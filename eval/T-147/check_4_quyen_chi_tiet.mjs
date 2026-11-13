#!/usr/bin/env node
// T-147 tiêu chí 4 (repo tohong-back), SỬA THEO ADR-083 mục 2 (T-150, đổi hành vi có chủ đích; không phải sửa eval cho khớp code; product sửa trong lượt T-150, theo tiền lệ ADR-074):
//   route chi tiết vendor mở cho MỌI platform admin (người đăng nhập Clerk có user id trong ADMIN_USER_IDS), không chỉ Capu. Người ngoài (không đăng nhập, token rác, không nằm trong ADMIN_USER_IDS) vẫn 403.
//   Approve / Sửa thủ công / export ký Ed25519 vẫn chỉ Capu (T-129, inv-004): phần không-hồi-quy ở cuối file.
// Chạy: cd /home/user/tohong-back && node /home/user/tohong-hq/eval/T-147/check_4_quyen_chi_tiet.mjs   (hoặc qua check_4_quyen_chi_tiet.sh)
// Người gọi bị chặn (mọi tổ hợp với 5 đường: GET detail của id thật, GET detail của id không có, GET detail id sai dạng, POST detail, DELETE detail):
//   không token; token rác; user thường (không trong ADMIN_USER_IDS); ADMIN_USER_IDS rỗng; ADMIN_USER_IDS thiếu; token dev khi DEV_AUTH_BYPASS tắt; người trong CAPU_USER_IDS nhưng không trong ADMIN_USER_IDS.
//   Đo: 403 + thân đúng một khoá {"error":"forbidden"} (id không có cũng 403, không phải 404: không lộ id nào tồn tại), thân không chứa tên vendor, R2 không có lần ghi nào, không gọi mạng.
// Người gọi được mở (mọi admin: Capu; admin khi CAPU_USER_IDS rỗng; thiếu; chỉ có người khác): GET id thật 200 và thân GIỐNG HỆT thân Capu nhận; id không có 404 not_found; id sai dạng 400; POST/DELETE 405; không ghi R2.
// Không hồi quy T-129: admin không phải Capu bấm Approve thì review có by_capu=false; export ký (đường máy /api/internal/vendor-enrich/export) KHÔNG có mục của họ nhưng CÓ mục của Capu; Capu quyết rồi thì admin khác nhận 409.
import crypto from "node:crypto";
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

/* ---------- 1. Người ngoài: 403 ---------- */
const blocked = [
  ["không token", mk({}), undefined],
  ["token rác", mk({}), "khong-phai-token"],
  ["user thường (không trong ADMIN_USER_IDS)", mk({}), "dev:user_other"],
  ["ADMIN_USER_IDS rỗng", mk({ ADMIN_USER_IDS: "" }), `dev:${CAPU}`],
  ["ADMIN_USER_IDS thiếu", mk({}, ["ADMIN_USER_IDS"]), `dev:${CAPU}`],
  ["token dev khi DEV_AUTH_BYPASS tắt", mk({ DEV_AUTH_BYPASS: "" }), `dev:${CAPU}`],
  ["trong CAPU_USER_IDS nhưng không phải admin", mk({ ADMIN_USER_IDS: ADMIN, CAPU_USER_IDS: CAPU }), `dev:${CAPU}`],
];
for (const [cn, env, token] of blocked) {
  for (const [method, p, body] of routes) {
    const r = await B.call(env, method, p, { token, body });
    const ok = r.status === 403 && r.json?.error === "forbidden" && Object.keys(r.json).length === 1 && !r.text.includes(row.name);
    R.check(`${cn} · ${method} …${p.slice(base.length).replace(row.id, "<id>")} -> 403 forbidden`, ok, [r.status, r.text.slice(0, 80)]);
  }
}
R.check("người ngoài bị chặn thì R2 không có lần ghi nào", bucket.putLog.length === 0, bucket.putLog);

/* ---------- 2. Mọi admin: mở được ---------- */
const capuRes = await B.call(mk({}), "GET", routes[0][1], { token: `dev:${CAPU}` });
R.check("Capu (trong cả hai danh sách) GET detail id thật: 200 và đúng vendor", capuRes.status === 200 && capuRes.json?.id === row.id, [capuRes.status, capuRes.text.slice(0, 80)]);
const admins = [
  ["admin không phải Capu (CAPU_USER_IDS rỗng)", mk({ ADMIN_USER_IDS: ADMIN, CAPU_USER_IDS: "" }), ADMIN],
  ["admin không phải Capu (CAPU_USER_IDS thiếu)", mk({ ADMIN_USER_IDS: ADMIN }, ["CAPU_USER_IDS"]), ADMIN],
  ["admin không phải Capu (CAPU_USER_IDS chỉ có người khác)", mk({ ADMIN_USER_IDS: `${ADMIN},${CAPU}`, CAPU_USER_IDS: CAPU }), ADMIN],
  ["admin khi CAPU_USER_IDS rỗng nhưng id là Capu cũ", mk({ CAPU_USER_IDS: "" }), CAPU],
];
const want = [200, 404, 400, 405, 405];
for (const [cn, env, uid] of admins) {
  for (let i = 0; i < routes.length; i++) {
    const [method, p, body] = routes[i];
    const r = await B.call(env, method, p, { token: `dev:${uid}`, body });
    let ok = r.status === want[i];
    if (i === 0) ok = ok && r.text === capuRes.text;                       // cùng nội dung với Capu, không bớt, không thêm
    if (i === 1) ok = ok && r.json?.error === "not_found";
    R.check(`${cn} · ${method} …${p.slice(base.length).replace(row.id, "<id>")} -> ${want[i]}${i === 0 ? " và thân giống Capu" : ""}`, ok, [r.status, r.text.slice(0, 80)]);
  }
}
R.check("mọi lần gọi detail (chặn lẫn mở) không ghi R2", bucket.putLog.length === 0, bucket.putLog);
const lst = await B.call(mk({ ADMIN_USER_IDS: ADMIN, CAPU_USER_IDS: CAPU }), "GET", base, { token: `dev:${ADMIN}` });
R.check("admin không phải Capu mở được danh sách (route cũ không đổi)", lst.status === 200 && Array.isArray(lst.json?.rows), lst.status);

/* ---------- 3. Không hồi quy T-129 / inv-004: quyết định và chữ ký vẫn chỉ Capu ---------- */
const { privateKey } = crypto.generateKeyPairSync("ed25519");
const TOKEN = "t150-khoa-may-0123456789abcdef";
const bk2 = new B.MemoryBucket();
const env2 = B.makeEnv(bk2, { ADMIN_USER_IDS: `${ADMIN},${CAPU}`, CAPU_USER_IDS: CAPU, ENRICH_EXPORT_TOKEN: TOKEN,
  ENRICH_SIGNING_KEY: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"), ENRICH_SIGNING_KEY_ID: "k1" });
const appr = report.vendors.filter((r) => r.approvable && !r.override);
if (appr.length < 2) { R.check("dữ liệu thật có ít nhất hai dòng approvable để thử", false, appr.length); R.done(); }
const [vA, vB] = appr;
const rv = (id) => `${base}/${id}/review`;
const pA = await B.call(env2, "PUT", rv(vA.id), { token: `dev:${ADMIN}`, body: { decision: "approve" } });
R.check("admin không phải Capu bấm Approve: 200 nhưng review.by_capu=false (vẫn 'Chờ Capu')", pA.status === 200 && pA.json?.review?.by_capu === false, [pA.status, pA.text.slice(0, 100)]);
const pB = await B.call(env2, "PUT", rv(vB.id), { token: `dev:${CAPU}`, body: { decision: "approve" } });
R.check("Capu bấm Approve: 200, by_capu=true", pB.status === 200 && pB.json?.review?.by_capu === true, [pB.status, pB.text.slice(0, 100)]);
const ex = await B.call(env2, "GET", "/api/internal/vendor-enrich/export", { token: TOKEN });
const got = (ex.json?.entries || []).map((e) => e.vendor_id);
R.check("export ký chỉ có mục của Capu, không có mục của admin khác", ex.status === 200 && got.length === 1 && got[0] === vB.id && ex.json.waiting_capu === 1, [ex.status, got, ex.json?.waiting_capu]);
const d2 = await B.call(env2, "GET", `${base}/${vA.id}/detail`, { token: `dev:${ADMIN}` });
R.check("xem drawer không đổi trạng thái duyệt: review của admin vẫn chờ, không có mục ký mới", d2.status === 200 && (await B.call(env2, "GET", "/api/internal/vendor-enrich/export", { token: TOKEN })).json?.count === 1, d2.status);
const pC = await B.call(env2, "PUT", rv(vB.id), { token: `dev:${ADMIN}`, body: { decision: "approve" } });
R.check("Capu đã quyết rồi thì admin khác ghi đè: 409 decided_by_capu", pC.status === 409 && pC.json?.error === "decided_by_capu", [pC.status, pC.text.slice(0, 80)]);
R.check("không gọi mạng ra ngoài", outbound.length === 0, outbound);
R.done();
