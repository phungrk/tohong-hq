// T-159 tiêu chí 5: map id hạng mục bảng dự toán <-> category vendor đầy đủ, một-một; eval FAIL khi có hạng mục mới chưa map.
// Tĩnh: mọi id trong BUDGET_TEMPLATE có dòng trong BUDGET_TO_VENDOR_CATEGORIES; chỉ "reserve" được không có vendor (danh sách NO_VENDOR_OK dưới đây; thêm id vào
// danh sách này là quyết định sản phẩm, phải qua spec, không phải sửa cho khớp); mỗi hạng mục map tới tối đa 1 category; mỗi category vendor (CATEGORIES trừ "all", và mọi category có trong pool)
// được đúng 1 hạng mục map tới.
// Động: với MỖI category vendor, chỉ phân bổ cho đúng hạng mục map tới nó (các hạng mục khác để số khác) thì tab chấm điểm ngân sách theo số đó: phân bổ = priceMax -> 1; phân bổ nhỏ -> 0.
import { loadBack, tabMatch, eligible, overlayKeep, doc, coupleProfile, budgetScoreOf, done } from "./_lib.mjs";
const M = await loadBack(); const fails = [];
const NO_VENDOR_OK = ["reserve"];
const T = M.BUDGET_TEMPLATE.map((t) => t.id), MAP = M.BUDGET_TO_VENDOR_CATEGORIES;
const vendorCats = M.CATEGORIES.map((c) => c.id).filter((id) => id !== "all");
for (const id of T) {
  if (!(id in MAP)) { fails.push(`hạng mục '${id}' (BUDGET_TEMPLATE) chưa có dòng trong BUDGET_TO_VENDOR_CATEGORIES`); continue; }
  if (!Array.isArray(MAP[id]) || MAP[id].some((x) => typeof x !== "string")) { fails.push(`map của '${id}' không phải mảng chuỗi`); continue; }
  if (MAP[id].length === 0 && !NO_VENDOR_OK.includes(id)) fails.push(`hạng mục '${id}' không có category vendor và không nằm trong danh sách được phép không có vendor (${NO_VENDOR_OK})`);
  if (MAP[id].length > 1) fails.push(`hạng mục '${id}' map một-nhiều (${MAP[id]}); một số allocated_tr không chia được cho nhiều category`);
}
for (const id of NO_VENDOR_OK) if ((MAP[id] || []).length) fails.push(`'${id}' đang có vendor (${MAP[id]}); bỏ khỏi NO_VENDOR_OK qua spec`);
for (const id of Object.keys(MAP)) if (!T.includes(id)) fails.push(`map có khoá '${id}' không có trong BUDGET_TEMPLATE`);
const poolCats = [...new Set(M.POOL.map((v) => v.category))];
for (const c of new Set([...vendorCats, ...poolCats])) {
  const owners = T.filter((id) => (MAP[id] || []).includes(c));
  if (owners.length !== 1) fails.push(`category vendor '${c}' được map bởi ${owners.length} hạng mục (${owners}), mong đúng 1`);
  if (!vendorCats.includes(c)) fails.push(`category '${c}' có trong pool nhưng không có trong CATEGORIES`);
}
for (const c of vendorCats) {
  const owner = T.find((id) => (MAP[id] || []).includes(c)); const v = eligible(M, c)[0];
  if (!owner || !v) continue;
  const ov = overlayKeep(M, c, [{ id: v.id, priceMin: 40, priceMax: 50 }]);
  const others = Object.fromEntries(T.filter((id) => id !== owner).map((id) => [id, 20]));
  for (const [own, want] of [[50, 1], [10, 0]]) {
    const r = await tabMatch(M, c, { profile: coupleProfile(), budgetDoc: doc({ ...others, [owner]: own }), overlay: ov });
    const s = budgetScoreOf(r, v.id);
    if (r.err || s !== want) fails.push(`category '${c}': phân bổ '${owner}' = ${own}tr (các hạng mục khác 20tr), điểm ngân sách ${s}, mong ${want}`);
  }
}
done(fails);
