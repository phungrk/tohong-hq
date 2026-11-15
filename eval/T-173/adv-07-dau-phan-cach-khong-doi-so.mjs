// T-173 · eval đối kháng 07 (adversary, sau v2). CHUỖI SỐ CÓ DẤU PHÂN CÁCH / SỐ LẺ KHÔNG ĐƯỢC GHI THÀNH SỐ KHÁC HOẶC THÀNH XOÁ.
// v2 chấp nhận "chuỗi chỉ gồm số" dạng /\d+([.,]\d+)?/ và đổi "," thành ".": "1.500" (cách viết Việt của 1500) thành 1,5; số khách "1.200" thành 1;
// số khách 0.5 / "0,5" bị cắt về 0 = XOÁ (H3.4) dù người gửi không gửi 0. Phong cách [" "] (chỉ khoảng trắng) được ghi và xoá gu hiệu lực.
// Kỳ vọng (spec T-169 H3.4: chỉ null/""/[]/0 là xoá; adv-01: rác không xoá số thật): sau lần ghi, giá trị hiệu lực là
//   (a) không đổi (giá trị bị bỏ qua như không có mặt, H3.5), HOẶC (b) đúng số người viết muốn theo cách đọc Việt ("1.500" = 1500, "1.200" = 1200);
//   KHÔNG BAO GIỜ là số co 1000 lần (1,5 / 1) và không về "không có".
// Ghi qua cả chat update_profile và PATCH. Không đòi đọc được ("1.500" bị bỏ qua là đạt).
// Chạy từ gốc tohong-hq: node eval/T-173/adv-07-dau-phan-cach-khong-doi-so.mjs
import { setup, bucket, readAll, api, chatAction, storedBudget, ids, done } from "../T-169/_lib.mjs";
const fails = []; const M = await setup();
const ov = M.hideAllBut([ids.R1, ids.HN]);
const HS = () => ({ couple: { bride_name: "Cô Dâu Thử", groom_name: "Chú Rể Thử", city: "HCMC", wedding_date: "2027-12-29" }, guest_count: 300, budget: 800, preferences: { style_tags: ["korean"], guest_count: 300 } });
const BANG = () => ({ categories: [{ id: "venue", name: "Tiệc cưới", allocated_tr: 240, items: [] }], total_tr: 800, guests: 300, mung_tr: 0, updated_at: "2026-11-01T00:00:00.000Z" });
const DUONG = [["chat", (b, a) => chatAction(M, b, a)], ["PATCH", (b, a) => api(M, b, "PATCH", "", a)]];
const CA = [
  // [trường, giá trị gửi, các giá trị hiệu lực chấp nhận được sau ghi]
  ["budget", "1.500", [800, 1500]],
  ["budget", "2.000", [800, 2000]],
  ["guest_count", "1.200", [300, 1200]],
  ["guest_count", "1,200", [300, 1200]],
  ["guest_count", "12,5", [300]],
  ["guest_count", 0.5, [300]],
  ["guest_count", "0,5", [300]],
];
for (const [duong, ghi] of DUONG) {
  for (const [f, raw, okVals] of CA) {
    const b = bucket(M, { profile: HS(), budget: BANG(), overlay: ov }); await ghi(b, { [f]: raw });
    const r = await readAll(M, b); const d = await storedBudget(M, b);
    const seen = f === "budget"
      ? { "GET /budget total_tr": r.budget?.total_tr, "profileSnapshot budgetTotal": r.snap?.budgetTotal, "budget.json total_tr": d?.total_tr }
      : { "GET /budget guests": r.budget?.guests, "profileSnapshot guestCount": r.snap?.guestCount, "budget.json guests": d?.guests };
    for (const [k, v] of Object.entries(seen)) if (!okVals.includes(v)) fails.push(`${duong} ${f}=${JSON.stringify(raw)} (đang ${okVals[0]}): ${k} = ${JSON.stringify(v ?? null)}, mong một trong ${JSON.stringify(okVals)}`);
  }
  // phong cách chỉ khoảng trắng: không phải xoá
  const b = bucket(M, { profile: HS(), budget: BANG(), overlay: ov }); await ghi(b, duong === "chat" ? { style_preferences: [" "] } : { preferences: { style_tags: [" "] } });
  const r = await readAll(M, b); if (JSON.stringify(r.snap?.styles ?? []) !== JSON.stringify(["korean"])) fails.push(`${duong} phong cách [" "]: gu hiệu lực = ${JSON.stringify(r.snap?.styles ?? [])}, mong ["korean"] (không phải xoá)`);
}
done(fails);
