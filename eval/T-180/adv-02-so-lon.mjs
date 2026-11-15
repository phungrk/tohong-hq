// T-180 adv-02: số rất lớn. 120tr × 360 bàn = 43200tr; 999,95 × 1000 bàn; 2500 × 999 bàn.
// Mong đợi: tổng viết liền, không dấu phân cách nghìn (",", ".", khoảng trắng), không "tỷ", không ký hiệu mũ "e".
import { run, venue, tableChip, r1, SHAPE, bad, done } from "./_adv.mjs";
let n = 0;
for (const [price, guests, want] of [[120, 3600, "43200"], [999.95, 10000, r1(999.95 * 1000)], [2500, 9990, "2497500"], [12.5, 3600, "4500"]]) {
  const tables = Math.ceil(guests / 10); n++;
  const c = tableChip(run({ guestCount: guests, budgetByCategory: { venue: 1e12 } }, venue({ priceMin: price, priceMax: price })));
  if (c.length !== 1) { bad(`${price}×${tables}: ${c.length} chip`); continue; }
  const tot = c[0].match(/= (.*)tr$/)?.[1];
  if (tot !== want) bad(`${price}×${tables}: tổng "${tot}" ≠ "${want}" (${c[0]})`);
  if (!SHAPE.test(c[0]) || /tỷ|e\+|[ ,]\d{3}tr$/.test(c[0])) bad(`${price}×${tables}: sai khuôn số lớn "${c[0]}"`);
}
done(n);
