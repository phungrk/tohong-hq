// T-169 tiêu chí 8. HẠNG MỤC KHÔNG NHẢY KHI GHI TỔNG NGÂN SÁCH. Hôm nay GET /budget co `allocated_tr` các hạng mục theo (tổng hồ sơ / `total_tr` bảng) khi hai tổng lệch,
// và ngân sách hạng mục dùng để ghép (profileSnapshot.budgetByCategory) lấy cùng số đã co. Khi một lần ghi đặt `total_tr` của bảng bằng tổng mới, `allocated_tr` các hạng mục phải được
// ghi lại đúng số cặp đôi sẽ thấy ở GET /budget nếu CHỈ hồ sơ đổi và bảng giữ nguyên: round(allocated_tr x tổng mới / total_tr cũ của bảng). Không số nào ở màn Ngân sách hay trong ngân sách hạng mục ghép nhảy vì chuẩn hoá.
// Ca gốc (Spec critic D1): hồ sơ 350, bảng 500, tiệc cưới 150 => màn đang hiện 105; ghi tổng 350 => vẫn 105 (không phải 150). Ghi tổng 400 => 120 (= 150 x 400/500, đúng số GET hôm nay cho hồ sơ 400 + bảng 500).
// Chạy từ gốc tohong-hq: node eval/T-169/check_8_hang_muc_khong_nhay_khi_ghi_tong.mjs
import { setup, bucket, api, match, chatAction, checker, storedBudget, LECH, BANG, ids, done } from "./_lib.mjs";
const { fails, eq } = checker(); const M = await setup();
const ov = M.hideAllBut([ids.R1, ids.HN]);
const venue = (c) => c?.categories?.find((x) => x.id === "venue")?.allocated_tr;
const mk = (budget = 350) => { const p = LECH(); p.budget = budget; return bucket(M, { profile: p, budget: BANG({ total_tr: 500, guests: 0 }), overlay: ov }); };
async function seen(b) { const g = await api(M, b, "GET", "budget"); const m = await match(M, b); return { total: g.body?.total_tr, venue: venue(g.body), ghep: m.body?.profileSnapshot?.budgetByCategory?.venue }; }
{ const b = mk(); eq("trước khi ghi (đối chứng với main)", await seen(b), { total: 350, venue: 105, ghep: 105 }); }
const cases = [
  ["chat budget 350 (tổng không đổi, chỉ chuẩn hoá)", 350, (b) => chatAction(M, b, { budget: 350 }), { total: 350, venue: 105, ghep: 105 }],
  ["chat budget 400", 400, (b) => chatAction(M, b, { budget: 400 }), { total: 400, venue: 120, ghep: 120 }],
  ["PATCH {budget: 350}", 350, (b) => api(M, b, "PATCH", "", { budget: 350 }), { total: 350, venue: 105, ghep: 105 }],
  ["PATCH onboarding (budget 400 + trường khác)", 350, (b) => api(M, b, "PATCH", "", { couple: { wedding_date: "2028-02-10" }, preferences: { guest_count: 180 }, guest_count: 180, budget: 400 }), { total: 400, venue: 120, ghep: 120 }],
  ["PUT /budget gửi đúng số đang thấy (105, tổng 350)", 350, async (b) => api(M, b, "PUT", "budget", { categories: [{ ...BANG().categories[0], allocated_tr: 105 }], total_tr: 350, guests: 0, mung_tr: 7 }), { total: 350, venue: 105, ghep: 105 }],
];
for (const [name, budget, run, want] of cases) {
  const b = mk(budget); const r = await run(b);
  if (!r || r.status >= 400 || r.success === false) { fails.push(`${name}: ghi lỗi`); continue; }
  eq(`${name}: GET /budget (tổng, tiệc cưới) và ngân sách hạng mục ghép`, await seen(b), want);
  const d = await storedBudget(M, b); eq(`${name}: khoản chi (items) và mừng của bảng giữ nguyên`, [d?.categories?.[0]?.items?.[0]?.amt, d?.mung_tr], [5, 7]);
}
// Hồ sơ chưa có ngân sách, bảng có total_tr 500: ghi tổng 500 qua chat thì hạng mục KHÔNG đổi (150), không co.
{ const p = LECH(); delete p.budget; const b = bucket(M, { profile: p, budget: BANG({ total_tr: 500, guests: 0 }), overlay: ov });
  await chatAction(M, b, { budget: 500 }); eq("hồ sơ chưa có tổng, ghi 500 = tổng bảng: tiệc cưới giữ 150", (await seen(b)).venue, 150); }
done(fails);
