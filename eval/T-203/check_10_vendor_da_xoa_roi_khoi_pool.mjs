#!/usr/bin/env node
// T-203 tiêu chí 10 (repo tohong-back): vendor đã xoá rồi bị pipeline gỡ khỏi pool (thành "mồ côi") chỉ nằm ở nhãn "Đã xoá", khôi phục được (200) rồi dọn bằng "Bỏ ghi đè";
// chiều ngược lại (pipeline đưa vendor đã xoá trở lại pool): cờ xoá vẫn thắng.
// Mô phỏng pipeline bằng cách rút/đưa lại phần tử trong VENDOR_POOL (cùng mô-đun với worker); không gieo khoá R2 tay nên không phụ thuộc cách đặt tên khoá nội bộ.
// Chạy từ gốc tohong-hq: node eval/T-203/check_10_vendor_da_xoa_roi_khoi_pool.mjs
import { fresh, pickTarget, chatIds, asAdmin, asCouple, DEL, RES, listAll, loadOverlay, VENDOR_POOL, reporter, outbound } from "./lib/common.mjs";
const R = reporter();
const { env } = fresh();
const A = asAdmin(env), C = asCouple(env);
const ov = (id) => `/api/admin/vendors/${id}/override`;
const X = (await pickTarget(env, "photography")), Y = await pickTarget(env, "makeup"), Z = await pickTarget(env, "decor");
R.check("tiền điều kiện: ba vendor khác nhau", [X.id, Y.id, Z.id].every(Boolean) && new Set([X.id, Y.id, Z.id]).size === 3);
const nameX = VENDOR_POOL.find((v) => v.id === X.id).name;
// X: có bản sửa giá; Y: không có bản sửa; Z: có trong pool và quay lại pool
const px = await A("PUT", ov(X.id), { priceMin: 5, priceMax: 6, expected_version: 0 });
R.check("chuẩn bị: X có bản sửa giá", px.status === 200, [px.status, px.text.slice(0, 60)]);
for (const [v, ver] of [[X, px.json?.version ?? 1], [Y, 0], [Z, 0]]) {
  const d = await A("POST", DEL(v.id), { expected_version: ver, reason: "eval T-203: đóng cửa" });
  R.check(`xoá ${v.id}: 200`, d.status === 200, [d.status, d.text.slice(0, 60)]);
}
// Pipeline gỡ X, Y khỏi pool
const drop = (id) => { const i = VENDOR_POOL.findIndex((v) => v.id === id); const [v] = VENDOR_POOL.splice(i, 1); return { i, v }; };
const back = (r) => VENDOR_POOL.splice(r.i, 0, r.v);
const dX = drop(X.id), dY = drop(Y.id);
await loadOverlay(env, { force: true });

const lab = await listAll(A, "label=deleted");
const rx = lab.rows.find((r) => r.id === X.id), ry = lab.rows.find((r) => r.id === Y.id);
R.check("nhãn Đã xoá: X và Y (đã rời pool) vẫn có mặt, kèm lý do/thời điểm/người", !!rx && !!ry && rx.deleted === true && rx.deleted_reason === "eval T-203: đóng cửa" && !!rx.deleted_at && !!rx.deleted_by, [lab.total, rx]);
R.check("hàng đã xoá rời pool: orphan:false (không là 'Mồ côi'), in_pool:false (để màn hiện ghi chú 'không còn trong pool')", rx?.orphan === false && rx?.in_pool === false && ry?.orphan === false && ry?.in_pool === false, [rx?.orphan, rx?.in_pool]);
for (const label of ["orphan", "hidden", "overridden", "estimated", "has_contact", "missing_contact", "estimate_category", "legacy_marry", "verified"]) {
  const l = await listAll(A, `label=${label}`);
  R.check(`nhãn ${label}: không có X, Y đã xoá`, l.status === 200 && !l.rows.some((r) => r.id === X.id || r.id === Y.id), l.status);
}
const def = await listAll(A);
R.check("danh sách mặc định: không có X, Y đã xoá", !def.rows.some((r) => r.id === X.id || r.id === Y.id));
const dt = await A("GET", `/api/admin/vendors/${X.id}`);
R.check("chi tiết admin của X: 200, deleted:true, deleted_info có lý do, in_pool:false, orphan không phải true", dt.status === 200 && dt.json?.deleted === true && !!dt.json?.deleted_info?.reason && dt.json?.in_pool === false && dt.json?.orphan !== true, [dt.status, dt.json?.deleted, dt.json?.in_pool, dt.json?.orphan]);
const e1 = await A("PUT", ov(X.id), { priceMin: 1, expected_version: dt.json?.version ?? 0 }), e2 = await A("DELETE", ov(X.id), { expected_version: dt.json?.version ?? 0 }), e3 = await A("POST", DEL(X.id), { expected_version: dt.json?.version ?? 0, reason: "lần hai" });
R.check("X đang xoá và đã rời pool: sửa / Bỏ ghi đè -> 409 vendor_deleted; xoá lần nữa -> 404 vendor_not_found (không còn trong pool)", e1.status === 409 && e1.json?.error === "vendor_deleted" && e2.status === 409 && e2.json?.error === "vendor_deleted" && e3.status === 404 && e3.json?.error === "vendor_not_found", [e1.status, e2.status, e3.status]);

// Khôi phục X (có bản sửa): 200, rồi hiện ở Mồ côi như khi chưa xoá; dọn bằng Bỏ ghi đè
const rsx = await A("POST", RES(X.id), { expected_version: dt.json?.version ?? 0 });
R.check("khôi phục X đã rời pool: 200 (không 404, không kẹt)", rsx.status === 200 && rsx.json?.ok === true, [rsx.status, rsx.text.slice(0, 80)]);
const after = await listAll(A, "label=orphan"), delAfter = await listAll(A, "label=deleted");
const ox = after.rows.find((r) => r.id === X.id);
R.check("sau khôi phục: X hiện ở nhãn Mồ côi (vì còn bản sửa giá 5-6), deleted:false, không còn ở Đã xoá", !!ox && ox.orphan === true && ox.deleted === false && ox.priceMin === 5 && !delAfter.rows.some((r) => r.id === X.id), [ox, delAfter.total]);
const clean = await A("DELETE", ov(X.id), { expected_version: (await A("GET", `/api/admin/vendors/${X.id}`)).json?.version ?? 0 });
R.check("'Bỏ ghi đè' dọn X như mồ côi thường: 200", clean.status === 200, [clean.status, clean.text.slice(0, 80)]);
R.check("sau dọn: X không còn ở nhãn nào (Mồ côi, Đã xoá, mặc định)", !(await listAll(A, "label=orphan")).rows.some((r) => r.id === X.id) && !(await listAll(A, "label=deleted")).rows.some((r) => r.id === X.id) && !(await listAll(A)).rows.some((r) => r.id === X.id));

// Khôi phục Y (không có bản sửa nào): biến mất khỏi mọi nhãn
const rsy = await A("POST", RES(Y.id), { expected_version: (await A("GET", `/api/admin/vendors/${Y.id}`)).json?.version ?? 0 });
R.check("khôi phục Y (không có bản sửa, đã rời pool): 200", rsy.status === 200, [rsy.status, rsy.text.slice(0, 80)]);
const yAll = await Promise.all(["", "label=orphan", "label=deleted", "label=overridden"].map((q) => listAll(A, q)));
R.check("sau khôi phục: Y biến mất khỏi mọi nhãn (không để lại hàng mồ côi rỗng)", yAll.every((l) => !l.rows.some((r) => r.id === Y.id)), yAll.map((l) => l.total));
R.check("Y sau khôi phục: chi tiết admin 404 vendor_not_found (như id lạ)", (await A("GET", `/api/admin/vendors/${Y.id}`)).status === 404);
// Khôi phục id mồ côi KHÔNG đang xoá vẫn 404 (như cũ)
const po = await A("PUT", ov("mo_coi_x"), { priceMin: 1, expected_version: 0 });
const ro = await A("POST", RES("mo_coi_x"), { expected_version: po.json?.version ?? 1 });
R.check("khôi phục mồ côi thường (không có cờ xoá): 404 vendor_not_found (không đổi)", po.status === 200 && ro.status === 404 && ro.json?.error === "vendor_not_found", [po.status, ro.status]);

// Chiều ngược: Z đã xoá, rời pool rồi quay lại pool -> cờ xoá vẫn thắng
const dZ = drop(Z.id); await loadOverlay(env, { force: true }); back(dZ); await loadOverlay(env, { force: true });
const st = await C("POST", "/api/vendors/status", { ids: [Z.id] });
R.check("Z quay lại pool: cặp đôi vẫn thấy hidden:true (cờ xoá thắng), không ở ghép theo id, không ở ứng viên chat", st.json?.vendors?.[Z.id]?.hidden === true && !((await C("GET", `/api/vendors/match?ids=${Z.id}`)).json?.vendors || []).some((v) => v.id === Z.id) && !(await chatIds(env, Z.mp)).includes(Z.id), st.json?.vendors?.[Z.id]);
const zl = await listAll(A, "label=deleted"), zr = zl.rows.find((r) => r.id === Z.id);
R.check("Z quay lại pool: vẫn ở nhãn Đã xoá (in_pool:true), không ở danh sách mặc định", !!zr && zr.in_pool === true && !(await listAll(A)).rows.some((r) => r.id === Z.id), zr);
back(dY); back(dX); // trả pool như cũ (an toàn nếu eval mở rộng)
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
