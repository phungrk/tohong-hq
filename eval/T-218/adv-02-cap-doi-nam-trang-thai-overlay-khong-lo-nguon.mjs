// T-218 adversary 02 (tầng 3): spec T-217 Hành vi 5 + 7 trên MỌI bề mặt cặp đôi (status, chi tiết, match, siêu dữ liệu + prompt chat) với vendor pool "verified"
// dưới 6 trạng thái overlay, gồm hai ca check_5/check_8 không chạm: overlay price_verified:false không giá, và overlay chỉ có trường không phải giá (contact).
// Mong đợi: không overlay giá (kể cả price_verified:false, kể cả overlay chỉ contact) -> source_verified / "Giá đã xác minh" / price_as_of null / price_source "verified";
// overlay có giá chưa xác minh -> admin / "Giá do Tơ Hồng cập nhật" / "estimated"; price_verified:true -> admin_verified / "Giá đã xác minh" / "verified".
// Không bề mặt cặp đôi nào có price_source "source_verified" hay chữ "(nguồn)"; prompt chat không chứa "source_verified" hay "(nguồn)". Chạy: node eval/T-218/<file>.
import * as H from "./_adv218.mjs";
const { M, ids: [VA, LC] } = await H.loadTwins([
  { priceMin: 3.4, priceMax: 3.4, priceSource: "verified" },
  { priceMin: 4.6, priceMax: 4.6, priceSource: "legacy_marry", priceAsOf: "2026-10" },
]);
const BQ2 = "marry_b92e8a86175d";
const fails = []; const bad = (m) => { if (fails.length < 30) fails.push(m); };
const hideOthers = H.hide(M, [VA, LC, BQ2]);
const SV = { price_basis: "source_verified", price_label: "Giá đã xác minh", price_as_of: null, price_source: "verified" };
const AD = { price_basis: "admin", price_label: "Giá do Tơ Hồng cập nhật", price_as_of: null, price_source: "estimated" };
const AV = { price_basis: "admin_verified", price_label: "Giá đã xác minh", price_as_of: null, price_source: "verified" };
const states = {
  "không overlay": [null, SV],
  "price_verified:false không giá": [{ price_verified: false }, SV],
  "overlay chỉ contact": [{ contact: { phone: "0900000000" } }, SV],
  "chỉ priceMax chưa xác minh": [{ priceMax: 9 }, AD],
  "giá chưa xác minh": [{ priceMin: 7, priceMax: 9, price_verified: false }, AD],
  "giá đã xác minh": [{ priceMin: 7, priceMax: 9, price_verified: true }, AV],
  "chỉ xác minh": [{ price_verified: true }, AV],
};
const prof = H.coupleProfile({ budget: 300, guest_count: 300, budget_by_category: { venue: 150 } });
const cmp = (where, got, want) => { for (const [k, w] of Object.entries(want)) if (got?.[k] !== w) bad(`${where}: ${k} mong ${JSON.stringify(w)}, thấy ${JSON.stringify(got?.[k])}`); };
const leak = (where, obj) => { const s = JSON.stringify(obj); if (/"price_source":"source_verified"/.test(s)) bad(`${where}: lộ price_source source_verified cho cặp đôi`); if (/\(nguồn\)/.test(s)) bad(`${where}: lộ nhãn admin "(nguồn)" cho cặp đôi`); };
for (const [name, [o, want]] of Object.entries(states)) {
  const overlay = { ...hideOthers, ...(o ? { [VA]: o, [BQ2]: o } : {}) };
  const st = await H.api(M, { method: "POST", url: "/api/vendors/status", body: { ids: [VA, LC, BQ2] }, overlay, profile: prof });
  leak(`status[${name}]`, st.body);
  for (const id of [VA, BQ2]) cmp(`status[${name}] ${id === VA ? "VA" : "BQ2"}`, st.body?.vendors?.[id], want);
  const d = await H.api(M, { url: `/api/vendors/${VA}?coupleId=${H.CID}`, overlay, profile: prof });
  leak(`chi tiết[${name}]`, d.body); cmp(`chi tiết[${name}]`, d.body?.vendor, want);
  const m = await H.match(M, "venue", { overlay, profile: prof });
  leak(`match[${name}]`, m.body); cmp(`match[${name}]`, m.body?.vendors?.find((v) => v.id === VA), want);
  const c = await H.chat(M, { message: "Tìm nhà hàng tiệc cưới giúp anh chị 150tr", profile: H.coupleProfile({ budget: 300, guest_count: 300 }), overlay });
  if (c.err) { bad(`chat[${name}] lỗi ${c.err.message}`); continue; }
  leak(`chat md[${name}]`, c.md);
  if (/source_verified|\(nguồn\)/.test(c.sp || "")) bad(`chat prompt[${name}]: chứa source_verified/(nguồn), AI có thể nói lại với cặp đôi`);
  const it = (c.md?.matches || []).find((x) => x.vendor_id === VA);
  if (it && it.price_source !== want.price_source) bad(`chat md[${name}]: price_source mong ${want.price_source}, thấy ${it.price_source}`);
  // đối chứng legacy luôn "estimated", nhãn tháng
  cmp(`status[${name}] LC`, st.body?.vendors?.[LC], { price_basis: "legacy_marry", price_source: "estimated" });
}
H.done(fails);
