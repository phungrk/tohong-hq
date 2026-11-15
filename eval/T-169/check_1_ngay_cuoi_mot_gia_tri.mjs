// T-169 tiêu chí 1. NGÀY CƯỚI: hồ sơ lưu ngày ở hai trường (couple.wedding_date và wedding_date top-level) thì MỌI bề mặt hiện/dùng cùng một ngày:
// hồ sơ (GET /api/couples/:id), màn hồ sơ (summary: ngày + số ngày còn lại), ghép vendor (profileSnapshot + chip "Còn lịch d.m"), chat (khối hồ sơ trong prompt).
// Luật chọn: couple.wedding_date thắng; không có/rỗng/không phải ngày thì wedding_date top-level; không có cả hai thì không có ngày (null) ở mọi nơi.
// Chạy từ gốc tohong-hq: node eval/T-169/check_1_ngay_cuoi_mot_gia_tri.mjs  · Biến: TOHONG_BACK_REPO.
import { setup, bucket, readAll, checker, dateAll, LECH, ids, done } from "./_lib.mjs";
const { fails, eq } = checker(); const M = await setup();
const ov = M.hideAllBut([ids.R1, ids.HN]);
const cases = [
  ["A lệch 12-31 vs 12-29 (couple thắng)", (p) => p, "2027-12-31"],
  ["B chỉ có wedding_date top-level", (p) => { delete p.couple.wedding_date; return p; }, "2027-12-29"],
  ["C couple.wedding_date rỗng, top-level có", (p) => { p.couple.wedding_date = ""; return p; }, "2027-12-29"],
  ["D couple.wedding_date không phải ngày, top-level có", (p) => { p.couple.wedding_date = "sắp cưới"; return p; }, "2027-12-29"],
  ["E không có ngày ở đâu cả", (p) => { delete p.couple.wedding_date; delete p.wedding_date; return p; }, null],
];
for (const [name, mut, iso] of cases) {
  const r = await readAll(M, bucket(M, { profile: mut(LECH()), overlay: ov }));
  for (const e of r.err) fails.push(`${name}: ${e}`);
  dateAll(eq, name, r, iso);
}
done(fails);
