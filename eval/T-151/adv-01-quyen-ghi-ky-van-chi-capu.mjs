#!/usr/bin/env node
// T-151 adv-01 (adversary, tầng 3): nới quyền ĐỌC drawer không được kéo theo quyền GHI/KÝ (T-150 Hành vi 1, T-129, inv-004).
// Ca mà eval T-147 #4 chưa chạm:
//   a) admin bị gỡ khỏi ADMIN_USER_IDS giữa phiên (cùng R2): lần sau 403 {"error":"forbidden"}, không lộ tên vendor;
//   b) admin không phải Capu bấm "Sửa thủ công" (decision=manual) khi CAPU_USER_IDS thiếu / rỗng / chỉ dấu phẩy: by_capu=false, export ký không có mục;
//   c) admin không phải Capu "Rút lại" quyết định của Capu: 409 decided_by_capu và mục ký của Capu còn nguyên;
//   d) mọi phương thức khác GET ở /detail (PUT, PATCH, HEAD) của admin: 405 (OPTIONS là preflight CORS chung, 204), không ghi R2; /detail/<x> không thành route ghi;
//   e) admin không phải Capu gọi export của bảng admin: không bao giờ có mục của mình, mọi mục có by_capu=true.
// Chạy: cd <tohong-back> && node <hq>/eval/T-151/adv-01-quyen-ghi-ky-van-chi-capu.mjs
import crypto from "node:crypto";
import { BACK, ADMIN, CAPU, load, embedded, outbound, reporter } from "../T-147/lib/back147.mjs";

const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ: " + String(e && e.message).slice(0, 200)); process.exit(1); });
const report = embedded(BACK, "vendorEnrichReport.generated.js", "VENDOR_ENRICH_REPORT");
const B = await load(BACK);
const base = "/api/admin/vendor-enrich";
const appr = report.vendors.filter((r) => r.approvable && !r.override);
const anyRow = report.vendors.find((r) => !r.override && r.google?.place_id) || report.vendors[0];
if (appr.length < 3) { console.log("FAIL dữ liệu thật thiếu dòng approvable"); process.exit(2); }
const [vA, vB, vC] = appr;
const { privateKey } = crypto.generateKeyPairSync("ed25519");
const TOKEN = "t151-adv-khoa-may-0123456789abcdef";
const sign = { ENRICH_EXPORT_TOKEN: TOKEN, ENRICH_SIGNING_KEY: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"), ENRICH_SIGNING_KEY_ID: "k1" };
const bk = new B.MemoryBucket();
const env = (extra = {}, drop = []) => { const e = B.makeEnv(bk, { ADMIN_USER_IDS: `${ADMIN},${CAPU}`, CAPU_USER_IDS: CAPU, ...sign, ...extra }); for (const k of drop) delete e[k]; return e; };
const exportIds = async () => ((await B.call(env(), "GET", "/api/internal/vendor-enrich/export", { token: TOKEN })).json?.entries || []).map((e) => e.vendor_id);

/* a) gỡ admin giữa phiên */
const d1 = await B.call(env(), "GET", `${base}/${vA.id}/detail`, { token: `dev:${ADMIN}` });
R.check("a) admin còn trong danh sách: detail 200", d1.status === 200, d1.status);
const d2 = await B.call(env({ ADMIN_USER_IDS: CAPU }), "GET", `${base}/${vA.id}/detail`, { token: `dev:${ADMIN}` });
R.check("a) admin bị gỡ giữa phiên: 403 đúng một khoá forbidden, không lộ tên", d2.status === 403 && d2.json?.error === "forbidden" && Object.keys(d2.json).length === 1 && !d2.text.includes(vA.name), [d2.status, d2.text.slice(0, 80)]);
const d3 = await B.call(env({ ADMIN_USER_IDS: ` ${CAPU} , ` }), "GET", `${base}/${vA.id}/detail`, { token: `dev:${ADMIN}` });
R.check("a) danh sách admin có dấu cách/phẩy thừa vẫn không mở cho người đã gỡ", d3.status === 403, d3.status);

/* b) Sửa thủ công của admin không phải Capu */
const manual = { decision: "manual", action: "reject_match", note: "adv-01 thử" };
let i = 0;
for (const [cn, e] of [["CAPU_USER_IDS thiếu", env({}, ["CAPU_USER_IDS"])], ["CAPU_USER_IDS rỗng", env({ CAPU_USER_IDS: "" })], ["CAPU_USER_IDS chỉ dấu phẩy", env({ CAPU_USER_IDS: " , ," })], ["CAPU_USER_IDS chỉ người khác", env()]]) {
  const v = [vA, vB, vC, vA][i++];
  const p = await B.call(e, "PUT", `${base}/${v.id}/review`, { token: `dev:${ADMIN}`, body: manual });
  R.check(`b) ${cn}: admin Sửa thủ công -> 200, by_capu=false`, p.status === 200 && p.json?.review?.by_capu === false, [p.status, p.text.slice(0, 100)]);
  const pa = await B.call(e, "PUT", `${base}/${v.id}/review`, { token: `dev:${ADMIN}`, body: { decision: "approve" } });
  R.check(`b) ${cn}: admin Approve -> by_capu=false`, pa.status === 200 && pa.json?.review?.by_capu === false, [pa.status, pa.text.slice(0, 100)]);
}
R.check("b) export ký không có mục nào của admin khác", (await exportIds()).length === 0, await exportIds());

/* c) Rút lại quyết định của Capu */
const pc = await B.call(env(), "PUT", `${base}/${vB.id}/review`, { token: `dev:${CAPU}`, body: { decision: "approve" } });
R.check("c) Capu Approve -> by_capu=true", pc.status === 200 && pc.json?.review?.by_capu === true, pc.status);
for (const [cn, e] of [["CAPU_USER_IDS chỉ Capu", env()], ["sau khi vừa mở drawer", env()]]) {
  if (cn === "sau khi vừa mở drawer") await B.call(e, "GET", `${base}/${vB.id}/detail`, { token: `dev:${ADMIN}` });
  const w = await B.call(e, "DELETE", `${base}/${vB.id}/review`, { token: `dev:${ADMIN}` });
  R.check(`c) ${cn}: admin Rút lại quyết định của Capu -> 409 decided_by_capu`, w.status === 409 && w.json?.error === "decided_by_capu", [w.status, w.text.slice(0, 80)]);
  const m = await B.call(e, "PUT", `${base}/${vB.id}/review`, { token: `dev:${ADMIN}`, body: manual });
  R.check(`c) ${cn}: admin Sửa thủ công đè quyết định của Capu -> 409`, m.status === 409 && m.json?.error === "decided_by_capu", [m.status, m.text.slice(0, 80)]);
}
R.check("c) mục ký của Capu còn nguyên, chỉ một mục", JSON.stringify(await exportIds()) === JSON.stringify([vB.id]), await exportIds());

/* d) /detail không thành route ghi */
const before = bk.putLog.length;
for (const m of ["PUT", "PATCH", "HEAD"]) {
  const r = await B.call(env(), m, `${base}/${vC.id}/detail`, { token: `dev:${ADMIN}`, body: m === "PUT" || m === "PATCH" ? { decision: "approve" } : undefined });
  R.check(`d) admin ${m} /detail -> 405`, r.status === 405, [r.status, r.text.slice(0, 80)]);
}
for (const p of [`${base}/${vC.id}/detail/review`, `${base}/${vC.id}/detail/x`]) {
  const r = await B.call(env(), "PUT", p, { token: `dev:${ADMIN}`, body: { decision: "approve" } });
  R.check(`d) admin PUT …${p.slice(base.length).replace(vC.id, "<id>")} không phải route ghi (không 2xx)`, r.status >= 400, [r.status, r.text.slice(0, 80)]);
}
R.check("d) không lần gọi nào ở trên ghi R2", bk.putLog.length === before, bk.putLog.slice(before));

/* e) export của bảng admin gọi bởi admin không phải Capu */
const ex = await B.call(env(), "GET", `${base}/export`, { token: `dev:${ADMIN}` });
const ent = ex.json?.entries || [];
R.check("e) export (bảng admin) do admin khác gọi: không có mục của admin, mọi mục by_capu=true", ex.status === 200 && ent.every((e) => e.by_capu === true) && !ent.some((e) => [vA.id, vC.id].includes(e.vendor_id)), [ex.status, ent.map((e) => e.vendor_id)]);
R.check("không gọi mạng ra ngoài", outbound.length === 0, outbound);
R.done();
