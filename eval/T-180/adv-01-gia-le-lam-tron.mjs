// T-180 adv-01: giá lẻ (4,25 / 3,95 / 4,05 / 2,35 / 0,15 / 12,45) × số bàn (1, 21, 33, 360, 999).
// Mong đợi: chip đúng khuôn chấm; {tổng} = r1(priceMax × N) = r1(budgetBasis.totalTr), totalTr = priceMax × N chưa làm tròn; {giá} = r1(priceMax).
import { run, venue, tableChip, r1, SHAPE, bad, done } from "./_adv.mjs";
let n = 0;
for (const price of [4.25, 3.95, 4.05, 2.35, 0.15, 12.45]) for (const guests of [1, 201, 330, 3600, 9990]) {
  const tables = Math.ceil(guests / 10);
  const x = run({ guestCount: guests, budgetByCategory: { venue: 1e9 } }, venue({ priceMin: price, priceMax: price }));
  const c = tableChip(x); n++;
  const want = `≈ ${r1(price)}tr/bàn × ${tables} bàn = ${r1(price * tables)}tr`;
  if (c.length !== 1) { bad(`${price}×${guests} khách: ${c.length} chip /bàn (${JSON.stringify(c)})`); continue; }
  if (c[0] !== want) bad(`${price}×${tables}: chip "${c[0]}" ≠ "${want}"`);
  if (!SHAPE.test(c[0])) bad(`${price}×${tables}: sai khuôn "${c[0]}"`);
  const bb = x.match.budgetBasis;
  if (!bb || bb.kind !== "per_table" || bb.totalTr !== price * tables || bb.tables !== tables) bad(`${price}×${tables}: budgetBasis lệch ${JSON.stringify(bb)}`);
  else if (!c[0].endsWith(`= ${r1(bb.totalTr)}tr`)) bad(`${price}×${tables}: tổng chip ≠ r1(totalTr)`);
  const fromText = bb?.text?.match(/= ([\d,]+)tr/)?.[1]?.replace(",", ".");
  if (fromText !== c[0].match(/= ([\d.]+)tr$/)?.[1]) bad(`${price}×${tables}: tổng chip ≠ tổng trong budgetBasis.text (${bb?.text})`);
}
done(n);
