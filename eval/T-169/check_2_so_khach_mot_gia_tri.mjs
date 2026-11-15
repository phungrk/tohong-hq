// T-169 tiêu chí 2. SỐ KHÁCH: hồ sơ lưu số khách ở nhiều chỗ (guest_count, preferences.guest_count, couple.guest_count; bảng ngân sách `guests`; `capacity` của danh sách khách)
// thì MỌI bề mặt hiện/dùng cùng MỘT số: hồ sơ, màn Khách mời (sức chứa), màn hồ sơ (summary), màn Ngân sách (GET /budget), ghép vendor (profileSnapshot), chat (số bàn + khối hồ sơ).
// Luật chọn (giữ ADR-094/INV-005): `guests` nguyên > 0 của bảng ngân sách; không thì số ĐẦU TIÊN khác 0 và không NaN (parseInt) trong guest_count, preferences.guest_count, couple.guest_count (âm = không có số khách, như INV-005);
// rồi `capacity` đã lưu của danh sách khách (CHỈ hiển thị ở màn Khách mời và summary; KHÔNG vào GET /budget seed, GET /couples/:id guest_count, ghép vendor, chat); không có gì = 0/null.
// Chạy từ gốc tohong-hq: node eval/T-169/check_2_so_khach_mot_gia_tri.mjs
import { setup, bucket, readAll, checker, guestsAll, LECH, BANG, ids, done } from "./_lib.mjs";
const { fails, eq } = checker(); const M = await setup();
const ov = M.hideAllBut([ids.R1, ids.HN]);
const DS = (capacity) => ({ capacity, guests: [{ id: "g1", name: "Khách Thử", side: "trai", status: "yes", count: 2, role: "Bạn bè" }], updated_at: "2026-11-01T00:00:00.000Z" });
// Mỗi ca: [tên, hồ sơ, bảng, danh sách khách, số hiển thị, số dùng để ghép (mặc định = số hiển thị)]. `capacity` đã lưu chỉ để HIỂN THỊ (Khách mời, summary); ghép vendor và chat không dùng (giữ điểm như main).
const cases = [
  ["A guest_count 200 / preferences 150 / couple 100, không bảng", () => LECH(), undefined, undefined, 200],
  ["B chỉ preferences.guest_count 150", () => { const p = LECH(); delete p.guest_count; delete p.couple.guest_count; return p; }, undefined, undefined, 150],
  ["C chỉ couple.guest_count 100", () => { const p = LECH(); delete p.guest_count; delete p.preferences.guest_count; return p; }, undefined, undefined, 100],
  ["D bảng guests 237 thắng hồ sơ 200 (ADR-094)", () => LECH(), BANG({ guests: 237 }), undefined, 237],
  ["E bảng guests 0 + hồ sơ 200: màn Ngân sách phải hiện 200", () => LECH(), BANG({ guests: 0 }), undefined, 200],
  ["F danh sách khách đã lưu capacity 80 cũ + hồ sơ 200: sức chứa = 200", () => LECH(), undefined, DS(80), 200],
  ["G hồ sơ không có số khách, danh sách khách capacity 80: dùng 80 (không mất)", () => { const p = LECH(); delete p.guest_count; delete p.preferences.guest_count; delete p.couple.guest_count; return p; }, undefined, DS(80), 80, null],
  ["H guest_count rác 'abc' + preferences 150", () => { const p = LECH(); p.guest_count = "abc"; return p; }, undefined, undefined, 150],
  ["J guest_count âm -50 + preferences 150: số đầu tiên khác 0 quyết định, âm = không có (INV-005)", () => { const p = LECH(); p.guest_count = -50; return p; }, undefined, undefined, null],
  ["I không có số khách ở đâu cả", () => { const p = LECH(); delete p.guest_count; delete p.preferences.guest_count; delete p.couple.guest_count; return p; }, undefined, undefined, null],
];
for (const [name, mk, budget, guests, g, gm = g] of cases) {
  const r = await readAll(M, bucket(M, { profile: mk(), budget, guests, overlay: ov }));
  for (const e of r.err) fails.push(`${name}: ${e}`);
  guestsAll(eq, name, r, g, gm);
}
done(fails);
