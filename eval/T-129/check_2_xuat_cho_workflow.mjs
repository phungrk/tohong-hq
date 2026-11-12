#!/usr/bin/env node
// T-129 tiêu chí 2 (repo tohong-back): đường xuất cho workflow của tohong — chỉ đọc, chỉ đưa review của Capu, chỉ mở bằng khoá máy `ENRICH_EXPORT_TOKEN`.
// Chạy: cd /home/user/tohong-back && node /home/user/tohong-hq/eval/T-129/check_2_xuat_cho_workflow.mjs   (TOHONG_BACK_REPO hoặc ../tohong-back).
// Hợp đồng: GET /api/internal/vendor-enrich/export với `Authorization: Bearer <ENRICH_EXPORT_TOKEN>` -> 200 cùng thân với GET /api/admin/vendor-enrich/export (Cache-Control: no-store).
//  Từ chối (403, thân đúng {"error":"forbidden"}, no-store, R2 không đổi): không Authorization; token sai; token cắt ngắn / thêm ký tự; ENRICH_EXPORT_TOKEN thiếu, rỗng hoặc < 16 ký tự (kể cả khi người gọi gửi đúng chuỗi đó);
//   token Clerk/dev của admin hoặc của Capu (đường này KHÔNG nhận danh tính người dùng); token đúng nhưng dùng "Basic"/bằng query string ?token=.
//  Phương thức khác GET với token đúng -> 405 (R2 không đổi). Khoá này KHÔNG mở được bất kỳ route /api/admin/* nào (vẫn 403 forbidden).
//  Không route nào ngoài export dùng khoá máy: PUT/DELETE review, GET danh sách admin bằng khoá máy -> 403.
import fs from "node:fs";
import path from "node:path";
import { BACK, MemoryBucket, makeEnv, call, reporter, outbound, worker } from "./lib/back.mjs";

const R = reporter();
const fp = path.join(BACK, "lib", "vendorEnrichReport.generated.js");
if (!fs.existsSync(fp)) { console.log("FAIL thiếu lib/vendorEnrichReport.generated.js ở tohong-back"); process.exit(1); }
const rep = JSON.parse(fs.readFileSync(fp, "utf8").match(/export\s+const\s+VENDOR_ENRICH_REPORT\s*=\s*([\s\S]*?);\s*$/)[1]);
const [A, B] = rep.vendors.filter((r) => r.approvable && !r.override).map((r) => r.id);
const TOKEN = "t129-khoa-may-0123456789abcdef";
const CAPU = "user_capu_0001", ADM = "user_admin_0002";
const bucket = new MemoryBucket();
const env = makeEnv(bucket, { ADMIN_USER_IDS: `${CAPU},${ADM}`, CAPU_USER_IDS: CAPU, ENRICH_EXPORT_TOKEN: TOKEN });
const as = (u, m, p, b) => call(env, m, p, { token: `dev:${u}`, body: b });
await as(CAPU, "PUT", `/api/admin/vendor-enrich/${A}/review`, { decision: "approve" });
await as(ADM, "PUT", `/api/admin/vendor-enrich/${B}/review`, { decision: "approve" });
const P = "/api/internal/vendor-enrich/export";
const snap = JSON.stringify([...bucket.data.entries()]);
const put0 = bucket.putLog.length;

const ok = await call(env, "GET", P, { token: TOKEN });
const adm = await as(ADM, "GET", "/api/admin/vendor-enrich/export");
R.check("token máy đúng -> 200, đúng 1 entry (review của Capu), nhãn băm, không lộ user id", ok.status === 200 && ok.json?.count === 1 && ok.json.entries[0].vendor_id === A && ok.json.entries[0].by_capu === true && /^admin:[0-9a-f]{8}$/.test(ok.json.entries[0].reviewer_label) && !/user_/.test(ok.text), [ok.status, ok.text.slice(0, 200)]);
R.check("thân giống export của admin", JSON.stringify(ok.json) === JSON.stringify(adm.json), [ok.json?.count, adm.json?.count]);
const r2 = await worker.fetch(new Request("http://localhost" + P, { headers: { Authorization: `Bearer ${TOKEN}` } }), env, { waitUntil() {} });
R.check("Cache-Control: no-store", /no-store/.test(r2.headers.get("Cache-Control") || ""), r2.headers.get("Cache-Control"));
const deny = async (name, e, opts, p = P, method = "GET") => {
  const r = await call(e, method, p, opts);
  R.check(`${name} -> 403 forbidden (thân đúng một khoá)`, r.status === 403 && r.json?.error === "forbidden" && Object.keys(r.json).length === 1 && !/user_|marry_/.test(r.text), [r.status, r.text.slice(0, 100)]);
};
await deny("không Authorization", env, {});
await deny("token sai", env, { token: "sai-hoan-toan-0123456789abcdef" });
await deny("token cắt ngắn một ký tự", env, { token: TOKEN.slice(0, -1) });
await deny("token thêm một ký tự", env, { token: TOKEN + "x" });
await deny("token dev của admin", env, { token: `dev:${ADM}` });
await deny("token dev của Capu", env, { token: `dev:${CAPU}` });
await deny("token trong query string", env, {}, `${P}?token=${TOKEN}`);
for (const [n, e] of [["ENRICH_EXPORT_TOKEN thiếu", makeEnv(bucket, { ADMIN_USER_IDS: CAPU, CAPU_USER_IDS: CAPU })], ["ENRICH_EXPORT_TOKEN rỗng", makeEnv(bucket, { ENRICH_EXPORT_TOKEN: "" })], ["ENRICH_EXPORT_TOKEN quá ngắn (gửi đúng chuỗi đó)", makeEnv(bucket, { ENRICH_EXPORT_TOKEN: "abc" })]]) {
  await deny(n, e, { token: n.includes("ngắn") ? "abc" : "" });
}
for (const m of ["POST", "PUT", "DELETE"]) {
  const r = await call(env, m, P, { token: TOKEN, body: {} });
  R.check(`${m} với token đúng -> 405`, r.status === 405, r.status);
}
await deny("khoá máy mở danh sách admin", env, { token: TOKEN }, "/api/admin/vendor-enrich");
await deny("khoá máy mở export admin", env, { token: TOKEN }, "/api/admin/vendor-enrich/export");
await deny("khoá máy PUT review", env, { token: TOKEN, body: { decision: "approve" } }, `/api/admin/vendor-enrich/${B}/review`, "PUT");
await deny("khoá máy DELETE review", env, { token: TOKEN }, `/api/admin/vendor-enrich/${A}/review`, "DELETE");
R.check("cả loạt gọi không đổi R2 và không ghi gì", JSON.stringify([...bucket.data.entries()]) === snap && bucket.putLog.length === put0, bucket.putLog.slice(put0));
R.check("không gọi mạng ra ngoài", outbound.length === 0, outbound);
R.done();
