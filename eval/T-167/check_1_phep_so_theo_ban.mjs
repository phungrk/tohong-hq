// T-167 tiêu chí 1. Dòng Ngân sách (match.budgetBasis) của venue theo bàn ghi phép so bằng ĐÚNG số server dùng, ở cả danh sách match và chi tiết vendor.
// Chạy từ gốc tohong-hq: node eval/T-167/check_1_phep_so_theo_ban.mjs
import { setup, matchOne, detailOne, budgetDoc, coupleProfile, restoreNow, done, ids, expectScore } from "./_lib.mjs";
const fails = []; const bad = (m) => fails.push(m);
const M = await setup();
// [nhãn, hồ sơ, bảng, số bàn mong, tổng mong, ngân sách hạng mục mong, văn bản mong (chuỗi con), nguồn ngân sách hạng mục mong]
const cases = [
  ["Alice & Capu (cưới 29.12.2027): 200 khách, tiệc cưới 90tr", coupleProfile({ budget: 200, guest_count: 200, couple: { city: "TP.HCM", wedding_date: "2027-12-29" } }), budgetDoc(90, { guests: 200 }), 20, 78, 90, "≈ 3,9tr/bàn × 20 bàn = 78tr so với 90tr tiệc cưới", "allocation"],
  ["bảng ghi 300 khách thắng hồ sơ 200 (phải lộ số lệch)", coupleProfile({ budget: 200, guest_count: 200 }), budgetDoc(90, { guests: 300 }), 30, 117, 90, "≈ 3,9tr/bàn × 30 bàn = 117tr so với 90tr tiệc cưới", "allocation"],
  ["bảng guests 0 => lấy hồ sơ 200", coupleProfile({ budget: 200, guest_count: 200 }), budgetDoc(90, { guests: 0 }), 20, 78, 90, "= 78tr so với 90tr tiệc cưới", "allocation"],
  ["tổng hồ sơ 100 lệch tổng bảng 200: phân bổ co giãn 90 -> 45", coupleProfile({ budget: 100, guest_count: 200 }), budgetDoc(90, { total_tr: 200, guests: 200 }), 20, 78, 45, "≈ 3,9tr/bàn × 20 bàn = 78tr so với 45tr tiệc cưới", "allocation"],
  ["không có bảng: ước theo tổng 200 x 48% = 96", coupleProfile({ budget: 200, guest_count: 200 }), undefined, 20, 78, 96, "= 78tr so với 96tr tiệc cưới (ước theo tổng ngân sách)", "total_share"],
  ["không có bảng, hồ sơ cũ budget_by_category.venue 70", coupleProfile({ budget: 200, guest_count: 200, budget_by_category: { venue: 70 } }), undefined, 20, 78, 70, "= 78tr so với 70tr tiệc cưới", "legacy_profile"],
];
for (const [label, profile, doc, tables, total, cat, text, src] of cases) {
  const m = await matchOne(M, { id: ids.R1, profile, doc });
  if (m.r.err || m.r.status !== 200 || !m.v) { bad(`${label}: match lỗi ${m.r.err?.message || m.r.status}`); continue; }
  const bb = m.v.match?.budgetBasis;
  if (!bb) { bad(`${label}: thiếu match.budgetBasis`); continue; }
  const want = { kind: "per_table", tables, totalTr: total, categoryBudgetTr: cat, categoryBudgetSource: src, pricePerTableTr: 3.9 };
  for (const [k, w] of Object.entries(want)) if (bb[k] !== w) bad(`${label}: budgetBasis.${k} mong ${w}, thấy ${bb[k]}`);
  if (typeof bb.text !== "string" || !bb.text.includes(text)) bad(`${label}: text mong chứa "${text}", thấy "${bb.text}"`);
  const es = expectScore(total, cat), got = m.v.match.scoreBreakdown.budget;
  if (es !== null && got !== es) bad(`${label}: điểm Ngân sách ${got} không khớp phép so ${total} vs ${cat} (mong ${es})`);
  const d = await detailOne(M, { id: ids.R1, profile, doc });
  if (d.r.err || d.r.status !== 200 || !d.m) { bad(`${label}: chi tiết lỗi ${d.r.err?.message || d.r.status}`); continue; }
  if (JSON.stringify(d.m.budgetBasis) !== JSON.stringify(bb)) bad(`${label}: chi tiết và danh sách khác budgetBasis: ${JSON.stringify(d.m.budgetBasis)} vs ${JSON.stringify(bb)}`);
}
restoreNow(); done(fails);
