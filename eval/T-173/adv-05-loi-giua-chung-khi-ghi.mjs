// T-173 · eval đối kháng 05 (adversary). LỖI GIỮA CHỪNG KHI GHI (lựa chọn 3 của engineering: ghi bảng ngân sách TRƯỚC hồ sơ).
// Ghi số khách / ngân sách qua chat, PATCH, PUT /budget mà bước ghi thứ hai vào R2 lỗi. Kỳ vọng: (a) lỗi được báo cho người gọi (HTTP >= 400 hoặc
// hành động chat success=false / ném), không giả vờ đã lưu; (b) sau lỗi, mọi bề mặt vẫn nói CÙNG MỘT số (spec T-169 H2: một thông tin một giá trị),
// dù đó là số cũ hay số mới; (c) không mất khoá nào của bảng ngân sách và hạng mục/khoản chi còn nguyên.
// Chạy từ gốc tohong-hq: node eval/T-173/adv-05-loi-giua-chung-khi-ghi.mjs
import { setup, bucket, readAll, api, chatAction, storedBudget, ids, done, KEY } from "../T-169/_lib.mjs";
const fails = []; const M = await setup();
const ov = M.hideAllBut([ids.R1, ids.HN]);
const HS = () => ({ couple: { bride_name: "Cô Dâu Thử", groom_name: "Chú Rể Thử", city: "HCMC", wedding_date: "2027-12-29" }, guest_count: 300, budget: 500, preferences: { style_tags: ["korean"], guest_count: 300 } });
const BANG = () => ({ categories: [{ id: "venue", name: "Tiệc cưới", allocated_tr: 150, items: [{ id: "i1", name: "Cọc", amt: 5 }] }], total_tr: 500, guests: 300, mung_tr: 7, x_khoa_la: 1, updated_at: "2026-11-01T00:00:00.000Z" });
const same = (tag, vals) => { const u = [...new Set(Object.values(vals).map((v) => JSON.stringify(v ?? 0)))]; if (u.length > 1) fails.push(`${tag}: các bề mặt lệch ${JSON.stringify(vals)}`); };
const failOn = (b, key) => { let n = 0; b.beforePut = async (k) => { if (k === key && n++ === 0) throw new Error("R2 lỗi giả khi ghi " + k); }; };
const CA = [
  ["chat guest_count 200, hồ sơ lỗi", KEY.profile, (b) => chatAction(M, b, { guest_count: 200 })],
  ["chat budget 350, hồ sơ lỗi", KEY.profile, (b) => chatAction(M, b, { budget: 350 })],
  ["PATCH guest_count 200 + budget 350, hồ sơ lỗi", KEY.profile, (b) => api(M, b, "PATCH", "", { guest_count: 200, budget: 350 })],
  ["PATCH guest_count 200 + budget 350, bảng lỗi", KEY.budget, (b) => api(M, b, "PATCH", "", { guest_count: 200, budget: 350 })],
  ["PUT /budget guests 200, hồ sơ lỗi", KEY.profile, (b) => api(M, b, "PUT", "budget", { categories: BANG().categories, total_tr: 500, guests: 200, mung_tr: 7 })],
];
for (const [tag, key, ghi] of CA) {
  const b = bucket(M, { profile: HS(), budget: BANG(), overlay: ov }); failOn(b, key);
  const res = await ghi(b); b.beforePut = null;
  const reported = !res || res.err || res.success === false || (res.status ?? 200) >= 400;
  if (!reported) fails.push(`${tag}: ghi lỗi giữa chừng mà người gọi nhận thành công ${JSON.stringify(res?.status ?? res?.success)}`);
  const r = await readAll(M, b); for (const e of r.err) fails.push(`${tag}: ${e}`);
  same(`${tag} số khách`, { "GET /budget": r.budget?.guests, profileSnapshot: r.snap?.guestCount, "GET /couples/:id": r.profile?.guest_count, "khối chat": r.chatBlock?.guest_count, "Khách mời": r.guestsDoc?.capacity, summary: r.summary?.guests?.capacity });
  same(`${tag} ngân sách`, { "GET /budget": r.budget?.total_tr, profileSnapshot: r.snap?.budgetTotal, "GET /couples/:id": r.profile?.budget, "khối chat": r.chatBlock?.budget, summary: r.summary?.budget?.total_tr });
  const d = await storedBudget(M, b);
  for (const k of ["categories", "mung_tr", "x_khoa_la", "total_tr", "guests"]) if (!(k in (d || {}))) fails.push(`${tag}: bảng ngân sách MẤT khoá ${k}`);
  if (JSON.stringify(d?.categories?.[0]?.items) !== JSON.stringify(BANG().categories[0].items)) fails.push(`${tag}: khoản chi đổi`);
  const venueShown = (r.budget?.categories || []).find((c) => c.id === "venue")?.allocated_tr;
  const want = Math.round(150 * (r.budget?.total_tr ?? 500) / 500);
  if (venueShown !== want) fails.push(`${tag}: Tiệc cưới hiện ${venueShown}, mong ${want} (co theo tổng đang hiện ${r.budget?.total_tr})`);
}
done(fails);
