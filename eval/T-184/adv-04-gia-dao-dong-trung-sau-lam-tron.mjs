// T-184 adv-04 (adversary): hai giá thô KHÁC nhau nhưng làm tròn TRÙNG (4.21 và 4.24 -> 4,2).
// Spec T-183 H1.4: điều kiện hiện vế "giá dao động" tính trên số thô, giữ nguyên -> vế vẫn hiện ("4,2–4,2tr/bàn").
// Eval khoá đúng chữ spec (minor đã nêu ở Spec Gate) và in câu để người đọc thấy; giá thô bằng nhau thì không có vế.
import { run, venue, DOT_MONEY, bad, done } from "../T-183/_lib.mjs";
const w1 = run({ guestCount: 300, budgetByCategory: { venue: 200 } }, [venue({ id: "a", priceMin: 4.21, priceMax: 4.21 }), venue({ id: "b", priceMin: 4.24, priceMax: 4.24 })]).whyThoseVendors;
console.log("4.21/4.24 ->", w1);
if (!/giá dao động 4,2–4,2tr\/bàn/i.test(w1)) bad(`mong vế theo spec (điều kiện số thô) "giá dao động 4,2–4,2tr/bàn": "${w1}"`);
const w2 = run({ guestCount: 300, budgetByCategory: { venue: 200 } }, [venue({ id: "a", priceMin: 4.2, priceMax: 4.2 }), venue({ id: "b", priceMin: 4.2, priceMax: 4.2 })]).whyThoseVendors;
if (/giá dao động/i.test(w2)) bad(`giá thô bằng nhau không được có vế dao động: "${w2}"`);
for (const w of [w1, w2]) if (DOT_MONEY.test(w)) bad(`dấu chấm: "${w}"`);
done(3);
