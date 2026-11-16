#!/usr/bin/env node
// T-190 adv-01 (tầng 3, back). Worker thật + R2 giả của repo; mạng bị chặn; không đặt biến thật.
// Dùng: node eval/T-190/adv-01.mjs --repo <tohong-back>  (dòng cuối PASS/FAIL; thoát 0/1/2)
//  (a) ADMIN_OPEN KHÔNG phải chuỗi (Cloudflare var kiểu JSON / wrangler `ADMIN_OPEN = 1` / true): số 1, true, ["1"], {"1":1}, "1\n", "١", "１"
//      -> tắt: mọi /api/admin/* không token/rác/guest/người thường trả 403 {"error":"forbidden"} giống hệt cờ thiếu, không ghi R2.
//  (b) Capu thật đã ký (cờ tắt), rồi cờ bật: danh tính cố định không ghi đè (PUT review) và không rút (DELETE review) được bản duyệt của Capu -> 409;
//      export ký vẫn còn đúng mục của Capu, by_capu=true; không chuỗi danh tính cố định nào trong export.
//  (c) Biến thể đường dẫn với cờ bật (/API/admin/me, /api//admin/me, /api/admin%2Fme, /api/admin/../couples, /api/couples/../admin/me đã chuẩn hoá):
//      cái nào không thuộc /api/admin/* thì mã + thân giống hệt cờ tắt.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const args = process.argv.slice(2);
const BACK = path.resolve(args[args.indexOf("--repo") + 1] || process.env.TOHONG_BACK_REPO || "/home/user/tohong-back");
if (!fs.existsSync(path.join(BACK, "worker.js"))) { console.log("FAIL thiếu --repo"); process.exit(2); }
const ID = "admin-khong-dang-nhap";
const outbound = [];
globalThis.fetch = async (u) => { outbound.push(String(u?.url || u)); throw new Error("mạng bị chặn"); };
const imp = (rel) => import(pathToFileURL(path.join(BACK, rel)).href);
const { default: worker } = await imp("worker.js");
const { MemoryBucket } = await imp("test/helpers/memoryBucket.js");
const fails = [];
const check = (n, ok, x) => { console.log(`${ok ? "  ok " : "  XX "} ${n}${!ok && x !== undefined ? "  :: " + JSON.stringify(x).slice(0, 220) : ""}`); if (!ok) fails.push(n); };
async function call(env, method, p, { token, body } = {}) {
  const headers = {}; if (token) headers.Authorization = "Bearer " + token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const pend = [];
  const res = await worker.fetch(new Request("http://localhost" + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil: (x) => pend.push(x) });
  const text = await res.text(); await Promise.allSettled(pend);
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}
const REAL = "user_that_admin";
const mk = (b, extra = {}) => ({ CHAT_DATA: b, DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: REAL, ...extra });
const keys = async (b) => { try { const l = await b.list(); return JSON.stringify((l.objects || []).map((o) => o.key).sort()); } catch { return "?"; } };

// (a)
const WEIRD = [["số 1", 1], ["true", true], ["mảng ['1']", ["1"]], ["object", { 1: 1 }], ['"1\\n"', "1\n"], ['"\\u0661"', "١"], ['"１" (fullwidth)', "１"], ['"1\\u200b"', "1​"]];
const ROUTES = [["GET", "/api/admin/me"], ["GET", "/api/admin/members-summary"], ["POST", "/api/admin/members-list", { page: 1, size: 20, q: "" }], ["GET", "/api/admin/audit"], ["GET", "/api/admin/vendors"], ["GET", "/api/admin/vendor-enrich"], ["PUT", "/api/admin/vendor-enrich/x/review", { decision: "approve" }], ["GET", "/api/admin/khong-co"]];
const WHO = [undefined, "rac", "guest_abc", "dev:user_thuong"];
for (const [wn, val] of WEIRD) {
  let same = true, all403 = true, noWrite = true, diff;
  for (const who of WHO) for (const [m, p, body] of ROUTES) {
    const b0 = new MemoryBucket(), b1 = new MemoryBucket();
    const r0 = await call(mk(b0), m, p, { token: who, body });
    const r1 = await call(mk(b1, { ADMIN_OPEN: val }), m, p, { token: who, body });
    if (r0.status !== r1.status || r0.text !== r1.text) { same = false; diff = [wn, who, p, r1.status, r1.text.slice(0, 60)]; }
    if (r1.status !== 403 || r1.text !== '{"error":"forbidden"}') all403 = false;
    if ((await keys(b1)) !== (await keys(b0))) noWrite = false;
  }
  check(`(a) ADMIN_OPEN=${wn}: giống hệt cờ thiếu`, same, diff);
  check(`(a) ADMIN_OPEN=${wn}: 403 {"error":"forbidden"} mọi người không phải admin`, all403);
  check(`(a) ADMIN_OPEN=${wn}: không ghi R2`, noWrite);
}

// (b)
{
  const TOK = "adv-xuat-thu";
  const { privateKey } = crypto.generateKeyPairSync("ed25519");
  const SIGN = { ENRICH_EXPORT_TOKEN: TOK, ENRICH_SIGNING_KEY: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"), ENRICH_SIGNING_KEY_ID: "kadv" };
  const CAPU = "user_capu_that";
  for (const capuCfg of [{ ADMIN_USER_IDS: CAPU, CAPU_USER_IDS: CAPU }, { ADMIN_USER_IDS: CAPU + "," + ID, CAPU_USER_IDS: CAPU + "," + ID }]) {
    const tag = capuCfg.ADMIN_USER_IDS.includes(ID) ? "[danh tính cố định cũng trong ADMIN/CAPU_USER_IDS]" : "[cấu hình thường]";
    const b = new MemoryBucket();
    const off = { CHAT_DATA: b, DEV_AUTH_BYPASS: "1", ...SIGN, ...capuCfg };
    const on = { ...off, ADMIN_OPEN: "1" };
    const rows = (await call(off, "GET", "/api/admin/vendor-enrich", { token: "dev:" + CAPU })).json?.rows || [];
    const r0 = rows.find((x) => x.approvable && !x.override);
    if (!r0) { check(`(b) ${tag} có dòng approvable để thử`, false); continue; }
    const pc = await call(off, "PUT", `/api/admin/vendor-enrich/${r0.id}/review`, { token: "dev:" + CAPU, body: { decision: "approve" } });
    check(`(b) ${tag} Capu thật ký (cờ tắt) -> 200 by_capu=true`, pc.status === 200 && pc.json?.review?.by_capu === true, [pc.status, pc.text.slice(0, 80)]);
    for (const tok of [undefined, "dev:" + CAPU, "dev:" + ID]) {
      const pw = await call(on, "PUT", `/api/admin/vendor-enrich/${r0.id}/review`, { token: tok, body: { decision: "approve" } });
      check(`(b) ${tag} cờ bật, token ${tok || "không"}: ghi đè bản duyệt Capu -> 409`, pw.status === 409, [pw.status, pw.text.slice(0, 80)]);
      const dw = await call(on, "DELETE", `/api/admin/vendor-enrich/${r0.id}/review`, { token: tok });
      check(`(b) ${tag} cờ bật, token ${tok || "không"}: rút bản duyệt Capu -> 409`, dw.status === 409, [dw.status, dw.text.slice(0, 80)]);
    }
    const ex = await call(on, "GET", "/api/internal/vendor-enrich/export", { token: TOK });
    const e = (ex.json?.entries || []).find((x) => x.vendor_id === r0.id);
    check(`(b) ${tag} export ký vẫn còn mục của Capu (by_capu=true), không chuỗi danh tính cố định`, ex.status === 200 && e?.by_capu === true && !ex.text.includes(ID), [ex.status, ex.text.slice(0, 120)]);
  }
}

// (c)
{
  const PATHS = ["/API/admin/me", "/api/Admin/me", "/api/admin%2Fme", "/api/%61dmin/me", "/apiadmin/me", "/api/admin.json", "/api/admins/me", "/api/couples/x/../../admin/me".replace(/\.\.\//g, "") , "/api/vendors/..%2fadmin%2fme"];
  for (const p of PATHS) for (const who of [undefined, "rac", "guest_abc"]) {
    const r0 = await call(mk(new MemoryBucket()), "GET", p, { token: who });
    const r1 = await call(mk(new MemoryBucket(), { ADMIN_OPEN: "1" }), "GET", p, { token: who });
    const url = new URL("http://localhost" + p).pathname;
    const isAdmin = url === "/api/admin" || url.startsWith("/api/admin/");
    if (isAdmin) continue;
    check(`(c) ${p} (${who || "không token"}): ngoài /api/admin/*, cờ bật giống hệt cờ tắt`, r0.status === r1.status && r0.text === r1.text && !r1.text.includes(ID), [r0.status, r1.status, r1.text.slice(0, 60)]);
  }
}
check("không gọi mạng ra ngoài", outbound.length === 0, outbound);
if (fails.length) { console.log("FAIL " + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1})` : "")); process.exit(1); }
console.log("PASS"); process.exit(0);
