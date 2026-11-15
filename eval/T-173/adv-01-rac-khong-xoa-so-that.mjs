// T-173 · eval đối kháng 01 (adversary). RÁC KHÔNG ĐƯỢC XOÁ SỐ THẬT.
// Spec T-169 H3.4 liệt kê ĐÚNG những gì là "xoá giá trị": null, chuỗi rỗng, mảng rỗng, số 0. H4/giả thuyết: "không có đường nào xoá ... giá trị cũ".
// Một lần ghi số khách / ngân sách mang giá trị KHÁC rỗng nhưng không đọc được thành số (AI trả "khoảng 300", "500 triệu", "300tr", {}; client gửi chuỗi lạ)
// không phải là "xoá tường minh". Kỳ vọng tối thiểu: sau lần ghi đó, số khách / ngân sách hiệu lực KHÔNG về "không có" và số đã lưu ở bảng ngân sách
// (`guests`, `total_tr`) KHÔNG về 0. Chấp nhận cả hai cách sửa: bỏ qua giá trị rác (như thông tin không có mặt, H3.5) HOẶC đọc được số nằm trong chuỗi
// ("200 khách" -> 200). Cùng một chuỗi phải cho cùng kết quả ở chat và ở PATCH.
// Trên main 1519d44: chat ghi NaN vào hồ sơ nhưng bảng giữ nguyên nên số khách/ngân sách hiệu lực vẫn còn; nhánh T-173 ép rác về 0 rồi lan sang bảng.
// Chạy từ gốc tohong-hq: node eval/T-173/adv-01-rac-khong-xoa-so-that.mjs
import { setup, bucket, readAll, api, chatAction, storedBudget, ids, done } from "../T-169/_lib.mjs";
const fails = []; const M = await setup();
const ov = M.hideAllBut([ids.R1, ids.HN]);
const HS = () => ({ couple: { bride_name: "Cô Dâu Thử", groom_name: "Chú Rể Thử", city: "HCMC", wedding_date: "2027-12-29" }, guest_count: 300, budget: 500, preferences: { style_tags: ["korean"], guest_count: 300 }, families: { bride_region: "Nam", groom_region: "Nam" } });
const BANG = () => ({ categories: [{ id: "venue", name: "Tiệc cưới", allocated_tr: 150, items: [] }], total_tr: 500, guests: 300, mung_tr: 0, updated_at: "2026-11-01T00:00:00.000Z" });
const fresh = () => bucket(M, { profile: HS(), budget: BANG(), overlay: ov });

const RAC_KHACH = ["khoảng 300", "300-350", "chưa chắc", { so: 300 }];
const RAC_TIEN = ["500 triệu", "300tr", "nửa tỷ", { tr: 500 }];
const okGuests = (n, raw) => { const parsed = parseInt(raw, 10); return n === 300 || (Number.isFinite(parsed) && parsed > 0 && n === parsed); };
const okBudget = (n, raw) => { const parsed = parseFloat(raw); return n === 500 || (Number.isFinite(parsed) && parsed > 0 && n === parsed); };

for (const [duong, ghi] of [["chat update_profile", (b, f, v) => chatAction(M, b, { [f]: v })], ["PATCH /api/couples/:id", (b, f, v) => api(M, b, "PATCH", "", { [f]: v })]]) {
  for (const raw of RAC_KHACH) {
    const b = fresh(); await ghi(b, "guest_count", raw);
    const r = await readAll(M, b); const d = await storedBudget(M, b);
    const tag = `${duong} guest_count=${JSON.stringify(raw)} (hồ sơ 300, bảng 300)`;
    const seen = { "GET /budget guests": r.budget?.guests ?? 0, "profileSnapshot guestCount": r.snap?.guestCount ?? 0, "GET /api/couples/:id guest_count": r.profile?.guest_count ?? 0, "budget.json guests đã lưu": d?.guests ?? 0 };
    for (const [k, v] of Object.entries(seen)) if (!okGuests(v, raw)) fails.push(`${tag}: ${k} = ${JSON.stringify(v)} (mong 300 hoặc số đọc được, không phải xoá)`);
  }
  for (const raw of RAC_TIEN) {
    const b = fresh(); await ghi(b, "budget", raw);
    const r = await readAll(M, b); const d = await storedBudget(M, b);
    const tag = `${duong} budget=${JSON.stringify(raw)} (hồ sơ 500, bảng 500)`;
    const seen = { "GET /budget total_tr": r.budget?.total_tr ?? 0, "summary budget.total_tr": r.summary?.budget?.total_tr ?? 0, "profileSnapshot budgetTotal": r.snap?.budgetTotal ?? 0, "budget.json total_tr đã lưu": d?.total_tr ?? 0 };
    for (const [k, v] of Object.entries(seen)) if (!okBudget(v, raw)) fails.push(`${tag}: ${k} = ${JSON.stringify(v)} (mong 500 hoặc số đọc được, không phải xoá)`);
  }
}
// Cùng chuỗi, hai đường ghi: cùng kết quả.
for (const raw of ["200 khách", "250"]) {
  const a = fresh(); await chatAction(M, a, { guest_count: raw }); const ra = await readAll(M, a);
  const p = fresh(); await api(M, p, "PATCH", "", { guest_count: raw }); const rp = await readAll(M, p);
  if ((ra.snap?.guestCount ?? null) !== (rp.snap?.guestCount ?? null)) fails.push(`guest_count=${JSON.stringify(raw)}: chat cho số khách ${JSON.stringify(ra.snap?.guestCount ?? null)}, PATCH cho ${JSON.stringify(rp.snap?.guestCount ?? null)} (cùng đầu vào, hai kết quả)`);
}
done(fails);
