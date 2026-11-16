// T-184 adv-02 (adversary): ngân sách hạng mục là CHUỖI số (hồ sơ cũ legacy budget_by_category không ép kiểu ở api/vendors.js),
// hạng mục không theo bàn có ngân sách lẻ, và ngân sách suy từ tổng (Math.round, số nguyên). Mong: dấu phẩy, không NaN, số nguyên không đổi.
import { run, venue, DOT_MONEY, bad, done } from "../T-183/_lib.mjs";
let n = 0;
const chk = (name, w, must, mustNot = []) => {
  n++;
  for (const m of must) if (!w.includes(m)) bad(`${name}: thiếu "${m}": "${w}"`);
  for (const m of mustNot) if (w.includes(m)) bad(`${name}: không được có "${m}": "${w}"`);
  if (DOT_MONEY.test(w) || /NaN/.test(w)) bad(`${name}: dấu chấm/NaN: "${w}"`);
};
const two = [venue({ id: "a", priceMin: 3.9, priceMax: 3.9 }), venue({ id: "b", priceMin: 4.25, priceMax: 4.25 })];
chk("venue chuỗi '139.5'", run({ guestCount: 300, budgetByCategory: { venue: "139.5" } }, two).whyThoseVendors, ["139,5tr cho ", "(≈ 4,7tr/bàn × 30 bàn)", "3,9–4,3tr/bàn"]);
chk("venue chuỗi '150'", run({ guestCount: 300, budgetByCategory: { venue: "150" } }, two).whyThoseVendors, ["150tr cho ", "(≈ 5tr/bàn × 30 bàn)"], ["150,0", "5,0tr"]);
const ph = (id, a, b) => ({ ...venue({ id, priceMin: a, priceMax: b }), category: "photography", price_basis: undefined, priceSource: undefined });
chk("photography 12.25", run({ guestCount: 300, budgetByCategory: { photography: 12.25 } }, [ph("p1", 8.5, 10.25), ph("p2", 9, 11)], "photography").whyThoseVendors, ["12,3tr cho ", "8,5–11tr"], ["/bàn"]);
// tổng × tỉ lệ: Math.round -> số nguyên
const w = run({ guestCount: 300, budgetTotal: 333, budgetByCategory: {} }, two).whyThoseVendors || "";
n++; const m = w.match(/khoảng ([\d,]+)tr cho/); if (m && m[1].includes(",")) bad(`ngân sách suy từ tổng phải nguyên: "${w}"`);
if (DOT_MONEY.test(w)) bad(`tổng × tỉ lệ còn dấu chấm: "${w}"`);
done(n);
