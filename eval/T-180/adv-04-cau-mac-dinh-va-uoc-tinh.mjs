// T-180 adv-04: câu whyThisVendor mặc định khi chip tổng đứng đầu (không gu, không ngày cưới).
// Mong đợi: (a) giá thật: câu chứa nguyên chip có tổng (đã toLowerCase không làm hỏng số) và tổng = r1(totalTr);
// (b) giá ước tính (estimate_*): không chip /bàn, câu không nói "Phù hợp ngân sách", không chứa "= …tr" hay "/bàn";
// (c) hạng mục khác venue (photography, có price_basis): không chip "/bàn", không "= …tr" trong chip; vẫn "Rẻ hơn"/"Trong ngân sách".
import { run, venue, tableChip, labels, r1, bad, done } from "./_adv.mjs";
let n = 0;
for (const price of [3, 4.25, 3.95]) {
  const x = run({ guestCount: 330, budgetByCategory: { venue: 5000 } }, venue({ priceMin: price, priceMax: price })); n++;
  const c = tableChip(x)[0]; const why = x.match.whyThisVendor;
  if (labels(x)[0] !== c) bad(`${price}: chip tổng không đứng đầu (${labels(x)})`);
  if (!why.includes(c)) bad(`${price}: câu mặc định không chứa nguyên chip: "${why}" / "${c}"`);
  if (!why.includes(`= ${r1(x.match.budgetBasis.totalTr)}tr`)) bad(`${price}: tổng trong câu ≠ totalTr: "${why}"`);
}
for (const src of ["estimate_category", "estimate_default"]) {
  const x = run({ guestCount: 200, budgetByCategory: { venue: 5000 } }, venue({ priceSource: src, price_basis: src })); n++;
  const why = x.match.whyThisVendor; const s = JSON.stringify(labels(x));
  if (tableChip(x).length) bad(`${src}: có chip /bàn ${s}`);
  if (/ngân sách/i.test(why) || /= [\d.,]+tr|\/bàn/.test(why)) bad(`${src}: câu khẳng định ngân sách/tổng cho giá ước tính: "${why}"`);
  if (/Trong ngân sách|Rẻ hơn/.test(s)) bad(`${src}: chip ngân sách cho giá ước tính ${s}`);
}
for (const [budget, want] of [[100, /^Rẻ hơn \d+tr$/], [16, /^Trong ngân sách$/]]) {
  const x = run({ guestCount: 200, budgetByCategory: { photography: budget } }, venue({ category: "photography", priceMin: 10, priceMax: 15 }), "photography"); n++;
  const s = labels(x);
  if (s.some((l) => /\/bàn|= [\d.]+tr/.test(l))) bad(`photography: chip theo bàn/tổng lọt ${JSON.stringify(s)}`);
  if (!s.some((l) => want.test(l))) bad(`photography ngân sách ${budget}: thiếu chip ${want} (${JSON.stringify(s)})`);
}
done(n);
