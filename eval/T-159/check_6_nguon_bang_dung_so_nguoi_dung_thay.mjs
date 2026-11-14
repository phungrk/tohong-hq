// T-159 tiêu chí 6: số allocated_tr dùng để ghép = số mà GET /api/couples/:id/budget trả cho hạng mục đó (đã co giãn theo profile.budget khi tổng đổi), tính bằng triệu,
// NGOẠI LỆ: hạng mục thiếu trong bảng hoặc chưa có bảng thì KHÔNG được "điền sẵn" (làm tròn) — dùng tổng x tỷ lệ chính xác như cũ.
// (i) bảng lưu tổng 500tr, ảnh 100tr; hồ sơ tổng 250tr -> GET trả ảnh 50tr; chat: vendor priceMin 70 bị loại, vendor priceMin 45 qua; tab: vendor priceMax 80 điểm ngân sách 0.
// (ii) bảng 500tr ảnh 100tr, hồ sơ không có tổng -> không co giãn: ảnh 100tr; chat vendor priceMin 70 qua.
// (iii) ảnh thiếu trong bảng, hồ sơ tổng 255tr -> tổng x tỷ lệ = 25,5tr chính xác (không làm tròn 26tr): tab vendor priceMax 26 điểm 0,90 (không phải 1).
import { loadBack, chat, tabMatch, getBudgetDoc, eligible, overlayKeep, keepPrice, doc, coupleProfile, budgetScoreOf, done } from "./_lib.mjs";
const M = await loadBack(); const fails = [];
const six = eligible(M, "photography").slice(0, 6);
const near = (x, y) => typeof x === "number" && Math.abs(x - y) < 0.01;
const stored = doc({ photography: 100 }, { total_tr: 500 });
{
  const g = await getBudgetDoc(M, { profile: coupleProfile({ budget: 250 }), budgetDoc: stored });
  const got = g.categories?.find((c) => c.id === "photography")?.allocated_tr;
  if (got !== 50) fails.push(`tín hiệu thử hỏng: GET /budget trả ảnh ${got}tr, mong 50`);
}
for (const [label, profile, pmin, n] of [["(i) co giãn: priceMin 70", coupleProfile({ budget: 250 }), 70, 0], ["(i) co giãn: priceMin 45", coupleProfile({ budget: 250 }), 45, 5], ["(ii) không co giãn: priceMin 70", coupleProfile(), 70, 5]]) {
  const r = await chat(M, { profile, budgetDoc: stored, overlay: overlayKeep(M, "photography", keepPrice(six, pmin, pmin + 1)) });
  if (r.err) fails.push(`${label}: ném ${r.err.message}`); else if (r.ids.length !== n) fails.push(`${label}: ${r.ids.length} ứng viên, mong ${n}`);
}
{
  const v = six[0]; const ov = overlayKeep(M, "photography", [{ id: v.id, priceMin: 10, priceMax: 80 }]);
  const r = await tabMatch(M, "photography", { profile: coupleProfile({ budget: 250 }), budgetDoc: stored, overlay: ov });
  if (!near(budgetScoreOf(r, v.id), 0)) fails.push(`(i) tab: điểm ngân sách ${budgetScoreOf(r, v.id)}, mong 0 (ngân sách 50tr sau co giãn; 100tr chưa co giãn cho 1)`);
}
{
  const v = six[0]; const ov = overlayKeep(M, "photography", [{ id: v.id, priceMin: 10, priceMax: 26 }]);
  for (const [label, budgetDoc] of [["ảnh thiếu trong bảng", doc({ venue: 100 }, { total_tr: 255 })], ["không có bảng", undefined]]) {
    const r = await tabMatch(M, "photography", { profile: coupleProfile({ budget: 255 }), budgetDoc, overlay: ov });
    if (!near(budgetScoreOf(r, v.id), 0.9021)) fails.push(`(iii) ${label}: điểm ngân sách ${budgetScoreOf(r, v.id)}, mong ~0,90 (25,5tr chính xác)`);
  }
}
done(fails);
