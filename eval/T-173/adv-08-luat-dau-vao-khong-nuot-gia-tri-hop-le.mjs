// T-173 · eval đối kháng 08 (adversary, sau v3). LUẬT ĐẦU VÀO CHẶT KHÔNG ĐƯỢC NUỐT GIÁ TRỊ HỢP LỆ (mặt kia của "rác không xoá").
// Đúng dạng front đang gửi (tohong-front 0221a5c: onboarding App.jsx:290-296 gửi số khách/ngân sách là number từ OB_GUESTS/OB_BUDGETS, ngày `${y}-${pad2(m)}-${pad2(d)}`;
// Dashboard.jsx:52/245 gửi cùng dạng ngày từ OBCalendar) và các dạng hợp lệ AI hay gửi phải được LƯU và đọc lại đúng ở mọi bề mặt:
// ngày 29/2 năm nhuận, số khách chuỗi chữ số, ngân sách số lẻ (12.5 triệu), xoá tường minh (0, "0", null, []) vẫn xoá (H3.4);
// payload có trường chuẩn rác nhưng trường cũ hợp lệ thì trường cũ thắng (H3.3) thay vì cả lần ghi bị bỏ.
// Chạy từ gốc tohong-hq: node eval/T-173/adv-08-luat-dau-vao-khong-nuot-gia-tri-hop-le.mjs
import { setup, bucket, readAll, api, chatAction, ids, done } from "../T-169/_lib.mjs";
const fails = []; const M = await setup();
const ov = M.hideAllBut([ids.R1, ids.HN]);
const HS = () => ({ couple: { bride_name: "Cô Dâu Thử", groom_name: "Chú Rể Thử", city: "HCMC", wedding_date: "2027-12-29" }, guest_count: 300, budget: 800, preferences: { style_tags: ["korean"], guest_count: 300 } });
const BANG = () => ({ categories: [{ id: "venue", name: "Tiệc cưới", allocated_tr: 240, items: [] }], total_tr: 800, guests: 300, mung_tr: 0, updated_at: "2026-11-01T00:00:00.000Z" });
const d10 = (x) => (x ? String(x).slice(0, 10) : null);
const G = (r) => ({ "GET /budget": r.budget?.guests ?? 0, snapshot: r.snap?.guestCount ?? 0, "GET /couples/:id": r.profile?.guest_count ?? 0 });
const B = (r) => ({ "GET /budget": r.budget?.total_tr ?? 0, snapshot: r.snap?.budgetTotal ?? 0, summary: r.summary?.budget?.total_tr ?? 0 });
const D = (r) => ({ summary: d10(r.summary?.profile?.wedding_date), snapshot: d10(r.snap?.weddingDate), chat: d10(r.chatBlock?.couple?.wedding_date) });
const S = (r) => ({ snapshot: r.snap?.styles ?? [] });
const CA = [
  ["onboarding (đúng payload front)", (b) => api(M, b, "PATCH", "", { couple: { bride_name: "Cô Dâu Thử", groom_name: "Chú Rể Thử", wedding_date: "2028-02-29", city: "Hà Nội" }, families: { bride_region: "Bắc", groom_region: "Bắc" }, preferences: { style_tags: ["modern"], guest_count: 150 }, guest_count: 150, budget: 1000 }),
    (r) => [[G(r), 150], [B(r), 1000], [D(r), "2028-02-29"], [S(r), ["modern"]]]],
  ["Dashboard sửa ngày 2028-01-05", (b) => api(M, b, "PATCH", "", { couple: { wedding_date: "2028-01-05" } }), (r) => [[D(r), "2028-01-05"]]],
  ["chat số khách chuỗi chữ số '250'", (b) => chatAction(M, b, { guest_count: "250" }), (r) => [[G(r), 250]]],
  ["chat ngân sách số lẻ 12.5", (b) => chatAction(M, b, { budget: 12.5 }), (r) => [[B(r), 12.5]]],
  ["chat ngân sách chuỗi chữ số '650'", (b) => chatAction(M, b, { budget: "650" }), (r) => [[B(r), 650]]],
  ["chat ngày 2028-02-29", (b) => chatAction(M, b, { wedding_date: "2028-02-29" }), (r) => [[D(r), "2028-02-29"]]],
  ["chat gu ['luxury', ' ']", (b) => chatAction(M, b, { style_preferences: ["luxury", " "] }), (r) => [[S(r), ["luxury"]]]],
  ["PATCH xoá số khách 0", (b) => api(M, b, "PATCH", "", { guest_count: 0 }), (r) => [[G(r), 0]]],
  ["chat xoá số khách '0'", (b) => chatAction(M, b, { guest_count: "0" }), (r) => [[G(r), 0]]],
  ["PATCH xoá ngân sách null", (b) => api(M, b, "PATCH", "", { budget: null }), (r) => [[B(r), 0]]],
  ["PATCH xoá gu []", (b) => api(M, b, "PATCH", "", { preferences: { style_tags: [] } }), (r) => [[S(r), []]]],
  ["PATCH guest_count rác + preferences.guest_count 180 (trường cũ hợp lệ thắng)", (b) => api(M, b, "PATCH", "", { guest_count: "khoảng 200", preferences: { guest_count: 180 } }), (r) => [[G(r), 180]]],
];
for (const [tag, ghi, chk] of CA) {
  const b = bucket(M, { profile: HS(), budget: BANG(), overlay: ov });
  const res = await ghi(b); if (res?.status >= 400 || res?.success === false) fails.push(`${tag}: ghi lỗi ${res?.status ?? ""} ${res?.error ?? ""}`);
  const r = await readAll(M, b); for (const e of r.err) fails.push(`${tag}: ${e}`);
  for (const [seen, want] of chk(r)) for (const [k, v] of Object.entries(seen)) if (JSON.stringify(v) !== JSON.stringify(want)) fails.push(`${tag}: ${k} = ${JSON.stringify(v)}, mong ${JSON.stringify(want)}`);
}
done(fails);
