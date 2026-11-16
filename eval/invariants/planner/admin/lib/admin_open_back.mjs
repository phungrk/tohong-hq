// Bất biến planner/admin (nguồn: T-188 spec products/T-188-mo-admin-khong-dang-nhap.md v2, rút từ eval/T-188/check_back.mjs).
// Worker thật + R2 giả của chính repo tohong-back; mạng bị chặn; không ghi gì vào repo. Dùng: node admin_open_back.mjs --repo <tohong-back> --case A|B|C
//  A: ADMIN_OPEN khác đúng "1" (thiếu, "", "0", "true", "yes", "on", " 1", "1 ", "01"...) => mọi /api/admin/* của người không trong ADMIN_USER_IDS nhận 403 {"error":"forbidden"} giống hệt từng byte, không ghi R2.
//  B: danh tính cố định "admin-khong-dang-nhap" không bao giờ là Capu và không bao giờ có mục trong export ký, dù được liệt kê trong ADMIN_USER_IDS/CAPU_USER_IDS, dù cờ bật hay tắt.
//  C: ADMIN_OPEN=1 không đổi gì ở route ngoài /api/admin/* (mã + thân giống hệt cờ tắt) và không đổi quyền cặp đôi.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const BACK = arg("--repo") && path.resolve(arg("--repo"));
const CASE = arg("--case");
if (!BACK || !fs.existsSync(path.join(BACK, "worker.js"))) { console.log("FAIL thiếu --repo trỏ tới tohong-back"); process.exit(2); }
if (!["A", "B", "C"].includes(CASE)) { console.log("FAIL thiếu --case A|B|C"); process.exit(2); }

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


if (CASE === "A") {
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
  done();
}

if (CASE === "B") {
  const TOK = "inv-admin-open-may-xuat-thu";
  const { privateKey } = crypto.generateKeyPairSync("ed25519");
  const SIGN = { ENRICH_EXPORT_TOKEN: TOK, ENRICH_SIGNING_KEY: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"), ENRICH_SIGNING_KEY_ID: "kinv" };
  for (const flag of ["1", undefined]) for (const extra of [{}, { ADMIN_USER_IDS: ID + "," + REAL, CAPU_USER_IDS: ID }]) {
    const bucket = new MemoryBucket();
    const e = mkEnv(bucket, { ...SIGN, ...(flag === undefined ? {} : { ADMIN_OPEN: flag }), ...extra });
    const tag = `ADMIN_OPEN=${flag === undefined ? "thiếu" : flag} · ${Object.keys(extra).length ? "danh tính cố định nằm trong ADMIN_USER_IDS/CAPU_USER_IDS" : "cấu hình thường"}`;
    const rows = (await call(e, "GET", "/api/admin/vendor-enrich", { token: "dev:" + REAL })).json?.rows || [];
    const aprs = rows.filter((x) => x.approvable && !x.override);
    const done_ = [];
    for (const who of [undefined, "khong-phai-token", "dev:" + REAL]) {
      const r = aprs[done_.length];
      if (!r) break;
      const p = await call(e, "PUT", `/api/admin/vendor-enrich/${r.id}/review`, { token: who, body: { decision: "approve" } });
      done_.push(r.id);
      check(`${tag}: Approve (${who || "không token"}) không bao giờ ra by_capu=true`, p.json?.review?.by_capu !== true, [p.status, p.text.slice(0, 100)]);
    }
    const ex = await call(e, "GET", "/api/internal/vendor-enrich/export", { token: TOK });
    check(`${tag}: export ký 200`, ex.status === 200 && Array.isArray(ex.json?.entries), [ex.status, ex.text.slice(0, 80)]);
    check(`${tag}: export ký không có mục của danh tính cố định (không chuỗi "${ID}", không mục nào của các bản duyệt vừa làm)`, !ex.text.includes(ID) && !(ex.json?.entries || []).some((x) => done_.includes(x.vendor_id)), (ex.json?.entries || []).map((x) => x.vendor_id));
  }
  // đối chứng: Capu thật vẫn ký được khi cờ tắt (để phép đo không rỗng)
  const bk = new MemoryBucket();
  const eC = mkEnv(bk, { ...SIGN, ADMIN_USER_IDS: "user_capu_that", CAPU_USER_IDS: "user_capu_that" });
  const rows = (await call(eC, "GET", "/api/admin/vendor-enrich", { token: "dev:user_capu_that" })).json?.rows || [];
  const r0 = rows.find((x) => x.approvable && !x.override);
  const pc = r0 ? await call(eC, "PUT", `/api/admin/vendor-enrich/${r0.id}/review`, { token: "dev:user_capu_that", body: { decision: "approve" } }) : { status: 0, text: "" };
  const exc = await call(eC, "GET", "/api/internal/vendor-enrich/export", { token: TOK });
  check("đối chứng: Capu thật duyệt (cờ tắt) thì export có mục của họ", pc.status === 200 && (exc.json?.entries || []).some((x) => x.vendor_id === r0?.id && x.by_capu === true), [pc.status, (exc.json?.entries || []).map((x) => x.vendor_id)]);
  done();
}

if (CASE === "C") {
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
