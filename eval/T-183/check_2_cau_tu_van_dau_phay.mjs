// T-183 tiêu chí 2. Hai câu tư vấn do back sinh (không qua AI) dùng cùng dấu PHẨY cho số tiền lẻ:
//  (a) match.whyThisVendor mặc định (không gu, không ngày): chứa NGUYÊN chip dấu phẩy, không còn số tiền dấu chấm;
//  (b) whyThoseVendors (câu dưới danh sách): "Với khoảng {ngân sách hạng mục}tr cho ... (≈ {giá/bàn}tr/bàn × N bàn)" và "giá dao động {min}–{max}tr[/bàn]"; mọi số tiền lẻ làm tròn 1 chữ số, dấu phẩy.
//  Số nguyên không đổi chữ ("(≈ 5tr/bàn × 30 bàn)", "giá dao động 4–9tr/bàn"); vendor giá ước tính vẫn không bị đếm vào "giá dao động".
// Chạy từ gốc tohong-hq: node eval/T-183/check_2_cau_tu_van_dau_phay.mjs
import { run, venue, vi, DOT_MONEY, bad, done } from "./_lib.mjs";
let n = 0;
for (const [price, guests] of [[3.9, 330], [4.25, 200], [4.6, 300]]) {   // (a)
  const x = run({ guestCount: guests, budgetByCategory: { venue: 5000 } }, [venue({ priceMin: price, priceMax: price })]).vendors[0]; n++;
  const t = Math.ceil(guests / 10), chip = `≈ ${vi(price)}tr/bàn × ${t} bàn = ${vi(price * t)}tr`, why = x.match.whyThisVendor;
  if (!why.includes(chip)) bad(`${price}tr x ${guests}: câu mặc định thiếu nguyên chip "${chip}": "${why}"`);
  if (DOT_MONEY.test(why)) bad(`${price}tr x ${guests}: câu mặc định còn số tiền dấu chấm: "${why}"`);
}
{ // (b) ngân sách hạng mục lẻ và đơn giá/bàn lẻ; khoảng giá lẻ
  const r = run({ guestCount: 300, budgetByCategory: { venue: 139.5 } }, [venue({ id: "a", priceMin: 3.9, priceMax: 3.9 }), venue({ id: "b", priceMin: 4.25, priceMax: 4.25 })]); n++;
  const w = r.whyThoseVendors || "";
  if (!w.includes(`139,5tr cho `)) bad(`câu danh sách: ngân sách hạng mục 139,5tr phải ghi "139,5tr cho ...": "${w}"`);
  if (!w.includes(`(≈ ${vi(139.5 / 30)}tr/bàn × 30 bàn)`)) bad(`câu danh sách: thiếu "(≈ ${vi(139.5 / 30)}tr/bàn × 30 bàn)": "${w}"`);
  if (!/giá dao động 3,9–4,3tr\/bàn/i.test(w)) bad(`câu danh sách: mong "giá dao động 3,9–4,3tr/bàn": "${w}"`);
  if (DOT_MONEY.test(w)) bad(`câu danh sách còn số tiền dấu chấm: "${w}"`);
}
{ // (b) hạng mục không theo bàn
  const r = run({ guestCount: 200, budgetByCategory: { photography: 39.5 } }, [venue({ id: "a", category: "photography", priceMin: 10.5, priceMax: 10.5 }), venue({ id: "b", category: "photography", priceMin: 15.5, priceMax: 15.5 })], "photography"); n++;
  const w = r.whyThoseVendors || "";
  if (!w.includes("39,5tr cho ")) bad(`photography: mong "39,5tr cho ...": "${w}"`);
  if (!/giá dao động 10,5–15,5tr(?!\/)/i.test(w)) bad(`photography: mong "giá dao động 10,5–15,5tr": "${w}"`);
  if (DOT_MONEY.test(w)) bad(`photography: còn số tiền dấu chấm: "${w}"`);
}
{ // số nguyên giữ nguyên chữ; ước tính không vào "giá dao động"
  const est = venue({ id: "e", priceMin: 2, priceMax: 20, priceSource: "estimate_category", price_basis: "estimate_category" });
  const r = run({ guestCount: 300, budgetByCategory: { venue: 150 } }, [venue({ id: "a", priceMin: 4, priceMax: 4 }), venue({ id: "b", priceMin: 9, priceMax: 9 }), est]); n++;
  const w = r.whyThoseVendors || "";
  if (!w.includes("Với khoảng 150tr cho ") || !w.includes("(≈ 5tr/bàn × 30 bàn)")) bad(`số nguyên đổi chữ: "${w}"`);
  if (!/giá dao động 4–9tr\/bàn/i.test(w)) bad(`số nguyên: mong "giá dao động 4–9tr/bàn" (ước tính không tính): "${w}"`);
}
done(n);
