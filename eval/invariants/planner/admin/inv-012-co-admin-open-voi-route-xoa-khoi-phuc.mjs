#!/usr/bin/env node
// T-206 adv-03 (adversary, tầng 3): cờ ADMIN_OPEN với hai route MỚI /api/admin/vendors/:id/delete và /restore.
// planner/admin inv-001 (cờ chỉ mở với đúng "1") và inv-002 (danh tính cố định) liệt kê route cố định nên không chạm route mới; spec T-203 §Ràng buộc:
// "vendor-enrich/inv-008/010(a) (không đăng nhập → 403) áp dụng cho route mới như mọi route admin (khi ADMIN_OPEN khác "1")"; §Tình huống 5: "ADMIN_OPEN bật thì người làm là danh tính cố định".
// Mong đợi: cờ khác đúng "1" -> người ngoài nhận 403 {"error":"forbidden"} (cùng byte với route admin cũ), R2 không đổi; cờ "1" -> xoá/khôi phục được, deleted_by và admin_id Nhật ký là danh tính cố định.
// Chạy từ gốc tohong-hq: node eval/T-206/adv-03-co-admin-open-voi-route-xoa-khoi-phuc.mjs
import { call, makeEnv, pickTarget, reporter, outbound, MemoryBucket, resetOverlayCache, DEL, RES, AUDIT_PREFIX, snapshot, diff } from "../../../T-203/lib/common.mjs";
const R = reporter();
const FIXED = "admin-khong-dang-nhap";
const OFF = [undefined, "", "0", "true", "on", " 1", "1 ", "01"];
const WHO = [["không token", undefined], ["token rác", "khong-phai-token"], ["người thường", "dev:user_thuong"], ["cặp đôi", "dev:couple_1"]];
resetOverlayCache();
let bucket = new MemoryBucket();
let env = makeEnv(bucket);
const T = await pickTarget(env, "photography");
for (const flag of OFF) {
  resetOverlayCache(); bucket = new MemoryBucket(); env = makeEnv(bucket, flag === undefined ? {} : { ADMIN_OPEN: flag });
  // một vendor đã xoá sẵn (bởi admin thật) để thử restore
  const pre = await call(env, "POST", DEL(T.ids[1]), { token: "dev:admin", body: { expected_version: 0, reason: "chuẩn bị" } });
  const ref = await call(env, "GET", "/api/admin/vendors", {});
  for (const [who, token] of WHO) {
    const s0 = snapshot(bucket);
    const d = await call(env, "POST", DEL(T.id), { token, body: { expected_version: 0, reason: "người ngoài" } });
    const r = await call(env, "POST", RES(T.ids[1]), { token, body: { expected_version: pre.json?.version ?? 0 } });
    const dd = diff(s0, snapshot(bucket));
    R.check(`ADMIN_OPEN=${JSON.stringify(flag)} ${who}: delete/restore 403 forbidden như route admin cũ, R2 không đổi`, d.status === 403 && r.status === 403 && d.text === ref.text && r.text === ref.text && dd.added.length + dd.changed.length + dd.removed.length === 0, [d.status, r.status, d.text.slice(0, 40), ref.status, dd]);
  }
}
// Cờ đúng "1": không token vẫn làm được, danh tính cố định
resetOverlayCache(); bucket = new MemoryBucket(); env = makeEnv(bucket, { ADMIN_OPEN: "1" });
const d = await call(env, "POST", DEL(T.id), { body: { expected_version: 0, reason: "cờ mở" } });
R.check("ADMIN_OPEN=1, không token: xoá 200", d.status === 200, [d.status, d.text.slice(0, 80)]);
const det = await call(env, "GET", `/api/admin/vendors/${T.id}`, {});
R.check("ADMIN_OPEN=1: deleted_info.by là danh tính cố định", det.json?.deleted_info?.by === FIXED, det.json?.deleted_info);
const r = await call(env, "POST", RES(T.id), { body: { expected_version: d.json?.version ?? 0 } });
R.check("ADMIN_OPEN=1, không token: khôi phục 200", r.status === 200, [r.status, r.text.slice(0, 80)]);
const aud = [...bucket.data.keys()].filter((k) => k.startsWith(AUDIT_PREFIX)).map((k) => JSON.parse(bucket.data.get(k)));
R.check("ADMIN_OPEN=1: hai dòng Nhật ký vendor.delete/restore, admin_id là danh tính cố định", aud.length === 2 && aud.every((e) => e.admin_id === FIXED) && aud.map((e) => e.action).sort().join() === "vendor.delete,vendor.restore", aud.map((e) => [e.action, e.admin_id]));
// Admin thật vẫn ghi đúng tên mình khi cờ mở
const d2 = await call(env, "POST", DEL(T.id), { token: "dev:admin", body: { expected_version: r.json?.version ?? 0, reason: "admin thật" } });
const det2 = await call(env, "GET", `/api/admin/vendors/${T.id}`, { token: "dev:admin" });
R.check("ADMIN_OPEN=1, admin thật đăng nhập: deleted_by vẫn là danh tính đã dùng (không rỗng)", d2.status === 200 && typeof det2.json?.deleted_info?.by === "string" && det2.json.deleted_info.by.length > 0, [d2.status, det2.json?.deleted_info]);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
