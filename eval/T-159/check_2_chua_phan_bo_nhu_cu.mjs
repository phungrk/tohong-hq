// T-159 tiêu chí 2 (chat): hạng mục "chưa phân bổ" dùng tổng x tỷ lệ BUDGET_TEMPLATE như cũ (chỉ khi KHÔNG có allocated_tr > 0 hợp lệ), rồi mặc định, không ném.
// "Chưa phân bổ" gồm: allocated_tr = 0; thiếu hạng mục; không có bảng; bảng hỏng; giá trị không phải số hữu hạn > 0 (chuỗi chữ, null, âm); hạng mục reserve; hạng mục tự thêm.
// Hồ sơ tổng 300tr -> ảnh cưới 30tr. Vendor priceMin 28 phải qua (không bị coi là ngân sách 0); vendor priceMin 38 phải bị loại (nới 36 chưa tới).
import { loadBack, chat, eligible, overlayKeep, keepPrice, doc, coupleProfile, done } from "./_lib.mjs";
const M = await loadBack(); const fails = [];
const six = eligible(M, "photography").slice(0, 6);
const cases = {
  "allocated_tr = 0": doc({ photography: 0 }),
  "thiếu hạng mục ảnh trong bảng": doc({ venue: 100 }),
  "không có bảng": undefined,
  "bảng không phải JSON": "{không phải json",
  "bảng là null": "null",
  "categories không phải mảng": { categories: "x", total_tr: 300 },
  "categories có phần tử rác": { categories: [null, 5, "a", { id: "photography" }], total_tr: 300 },
  "allocated_tr là chuỗi chữ": doc({ photography: "abc" }),
  "allocated_tr null": doc({ photography: null }),
  "allocated_tr âm": doc({ photography: -5 }),
  "chỉ reserve có số lớn": doc({ reserve: 500, photography: 0 }),
  "hạng mục tự thêm c1700000 có số lớn": doc({ photography: 0 }, { extra: [{ id: "c1700000", name: "Nhiếp ảnh", allocated_tr: 500, items: [] }] }),
};
for (const [label, budgetDoc] of Object.entries(cases)) {
  for (const [pmin, n] of [[28, 5], [38, 0]]) {
    const r = await chat(M, { budgetDoc, profile: coupleProfile({ budget: 300 }), overlay: overlayKeep(M, "photography", keepPrice(six, pmin, pmin + 1)) });
    if (r.err) fails.push(`${label}: ném ${r.err.message}`); else if (r.ids.length !== n) fails.push(`${label}, vendor priceMin ${pmin}: ${r.ids.length} ứng viên, mong ${n}`);
  }
}
// Không có tổng ngân sách, không phân bổ -> mặc định 20tr cho ảnh cưới (nới 24tr): vendor 18 qua, vendor 26 bị loại.
for (const [pmin, n] of [[18, 5], [26, 0]]) {
  const r = await chat(M, { budgetDoc: doc({ photography: 0 }, { total_tr: 0 }), profile: coupleProfile(), overlay: overlayKeep(M, "photography", keepPrice(six, pmin, pmin + 1)) });
  if (r.err) fails.push(`mặc định: ném ${r.err.message}`); else if (r.ids.length !== n) fails.push(`không tổng, không phân bổ, vendor priceMin ${pmin}: ${r.ids.length} ứng viên, mong ${n} (mặc định ảnh cưới 20tr)`);
}
done(fails);
