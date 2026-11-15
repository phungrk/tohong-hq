// T-180 adv-03: đầu vào hỏng/biên. Số khách 1 → 1 bàn; "200" (chuỗi) → 20 bàn; 0, -5, "", "abc", NaN, undefined → không chip /bàn.
// priceMax NaN / 0 / undefined / "abc" → không chip /bàn, không chữ "NaN"/"undefined" ở reasons và whyThisVendor (phạm vi T-178; budgetBasis.text thuộc T-167, pool đã được planner/vendor/inv-001 gác giá hợp lệ).
import { run, venue, tableChip, labels, bad, done } from "./_adv.mjs";
let n = 0;
const leak = (x, tag) => { const s = JSON.stringify([labels(x), x.match.whyThisVendor]); if (/NaN|undefined|Infinity/.test(s)) bad(`${tag}: rò ${s}`); };
for (const [g, want] of [[1, "≈ 3tr/bàn × 1 bàn = 3tr"], ["200", "≈ 3tr/bàn × 20 bàn = 60tr"], [11, "≈ 3tr/bàn × 2 bàn = 6tr"]]) {
  const x = run({ guestCount: g, budgetByCategory: { venue: 500 } }, venue()); n++;
  const c = tableChip(x); if (c.length !== 1 || c[0] !== want) bad(`khách ${JSON.stringify(g)}: ${JSON.stringify(c)} ≠ ${want}`); leak(x, `khách ${g}`);
}
for (const g of [0, -5, "", "abc", NaN, undefined, null]) {
  const x = run({ guestCount: g, budgetByCategory: { venue: 500 } }, venue()); n++;
  if (tableChip(x).length) bad(`khách ${JSON.stringify(g)}: vẫn có chip ${tableChip(x)}`); leak(x, `khách ${g}`);
}
for (const pm of [NaN, 0, undefined, "abc"]) {
  const x = run({ guestCount: 200, budgetByCategory: { venue: 500 } }, venue({ priceMin: pm, priceMax: pm })); n++;
  if (tableChip(x).length) bad(`priceMax ${String(pm)}: vẫn có chip ${tableChip(x)}`); leak(x, `priceMax ${String(pm)}`);
}
done(n);
