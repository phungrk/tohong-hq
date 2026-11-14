// T-159 tiêu chí 5: map hạng mục bảng dự toán <-> category vendor đầy đủ, một-một; eval FAIL khi có hạng mục mới chưa map. ĐO BẰNG HÀNH VI:
//  - danh sách hạng mục = những gì GET /api/couples/:id/budget trả khi chưa có bảng (máy chủ điền theo mẫu);
//  - danh sách category vendor = GET /api/vendors/categories;
//  - với mỗi (hạng mục b, category c): phân bổ CHỈ b = 50tr (hồ sơ không có tổng) rồi chấm một vendor của c có priceMax 50: điểm ngân sách 1 nghĩa là "b ăn vào c" (không phân bổ -> 0,5).
// Yêu cầu: mỗi hạng mục ăn vào đúng 1 category, trừ NO_VENDOR_OK (chỉ reserve) ăn vào 0; mỗi category bị đúng 1 hạng mục ăn vào; hạng mục tự thêm ăn vào 0.
// Category không có vendor đủ điều kiện trong pool không đo được -> FAIL (cần vendor trong pool để chứng minh map).
// Danh sách NO_VENDOR_OK là quyết định sản phẩm: thêm id vào đây phải qua spec.
import { loadBack, tabMatch, tab, getBudgetDoc, CID, eligible, overlayKeep, doc, coupleProfile, budgetScoreOf, done } from "./_lib.mjs";
const M = await loadBack(); const fails = [];
const NO_VENDOR_OK = ["reserve"];
const bdoc = await getBudgetDoc(M, { profile: coupleProfile({ budget: 300 }), budgetDoc: undefined });
const budgetIds = (bdoc.categories || []).map((c) => c.id);
const cr = await tab(M, { url: `/api/vendors/categories?coupleId=${CID}` });
const vendorCats = (Array.isArray(cr.body) ? cr.body : []).map((c) => c.category);
if (!budgetIds.length || !vendorCats.length) { fails.push(`không liệt kê được hạng mục (${budgetIds.length}) hoặc category (${vendorCats.length})`); done(fails); }
const hits = Object.fromEntries(budgetIds.map((b) => [b, []])); const byCat = Object.fromEntries(vendorCats.map((c) => [c, []]));
for (const c of vendorCats) {
  const v = eligible(M, c)[0];
  if (!v) { fails.push(`category '${c}' không có vendor đủ điều kiện trong pool: không đo được map`); continue; }
  const ov = overlayKeep(M, c, [{ id: v.id, priceMin: 40, priceMax: 50 }]);
  for (const b of budgetIds) {
    const r = await tabMatch(M, c, { profile: coupleProfile(), budgetDoc: doc({ [b]: 50 }, { total_tr: 0 }), overlay: ov });
    const s = budgetScoreOf(r, v.id);
    if (r.err || (s !== 1 && s !== 0.5)) { fails.push(`(${b} -> ${c}): điểm ngân sách ${s}, mong 1 hoặc 0,5`); continue; }
    if (s === 1) { hits[b].push(c); byCat[c].push(b); }
  }
}
for (const b of budgetIds) {
  if (hits[b].length > 1) fails.push(`hạng mục '${b}' ăn vào nhiều category (${hits[b]}): một allocated_tr không chia được`);
  if (hits[b].length === 0 && !NO_VENDOR_OK.includes(b)) fails.push(`hạng mục '${b}' không ăn vào category vendor nào và không nằm trong NO_VENDOR_OK (${NO_VENDOR_OK}): hạng mục mới chưa map?`);
  if (hits[b].length && NO_VENDOR_OK.includes(b)) fails.push(`'${b}' nằm trong NO_VENDOR_OK nhưng đang ăn vào ${hits[b]}`);
}
for (const c of vendorCats) if (byCat[c].length !== 1) fails.push(`category '${c}' bị ${byCat[c].length} hạng mục ăn vào (${byCat[c]}), mong đúng 1`);
{ // hạng mục tự thêm không ăn vào đâu
  const c = vendorCats[0]; const v = eligible(M, c)[0];
  if (v) { const r = await tabMatch(M, c, { profile: coupleProfile(), budgetDoc: doc({}, { total_tr: 0, extra: [{ id: "c1700000", name: "Tự thêm", allocated_tr: 50, items: [] }] }), overlay: overlayKeep(M, c, [{ id: v.id, priceMin: 40, priceMax: 50 }]) });
    if (budgetScoreOf(r, v.id) !== 0.5) fails.push("hạng mục tự thêm c1700000 làm đổi điểm ngân sách"); }
}
done(fails);
