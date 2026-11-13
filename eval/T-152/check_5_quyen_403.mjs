#!/usr/bin/env node
// T-152 tiêu chí 5 (tohong-back): chỉ platform admin (ADMIN_USER_IDS) được sửa/xoá/đọc lớp sửa; người ngoài nhận 403 {"error":"forbidden"} (thân đúng một khoá) ở mọi đường, và R2 không bị ghi.
// Người ngoài: không token; token rác; user không trong ADMIN_USER_IDS; ADMIN_USER_IDS rỗng; ADMIN_USER_IDS thiếu; token dev khi DEV_AUTH_BYPASS tắt; người chỉ trong CAPU_USER_IDS.
// Đường: PUT override (trường pool), PUT override (giá), DELETE override, GET /api/admin/vendors/<id> (lịch sử), GET danh sách. Mọi admin (không cần là Capu) sửa được.
import { boot, pick, A1, A2, env, tok, reporter, outbound } from "./lib/back152.mjs";
const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ khi chạy (hợp đồng chưa đúng?): " + String(e && e.message).slice(0, 200)); process.exit(1); });
const { B, bucket } = await boot();
const { venue } = pick();
const mk = (extra, drop = []) => { const x = env(bucket, extra); for (const k of drop) delete x[k]; return x; };
const callers = [["không token", mk({}), undefined], ["token rác", mk({}), "khong-phai-token"], ["user thường", mk({}), "dev:user_ngoai"], ["ADMIN_USER_IDS rỗng", mk({ ADMIN_USER_IDS: "" }), tok(A1)],
  ["ADMIN_USER_IDS thiếu", mk({}, ["ADMIN_USER_IDS"]), tok(A1)], ["dev khi DEV_AUTH_BYPASS tắt", mk({ DEV_AUTH_BYPASS: "" }), tok(A1)], ["chỉ trong CAPU_USER_IDS", mk({ ADMIN_USER_IDS: A1, CAPU_USER_IDS: "user_chi_capu" }), "dev:user_chi_capu"]];
const routes = [["PUT", `/api/admin/vendors/${venue.id}/override`, { expected_version: 0, name: "Kẻ lạ sửa ZZ" }], ["PUT", `/api/admin/vendors/${venue.id}/override`, { expected_version: 0, priceMin: 1 }],
  ["DELETE", `/api/admin/vendors/${venue.id}/override`, { expected_version: 0 }], ["GET", `/api/admin/vendors/${venue.id}`], ["GET", `/api/admin/vendors`]];
for (const [cn, ev, token] of callers) for (const [m, p, body] of routes) {
  const r = await B.call(ev, m, p, { token, body });
  R.check(`${cn} · ${m} ${p.replace(venue.id, "<id>")} -> 403 forbidden`, r.status === 403 && r.json?.error === "forbidden" && Object.keys(r.json).length === 1 && !r.text.includes(venue.name), [r.status, r.text.slice(0, 80)]);
}
R.check("người ngoài không ghi được gì vào R2", bucket.putLog.length === 0, bucket.putLog);
const e = mk({});
for (const [u, n] of [[A1, "admin 1"], [A2, "admin 2 (không phải Capu)"]]) {
  const cur = (await B.call(e, "GET", `/api/admin/vendors/${venue.id}`, { token: tok(u) })).json?.version || 0;
  const r = await B.call(e, "PUT", `/api/admin/vendors/${venue.id}/override`, { token: tok(u), body: { expected_version: cur, name: `Do ${n}` } });
  R.check(`${n} sửa được: 200`, r.status === 200, [r.status, r.text.slice(0, 100)]);
}
R.check("không gọi mạng", outbound.length === 0, outbound);
R.done();
