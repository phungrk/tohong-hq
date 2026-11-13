#!/usr/bin/env node
// T-147 tiêu chí 4 (repo tohong-back): route chi tiết vendor chỉ cho Capu = người đăng nhập Clerk có user id nằm trong CẢ ADMIN_USER_IDS lẫn CAPU_USER_IDS.
// Chạy: cd /home/user/tohong-back && node /home/user/tohong-hq/eval/T-147/check_4_quyen_chi_tiet.mjs   (hoặc qua check_4_quyen_chi_tiet.sh)
// Người gọi bị chặn (mọi tổ hợp với 5 đường: GET detail của id thật, GET detail của id không có, GET detail id sai dạng, POST detail, DELETE detail):
//   không token; token rác; user thường (không trong ADMIN_USER_IDS); admin nhưng ADMIN_USER_IDS rỗng; admin nhưng ADMIN_USER_IDS thiếu; token dev khi DEV_AUTH_BYPASS tắt;
//   admin không phải Capu (CAPU_USER_IDS rỗng, thiếu, hoặc chỉ có người khác); người trong CAPU_USER_IDS nhưng không trong ADMIN_USER_IDS.
// Đo: mọi tổ hợp trả 403 + thân đúng một khoá {"error":"forbidden"} (id không có cũng 403, không phải 404: không lộ id nào tồn tại), thân không chứa tên vendor, R2 không có lần ghi nào,
// không gọi mạng; Capu thật gọi được 200. Route danh sách và review cũ vẫn mở cho admin không phải Capu (danh sách 200): spec không siết chúng.
import { BACK, ADMIN, CAPU, load, embedded, outbound, reporter } from "./lib/back147.mjs";

const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ khi chạy (hợp đồng chưa đúng?): " + String(e && e.message).slice(0, 200)); process.exit(1); });
const report = embedded(BACK, "vendorEnrichReport.generated.js", "VENDOR_ENRICH_REPORT");
const B = await load(BACK);
const row = report.vendors.find((r) => r.group === "full");
const base = "/api/admin/vendor-enrich";
const routes = [["GET", `${base}/${row.id}/detail`], ["GET", `${base}/marry_khong_co_that/detail`], ["GET", `${base}/${encodeURIComponent("../x y")}/detail`], ["POST", `${base}/${row.id}/detail`, {}], ["DELETE", `${base}/${row.id}/detail`]];
const bucket = new B.MemoryBucket();
const mk = (extra, drop = []) => { const e = B.makeEnv(bucket, extra); for (const k of drop) delete e[k]; return e; };
const callers = [
  ["không token", mk({}), undefined],
  ["token rác", mk({}), "khong-phai-token"],
  ["user thường", mk({}), "dev:user_other"],
  ["admin nhưng ADMIN_USER_IDS rỗng", mk({ ADMIN_USER_IDS: "" }), `dev:${CAPU}`],
  ["admin nhưng ADMIN_USER_IDS thiếu", mk({}, ["ADMIN_USER_IDS"]), `dev:${CAPU}`],
  ["token dev khi DEV_AUTH_BYPASS tắt", mk({ DEV_AUTH_BYPASS: "" }), `dev:${CAPU}`],
  ["admin không phải Capu (CAPU_USER_IDS rỗng)", mk({ ADMIN_USER_IDS: ADMIN, CAPU_USER_IDS: "" }), `dev:${ADMIN}`],
  ["admin không phải Capu (CAPU_USER_IDS thiếu)", mk({ ADMIN_USER_IDS: ADMIN }, ["CAPU_USER_IDS"]), `dev:${ADMIN}`],
  ["admin không phải Capu (CAPU_USER_IDS chỉ có người khác)", mk({ ADMIN_USER_IDS: `${ADMIN},${CAPU}`, CAPU_USER_IDS: CAPU }), `dev:${ADMIN}`],
  ["trong CAPU_USER_IDS nhưng không phải admin", mk({ ADMIN_USER_IDS: ADMIN, CAPU_USER_IDS: CAPU }), `dev:${CAPU}`],
];
for (const [cn, env, token] of callers) {
  for (const [method, p, body] of routes) {
    const r = await B.call(env, method, p, { token, body });
    const ok = r.status === 403 && r.json?.error === "forbidden" && Object.keys(r.json).length === 1 && !r.text.includes(row.name);
    R.check(`${cn} · ${method} …${p.slice(base.length).replace(row.id, "<id>")} -> 403 forbidden`, ok, [r.status, r.text.slice(0, 80)]);
  }
}
R.check("bị chặn thì R2 không có lần ghi nào", bucket.putLog.length === 0, bucket.putLog);
const ok = await B.call(B.makeEnv(bucket), "GET", routes[0][1], { token: `dev:${CAPU}` });
R.check("Capu thật (trong cả hai danh sách) gọi được: 200 và đúng vendor", ok.status === 200 && ok.json?.id === row.id, [ok.status, ok.text.slice(0, 80)]);
const lst = await B.call(mk({ ADMIN_USER_IDS: ADMIN, CAPU_USER_IDS: CAPU }), "GET", base, { token: `dev:${ADMIN}` });
R.check("admin không phải Capu vẫn mở được danh sách (route cũ không bị siết)", lst.status === 200 && Array.isArray(lst.json?.rows), lst.status);
R.check("không gọi mạng ra ngoài", outbound.length === 0, outbound);
R.done();
