// T-169 tiêu chí 3. NGÂN SÁCH TỔNG (triệu): hồ sơ `budget` và bảng ngân sách `total_tr` có thể lệch; MỌI bề mặt hiện/dùng cùng một số:
// hồ sơ, màn hồ sơ (summary.budget.total_tr), màn Ngân sách (GET /budget), ghép vendor (profileSnapshot.budgetTotal), chat (khối hồ sơ).
// Luật chọn: `budget` của hồ sơ khi > 0 (màn Ngân sách ghi "Thiết lập trong hồ sơ", GET /budget đã dùng luật này); không thì `total_tr` > 0 của bảng, CHỈ để hiển thị; ghép vendor và chat chỉ dùng `budget` hồ sơ (giữ điểm như main); không có = 0/null.
// Chạy từ gốc tohong-hq: node eval/T-169/check_3_ngan_sach_tong_mot_gia_tri.mjs
import { setup, bucket, readAll, checker, budgetAll, LECH, BANG, ids, done } from "./_lib.mjs";
const { fails, eq } = checker(); const M = await setup();
const ov = M.hideAllBut([ids.R1, ids.HN]);
const cases = [
  ["A hồ sơ 300, bảng total_tr 500", () => LECH(), BANG({ total_tr: 500 }), 300],
  ["B hồ sơ không có budget, bảng total_tr 500: hiển thị 500, ghép vẫn không có ngân sách (no_budget, 0,5 như main)", () => { const p = LECH(); delete p.budget; return p; }, BANG({ total_tr: 500 }), 500, null],
  ["C hồ sơ 300, không bảng", () => LECH(), undefined, 300],
  ["D hồ sơ budget 0, bảng 0: không có số", () => { const p = LECH(); p.budget = 0; return p; }, BANG({ total_tr: 0 }), null],
];
for (const [name, mk, budget, tr, trm = tr] of cases) {
  const r = await readAll(M, bucket(M, { profile: mk(), budget, overlay: ov }));
  for (const e of r.err) fails.push(`${name}: ${e}`);
  budgetAll(eq, name, r, tr, trm);
}
done(fails);
