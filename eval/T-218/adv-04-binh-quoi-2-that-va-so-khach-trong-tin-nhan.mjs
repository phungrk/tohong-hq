// T-218 adversary 04 (tầng 3): spec T-217 Hành vi 5, ca thật nêu trong spec + số khách đến từ tin nhắn chat thay vì hồ sơ.
// (a) Bình Quới 2 THẬT (marry_b92e8a86175d, pool verified 6,37168tr/bàn): 300 khách, ngân sách venue 90tr -> điểm ngân sách 0 ở chi tiết và match, không chip "Rẻ hơn"/"Trong ngân sách";
//     nhãn cặp đôi "Giá đã xác minh"; 0 khách -> 0,5 không chip.
// (b) Chat, hồ sơ KHÔNG có số khách, tin nhắn nêu "300 khách": venue verified và legacy_marry cùng giá 3,4tr/bàn phải cùng qua/cùng bị lọc ở 80tr (102 > 96), 90tr (102 <= 108).
// Chạy: node eval/T-218/<file> · Biến: TOHONG_BACK_REPO.
import * as H from "./_adv218.mjs";
const { M, ids: [VA, LA] } = await H.loadTwins([
  { priceMin: 3.4, priceMax: 3.4, priceSource: "verified" },
  { priceMin: 3.4, priceMax: 3.4, priceSource: "legacy_marry", priceAsOf: "2026-10" },
]);
const BQ2 = "marry_b92e8a86175d";
const fails = []; const bad = (m) => { if (fails.length < 30) fails.push(m); };
const P = (g, bc) => H.coupleProfile({ budget: 300, ...(g ? { guest_count: g } : {}), budget_by_category: { venue: bc } });
{
  const d = await H.api(M, { url: `/api/vendors/${BQ2}?coupleId=${H.CID}`, profile: P(300, 90) });
  if (d.status !== 200) bad(`chi tiết BQ2 HTTP ${d.status}`);
  else {
    const v = d.body.vendor, mt = d.body.match;
    if (v.price_label !== "Giá đã xác minh" || v.price_basis !== "source_verified" || v.price_source !== "verified") bad(`BQ2 nhãn ${v.price_label}/${v.price_basis}/${v.price_source}`);
    if (mt?.scoreBreakdown?.budget !== 0) bad(`BQ2 300 khách 90tr: điểm ngân sách mong 0, thấy ${mt?.scoreBreakdown?.budget}`);
    if ((mt?.reasons || []).some((x) => /Rẻ hơn|Trong ngân sách/.test(x.label))) bad(`BQ2: chip sai ${JSON.stringify(mt.reasons.map((x) => x.label))}`);
  }
  const ov = H.hide(M, [BQ2]);
  const m = await H.match(M, "venue", { overlay: ov, profile: P(300, 90) });
  const it = m.body?.vendors?.find((x) => x.id === BQ2);
  if (it && it.match?.scoreBreakdown?.budget !== 0) bad(`match BQ2: điểm ${it.match?.scoreBreakdown?.budget}`);
  const z = await H.api(M, { url: `/api/vendors/${BQ2}?coupleId=${H.CID}`, profile: P(0, 90) });
  if (z.body?.match?.scoreBreakdown?.budget !== 0.5) bad(`BQ2 không số khách: điểm mong 0,5, thấy ${z.body?.match?.scoreBreakdown?.budget}`);
}
{
  const ov = H.hide(M, [VA, LA]);
  for (const bc of [80, 84, 86, 90]) {
    const c = await H.chat(M, { message: `Tìm nhà hàng tiệc cưới 300 khách, ngân sách nhà hàng ${bc}tr`, profile: H.coupleProfile({ budget: 300 }), overlay: ov });
    if (c.err) { bad(`chat ${bc}tr lỗi ${c.err.message}`); continue; }
    if (c.ids.includes(VA) !== c.ids.includes(LA)) bad(`chat số khách trong tin nhắn, ${bc}tr: verified ${c.ids.includes(VA)}, legacy ${c.ids.includes(LA)}`);
  }
}
H.done(fails);
