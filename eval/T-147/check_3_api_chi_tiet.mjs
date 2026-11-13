#!/usr/bin/env node
// T-147 tiêu chí 3 (repo tohong-back): GET /api/admin/vendor-enrich/<id>/detail trả đủ dữ liệu cho drawer, chỉ đọc, không lộ liên hệ.
// Chạy: cd /home/user/tohong-back && node /home/user/tohong-hq/eval/T-147/check_3_api_chi_tiet.mjs   (hoặc qua check_3_api_chi_tiet.sh)
// Hợp đồng (spec products/T-147-drawer-vendor-enrich.md, Hành vi 2 và 3; sửa theo products/T-150-drawer-moi-admin-nhan-reviews.md). Người gọi ở đây là Capu; quyền của admin khác do check_4. Phản hồi 200, no-store, đúng các khoá:
//   data_as_of (= báo cáo), id, name,
//   catalog   = báo cáo.pool_catalog nguyên văn; extra_inputs = báo cáo.pool_extra_inputs nguyên văn ([] nếu báo cáo cũ không có),
//   source    = {available, record, audit, truncated}: bằng pool_input của dòng trong báo cáo; dòng không có pool_input -> {available:false, record:null, audit:null, truncated:{}} (vẫn 200),
//   pool      = {in_pool, visible, vendor, reasons:[{code,text}]}: vendor = đúng bản ghi trong vendorPool.generated.js (null nếu ngoài pool); visible = in_pool và chưa bị admin ẩn;
//               field_notes = [{field, code, text}]: chỗ giá trị pool KHÁC giá trị sinh từ nguồn (pool nền, ADR-025) hoặc do admin sửa; [] nếu ngoài pool. Với vendor trong pool có nguồn,
//               theo thứ tự trường name, category, city, description, rating, reviewCount, priceMin, priceMax, styles, reviews (reviews thêm ở T-150, ADR-083 mục 3), mỗi trường: (1) nếu nguồn cho giá trị khác pool -> `kept_from_base`
//               "giữ từ pool nền (ADR-025, --styles-only): nguồn hiện cho <giá trị nguồn>" (mảng nối ", "); nguồn không có giá (priceMin/priceMax) -> `price_default`
//               "nguồn không có giá: pool dùng giá mặc định theo hạng mục hoặc giữ từ pool nền"; (2) nếu lớp admin có priceMin/priceMax là số -> `admin_override` "admin sửa (R2): <số>".
//               Giá trị sinh từ nguồn: name; category = phần tử đầu của categories thuộc 10 hạng mục matcher; city (thiếu: HCMC); description cắt 220; rating/reviewCount của reviews[0] (thiếu: 0);
//               priceMin/priceMax = làm tròn 0,1 của min_vnd/max_vnd/1e6 khi > 0 (priceMax = priceMin nếu nhỏ hơn); styles = style_tags (thiếu: []).
//               reviews (T-150): N = số phần tử top_reviews có `text` (tối đa 5), M = số phần tử `reviews` của pool (thiếu = 0); N khác M -> `kept_from_base` "giữ từ pool nền (ADR-025, --styles-only): nguồn hiện có N bài đánh giá có chữ, pool có M".
//               reasons theo thứ tự, mã và chữ cố định:
//                 temp_closed         "Tạm đóng cửa: không vào pool"                                   (ngoài pool, nhóm temp_closed)
//                 removed             "Đã duyệt gỡ vendor: không vào pool"                             (ngoài pool, override.action = remove)
//                 not_generated       "Không có trong pool đang chạy: pool chưa được sinh lại sau lần enrich cuối"   (ngoài pool, không thuộc hai mã trên)
//                 overlay_hidden      "Admin đã ẩn vendor (lớp R2): cặp đôi không thấy"                (trong pool, lớp admin hidden=true)
//                 unverified          "Ảnh Google chưa qua kiểm khớp (T-104): vẫn đang chạy trong pool" (trong pool, nhóm unverified)
//                 stale_google_photos "Pool còn ảnh Google nhưng nguồn không còn place_id: sẽ bị hạ ở lần sinh lại" (trong pool, có ảnh nguồn google, google.matched không đúng)
//   overlay   = null nếu vendor không có ghi đè nào trong R2 data/admin/vendor_overrides.json; khác thì CHỈ các khoá hidden, hidden_reason, priceMin, priceMax, price_verified có trong ghi đè
//               (không contact, không updated_by/updated_at); đọc R2 mới nhất mỗi lần (không dùng cache 5 phút của đường chat).
// Cũng đo: id không có trong báo cáo 404 not_found, id sai dạng 400, POST/PUT/DELETE 405, chỉ đọc (R2 không có lần ghi nào, không đọc conversations/), không gọi mạng,
// dòng danh sách (GET /api/admin/vendor-enrich) KHÔNG mang pool_input hay catalog, liên hệ trong ghi đè không lọt ra phản hồi, route công khai không lộ nguồn.
import fs from "node:fs";
import path from "node:path";
import { BACK, ADMIN, CAPU, OVERLAY_KEY, load, embedded, copyBack, outbound, reporter } from "./lib/back147.mjs";

const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ khi chạy (hợp đồng chưa đúng?): " + String(e && e.message).slice(0, 200)); process.exit(1); });
const REP_FILE = path.join(BACK, "lib", "vendorEnrichReport.generated.js");
if (!fs.existsSync(REP_FILE)) { console.log("FAIL thiếu lib/vendorEnrichReport.generated.js ở tohong-back"); process.exit(1); }
const report = embedded(BACK, "vendorEnrichReport.generated.js", "VENDOR_ENRICH_REPORT");
const pool = embedded(BACK, "vendorPool.generated.js", "GENERATED_VENDOR_POOL");
const poolBy = new Map(pool.map((v) => [v.id, v]));
const B = await load(BACK);
const base = "/api/admin/vendor-enrich";
const TXT = {
  temp_closed: "Tạm đóng cửa: không vào pool",
  removed: "Đã duyệt gỡ vendor: không vào pool",
  not_generated: "Không có trong pool đang chạy: pool chưa được sinh lại sau lần enrich cuối",
  overlay_hidden: "Admin đã ẩn vendor (lớp R2): cặp đôi không thấy",
  unverified: "Ảnh Google chưa qua kiểm khớp (T-104): vẫn đang chạy trong pool",
  stale_google_photos: "Pool còn ảnh Google nhưng nguồn không còn place_id: sẽ bị hạ ở lần sinh lại",
};
const KEYS = ["catalog", "data_as_of", "extra_inputs", "id", "name", "overlay", "pool", "source"];
const ROW_KEYS = ["approvable", "catLabel", "category", "google", "group", "id", "marry", "n", "name", "override", "review"];
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sortKeys = (o) => Object.keys(o).sort();
const codes = (j) => (j?.pool?.reasons || []).map((r) => r.code);
const reasonsOk = (j, want) => eq(codes(j), want) && (j?.pool?.reasons || []).every((r) => r.text === TXT[r.code]);
const stale = (r) => poolBy.has(r.id) && (poolBy.get(r.id).photos || []).some((p) => p && p.source === "google") && !(r.google && r.google.matched);

/* ---------- dữ liệu thật ---------- */
{
  const bucket = new B.MemoryBucket();
  const env = B.makeEnv(bucket);
  const full = report.vendors.find((r) => r.group === "full" && poolBy.has(r.id) && !stale(r));
  const d = await B.asCapu(env, "GET", `${base}/${full.id}/detail`);
  R.check("Capu GET detail dòng Enrich 100% -> 200", d.status === 200 && d.json, [d.status, d.text.slice(0, 100)]);
  const j = d.json || {};
  R.check("đúng tập khoá của phản hồi", eq(sortKeys(j), KEYS), sortKeys(j));
  R.check("no-store", /no-store/.test(d.headers.get("cache-control") || ""), d.headers.get("cache-control"));
  R.check("data_as_of, id, name theo báo cáo", j.data_as_of === report.data_as_of && j.id === full.id && j.name === full.name, [j.data_as_of, j.id]);
  R.check("catalog = pool_catalog của báo cáo (nguồn duy nhất, back không tự liệt kê)", Array.isArray(report.pool_catalog) && report.pool_catalog.length > 0 && eq(j.catalog, report.pool_catalog), [j.catalog?.length]);
  R.check("extra_inputs = pool_extra_inputs của báo cáo (pool nền, manifest ảnh)", Array.isArray(report.pool_extra_inputs) && report.pool_extra_inputs.length === 2 && eq(j.extra_inputs, report.pool_extra_inputs), j.extra_inputs?.length);
  R.check("source = pool_input của dòng, available=true", full.pool_input && j.source && j.source.available === true && eq(j.source.record, full.pool_input.record) && eq(j.source.audit, full.pool_input.audit) && eq(j.source.truncated, full.pool_input.truncated), j.source && Object.keys(j.source));
  R.check("source.record có giá trị (không rỗng)", j.source?.record && Object.keys(j.source.record).length >= 3, Object.keys(j.source?.record || {}));
  R.check("pool.vendor đúng bản ghi trong vendorPool.generated.js, in_pool và visible", j.pool?.in_pool === true && j.pool.visible === true && eq(j.pool.vendor, poolBy.get(full.id)), j.pool && [j.pool.in_pool, j.pool.visible]);
  R.check("dòng sạch: không có lý do nào", reasonsOk(j, []), codes(j));
  R.check("overlay null khi R2 không có ghi đè", j.overlay === null, j.overlay);

  const closed = report.vendors.find((r) => r.group === "temp_closed" && !poolBy.has(r.id));
  if (closed) {
    const c = (await B.asCapu(env, "GET", `${base}/${closed.id}/detail`));
    R.check("vendor tạm đóng cửa (ngoài pool) vẫn xem được: 200, in_pool=false, visible=false, vendor=null", c.status === 200 && c.json?.pool?.in_pool === false && c.json.pool.visible === false && c.json.pool.vendor === null, [c.status, c.json?.pool?.in_pool]);
    R.check("lý do ngoài pool: temp_closed + đúng chữ", reasonsOk(c.json, ["temp_closed"]), codes(c.json));
    R.check("vendor ngoài pool vẫn có dữ liệu nguồn", c.json?.source?.available === true && eq(c.json.source.record, closed.pool_input?.record), c.json?.source && Object.keys(c.json.source));
  } else R.check("dữ liệu thật có vendor tạm đóng cửa ngoài pool để thử", false, "không có");
  const unv = report.vendors.find((r) => r.group === "unverified" && poolBy.has(r.id) && !stale(r));
  if (unv) { const u = await B.asCapu(env, "GET", `${base}/${unv.id}/detail`); R.check("nhóm unverified trong pool: lý do unverified đúng chữ", u.status === 200 && u.json.pool.in_pool && reasonsOk(u.json, ["unverified"]), codes(u.json)); }
  else R.check("dữ liệu thật có vendor unverified trong pool để thử", false, "không có");

  /* ---------- field_notes: so pool với giá trị sinh từ nguồn, mọi vendor có nguồn ---------- */
  const MATCH = new Set(["photography", "venue", "decor", "attire", "makeup", "ceremony", "jewelry", "transport", "stationery", "honeymoon"]);
  const r1 = (v) => Math.round((v / 1e6) * 10) / 10;
  const disp = (v) => (Array.isArray(v) ? v.join(", ") : String(v));
  const wantNotes = (rec, pv) => {
    const out = [];
    const rv = (rec.reviews || [])[0] || {};
    const pr = rec.price_range || {};
    let pmin = pr.min_vnd > 0 ? r1(pr.min_vnd) : undefined, pmax = pr.max_vnd > 0 ? r1(pr.max_vnd) : undefined;
    if (pmin !== undefined && pmax !== undefined && pmin > pmax) pmax = pmin;
    const src = { name: rec.name, category: (rec.categories || []).find((c) => MATCH.has(c)), city: rec.city || "HCMC", description: (rec.description ?? "").slice(0, 220),
      rating: rv.rating ?? 0, reviewCount: rv.count ?? 0, priceMin: pmin, priceMax: pmax, styles: rec.style_tags || [] };
    for (const f of ["name", "category", "city", "description", "rating", "reviewCount", "priceMin", "priceMax", "styles"]) {
      if (src[f] === undefined) { if (f.startsWith("price")) out.push({ field: f, code: "price_default", text: "nguồn không có giá: pool dùng giá mặc định theo hạng mục hoặc giữ từ pool nền" }); }
      else if (!eq(src[f], pv[f])) out.push({ field: f, code: "kept_from_base", text: `giữ từ pool nền (ADR-025, --styles-only): nguồn hiện cho ${disp(src[f])}` });
    }
    // T-150 (ADR-083 mục 3): trường `reviews` (đứng sau `styles`). Nguồn = số phần tử top_reviews có chữ, tối đa 5; pool = số phần tử `reviews` (thiếu = 0). Khác số lượng -> kept_from_base.
    const nSrc = (rec.top_reviews || []).filter((x) => x && x.text).slice(0, 5).length, nPool = (pv.reviews || []).length;
    if (nSrc !== nPool) out.push({ field: "reviews", code: "kept_from_base", text: `giữ từ pool nền (ADR-025, --styles-only): nguồn hiện có ${nSrc} bài đánh giá có chữ, pool có ${nPool}` });
    return out;
  };
  let nBase = 0, nChecked = 0, badNote = null, nRevSrc = 0, nRevPool = 0;
  for (const r of report.vendors) {
    if (!r.pool_input || !poolBy.has(r.id)) continue;
    const dd = await B.asCapu(env, "GET", `${base}/${r.id}/detail`);
    nChecked++;
    const want = wantNotes(r.pool_input.record, poolBy.get(r.id));
    nBase += want.filter((x) => x.code === "kept_from_base").length;
    const rn = want.find((x) => x.field === "reviews");
    if (rn) { if (/nguồn hiện có 0 /.test(rn.text)) nRevPool++; else nRevSrc++; }
    if (!eq(dd.json?.pool?.field_notes, want) && !badNote) badNote = [r.id, JSON.stringify(dd.json?.pool?.field_notes).slice(0, 120), JSON.stringify(want).slice(0, 120)];
  }
  R.check(`field_notes đúng cho mọi vendor trong pool có nguồn (${nChecked} vendor)`, nChecked > 100 && !badNote, badNote);
  R.check("dữ liệu thật có vendor mà pool nền lệch nguồn (kept_from_base) để thử", nBase > 0, nBase);
  R.check("dữ liệu thật có cả hai kiểu lệch reviews (nguồn có chữ mà pool không; pool có mà nguồn không) để thử", nRevSrc > 0 && nRevPool > 0, [nRevSrc, nRevPool]);
  /* ---------- lớp admin R2 ---------- */
  const secret = { phone: "0900147147", website: "https://t147-contact.invalid" };
  const ov = { hidden: true, hidden_reason: "Ẩn thử T-147", priceMin: 11.5, priceMax: 22.5, price_verified: true, contact: secret, updated_by: "user_x", updated_at: "2026-11-13T00:00:00Z" };
  bucket.data.set(OVERLAY_KEY, JSON.stringify({ seq: 1, vendors: { [full.id]: ov } }));
  const h = await B.asCapu(env, "GET", `${base}/${full.id}/detail`);
  R.check("lớp admin có priceMin/priceMax: field_notes có admin_override cho cả hai, đúng chữ", ["priceMin", "priceMax"].every((f, i) => (h.json?.pool?.field_notes || []).some((x) => x.field === f && x.code === "admin_override" && x.text === `admin sửa (R2): ${[11.5, 22.5][i]}`)), h.json?.pool?.field_notes?.filter((x) => x.code === "admin_override"));
  R.check("overlay đúng 5 khoá hidden/hidden_reason/priceMin/priceMax/price_verified, không contact/updated_by", h.json && eq(h.json.overlay, { hidden: true, hidden_reason: "Ẩn thử T-147", priceMin: 11.5, priceMax: 22.5, price_verified: true }), h.json?.overlay);
  R.check("vendor bị admin ẩn: visible=false, in_pool=true, lý do overlay_hidden", h.json?.pool?.in_pool === true && h.json.pool.visible === false && reasonsOk(h.json, ["overlay_hidden"]), [h.json?.pool?.visible, codes(h.json)]);
  R.check("liên hệ trong ghi đè không lọt ra phản hồi", !h.text.includes(secret.phone) && !h.text.includes("t147-contact"), "lộ");
  bucket.data.set(OVERLAY_KEY, JSON.stringify({ seq: 2, vendors: { [full.id]: { hidden: false, priceMin: 1 } } }));
  const h2 = await B.asCapu(env, "GET", `${base}/${full.id}/detail`);
  R.check("đọc R2 mới nhất mỗi lần (không kẹt cache 5 phút): hidden=false, priceMin=1", h2.json && eq(h2.json.overlay, { hidden: false, priceMin: 1 }) && h2.json.pool.visible === true, h2.json?.overlay);
  bucket.data.set(OVERLAY_KEY, JSON.stringify({ seq: 3, vendors: { [full.id]: { contact: secret } } }));
  const h3 = await B.asCapu(env, "GET", `${base}/${full.id}/detail`);
  R.check("ghi đè chỉ có contact: overlay null (không lộ gì)", h3.json?.overlay === null && !h3.text.includes(secret.phone), h3.json?.overlay);
  bucket.data.delete(OVERLAY_KEY);

  /* ---------- lỗi, phương thức, chỉ đọc ---------- */
  const nf = await B.asCapu(env, "GET", `${base}/marry_khong_co_that/detail`);
  R.check("id không có trong báo cáo: 404 not_found", nf.status === 404 && nf.json?.error === "not_found", [nf.status, nf.text.slice(0, 60)]);
  const bad = await B.asCapu(env, "GET", `${base}/${encodeURIComponent("../x y")}/detail`);
  R.check("id sai dạng: 400", bad.status === 400, bad.status);
  for (const m of ["POST", "PUT", "DELETE", "PATCH"]) {
    const r = await B.asCapu(env, m, `${base}/${full.id}/detail`, m === "DELETE" ? undefined : {});
    R.check(`${m} detail: 405`, r.status === 405, r.status);
  }
  R.check("chỉ đọc: R2 không có lần ghi nào", bucket.putLog.length === 0, bucket.putLog);
  R.check("không đọc conversations/", !bucket.reads.some((k) => /^conversations\//.test(k)), bucket.reads.filter((k) => /^conversations\//.test(k)).slice(0, 2));

  /* ---------- danh sách không phình ---------- */
  const l = await B.asCapu(env, "GET", `${base}?limit=100`);
  R.check("danh sách vẫn 200 và dòng không mang pool_input", l.status === 200 && l.json.rows.length > 0 && l.json.rows.every((r) => !("pool_input" in r)) && !l.text.includes('"pool_input"'), [l.status]);
  R.check("dòng danh sách có đúng tập khoá cho phép (id,name,category,group,marry,google,approvable,override + n,catLabel,review)", l.json.rows.every((r) => eq(sortKeys(r), ROW_KEYS)), sortKeys(l.json.rows[0] || {}));
  R.check("danh sách không mang catalog/pool_catalog", !("catalog" in l.json) && !("pool_catalog" in l.json) && !l.text.includes('"pool_catalog"'), Object.keys(l.json || {}));

  /* ---------- route công khai không lộ nguồn ---------- */
  const st = await B.call(env, "POST", "/api/vendors/status", { token: "dev:user_other", body: { ids: [full.id, closed?.id].filter(Boolean) } });
  const pub = st.text;
  R.check("route công khai /api/vendors/status không có pool_input, catalog, audit, merchant_description", !/pool_input|pool_catalog|closed_state|merchant_description|enrichment_log/.test(pub), pub.slice(0, 80));
}

/* ---------- kịch bản tổng hợp (bản sao tạm của back, báo cáo + pool sửa) ---------- */
{
  const norm = report.vendors.filter((r) => r.group === "name_similar" && !r.override && poolBy.has(r.id));
  const rm = norm[0], gone = norm[1], noSrc = norm[2];
  const stl = report.vendors.find((r) => poolBy.has(r.id) && r.group !== "full" && !(r.google && r.google.matched) && r.group !== "unverified" && r.id !== rm.id && r.id !== gone.id && r.id !== noSrc.id);
  const dir = copyBack((d) => {
    const rf = path.join(d, "lib", "vendorEnrichReport.generated.js");
    const rep = embedded(d, "vendorEnrichReport.generated.js", "VENDOR_ENRICH_REPORT");
    for (const r of rep.vendors) {
      if (r.id === rm.id) r.override = { action: "remove", approved_on: "2026-11-12" };
      if (r.id === noSrc.id) delete r.pool_input;
      if (r.id === stl.id) { r.zz_khoa_tuong_lai = "bi-mat-t147"; r.pool_input = r.pool_input || { record: {}, audit: null, truncated: {} }; }
    }
    fs.writeFileSync(rf, "// AUTO-GENERATED — do not edit manually.\nexport const VENDOR_ENRICH_REPORT = " + JSON.stringify(rep) + ";\n");
    const pf = path.join(d, "lib", "vendorPool.generated.js");
    const t = fs.readFileSync(pf, "utf8");
    const i = t.indexOf("= [") + 2, j = t.lastIndexOf("]") + 1;
    let arr = JSON.parse(t.slice(i, j));
    arr = arr.filter((v) => v.id !== rm.id && v.id !== gone.id);
    for (const v of arr) if (v.id === stl.id) v.photos = [{ url: "https://lh3.googleusercontent.com/t147", source: "google", attribution: "Google Maps" }];
    fs.writeFileSync(pf, t.slice(0, i) + JSON.stringify(arr) + t.slice(j));
  });
  try {
    const S = await load(dir);
    const env = S.makeEnv(new S.MemoryBucket());
    const a = await S.asCapu(env, "GET", `${base}/${rm.id}/detail`);
    R.check("[tổng hợp] ngoài pool + override remove: lý do removed", a.status === 200 && a.json.pool.in_pool === false && reasonsOk(a.json, ["removed"]), [a.status, codes(a.json)]);
    const g = await S.asCapu(env, "GET", `${base}/${gone.id}/detail`);
    R.check("[tổng hợp] ngoài pool không rõ lý do: not_generated", g.status === 200 && g.json.pool.in_pool === false && reasonsOk(g.json, ["not_generated"]), [g.status, codes(g.json)]);
    const n = await S.asCapu(env, "GET", `${base}/${noSrc.id}/detail`);
    R.check("[tổng hợp] dòng báo cáo thiếu pool_input: 200, source.available=false, record=null, truncated={}, pool vẫn có", n.status === 200 && eq(n.json.source, { available: false, record: null, audit: null, truncated: {} }) && n.json.pool.in_pool === true, [n.status, n.json?.source]);
    const s = await S.asCapu(env, "GET", `${base}/${stl.id}/detail`);
    const ll = await S.asCapu(env, "GET", `${base}?limit=100&q=${encodeURIComponent(stl.name)}`);
    R.check("[tổng hợp] khoá lạ thêm vào báo cáo (kể cả pool_input) không lọt ra danh sách (danh sách dùng whitelist, không ...r)", ll.status === 200 && ll.json.rows.some((r) => r.id === stl.id) && !ll.text.includes("bi-mat-t147") && !ll.text.includes("zz_khoa_tuong_lai") && !ll.text.includes("pool_input"), [ll.status, ll.text.slice(0, 60)]);
    R.check("[tổng hợp] pool còn ảnh Google mà nguồn không còn khớp: stale_google_photos", s.status === 200 && codes(s.json).includes("stale_google_photos") && s.json.pool.reasons.find((x) => x.code === "stale_google_photos").text === TXT.stale_google_photos, [s.status, codes(s.json)]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
R.check("không gọi mạng ra ngoài", outbound.length === 0, outbound);
R.done();
