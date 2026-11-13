// T-140 tiêu chí 2: bộ lọc cứng của đường chat (pool đông cứng + overlay): xác minh, không dưới 3,5 sao, hạng mục, thành phố (không tràn sang thành phố khác),
// ngân sách theo GIÁ HIỂN THỊ (priceMin <= ngân sách; vendor không có giá thì qua), điều không chịu được (dealbreaker), admin ẩn. Không ném lỗi khi rỗng.
import { frozenRoot, load, chat, candidates, overlayKeep, FROZEN, done } from "./_lib.mjs";
const M = await load(frozenRoot()); const fails = [];
const byId = new Map(M.POOL.map((v) => [v.id, v]));
const none = (label, r) => { if (r.ids.length || candidates(r.sp).length) fails.push(`${label}: còn ứng viên`); if (!r.sp.includes("Không có vendor phù hợp")) fails.push(`${label}: thiếu khối 'Không có vendor phù hợp'`); };
// thành phố: pool 100% HCMC, cặp đôi ở Hà Nội thì không có ứng viên (tab Vendor vẫn nới sang HCMC, chat thì không)
none("cặp đôi Hà Nội", await chat(M, { city: "Hà Nội" }));
// hạng mục không có vendor trong pool (MC) -> rỗng, không ném
none("MC/ban nhạc", await chat(M, { message: "Đề xuất MC đám cưới song ngữ giúp anh chị 10tr" }));
// ẩn hết hạng mục
none("ẩn hết photography", await chat(M, { overlay: overlayKeep(M, "photography", []) }));
// rating: không bao giờ có vendor 0 < rating < 3,5; xác minh
const low = FROZEN.filter((v) => v.rating > 0 && v.rating < 3.5);
for (const v of low) {
  const r = await chat(M, { category: v.category, budgetTr: 1000, overlay: overlayKeep(M, v.category, [{ id: v.id }]) });
  if (r.ids.includes(v.id)) fails.push(`vendor ${v.rating} sao vẫn vào ứng viên`);
}
// dealbreaker: gu luxury + dealbreaker luxury -> không ứng viên nào mang tag luxury; đối chứng không dealbreaker có luxury
const base = await chat(M, { styles: ["luxury"] });
if (!base.ids.some((id) => (byId.get(id).styles || []).includes("luxury"))) fails.push("đối chứng: gu luxury không ra vendor luxury nào (tín hiệu thử hỏng)");
const dz = await chat(M, { styles: ["luxury"], dealbreakers: ["Luxury "] });
if (!dz.ids.length) fails.push("dealbreaker: không còn ứng viên nào (pool còn nhiều vendor không luxury)");
for (const id of dz.ids) if ((byId.get(id).styles || []).some((t) => t.toLowerCase() === "luxury")) fails.push(`dealbreaker luxury: ${id} vẫn có tag luxury`);
// ngân sách theo giá hiển thị: mọi ứng viên có giá thì priceMin <= ngân sách (chưa nới) hoặc <= ngân sách x 1,2 (đã nới)
for (const [cat, b] of [["photography", 20], ["makeup", 5], ["venue", 100], ["decor", 10]]) {
  const r = await chat(M, { category: cat, budgetTr: b, guests: cat === "venue" ? 150 : null });
  const cap = r.md?.relaxations_applied?.length ? Math.trunc(b * 1e6 * 1.2) : b * 1e6;
  for (const m of r.md?.matches || []) if (m.price_range && m.price_range.min_vnd > cap) fails.push(`${cat} ${b}tr: ${m.vendor_id} giá từ ${m.price_range.min_vnd} vượt ${cap}`);
}
// vendor không có giá thì vẫn qua bộ lọc ngân sách và in 'Liên hệ để hỏi báo giá'
const np = FROZEN.find((v) => ["photography", "attire", "makeup", "decor", "transport", "venue"].includes(v.category) && !(v.priceMin > 0) && !(v.priceMax > 0) && v.isVerified && !(v.rating > 0 && v.rating < 3.5));
if (np) {
  const r = await chat(M, { category: np.category, budgetTr: 1, guests: np.category === "venue" ? 150 : null, overlay: overlayKeep(M, np.category, [{ id: np.id }]) });
  const c = candidates(r.sp);
  if (!r.ids.includes(np.id)) fails.push("vendor không giá bị bộ lọc ngân sách loại");
  else if (!/Liên hệ để hỏi báo giá/.test(c[0]?.priceLine || "")) fails.push(`vendor không giá in '${c[0]?.priceLine}'`);
}
done(fails);
