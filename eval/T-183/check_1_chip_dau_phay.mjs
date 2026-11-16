// T-183 tiêu chí 1. Chip lý do theo bàn của nhà hàng dùng dấu PHẨY cho số lẻ (khuôn T-167): "≈ 3,9tr/bàn × 20 bàn = 78tr", "= 128,7tr".
// Ba số trong chip vẫn là ba số của match.budgetBasis (làm tròn 1 chữ số, bỏ ",0"); tổng trong chip trùng tổng trong budgetBasis.text; chi tiết cho đúng chip như danh sách;
// số trong JSON (budgetBasis.pricePerTableTr, totalTr) vẫn là số đầy đủ. Số nguyên không đổi ("≈ 3tr/bàn × 20 bàn = 60tr"). Chữ KHÔNG phải tiền giữ dấu chấm:
// "Đánh giá cao (4.9★)", "Còn lịch 20.3". "Rẻ hơn Ntr" (số nguyên) của hạng mục khác không đổi. Không chữ tiền nào trong reasons còn dạng "3.9tr".
// Chạy từ gốc tohong-hq: node eval/T-183/check_1_chip_dau_phay.mjs
import { run, venue, labels, vi, CHIP, DOT_MONEY, bad, done } from "./_lib.mjs";
let n = 0;
const CASES = [   // [giá/bàn, khách, chip mong (viết tay)]
  [3, 200, "≈ 3tr/bàn × 20 bàn = 60tr"],
  [3.9, 200, "≈ 3,9tr/bàn × 20 bàn = 78tr"],
  [3.9, 330, "≈ 3,9tr/bàn × 33 bàn = 128,7tr"],
  [4.25, 200, "≈ 4,3tr/bàn × 20 bàn = 85tr"],
  [4.6, 300, "≈ 4,6tr/bàn × 30 bàn = 138tr"],
  [3.95, 330, null], [12.5, 360, null], [0.5, 10, null],
];
for (const [price, guests, want] of CASES) {
  const r = run({ guestCount: guests, budgetByCategory: { venue: 5000 } }, [venue({ priceMin: price, priceMax: price })]); n++;
  const x = r.vendors[0], tag = `${price}tr x ${guests} khách`;
  const chips = labels(x).filter((l) => /\/bàn/.test(l)); const bb = x?.match?.budgetBasis;
  if (chips.length !== 1) { bad(`${tag}: mong đúng 1 chip theo bàn, thấy ${JSON.stringify(labels(x))}`); continue; }
  const c = chips[0], tables = Math.ceil(guests / 10);
  const exp = want || `≈ ${vi(price)}tr/bàn × ${tables} bàn = ${vi(price * tables)}tr`;
  if (c !== exp) bad(`${tag}: chip "${c}", mong "${exp}"`);
  if (!CHIP.test(c)) bad(`${tag}: chip "${c}" sai khuôn dấu phẩy`);
  if (!(Math.abs(bb.totalTr - price * tables) < 1e-6 && bb.pricePerTableTr === price)) bad(`${tag}: số trong JSON phải đầy đủ (giá ${bb.pricePerTableTr}, tổng ${bb.totalTr}), không làm tròn`);
  if (!bb.text.includes(`= ${vi(bb.totalTr)}tr so với`)) bad(`${tag}: tổng trong chip khác tổng trong budgetBasis.text "${bb.text}"`);
}
{ // chữ không phải tiền giữ dấu chấm: đánh giá, ngày; và không còn số tiền lẻ dấu chấm nào trong reasons
  const r = run({ guestCount: 200, budgetByCategory: { venue: 5000 }, weddingDate: "2029-03-20" }, [venue({ priceMin: 3.9, priceMax: 3.9, rating: 4.9, reviewCount: 60, availability: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] })]); n++;
  const ls = labels(r.vendors[0]);
  if (!ls.includes("≈ 3,9tr/bàn × 20 bàn = 78tr")) bad(`ca đánh giá/ngày: thiếu chip dấu phẩy, thấy ${JSON.stringify(ls)}`);
  if (!ls.some((l) => /^Còn lịch 20\.3$/.test(l))) bad(`ngày giữ dấu chấm "Còn lịch 20.3", thấy ${JSON.stringify(ls)}`);
  const r2 = run({ guestCount: 200, budgetByCategory: { venue: 5000 } }, [venue({ priceMin: 3.9, priceMax: 3.9, rating: 4.9, reviewCount: 60 })]); n++;
  if (!labels(r2.vendors[0]).includes("Đánh giá cao (4.9★)")) bad(`đánh giá giữ dấu chấm "Đánh giá cao (4.9★)", thấy ${JSON.stringify(labels(r2.vendors[0]))}`);
  for (const l of [...ls, ...labels(r2.vendors[0])]) if (DOT_MONEY.test(l)) bad(`số tiền còn dấu chấm: "${l}"`);
}
{ // hạng mục khác: chip "Rẻ hơn Ntr" số nguyên không đổi; không chip theo bàn
  const x = run({ guestCount: 200, budgetByCategory: { photography: 100 } }, [venue({ category: "photography", priceMin: 10.5, priceMax: 15.5 })], "photography").vendors[0]; n++;
  const ls = labels(x);
  if (!ls.some((l) => /^Rẻ hơn \d+tr$/.test(l))) bad(`photography: thiếu chip "Rẻ hơn Ntr" số nguyên, thấy ${JSON.stringify(ls)}`);
  if (ls.some((l) => /\/bàn/.test(l))) bad(`photography: không được có chip theo bàn ${JSON.stringify(ls)}`);
}
done(n);
