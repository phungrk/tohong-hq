#!/usr/bin/env node
// T-206 adv-01 (adversary, tầng 3): sau khôi phục, trường `deleted` PHẢI có mặt và bằng false (không chỉ "không phải true"):
// ở chi tiết admin (deleted:false, deleted_info:null) và ở hàng danh sách (deleted:false), với cả ba kiểu bản sửa (không có / có giá / đang ẩn).
// Spec T-203 §Hợp đồng API: "GET /api/admin/vendors/:id thêm in_pool: bool, deleted: bool"; "GET /api/admin/vendors mỗi hàng thêm deleted: bool và in_pool: bool".
// Kèm: vendor đã xoá rồi rời pool: /status không bao giờ trả hidden:false (null = "không còn trong pool", hoặc hidden:true).
// Chạy từ gốc tohong-hq: node eval/T-206/adv-01-co-xoa-co-mat-va-false-sau-khoi-phuc.mjs
import { fresh, pickTarget, asAdmin, asCouple, DEL, RES, listAll, reporter, outbound, loadOverlay, VENDOR_POOL } from "../T-203/lib/common.mjs";
const R = reporter();
const { env } = fresh();
const A = asAdmin(env), C = asCouple(env);
const cases = [["không bản sửa", "photography", null], ["có giá", "makeup", { priceMin: 3, priceMax: 5 }], ["đang ẩn", "decor", { hidden: true, hidden_reason: "adv ẩn" }]];
for (const [name, cat, prep] of cases) {
  const T = await pickTarget(env, cat);
  if (prep) await A("PUT", `/api/admin/vendors/${T.id}/override`, { ...prep, expected_version: 0 });
  const d0 = await A("GET", `/api/admin/vendors/${T.id}`);
  R.check(`${name}: trước xoá chi tiết có deleted === false (boolean, có mặt) và in_pool === true`, d0.json?.deleted === false && d0.json?.in_pool === true, [d0.json?.deleted, d0.json?.in_pool]);
  const del = await A("POST", DEL(T.id), { expected_version: d0.json?.version ?? 0, reason: "adv-01" });
  const res = await A("POST", RES(T.id), { expected_version: del.json?.version ?? 0 });
  R.check(`${name}: xoá + khôi phục 200`, del.status === 200 && res.status === 200, [del.status, res.status, res.text.slice(0, 80)]);
  const d1 = await A("GET", `/api/admin/vendors/${T.id}`);
  R.check(`${name}: sau khôi phục chi tiết có khoá 'deleted' và === false`, d1.json && Object.prototype.hasOwnProperty.call(d1.json, "deleted") && d1.json.deleted === false, d1.json && Object.keys(d1.json));
  R.check(`${name}: sau khôi phục deleted_info có mặt và null`, d1.json && "deleted_info" in d1.json && d1.json.deleted_info === null, d1.json?.deleted_info);
  R.check(`${name}: override sau khôi phục không chứa khoá deleted*`, !Object.keys(d1.json?.override || {}).some((k) => k.startsWith("deleted")), d1.json?.override);
  const all = await listAll(A, "");
  const row = all.rows.find((r) => r.id === T.id);
  R.check(`${name}: sau khôi phục hàng danh sách có deleted === false và in_pool === true`, !!row && row.deleted === false && row.in_pool === true, row && [row.deleted, row.in_pool]);
}
// Vendor đã xoá rồi rời pool: phía cặp đôi không bao giờ thấy "còn nhận đặt"
const P = await pickTarget(env, "photography");
const tid = P.ids.find((x) => x !== P.id);
const del = await A("POST", DEL(tid), { expected_version: 0, reason: "adv-01 rời pool" });
R.check("tiền điều kiện: xoá vendor sẽ rời pool 200", del.status === 200, [del.status, del.text.slice(0, 80)]);
const idx = VENDOR_POOL.findIndex((v) => v.id === tid); const [gone] = VENDOR_POOL.splice(idx, 1);
await loadOverlay(env, { force: true });
const st = await C("POST", "/api/vendors/status", { ids: [tid] });
const s = st.json?.vendors?.[tid];
R.check("đã xoá + rời pool: /status trả null hoặc hidden:true, không bao giờ hidden:false", st.status === 200 && (s === null || s === undefined || s?.hidden === true), s);
const one = await C("GET", `/api/vendors/${tid}`);
R.check("đã xoá + rời pool: /api/vendors/:id không trả vendor hiện được (404 hoặc hidden:true)", one.status === 404 || one.json?.vendor?.hidden === true, [one.status, one.text.slice(0, 80)]);
VENDOR_POOL.splice(idx, 0, gone);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
