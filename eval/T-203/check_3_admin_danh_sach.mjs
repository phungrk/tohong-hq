#!/usr/bin/env node
// T-203 tiêu chí 3 (repo tohong-back): vendor đã xoá biến khỏi danh sách admin mặc định và mọi nhãn trừ "Đã xoá"; nhãn `deleted` liệt kê đúng kèm lý do/thời điểm/người xoá; total khớp; kết hợp AND với hạng mục + ô tìm.
// Chạy từ gốc tohong-hq: node eval/T-203/check_3_admin_danh_sach.mjs
import { fresh, asAdmin, DEL, VENDOR_POOL, listAll, reporter, outbound, ADMIN } from "./lib/common.mjs";
const R = reporter();
const { env } = fresh();
const A = asAdmin(env);
const [v1, v2] = [VENDOR_POOL.find((v) => v.category === "photography" && VENDOR_POOL.filter((x) => x.name === v.name).length === 1), VENDOR_POOL.find((v) => v.category === "makeup" && VENDOR_POOL.filter((x) => x.name === v.name).length === 1)];
const base = await listAll(A);
R.check("tiền điều kiện: danh sách mặc định có đủ pool", base.status === 200 && base.total === base.rows.length && base.rows.some((r) => r.id === v1.id), [base.status, base.total]);
R.check("mọi hàng hiện tại có deleted:false", base.rows.every((r) => r.deleted === false), base.rows.slice(0, 1));
const N = base.total;

const reason1 = "Trùng với vendor khác", reason2 = "Đã đóng cửa";
const rDel1 = await A("POST", DEL(v1.id), { expected_version: 0, reason: reason1 });
const rDel2 = await A("POST", DEL(v2.id), { expected_version: 0, reason: reason2 });
R.check("xoá hai vendor thành công (200)", rDel1.status === 200 && rDel2.status === 200, [rDel1.status, rDel2.status, rDel1.text.slice(0, 80)]);

const def = await listAll(A);
R.check("danh sách mặc định: hai vendor đã xoá biến mất, total giảm đúng 2", !def.rows.some((r) => r.id === v1.id || r.id === v2.id) && def.total === N - 2, [def.total, N]);
for (const label of ["estimated", "has_contact", "missing_contact", "overridden", "hidden", "estimate_category", "legacy_marry", "verified", "orphan"]) {
  const l = await listAll(A, `label=${label}`);
  R.check(`nhãn ${label}: không có vendor đã xoá`, l.status === 200 && !l.rows.some((r) => r.id === v1.id || r.id === v2.id), [l.status]);
}
const q1 = await listAll(A, `q=${encodeURIComponent(v1.name.slice(0, 12))}`);
R.check("ô tìm theo tên vendor đã xoá (không nhãn): không thấy", q1.status === 200 && !q1.rows.some((r) => r.id === v1.id));

const del = await listAll(A, "label=deleted");
R.check("nhãn deleted: 200, đúng 2 hàng, total 2", del.status === 200 && del.total === 2 && del.rows.length === 2 && new Set(del.rows.map((r) => r.id)).size === 2 && del.rows.every((r) => [v1.id, v2.id].includes(r.id)), [del.status, del.total]);
const r1 = del.rows.find((r) => r.id === v1.id) || {};
R.check("hàng đã xoá: deleted:true, tên + hạng mục còn đủ, kèm lý do, thời điểm (ISO), người xoá = admin", r1.deleted === true && r1.name === v1.name && r1.category === v1.category && r1.deleted_reason === reason1 && !Number.isNaN(Date.parse(r1.deleted_at)) && r1.deleted_by === ADMIN, r1);
const dc = await listAll(A, `label=deleted&category=${v1.category}`);
R.check("nhãn deleted + Hạng mục: chỉ vendor đúng hạng mục (AND)", dc.status === 200 && dc.total === 1 && dc.rows[0].id === v1.id, [dc.status, dc.total]);
const dq = await listAll(A, `label=deleted&q=${encodeURIComponent(v2.name.slice(0, 12))}`);
R.check("nhãn deleted + ô tìm: chỉ vendor khớp tên (AND)", dq.status === 200 && dq.rows.length >= 1 && dq.rows.every((r) => r.id === v2.id), [dq.status, dq.total]);
const none = await listAll(A, "label=deleted&category=venue");
R.check("nhãn deleted + hạng mục không có vendor xoá: rỗng, total 0", none.status === 200 && none.total === 0, [none.status, none.total]);
const bad = await A("GET", "/api/admin/vendors?label=Deleted");
R.check("nhãn viết sai hoa/thường vẫn 400 invalid_label (không đổi)", bad.status === 400, bad.status);
const det = await A("GET", `/api/admin/vendors/${v1.id}`);
R.check("chi tiết admin của vendor đã xoá vẫn mở được: deleted:true, deleted_info {reason, at, by}", det.status === 200 && det.json?.deleted === true && det.json?.deleted_info?.reason === reason1 && det.json?.deleted_info?.by === ADMIN && !!det.json?.deleted_info?.at, [det.status, det.json?.deleted, det.json?.deleted_info]);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
