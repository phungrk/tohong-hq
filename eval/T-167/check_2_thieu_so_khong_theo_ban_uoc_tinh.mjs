// T-167 tiêu chí 2. Dòng Ngân sách khi thiếu số khách, thiếu ngân sách, vendor không theo bàn, giá ước tính (luật T-164 H5).
// Chạy từ gốc tohong-hq: node eval/T-167/check_2_thieu_so_khong_theo_ban_uoc_tinh.mjs
import { setup, matchOne, budgetDoc, coupleProfile, restoreNow, done, ids } from "./_lib.mjs";
const fails = []; const bad = (m) => fails.push(m);
const M = await setup();
const get = async (label, o) => { const m = await matchOne(M, o); if (m.r.err || m.r.status !== 200 || !m.v) { bad(`${label}: match lỗi ${m.r.err?.message || m.r.status}`); return null; } const bb = m.v.match?.budgetBasis; if (!bb) { bad(`${label}: thiếu match.budgetBasis`); return null; } return { bb, score: m.v.match.scoreBreakdown.budget }; };

// (a) venue theo bàn, không có số khách ở bảng lẫn hồ sơ
let x = await get("thiếu số khách", { id: ids.R1, profile: coupleProfile({ budget: 200 }), doc: budgetDoc(90, { guests: 0 }) });
if (x) {
  if (x.bb.kind !== "no_guests") bad(`thiếu số khách: kind mong no_guests, thấy ${x.bb.kind}`);
  if (!/chưa có số khách/.test(x.bb.text || "")) bad(`thiếu số khách: text phải nói "chưa có số khách", thấy "${x.bb.text}"`);
  if (/\bbàn\s*=|= *\d/.test(x.bb.text || "")) bad(`thiếu số khách: không được đoán tổng, thấy "${x.bb.text}"`);
  if (x.score !== 0.5) bad(`thiếu số khách: điểm trung tính 0,5, thấy ${x.score}`);
}
// (b) venue theo bàn, có khách nhưng không có ngân sách nào (không bảng, không tổng, không hạng mục)
x = await get("thiếu ngân sách", { id: ids.R1, profile: coupleProfile({ guest_count: 200 }), doc: undefined });
if (x) {
  if (x.bb.kind !== "no_budget") bad(`thiếu ngân sách: kind mong no_budget, thấy ${x.bb.kind}`);
  if (!/chưa có ngân sách/.test(x.bb.text || "")) bad(`thiếu ngân sách: text phải nói "chưa có ngân sách", thấy "${x.bb.text}"`);
  if (x.score !== 0.5) bad(`thiếu ngân sách: điểm trung tính 0,5, thấy ${x.score}`);
}
// (c) vendor không theo bàn (photography, giá tối đa 15tr, hạng mục 40tr)
x = await get("không theo bàn", { category: "photography", id: ids.P1, profile: coupleProfile({ budget: 300, guest_count: 200 }), doc: { ...budgetDoc(90, { total_tr: 300, guests: 200 }), categories: [{ id: "photography", name: "Chụp ảnh", allocated_tr: 40, items: [] }] } });
if (x) {
  if (x.bb.kind !== "total") bad(`không theo bàn: kind mong total, thấy ${x.bb.kind}`);
  if (!(x.bb.text || "").includes("giá đến 15tr so với 40tr chụp ảnh + quay phim")) bad(`không theo bàn: text mong chứa "giá đến 15tr so với 40tr chụp ảnh + quay phim", thấy "${x.bb.text}"`);
  if (/bàn/.test(x.bb.text || "")) bad(`không theo bàn: không được nhắc "bàn", thấy "${x.bb.text}"`);
  if (x.bb.categoryBudgetTr !== 40 || x.bb.priceMaxTr !== 15) bad(`không theo bàn: số mong 15 và 40, thấy ${x.bb.priceMaxTr} và ${x.bb.categoryBudgetTr}`);
}
// (d) giá ước tính (estimate_category): vẫn ghi phép so đúng số, nhưng gọi là ước tính và không khẳng định trong ngân sách
x = await get("giá ước tính", { id: ids.E1, profile: coupleProfile({ budget: 200, guest_count: 200 }), doc: budgetDoc(90, { guests: 200 }) });
if (x) {
  if (x.bb.estimated !== true) bad(`giá ước tính: estimated mong true, thấy ${x.bb.estimated}`);
  if (!/ước tính/.test(x.bb.text || "")) bad(`giá ước tính: text phải có "ước tính", thấy "${x.bb.text}"`);
  if (!/78tr so với 90tr/.test(x.bb.text || "")) bad(`giá ước tính: vẫn phải ghi "78tr so với 90tr", thấy "${x.bb.text}"`);
  if (/trong ngân sách|vừa ngân sách|đủ ngân sách|rẻ hơn/i.test(x.bb.text || "")) bad(`giá ước tính: không được khẳng định ngân sách, thấy "${x.bb.text}"`);
}
// (e) vendor giá thật: estimated phải là false
x = await get("giá thật", { id: ids.R1, profile: coupleProfile({ budget: 200, guest_count: 200 }), doc: budgetDoc(90, { guests: 200 }) });
if (x && x.bb.estimated !== false) bad(`giá thật: estimated mong false, thấy ${x.bb.estimated}`);
restoreNow(); done(fails);
