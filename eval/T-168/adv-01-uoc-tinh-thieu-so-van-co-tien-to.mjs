// T-168 adv-01 (adversary, tầng 3). Spec T-167 H2: "Vendor `estimated = true`: câu bắt đầu bằng `Giá ước tính: ` rồi khuôn ở trên"
// — "khuôn ở trên" gồm cả no_guests và no_budget (không có ngoại lệ). Eval 1-2 chỉ thử vendor ước tính khi đủ số (per_table).
// Input phá: venue giá ước tính (E1, estimate_category 3,9tr/bàn) khi (a) thiếu số khách, (b) thiếu ngân sách.
// Mong: text = "Giá ước tính: " + khuôn nguyên văn H2; đối chứng: vendor giá thật (R1) cùng tình huống KHÔNG có tiền tố.
// Chạy từ gốc tohong-hq: node eval/T-168/adv-01-uoc-tinh-thieu-so-van-co-tien-to.mjs (TOHONG_BACK_REPO)
import { setup, matchOne, budgetDoc, coupleProfile, restoreNow, done, ids } from "../T-167/_lib.mjs";
const fails = []; const bad = (m) => fails.push(m);
const M = await setup();
const bbOf = async (label, o) => { const m = await matchOne(M, o); const bb = m.v?.match?.budgetBasis; if (!bb) { bad(`${label}: thiếu budgetBasis (${m.r.err?.message || m.r.status})`); return null; } return bb; };
const NG = "Chưa có số khách nên chưa tính được tổng tiệc (giá ≈ 3,9tr/bàn)";
const NB = "Chưa có ngân sách cho tiệc cưới nên chưa so được";
const cases = [
  ["(a) ước tính + thiếu số khách", { id: ids.E1, profile: coupleProfile({ budget: 200 }), doc: budgetDoc(90, { guests: 0 }) }, "no_guests", "Giá ước tính: " + NG],
  ["(b) ước tính + thiếu ngân sách", { id: ids.E1, profile: coupleProfile({ guest_count: 200 }), doc: undefined }, "no_budget", "Giá ước tính: " + NB],
  ["(c) đối chứng giá thật + thiếu số khách", { id: ids.R1, profile: coupleProfile({ budget: 200 }), doc: budgetDoc(90, { guests: 0 }) }, "no_guests", NG],
  ["(d) đối chứng giá thật + thiếu ngân sách", { id: ids.R1, profile: coupleProfile({ guest_count: 200 }), doc: undefined }, "no_budget", NB],
];
for (const [label, o, kind, text] of cases) {
  const bb = await bbOf(label, o); if (!bb) continue;
  if (bb.kind !== kind) bad(`${label}: kind mong ${kind}, thấy ${bb.kind}`);
  if (bb.text !== text) bad(`${label}: text mong "${text}", thấy "${bb.text}"`);
}
restoreNow(); done(fails);
