// T-217 tiêu chí 5 (ADR-138, bổ sung hạ tầng back): vendor có pool priceSource "verified" (đúng dạng generator ghi: không priceAsOf) hiện ra ở MỌI bề mặt API cặp đôi
// (POST /api/vendors/status, GET /api/vendors/:id, GET /api/vendors/match) với price_basis "source_verified", price_label "Giá đã xác minh", price_as_of null (không overlay);
// overlay admin vẫn thắng (giá chưa xác minh: "admin"; price_verified: "admin_verified"). Vendor verified thật của pool (Bình Quới 2, marry_b92e8a86175d) cũng vậy.
// Đối chứng: legacy_marry và estimate_category giữ price_basis cũ. Chạy: node eval/T-217/<file> · Biến: TOHONG_BACK_REPO.
import * as H from "./_back217.mjs";
const M = await H.loadBack(); const { VA, VB, LC, EC } = H.ids; const BQ2 = "marry_b92e8a86175d";
const fails = []; const bad = (m) => { if (fails.length < 30) fails.push(m); };
if (!M.POOL.some((v) => v.id === BQ2 && v.priceSource === "verified")) bad("pool thật không còn Bình Quới 2 với priceSource verified (đối chứng mất)");
const WANT = { price_basis: "source_verified", price_label: "Giá đã xác minh", price_as_of: null };
const keep = [VA, VB, LC, EC, BQ2]; const hideOthers = H.hide(M, keep);
const variants = {
  "không overlay": { ov: {}, want: { [VA]: WANT, [VB]: WANT, [BQ2]: WANT } },
  "giá chưa xác minh": { ov: Object.fromEntries([VA, VB, BQ2].map((i) => [i, { priceMin: 7, priceMax: 9 }])), want: Object.fromEntries([VA, VB, BQ2].map((i) => [i, { price_basis: "admin", price_label: "Giá do Tơ Hồng cập nhật" }])) },
  "giá đã xác minh": { ov: Object.fromEntries([VA, VB, BQ2].map((i) => [i, { priceMin: 7, priceMax: 9, price_verified: true }])), want: Object.fromEntries([VA, VB, BQ2].map((i) => [i, { price_basis: "admin_verified", price_label: "Giá đã xác minh" }])) },
  "chỉ xác minh": { ov: Object.fromEntries([VA, VB, BQ2].map((i) => [i, { price_verified: true }])), want: Object.fromEntries([VA, VB, BQ2].map((i) => [i, { price_basis: "admin_verified", price_label: "Giá đã xác minh" }])) },
};
const prof = H.coupleProfile({ budget: 300, guest_count: 300 });
const chk = (where, v, want) => { for (const [k, x] of Object.entries(want)) if (v?.[k] !== x) bad(`${where}: ${k} mong ${JSON.stringify(x)}, thấy ${JSON.stringify(v?.[k])}`); };
for (const [name, { ov, want }] of Object.entries(variants)) {
  const overlay = { ...hideOthers, ...ov };
  const st = await H.api(M, { method: "POST", url: "/api/vendors/status", body: { ids: keep }, overlay, profile: prof });
  if (st.status !== 200) bad(`status[${name}]: HTTP ${st.status}`);
  for (const id of Object.keys(want)) {
    chk(`status[${name}] ${id}`, st.body?.vendors?.[id], want[id]);
    const d = await H.api(M, { url: `/api/vendors/${id}?coupleId=${H.CID}`, overlay, profile: prof });
    if (d.status !== 200) bad(`chi tiết[${name}] ${id}: HTTP ${d.status}`); else chk(`chi tiết[${name}] ${id}`, d.body?.vendor, want[id]);
  }
  const m = await H.match(M, "venue", { overlay, profile: prof });
  for (const id of Object.keys(want)) { const v = m.body?.vendors?.find((x) => x.id === id); if (!v) bad(`match[${name}]: thiếu ${id}`); else chk(`match[${name}] ${id}`, v, want[id]); }
}
{ // đối chứng: nguồn khác giữ nguyên
  const m = await H.match(M, "venue", { overlay: hideOthers, profile: prof });
  const g = (id) => m.body?.vendors?.find((x) => x.id === id);
  if (g(LC)?.price_basis !== "legacy_marry") bad(`đối chứng legacy_marry: price_basis ${g(LC)?.price_basis}`);
  if (g(EC)?.price_basis !== "estimate_category" || g(EC)?.price_label !== "Ước tính theo hạng mục") bad(`đối chứng estimate_category: ${g(EC)?.price_basis}/${g(EC)?.price_label}`);
}
H.done(fails);
