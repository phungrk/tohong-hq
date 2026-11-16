#!/usr/bin/env node
// T-188 (tohong-back): eval hành vi cho cờ ADMIN_OPEN. Worker thật + R2 giả của chính repo (test/helpers/memoryBucket.js); mạng bị chặn;
// không đặt biến thật, không ghi gì vào repo. Dùng: node check_back.mjs --repo <tohong-back> --case 1|2|3|4   (in dòng cuối PASS hoặc FAIL <lý do>; thoát 0/1, 2 = không chạy được)
//  case 1 (tiêu chí 1): cờ bật = đúng chuỗi "1": mọi GET/POST đọc của /api/admin/* chạy KHÔNG token / token rác / token guest / token của chính một admin thật -> 200 (không 401/403);
//         GET /api/admin/me trả admin:true và user_id đúng "admin-khong-dang-nhap" trong mọi trường hợp trên (kể cả khi ADMIN_USER_IDS thiếu, rỗng hay chứa người khác).
//  case 2 (tiêu chí 2): cờ bật, mọi thao tác GHI admin (sửa/xoá lớp sửa vendor, duyệt/rút duyệt enrich, đổi trạng thái yêu cầu kết nối, từ chối yêu cầu nâng cấp) thành công không token;
//         mọi dòng nhật ký GET /api/admin/audit sinh ra có admin_id đúng "admin-khong-dang-nhap" (không có giá trị nào khác, không rỗng); lịch sử lớp sửa vendor (GET /api/admin/vendors/<id>.history) ghi người sửa đúng danh tính đó;
//         bản duyệt enrich mang reviewed_by đúng danh tính đó và by_capu=false, KỂ CẢ khi ADMIN_USER_IDS và CAPU_USER_IDS đều liệt kê chính chuỗi đó (danh tính cố định không bao giờ là Capu).
//  case 3 (tiêu chí 3): cờ tắt = thiếu, "", "0", "true", "yes", "on", " 1", "1 ", "01": mọi route /api/admin/* (kể cả đường không tồn tại) không token/token rác/guest/người không trong ADMIN_USER_IDS -> 403 thân đúng {"error":"forbidden"},
//         không ghi R2; phản hồi (mã + thân) giống HỆT từng byte giữa "thiếu cờ" và mỗi giá trị khác "1"; admin thật (trong ADMIN_USER_IDS) vẫn thấy user_id của chính họ ở /me, không phải danh tính cố định;
//         cấu hình nằm trong repo (wrangler*.toml, .dev.vars*, .env*) không bật cờ (không có dòng ADMIN_OPEN nào có giá trị "1").
//  case 4 (tiêu chí 4): cờ bật: mọi route ngoài /api/admin/* (couples, vendors, claim, internal/vendor-enrich/export, đường lạ, "/api/administrator", "/api/adminx/me") trả mã + thân GIỐNG HỆT cờ tắt cho cùng request không token / token rác / guest;
//         và đường /api/admin chỉ khớp đúng tiền tố "/api/admin" hoặc "/api/admin/" (không mở "/api/administrator"); người ngoài vẫn không đọc được dữ liệu cặp đôi.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const BACK = arg("--repo") && path.resolve(arg("--repo"));
const CASE = arg("--case");
if (!BACK || !fs.existsSync(path.join(BACK, "worker.js"))) { console.log("FAIL thiếu --repo trỏ tới tohong-back"); process.exit(2); }
if (!["1", "2", "3", "4"].includes(CASE)) { console.log("FAIL thiếu --case 1|2|3|4"); process.exit(2); }

const ID = "admin-khong-dang-nhap";
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ khi chạy (hành vi chưa đúng?): " + String(e && e.message).slice(0, 160)); process.exit(1); });
const outbound = [];
globalThis.fetch = async (u) => { outbound.push(String(u?.url || u)); throw new Error("mạng bị chặn"); };
const imp = (rel) => import(pathToFileURL(path.join(BACK, rel)).href);
const { default: worker } = await imp("worker.js");
const { MemoryBucket } = await imp("test/helpers/memoryBucket.js");
const { appendAudit, createConnectRequest } = await imp("lib/adminStore.js");

const fails = [];
const check = (n, ok, x) => {
  console.log(`${ok ? "  ok " : "  XX "} ${n}${!ok && x !== undefined ? "  :: " + String(typeof x === "string" ? x : JSON.stringify(x)).slice(0, 220) : ""}`);
  if (!ok) fails.push(n + (x === undefined ? "" : " [" + String(typeof x === "string" ? x : JSON.stringify(x)).slice(0, 140) + "]"));
};
const done = () => {
  check("không gọi mạng ra ngoài", outbound.length === 0, outbound);
  if (fails.length) { console.log("FAIL " + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : "")); process.exit(1); }
  console.log("PASS"); process.exit(0);
};

async function call(env, method, p, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = "Bearer " + token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const pend = [];
  const res = await worker.fetch(new Request("http://localhost" + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil: (x) => pend.push(x) });
  const text = await res.text();
  await Promise.allSettled(pend);
  let json = null; try { json = JSON.parse(text); } catch { /* không phải JSON */ }
  return { status: res.status, json, text };
}
const REAL = "user_that_admin";
const mkEnv = (bucket, extra = {}, drop = []) => { const e = { CHAT_DATA: bucket, DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: REAL, ...extra }; for (const k of drop) delete e[k]; return e; };
const WHO = [["không token", undefined], ["token rác", "khong-phai-token"], ["token guest", "guest_abc123"], ["token admin thật", "dev:" + REAL], ["token người thường", "dev:user_thuong"]];
const READS = [["GET", "/api/admin/me"], ["GET", "/api/admin/members-summary"], ["POST", "/api/admin/members-list", { page: 1, size: 20, q: "" }], ["GET", "/api/admin/audit"],
  ["GET", "/api/admin/connect-requests?status=open"], ["GET", "/api/admin/upgrade-requests?status=pending"], ["GET", "/api/admin/legacy-subscriptions"],
  ["GET", "/api/admin/vendors"], ["GET", "/api/admin/vendor-enrich"], ["GET", "/api/admin/vendor-enrich/export"]];

async function firstEnrichId(env) {
  const r = await call(env, "GET", "/api/admin/vendor-enrich");
  const row = (r.json?.rows || []).find((x) => !x.override);
  return row?.id;
}

if (CASE === "1") {
  const flagOn = ["1"];
  for (const val of flagOn) for (const adminCfg of [{ ADMIN_USER_IDS: REAL }, { ADMIN_USER_IDS: "" }, { ADMIN_USER_IDS: "user_khac" }, {}]) {
    const bucket = new MemoryBucket();
    const e = mkEnv(bucket, { ADMIN_OPEN: val, ...adminCfg }, "ADMIN_USER_IDS" in adminCfg ? [] : ["ADMIN_USER_IDS"]);
    const cfg = JSON.stringify(adminCfg);
    for (const [wn, token] of WHO) {
      for (const [m, p, body] of READS) {
        const r = await call(e, m, p, { token, body });
        check(`cờ bật · ${cfg} · ${wn} · ${m} ${p.split("?")[0]} -> không bị chặn`, ![401, 403].includes(r.status) && r.json?.error !== "forbidden" && (p.includes("/export") || r.status < 400), [r.status, r.text.slice(0, 80)]);
      }
      const me = await call(e, "GET", "/api/admin/me", { token });
      check(`cờ bật · ${cfg} · ${wn} · /me: admin:true, user_id = danh tính cố định`, me.status === 200 && me.json?.admin === true && me.json?.user_id === ID, me.text.slice(0, 120));
    }
  }
  // đường không tồn tại dưới /api/admin vẫn 404 (không phải 403, không phải 200)
  const e2 = mkEnv(new MemoryBucket(), { ADMIN_OPEN: "1" });
  const nf = await call(e2, "GET", "/api/admin/khong-co-route-nay");
  check("cờ bật · đường lạ dưới /api/admin không 403 (bình thường, không mở thêm gì)", nf.status !== 403 && nf.status !== 200, [nf.status, nf.text.slice(0, 80)]);
  done();
}

if (CASE === "2") {
  for (const extra of [{}, { ADMIN_USER_IDS: ID + "," + REAL, CAPU_USER_IDS: ID }]) {
    const bucket = new MemoryBucket();
    const e = mkEnv(bucket, { ADMIN_OPEN: "1", ...extra });
    const tag = Object.keys(extra).length ? "ADMIN_USER_IDS/CAPU_USER_IDS có chính danh tính cố định" : "cấu hình thường";
    // 1) vendor override PUT/DELETE
    const list = await call(e, "GET", "/api/admin/vendors");
    const vid = list.json?.vendors?.[0]?.id;
    check(`[${tag}] có vendor để sửa`, !!vid, list.text.slice(0, 100));
    const vd = await call(e, "GET", `/api/admin/vendors/${vid}`);
    const put = await call(e, "PUT", `/api/admin/vendors/${vid}/override`, { body: { expected_version: vd.json?.version || 0, name: "Ten sua T188 ZZ" } });
    check(`[${tag}] PUT override không token -> 200`, put.status === 200, [put.status, put.text.slice(0, 100)]);
    const vd2 = await call(e, "GET", `/api/admin/vendors/${vid}`);
    const hist = vd2.json?.history || [];
    check(`[${tag}] lịch sử lớp sửa vendor: có bản ghi mới và người sửa chỉ là danh tính cố định`, hist.length >= 1 && JSON.stringify(hist).includes(ID) && !JSON.stringify(hist).includes(REAL) && !JSON.stringify(hist).includes("guest_"), JSON.stringify(hist).slice(0, 200));
    check(`[${tag}] lớp sửa lưu người sửa là danh tính cố định`, JSON.stringify(vd2.json?.override || {}).includes(ID) || hist.some((h) => JSON.stringify(h).includes(ID)), JSON.stringify(vd2.json?.override).slice(0, 160));
    const del = await call(e, "DELETE", `/api/admin/vendors/${vid}/override`, { body: { expected_version: vd2.json?.version } });
    check(`[${tag}] DELETE override không token -> 200`, del.status === 200, [del.status, del.text.slice(0, 100)]);
    // 2) enrich review PUT/DELETE
    const eid = await firstEnrichId(e);
    check(`[${tag}] có dòng enrich để duyệt`, !!eid);
    const rv = await call(e, "PUT", `/api/admin/vendor-enrich/${eid}/review`, { body: { decision: "manual", action: "remove", note: "T188 thu" } });
    check(`[${tag}] PUT review enrich không token -> 200`, rv.status === 200, [rv.status, rv.text.slice(0, 100)]);
    const det = await call(e, "GET", `/api/admin/vendor-enrich/${eid}/detail`);
    const review = det.json?.review || rv.json?.review;
    check(`[${tag}] bản duyệt: reviewed_by = danh tính cố định, by_capu = false`, review?.reviewed_by === ID && review?.by_capu !== true, JSON.stringify(review).slice(0, 200));
    const wd = await call(e, "DELETE", `/api/admin/vendor-enrich/${eid}/review`);
    check(`[${tag}] DELETE review enrich không token -> 200`, wd.status === 200, [wd.status, wd.text.slice(0, 100)]);
    // 3) yêu cầu kết nối
    const vend = { id: vid, name: "V", category: "venue", catLabel: "Tiệc" };
    await createConnectRequest(e, { coupleId: "couple_20261001_aaaaaa", userId: "user_owner", vendor: vend, source: "chat", contact: { phone: "0912345678" }, note: "", clientRequestId: "crid_t188" });
    const crList = await call(e, "GET", "/api/admin/connect-requests?status=open");
    const crId = crList.json?.requests?.[0]?.id;
    check(`[${tag}] có yêu cầu kết nối để đổi trạng thái`, !!crId, crList.text.slice(0, 120));
    const patch = await call(e, "PATCH", `/api/admin/connect-requests/${crId}`, { body: { to: "contacted_vendor", note: "" } });
    check(`[${tag}] PATCH yêu cầu kết nối không token -> 200`, patch.status === 200, [patch.status, patch.text.slice(0, 100)]);
    // 4) nâng cấp
    bucket.seedJson("data/couples/couple_up1/members.json", [{ user_id: "user_owner", role: "owner" }]);
    bucket.seedJson("data/admin/upgrade/couple_up1.json", { couple_id: "couple_up1", created_by: "user_owner", plan: "m3", price_k: 249, status: "pending", contact: null, admin_note: "", created_at: new Date().toISOString() });
    const rj = await call(e, "POST", "/api/admin/upgrade-requests/couple_up1/reject", { body: { note: "T188 thu" } });
    check(`[${tag}] từ chối yêu cầu nâng cấp không token -> 200`, rj.status === 200, [rj.status, rj.text.slice(0, 100)]);
    // 5) nhật ký
    const au = await call(e, "GET", "/api/admin/audit?limit=200");
    const ents = au.json?.entries || [];
    check(`[${tag}] nhật ký có đủ các thao tác vừa làm (>= 6 dòng)`, ents.length >= 6, ents.map((x) => x.action));
    check(`[${tag}] MỌI dòng nhật ký có admin_id đúng "${ID}"`, ents.length > 0 && ents.every((x) => x.admin_id === ID), ents.map((x) => x.admin_id));
    check(`[${tag}] nhật ký không chứa mã admin thật / guest`, !au.text.includes(REAL) && !au.text.includes("guest_"));
  }
  done();
}

if (CASE === "3") {
  const OFF = [undefined, "", "0", "true", "yes", "on", " 1", "1 ", "01", "TRUE", "false"];
  const ROUTES = [...READS, ["PUT", "/api/admin/vendors/x/override", { expected_version: 0, name: "ZZ" }], ["DELETE", "/api/admin/vendors/x/override"], ["PUT", "/api/admin/vendor-enrich/x/review", { decision: "approve" }],
    ["PATCH", "/api/admin/connect-requests/cr_x", { to: "closed" }], ["POST", "/api/admin/upgrade-requests/couple_x/reject", { note: "n" }], ["GET", "/api/admin/khong-co-route-nay"], ["GET", "/api/admin"]];
  const snap = async (val, who) => {
    const bucket = new MemoryBucket();
    const e = mkEnv(bucket, val === undefined ? {} : { ADMIN_OPEN: val });
    const out = [];
    for (const [m, p, body] of ROUTES) { const r = await call(e, m, p, { token: who, body }); out.push([m, p, r.status, r.text]); }
    return { out, puts: bucket.putLog.length };
  };
  for (const [wn, token] of WHO.filter(([n]) => n !== "token admin thật")) {
    const base = await snap(undefined, token);
    check(`cờ thiếu · ${wn}: mọi route /api/admin/* -> 403 {"error":"forbidden"}`, base.out.every(([, , s, t]) => s === 403 && t === '{"error":"forbidden"}'), base.out.filter(([, , s]) => s !== 403).map((x) => x.slice(0, 3)));
    check(`cờ thiếu · ${wn}: không ghi R2`, base.puts === 0, base.puts);
    for (const val of OFF.slice(1)) {
      const s = await snap(val, token);
      check(`ADMIN_OPEN=${JSON.stringify(val)} · ${wn}: giống hệt từng byte với cờ thiếu (đều 403)`, JSON.stringify(s.out) === JSON.stringify(base.out) && s.puts === 0, s.out.filter(([, , st]) => st !== 403).map((x) => x.slice(0, 3)));
    }
  }
  // admin thật vẫn là chính họ khi cờ tắt
  for (const val of OFF) {
    const e = mkEnv(new MemoryBucket(), val === undefined ? {} : { ADMIN_OPEN: val });
    const me = await call(e, "GET", "/api/admin/me", { token: "dev:" + REAL });
    check(`ADMIN_OPEN=${JSON.stringify(val)} · admin thật: /me 200 và user_id là của chính họ`, me.status === 200 && me.json?.user_id === REAL, me.text.slice(0, 100));
  }
  // cấu hình trong repo không bật cờ
  const hits = [];
  for (const f of fs.readdirSync(BACK)) {
    if (!/^(wrangler.*\.toml|\.dev\.vars.*|\.env.*)$/.test(f)) continue;
    const t = fs.readFileSync(path.join(BACK, f), "utf8");
    for (const line of t.split("\n")) {
      const m = /^\s*ADMIN_OPEN\s*[=:]\s*(.*)$/.exec(line);
      if (m && m[1].replace(/#.*/, "").trim().replace(/^["']|["']$/g, "") === "1") hits.push(f + ": " + line.trim());
    }
  }
  check("cấu hình trong repo back (wrangler*.toml, .dev.vars*, .env*) không bật ADMIN_OPEN", hits.length === 0, hits);
  done();
}

if (CASE === "4") {
  const OUT = [["GET", "/api/couples/couple_20261001_aaaaaa"], ["GET", "/api/couples/couple_20261001_aaaaaa/guests"], ["POST", "/api/couples/couple_20261001_aaaaaa/guests", { name: "x" }], ["GET", "/api/vendors"], ["GET", "/api/vendors/abc"],
    ["POST", "/api/claim", { guestToken: "guest_x" }], ["GET", "/api/internal/vendor-enrich/export"], ["POST", "/api/internal/vendor-enrich/export", {}], ["GET", "/api/khong-co"], ["GET", "/api/administrator"], ["GET", "/api/administrator/me"], ["GET", "/api/adminx/me"],
    ["GET", "/api/admin-members"], ["GET", "/admin/me"], ["GET", "/api/couples/couple_20261001_aaaaaa/admin/me"]];
  const run = async (flag, token) => {
    const bucket = new MemoryBucket();
    bucket.seedJson("data/couples/couple_20261001_aaaaaa/members.json", [{ user_id: "user_owner", role: "owner" }]);
    const e = mkEnv(bucket, flag ? { ADMIN_OPEN: "1" } : {});
    const out = [];
    for (const [m, p, body] of OUT) { const r = await call(e, m, p, { token, body }); out.push([m, p, r.status, r.text]); }
    return { out, puts: bucket.putLog.length };
  };
  for (const [wn, token] of WHO) {
    const off = await run(false, token);
    const on = await run(true, token);
    const diff = on.out.map((x, i) => (JSON.stringify(x) === JSON.stringify(off.out[i]) ? null : `${x[0]} ${x[1]} on=${x[2]} off=${off.out[i][2]}`)).filter(Boolean);
    check(`${wn}: mọi route ngoài /api/admin/* trả giống hệt (mã + thân) khi bật và khi tắt cờ`, diff.length === 0, diff);
    check(`${wn}: cờ bật không ghi thêm R2 qua route ngoài /api/admin/*`, on.puts === off.puts, [on.puts, off.puts]);
    if (token !== "dev:user_owner") {
      const leak = on.out.filter(([m, p, s]) => s < 400 && /^\/api\/couples\//.test(p) && m === "GET");
      check(`${wn}: cờ bật, người ngoài không đọc được dữ liệu cặp đôi`, leak.length === 0, leak.map((x) => x.slice(0, 3)));
    }
  }
  const e = mkEnv(new MemoryBucket(), { ADMIN_OPEN: "1" });
  for (const p of ["/api/administrator", "/api/administrator/me", "/api/adminx/me", "/api/admin-members"]) {
    const r = await call(e, "GET", p);
    check(`cờ bật: ${p} không bị coi là trang admin (không trả user_id/admin:true)`, r.json?.admin !== true && !r.text.includes(ID), [r.status, r.text.slice(0, 80)]);
  }
  done();
}
