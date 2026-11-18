#!/usr/bin/env node
// T-206 adv-07 (adversary, tầng 3): số đếm `total` của TỪNG nhãn ở GET /api/admin/vendors sau khi xoá ba vendor (một đang ẩn, một có bản sửa giá+liên hệ, một không bản sửa).
// Spec T-203 Tình huống 3: "Danh sách admin mặc định (Mọi nhãn) và mọi nhãn khác… không có vendor đã xoá; total không đếm chúng"; label=deleted chỉ liệt kê vendor đã xoá.
// Mong đợi: total(nhãn, sau) = total(nhãn, trước) - số vendor bị xoá từng thuộc nhãn đó; total = số hàng đọc hết trang; label=deleted total 3; khôi phục đưa mọi total về như trước.
// Chạy từ gốc tohong-hq: node eval/T-206/adv-07-dem-tung-nhan-sau-xoa.mjs
import { fresh, pickTarget, asAdmin, DEL, RES, listAll, reporter, outbound } from "../T-203/lib/common.mjs";
const R = reporter();
const { env } = fresh();
const A = asAdmin(env);
const LABELS = ["", "hidden", "overridden", "verified", "estimate_category", "legacy_marry", "orphan"];
const H = await pickTarget(env, "makeup"), O = await pickTarget(env, "photography"), N = await pickTarget(env, "decor");
await A("PUT", `/api/admin/vendors/${H.id}/override`, { hidden: true, hidden_reason: "ẩn", expected_version: 0 });
await A("PUT", `/api/admin/vendors/${O.id}/override`, { priceMin: 5, priceMax: 6, price_verified: true, contact: { phone: "0900000002" }, expected_version: 0 });
await A("PUT", "/api/admin/vendors/mo_coi_adv07/override", { priceMin: 1, expected_version: 0 }).catch(() => null);
const counts = async () => { const out = {}; for (const l of LABELS) { const r = await listAll(A, l ? `label=${l}` : ""); out[l || "all"] = { total: r.total, n: r.rows.length, ids: new Set(r.rows.map((x) => x.id)) }; } return out; };
const c0 = await counts();
const victims = [H.id, O.id, N.id];
for (const id of victims) { const d = await A("GET", `/api/admin/vendors/${id}`); const r = await A("POST", DEL(id), { expected_version: d.json?.version ?? 0, reason: "adv-07" }); R.check(`xoá ${id} 200`, r.status === 200, [r.status, r.text.slice(0, 60)]); }
const c1 = await counts();
for (const k of Object.keys(c0)) {
  const was = victims.filter((id) => c0[k].ids.has(id)).length;
  R.check(`nhãn ${k}: total sau = trước - ${was}; total = số hàng đọc được; không còn id đã xoá`, c1[k].total === c0[k].total - was && c1[k].total === c1[k].n && !victims.some((id) => c1[k].ids.has(id)), [c0[k].total, c1[k].total, c1[k].n, was]);
}
const del = await listAll(A, "label=deleted");
R.check("label=deleted: total 3, đúng ba id", del.total === 3 && del.rows.length === 3 && victims.every((id) => del.rows.some((r) => r.id === id)), [del.total, del.rows.map((r) => r.id)]);
for (const id of victims) { const d = await A("GET", `/api/admin/vendors/${id}`); await A("POST", RES(id), { expected_version: d.json?.version ?? 0 }); }
const c2 = await counts();
for (const k of Object.keys(c0)) R.check(`nhãn ${k}: khôi phục xong total và tập id y như trước xoá`, c2[k].total === c0[k].total && [...c0[k].ids].every((id) => c2[k].ids.has(id)) && c2[k].ids.size === c0[k].ids.size, [c0[k].total, c2[k].total]);
const del2 = await listAll(A, "label=deleted");
R.check("label=deleted sau khôi phục: rỗng", del2.total === 0 && del2.rows.length === 0, del2.total);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
