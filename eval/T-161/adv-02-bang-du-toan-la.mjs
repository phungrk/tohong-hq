// T-161 adv-02 (Code Gate, tầng 3). Spec T-159 H3/H4/H7: bảng dự toán lạ. Số tab dùng (câu whyThoseVendors "khoảng Xtr") phải là:
// số GET /budget hiển thị nếu Number(.) hữu hạn > 0 (sau co giãn), ngược lại tổng x tỷ lệ (300 x 10% = 30tr); không ném, 200.
import { loadBack, tabMatch, getBudgetDoc, eligible, overlayKeep, doc, coupleProfile, done } from "../T-159/_lib.mjs";
const M = await loadBack(); const fails = [];
const [v] = eligible(M, "photography");
const ov = overlayKeep(M, "photography", [{ id: v.id, priceMin: 10, priceMax: 15 }]);
const cat = (id, a) => ({ id, name: id, allocated_tr: a, items: [] });
const raw = (categories, total_tr = 300) => ({ categories, total_tr, guests: 0, mung_tr: 0, updated_at: null });
const cases = [
  ["allocated chuỗi số '20'", raw([cat("photography", "20")]), 300, 20],
  ["allocated thập phân 37.5", raw([cat("photography", 37.5)]), 300, 37.5],
  ["allocated 'Infinity'", raw([cat("photography", "Infinity")]), 300, 30],
  ["allocated chữ 'abc'", raw([cat("photography", "abc")]), 300, 30],
  ["allocated rất lớn 1e9", raw([cat("photography", 1e9)]), 300, 1e9],
  ["id viết hoa 'Photography'", raw([cat("Photography", 20)]), 300, 30],
  ["categories là object", { categories: { photography: { allocated_tr: 20 } }, total_tr: 300 }, 300, 30],
  ["categories phần tử rác", raw([null, 5, "x", [], cat("photography", 20)]), 300, 20],
  ["hồ sơ budget 0, bảng có phân bổ", raw([cat("photography", 20)]), 0, 20],
  ["co giãn làm tròn: bảng 300, hồ sơ 250, ảnh 37", raw([cat("photography", 37)]), 250, 31],
  ["co giãn về 0: bảng 3000, hồ sơ 100, ảnh 4", raw([cat("photography", 4)], 3000), 100, 10],
  ["total_tr chuỗi '300' khớp hồ sơ", raw([cat("photography", 20)], "300"), 300, 20],
  ["hồ sơ budget chuỗi '150', bảng 300", raw([cat("photography", 20)]), "150", 10],
  ["reserve lớn không ảnh hưởng", raw([cat("reserve", 250)]), 300, 30],
];
for (const [label, d, budget, wantX] of cases) {
  const profile = coupleProfile(budget === 0 ? {} : { budget });
  const r = await tabMatch(M, "photography", { profile, budgetDoc: d, overlay: ov });
  if (r.err || r.status !== 200) { fails.push(`${label}: lỗi ${r.err?.message || r.status}`); continue; }
  const why = String(r.body?.whyThoseVendors ?? "");
  const want = wantX === null ? null : `khoảng ${wantX}tr`;
  if (label.startsWith("hồ sơ budget 0")) { if (!why.includes("khoảng 20tr")) fails.push(`${label}: câu "${why}", mong chứa "khoảng 20tr"`); continue; }
  if (!why.includes(want)) fails.push(`${label}: câu "${why}", mong chứa "${want}"`);
  // đối chiếu với số GET /budget hiển thị khi có
  if (Array.isArray(d.categories) && !label.startsWith("id viết hoa") && !label.includes("rác")) {
    const g = await getBudgetDoc(M, { profile, budgetDoc: d });
    const shown = Number(g.categories?.find((c) => c && c.id === "photography")?.allocated_tr);
    if (Number.isFinite(shown) && shown > 0 && shown !== wantX && !label.startsWith("co giãn về 0")) fails.push(`${label}: GET /budget hiện ${shown}tr nhưng eval mong ${wantX} (eval sai?)`);
  }
}
done(fails);
