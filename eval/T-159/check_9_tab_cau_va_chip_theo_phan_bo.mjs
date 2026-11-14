// T-159 tiêu chí 9: mọi thứ tab Vendor hiển thị từ ngân sách hạng mục đi theo MỘT số duy nhất (ngân sách hiệu lực theo spec H1/H4):
//  (a) câu dưới danh sách whyThoseVendors ("Với khoảng {X}tr cho ..."), (b) chip lý do "Rẻ hơn {N}tr" / "Trong ngân sách" (match.reasons), ở cả /match và /:id.
// Hồ sơ tổng 300tr (tổng x tỷ lệ ảnh = 30tr). Vendor priceMax 12.
//  allocated 20tr -> câu "khoảng 20tr", chip "Rẻ hơn 8tr";  đổi 25tr -> "khoảng 25tr", "Rẻ hơn 13tr";  chưa phân bổ/không bảng -> "khoảng 30tr", "Trong ngân sách" (như cũ: chip chỉ dùng ngân sách hạng mục tường minh, không dùng tổng x tỷ lệ).
import { loadBack, tabMatch, tab, CID, eligible, overlayKeep, doc, coupleProfile, done } from "./_lib.mjs";
const M = await loadBack(); const fails = [];
const [V] = eligible(M, "photography");
const overlay = overlayKeep(M, "photography", [{ id: V.id, priceMin: 8, priceMax: 12 }]);
const P = coupleProfile({ budget: 300 });
const labels = (m) => (m?.reasons || []).map((r) => r.label || r);
const chip = (m) => labels(m).find((l) => /^Rẻ hơn \d+tr$|^Trong ngân sách$/.test(l));
const cases = [["allocated 20tr", doc({ photography: 20 }), 20, "Rẻ hơn 8tr"], ["đổi sang 25tr", doc({ photography: 25 }), 25, "Rẻ hơn 13tr"],
  ["allocated_tr = 0", doc({ photography: 0 }), 30, "Trong ngân sách"], ["không có bảng", undefined, 30, "Trong ngân sách"], ["bảng hỏng", "{hỏng", 30, "Trong ngân sách"]];
for (const [label, budgetDoc, x, wantChip] of cases) {
  const r = await tabMatch(M, "photography", { profile: P, budgetDoc, overlay });
  if (r.err || r.status !== 200) { fails.push(`${label}: lỗi ${r.err?.message || r.status}`); continue; }
  const sentence = r.body?.whyThoseVendors || "";
  if (!new RegExp(`khoảng ${x}tr cho`).test(sentence)) fails.push(`${label}: whyThoseVendors "${sentence.slice(0, 70)}" không chứa "khoảng ${x}tr cho"`);
  const got = chip(r.body?.vendors?.find((v) => v.id === V.id)?.match);
  if (got !== wantChip) fails.push(`${label}: chip ngân sách "${got}", mong "${wantChip}"`);
  const d = await tab(M, { url: `/api/vendors/${V.id}?coupleId=${CID}`, profile: P, budgetDoc, overlay });
  const gd = chip(d.body?.match);
  if (gd !== wantChip) fails.push(`${label}: chi tiết /:id chip "${gd}", mong "${wantChip}"`);
}
done(fails);
