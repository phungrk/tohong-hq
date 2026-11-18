#!/usr/bin/env node
// T-206 adv-02 (adversary, tầng 3): thao tác ĐỒNG THỜI trên cùng vendor, cùng expected_version (etag/ifMatch).
// Spec T-203 §Hợp đồng API: "expected_version lệch 409 version_conflict"; "Ghi hỏng giữa chừng không để trạng thái nửa vời (một lần ghi ifMatch)";
// §Tình huống 5: "Mỗi lần xoá / khôi phục THÀNH CÔNG thêm đúng một dòng… Lần bị từ chối (400/404/409) không ghi dòng nào".
// Mong đợi: mỗi cặp chạy song song có đúng một 200, cái kia 409; số dòng Nhật ký = số lần 200; trạng thái cuối khớp bên thắng.
// Chạy từ gốc tohong-hq: node eval/T-206/adv-02-dong-thoi-xoa-khoi-phuc-sua.mjs
import { meta, fresh, pickTarget, asAdmin, DEL, RES, reporter, outbound, AUDIT_PREFIX } from "../T-203/lib/common.mjs";
const R = reporter();
const { env, bucket } = fresh();
const A = asAdmin(env);
const audits = (action) => [...bucket.data.keys()].filter((k) => k.startsWith(AUDIT_PREFIX)).map((k) => JSON.parse(bucket.data.get(k))).filter((e) => e.action === action);
const T = await pickTarget(env, "photography");
const id = T.id;
const ok = (rs) => rs.filter((r) => r.status === 200).length;
const c409 = (rs) => rs.filter((r) => r.status === 409).length;

// 1. Hai lần xoá cùng lúc
const d2 = await Promise.all([A("POST", DEL(id), { expected_version: 0, reason: "song song 1" }), A("POST", DEL(id), { expected_version: 0, reason: "song song 2" })]);
R.check("hai lần xoá song song: đúng một 200, một 409", ok(d2) === 1 && c409(d2) === 1, d2.map((r) => [r.status, r.json?.error]));
R.check("hai lần xoá song song: đúng một dòng vendor.delete", audits("vendor.delete").length === 1, audits("vendor.delete").length);
let d = await A("GET", `/api/admin/vendors/${id}`);
const winReason = d2.find((r) => r.status === 200) === d2[0] ? "song song 1" : "song song 2";
R.check("lý do lưu là của bên thắng", d.json?.deleted_info?.reason === winReason, [d.json?.deleted_info?.reason, winReason]);
const v1 = d.json?.version;

// 2. Hai lần khôi phục cùng lúc
const r2 = await Promise.all([A("POST", RES(id), { expected_version: v1 }), A("POST", RES(id), { expected_version: v1 })]);
R.check("hai lần khôi phục song song: đúng một 200, một 409", ok(r2) === 1 && c409(r2) === 1, r2.map((r) => [r.status, r.json?.error]));
R.check("hai lần khôi phục song song: đúng một dòng vendor.restore", audits("vendor.restore").length === 1, audits("vendor.restore").length);
d = await A("GET", `/api/admin/vendors/${id}`);
R.check("sau đó: deleted:false, không có bản sửa", d.json?.deleted === false && d.json?.override == null, [d.json?.deleted, d.json?.override]);

// 3. Xoá cùng lúc với sửa ghi đè (cùng phiên bản)
const v2 = d.json?.version ?? 0;
const x = await Promise.all([A("POST", DEL(id), { expected_version: v2, reason: "đua với sửa" }), A("PUT", `/api/admin/vendors/${id}/override`, { priceMin: 11, priceMax: 12, expected_version: v2 })]);
R.check("xoá song song với sửa: đúng một 200, một 409", ok(x) === 1 && c409(x) === 1, x.map((r) => [r.status, r.json?.error]));
d = await A("GET", `/api/admin/vendors/${id}`);
if (x[0].status === 200) R.check("xoá thắng: deleted:true, giá không đổi", d.json?.deleted === true && d.json?.override?.priceMin !== 11, d.json);
else R.check("sửa thắng: deleted:false, giá 11", d.json?.deleted === false && d.json?.override?.priceMin === 11, d.json);
R.check("số dòng vendor.delete khớp số lần xoá thành công", audits("vendor.delete").length === 1 + (x[0].status === 200 ? 1 : 0), audits("vendor.delete").length);

// 4. Đang xoá: khôi phục song song với Bỏ ghi đè (cùng phiên bản) — Bỏ ghi đè không bao giờ thắng
if (d.json?.deleted !== true) { await A("POST", DEL(id), { expected_version: d.json?.version ?? 0, reason: "chuẩn bị bước 4" }); d = await A("GET", `/api/admin/vendors/${id}`); }
const before4 = JSON.stringify(meta(d.json?.override ?? null));
const y = await Promise.all([A("POST", RES(id), { expected_version: d.json.version }), A("DELETE", `/api/admin/vendors/${id}/override`, { expected_version: d.json.version })]);
R.check("đang xoá: Bỏ ghi đè chạy song song với khôi phục không bao giờ 200", y[1].status === 409, y.map((r) => [r.status, r.json?.error]));
R.check("khôi phục song song vẫn 200", y[0].status === 200, [y[0].status, y[0].text.slice(0, 80)]);
d = await A("GET", `/api/admin/vendors/${id}`);
R.check("sau bước 4: deleted:false và bản sửa y như trước (Bỏ ghi đè không làm mất)", d.json?.deleted === false && JSON.stringify(meta(d.json?.override ?? null)) === before4, [d.json?.override, before4]);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
