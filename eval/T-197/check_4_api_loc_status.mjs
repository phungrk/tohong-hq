#!/usr/bin/env node
// T-197 tiêu chí 4 (repo tohong-back): GET /api/admin/vendor-enrich?status=<khoá> lọc đúng theo Status HIỂN THỊ, kết hợp AND với filter/category/q, chia trang đúng.
// Chạy từ gốc tohong-hq: node eval/T-197/check_4_api_loc_status.mjs   (TOHONG_BACK_REPO hoặc ../tohong-back). Worker thật + R2 giả; mạng bị chặn.
// Hợp đồng (spec products/T-197-loc-status-bang-enrich.md): `status` ∈ {all, 9 khoá nhóm, pending_capu, pending_apply, override}; thiếu, rỗng hoặc "all" = không lọc;
//   giá trị khác (kể cả sai hoa/thường, có khoảng trắng) -> 400 {"error":"invalid_status"}; nhiều `status` -> lấy cái đầu.
import { REVIEWS_KEY, ROWS, STATUS, GROUPS, CHIP, MemoryBucket, makeEnv, as, seed, pickSeeds, expected, shown, reporter, outbound, ADMIN, CAPU, fold } from "./lib/common.mjs";

const R = reporter();
const admin = as(ADMIN);
const bucket = new MemoryBucket();
const env = makeEnv(bucket);
const st = await seed(env, pickSeeds("small"));
const LIST = "/api/admin/vendor-enrich";
const all = async (qs, e = env) => { // đọc hết mọi trang (limit 100)
  const rows = []; let total = null, first = null;
  for (let off = 0; ; off += 100) {
    const r = await admin(e, "GET", `${LIST}?${qs}${qs ? "&" : ""}limit=100&offset=${off}`);
    if (r.status !== 200) return { status: r.status, json: r.json, rows };
    first ??= r.json; total = r.json.total; rows.push(...r.json.rows);
    if (r.json.rows.length === 0 || rows.length >= total) break;
  }
  return { status: 200, total, rows, first };
};
const base = await admin(env, "GET", LIST);
R.check("không có status: 200 và có đủ dữ liệu", base.status === 200 && base.json.total === ROWS.length, [base.status, base.json?.total]);

// 1. Từng giá trị: đúng tập hàng, đúng thứ tự báo cáo, total khớp, n liên tục
let sum = 0;
for (const [key, label] of STATUS) {
  const want = expected(st, { status: key });
  const a = await all(`status=${key}`);
  R.check(`status=${key} (${label}): 200, total ${want.length}`, a.status === 200 && a.total === want.length, [a.status, a.total, want.length]);
  if (a.status !== 200) continue;
  R.check(`status=${key}: đúng các hàng, đúng thứ tự báo cáo`, a.rows.length === want.length && a.rows.every((x, i) => x.id === want[i].id), a.rows.slice(0, 3).map((x) => x.id));
  R.check(`status=${key}: n = 1..total liên tục`, a.rows.every((x, i) => x.n === i + 1));
  R.check(`status=${key}: summary giống bản không lọc`, JSON.stringify(a.first.summary) === JSON.stringify(base.json.summary) && a.first.data_as_of === base.json.data_as_of);
  if (key !== "override") sum += a.total;
  if (key === "pending_capu") R.check("pending_capu: mọi hàng có review, by_capu khác true, không override", a.rows.every((x) => x.review && x.review.by_capu !== true && !x.override));
  if (key === "pending_apply") R.check("pending_apply: mọi hàng có review by_capu true, không override", a.rows.every((x) => x.review && x.review.by_capu === true && !x.override));
  if (GROUPS.includes(key)) R.check(`status=${key}: không hàng nào có review (hàng chờ không lọt vào nhóm)`, a.rows.every((x) => x.review === null && x.group === key));
}
R.check("9 nhóm + Chờ Capu + Chờ áp dụng chia toàn bộ danh sách (mỗi hàng đúng một ô, kể cả hàng override)", sum === ROWS.length, [sum, ROWS.length]);
const seededFull = ROWS.find((r) => r.group === "full" && st.has(r.id) && !r.override);
R.check("hàng nhóm Enrich 100% đang 'Chờ Capu': có ở status=pending_capu, KHÔNG có ở status=full", (await all("status=pending_capu")).rows.some((x) => x.id === seededFull.id) && !(await all("status=full")).rows.some((x) => x.id === seededFull.id));
const ov = ROWS.filter((r) => r.override);
R.check("báo cáo thật có hàng override để đo (nếu 0 thì ca override không đo được)", ov.length > 0, ov.length);
for (const o of ov) {
  R.check(`hàng override ${o.id} (${o.group}): có ở status=override VÀ ở status=${o.group}`, (await all("status=override")).rows.some((x) => x.id === o.id) && (await all(`status=${o.group}`)).rows.some((x) => x.id === o.id));
}

// 2. Review nằm sẵn ở kho cho hàng đã có override: override thắng, không thành "chờ"
if (ov.length) {
  const o = ov[0];
  const b2 = new MemoryBucket(); const e2 = makeEnv(b2);
  b2.data.set(REVIEWS_KEY, JSON.stringify({ vendors: { [o.id]: { state: "pending", decision: "manual", action: "remove", reason: "x", reviewed_by: ADMIN, reviewed_at: "2026-11-01T00:00:00.000Z", by_capu: false } } }));
  const p = await all("status=pending_capu", e2), g = await all(`status=${o.group}`, e2), v = await all("status=override", e2);
  R.check("review tồn đọng của hàng đã override: không ở pending_capu", p.status === 200 && p.total === 0, p.total);
  R.check("review tồn đọng của hàng đã override: vẫn ở nhóm của nó và ở override", g.rows.some((x) => x.id === o.id) && v.rows.some((x) => x.id === o.id));
}

// 3. 'Chờ áp dụng' theo đúng người đang là Capu: bỏ Capu khỏi danh sách thì review của họ thành 'Chờ Capu' (khớp chữ cột Status hôm nay)
{
  const e3 = makeEnv(bucket, { CAPU_USER_IDS: "nguoi_khac" });
  const ap = await all("status=pending_apply", e3), pc = await all("status=pending_capu", e3);
  const nCapu = [...st.values()].filter((x) => x.byCapu).length;
  R.check("khi người ký không còn là Capu: pending_apply rỗng", ap.status === 200 && ap.total === 0, ap.total);
  R.check("... và các review đó chuyển sang pending_capu (khớp chữ hiển thị)", pc.total === [...st.values()].length, [pc.total, nCapu]);
}

// 4. Giá trị lạ
for (const bad of ["Full", "FULL", "pending", "full ", " full", "Chờ Capu", "unknown", "full,override", "constructor", "__proto__", "0", "null", "full%00", "tên-hơi-giống"]) {
  const r = await admin(env, "GET", `${LIST}?status=${encodeURIComponent(bad)}`);
  R.check(`status=${JSON.stringify(bad)} -> 400 {"error":"invalid_status"}`, r.status === 400 && r.text === '{"error":"invalid_status"}', [r.status, r.text.slice(0, 60)]);
}
for (const neutral of ["", "all"]) {
  const r = await admin(env, "GET", `${LIST}?status=${neutral}`);
  R.check(`status=${JSON.stringify(neutral)}: giống từng byte bản không có status`, r.status === 200 && r.text === base.text, [r.status]);
}
{ const r = await admin(env, "GET", `${LIST}?status=name_similar&status=override&limit=100`); const w = expected(st, { status: "name_similar" });
  R.check("nhiều tham số status: lấy giá trị ĐẦU (name_similar)", r.status === 200 && r.json.total === w.length, [r.status, r.json?.total, w.length]); }
{ const r = await admin(env, "GET", `${LIST}?status=bogus&filter=bogus`);
  R.check("status lạ và filter lạ cùng lúc: vẫn 400 (filter báo trước, như hôm nay)", r.status === 400 && r.text === '{"error":"invalid_filter"}', r.text.slice(0, 60)); }

// 5. Kết hợp AND với chip, hạng mục, từ khoá, chia trang
const catWith = (rows) => { const c = {}; for (const r of rows) c[r.category] = (c[r.category] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0]; };
for (const [chip, key] of [["name_similar", "name_similar"], ["name_similar", "pending_capu"], ["full", "pending_capu"], ["full", "full"], ["addr_diff", "name_similar"], ["no_google_photo", "not_found"], ["addr_diff", "override"], ["full", "pending_apply"]]) {
  const want = expected(st, { chip, status: key });
  const a = await all(`filter=${chip}&status=${key}`);
  R.check(`filter=${chip} + status=${key}: giao đúng (${want.length} hàng)`, a.status === 200 && a.total === want.length && a.rows.every((x, i) => x.id === want[i].id), [a.status, a.total, want.length]);
}
{ const cat = catWith(expected(st, { status: "not_found" })); const want = expected(st, { status: "not_found", category: cat });
  const a = await all(`status=not_found&category=${cat}`);
  R.check(`status=not_found + category=${cat}: ${want.length} hàng`, a.total === want.length && a.rows.every((x, i) => x.id === want[i].id), [a.total, want.length]);
  const w = fold(want[0].name).split(/\s+/).find((x) => x.length >= 4) || fold(want[0].name).slice(0, 4);
  const wq = expected(st, { status: "not_found", category: cat, q: w }); const b = await all(`status=not_found&category=${cat}&q=${encodeURIComponent(w.toUpperCase())}`);
  R.check(`+ q=${w} (không dấu, không phân biệt hoa/thường): ${wq.length} hàng`, b.total === wq.length && b.rows.every((x, i) => x.id === wq[i].id), [b.total, wq.length]); }
{ const want = expected(st, { status: "not_found" });
  const p = await admin(env, "GET", `${LIST}?status=not_found&offset=50&limit=10`);
  R.check("status=not_found&offset=50&limit=10: 10 hàng, n từ 51, đúng hàng thứ 51 của danh sách lọc", p.status === 200 && p.json.rows.length === 10 && p.json.rows[0].n === 51 && p.json.rows[0].id === want[50].id && p.json.total === want.length, [p.json?.rows?.[0]?.n]);
  const far = await admin(env, "GET", `${LIST}?status=pending_capu&offset=500`);
  R.check("offset quá cuối: 200, rows rỗng, total vẫn đúng", far.status === 200 && far.json.rows.length === 0 && far.json.total === expected(st, { status: "pending_capu" }).length, [far.status, far.json?.total]);
  const none = await admin(env, "GET", `${LIST}?status=not_enriched`);
  R.check("status=not_enriched (không hàng nào): 200, total 0, rows rỗng", none.status === 200 && none.json.total === 0 && none.json.rows.length === 0, none.json?.total); }

// 6. Review mới ghi thì lọc thấy ngay (không bộ nhớ đệm cũ)
{ const tgt = ROWS.find((r) => r.group === "name_similar" && r.approvable && !r.override && !st.has(r.id));
  const before = (await all("status=name_similar")).total;
  const w = await admin(env, "PUT", `${LIST}/${tgt.id}/review`, { decision: "approve" });
  const afterG = await all("status=name_similar"), afterP = await all("status=pending_capu");
  R.check("sau Approve của admin: hàng rời name_similar và vào pending_capu", w.status === 200 && afterG.total === before - 1 && afterP.rows.some((x) => x.id === tgt.id), [w.status, before, afterG.total]);
  const d = await admin(env, "DELETE", `${LIST}/${tgt.id}/review`);
  const backG = await all("status=name_similar");
  R.check("sau Rút lại: hàng về name_similar, rời pending_capu", d.status === 200 && backG.total === before && !(await all("status=pending_capu")).rows.some((x) => x.id === tgt.id), [d.status, backG.total]); }
R.check("không gọi mạng ra ngoài", outbound.length === 0, outbound);
R.done();
