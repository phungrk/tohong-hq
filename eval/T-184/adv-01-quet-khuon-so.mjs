// T-184 adv-01 (adversary): quét lưới giá lẻ x số khách x ngân sách. Mọi chữ do back sinh cho cặp đôi
// (chip, whyThisVendor, whyThoseVendors, budgetBasis.text) không có số tiền dấu chấm, không có ",0",
// không "NaN"/"e+"; chip đúng khuôn, ba số chip = vi(budgetBasis), tổng chip = tổng trong budgetBasis.text.
// Biên làm tròn: 3.95/3.96 -> 4 (không ",0"), 4.05, 4.25, 9.95 -> 10, 99.95 -> 100, số khách 95 (10 bàn), 3600.
import { run, venue, labels, vi, CHIP, DOT_MONEY, bad, done } from "../T-183/_lib.mjs";
const prices = [0.5, 1.05, 2.45, 3.9, 3.95, 3.96, 4.05, 4.25, 4.6, 5.55, 9.95, 12.34, 99.95];
for (let p = 1; p <= 15; p += 0.37) prices.push(Math.round(p * 100) / 100);
const guests = [10, 95, 200, 330, 555, 1001, 3600];
const budgets = [undefined, 50, 139.5, 1234.56, 99.95];
let n = 0;
const texts = (r) => [r.whyThoseVendors || "", ...r.vendors.flatMap((v) => [...labels(v), v.match.whyThisVendor || "", v.match.budgetBasis?.text || ""])];
for (const p of prices) for (const g of guests) for (const b of budgets) {
  const prof = { guestCount: g, budgetByCategory: b == null ? {} : { venue: b } };
  const r = run(prof, [venue({ id: "a", name: "A", priceMin: p, priceMax: p }), venue({ id: "b", name: "B", priceMin: p + 0.35, priceMax: p + 0.35 })]);
  for (const t of texts(r)) {
    n++;
    if (DOT_MONEY.test(t)) bad(`p=${p} g=${g} b=${b}: số tiền dấu chấm: "${t}"`);
    if (/\d,0(?=tr|–|\b)(?!\d)/.test(t)) bad(`p=${p} g=${g} b=${b}: còn ",0": "${t}"`);
    if (/NaN|e\+|undefined/.test(t)) bad(`p=${p} g=${g} b=${b}: chữ hỏng: "${t}"`);
  }
  for (const v of r.vendors) {
    const bb = v.match.budgetBasis;
    const chip = labels(v).find((l) => l.startsWith("≈"));
    if (!chip) continue;
    if (!CHIP.test(chip)) bad(`chip sai khuôn: "${chip}"`);
    const want = `≈ ${vi(bb.pricePerTableTr)}tr/bàn × ${bb.tables} bàn = ${vi(bb.totalTr)}tr`;
    if (chip !== want) bad(`chip "${chip}" != từ budgetBasis "${want}"`);
    if (!bb.text.includes(`= ${vi(bb.totalTr)}tr`)) bad(`tổng chip không có trong budgetBasis.text: "${bb.text}"`);
    if (typeof bb.totalTr !== "number" || bb.totalTr !== v.priceMax * bb.tables) bad(`JSON totalTr không đầy đủ: ${bb.totalTr}`);
  }
}
done(n);
