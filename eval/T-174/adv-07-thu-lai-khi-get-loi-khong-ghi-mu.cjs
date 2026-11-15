#!/usr/bin/env node
/* T-174 adversary 07 (tohong-front, spec T-171 v3.1 H5 "Không lấy được bản server (GET lỗi) thì không ghi mù"): lưu 90 -> 40 lỗi; bấm "Thử lại" khi GET dự toán đứt mạng
 * (PUT thì qua được nếu có). Mong đợi: KHÔNG có PUT nào (không ghi mù), câu báo còn, thanh vẫn 40. Rồi chỉnh tiếp 40 -> 45 khi GET vẫn đứt: vẫn không PUT. GET tốt lại, bấm Thử lại: server 45, câu báo mất.
 * Chạy từ gốc tohong-hq: node eval/T-174/adv-07-thu-lai-khi-get-loi-khong-ghi-mu.cjs [--repo <tohong-front>] */
const { runAdv } = require('./adv_khung.cjs');
runAdv(async ({ pg, D, bad, body, slider, dragTo, waitFor, venue, sleep }) => {
  D.putFail = '500'; await dragTo(pg, 40);
  if (!(await waitFor(async () => /Chưa lưu được dự toán/.test(await body())))) { bad('khung: lưu lỗi phải hiện câu báo'); return; }
  D.putFail = null; D.getFail = true; const p0 = D.puts.length;
  await pg.getByRole('button', { name: 'Thử lại' }).first().click(); await sleep(1500);
  if (D.puts.length !== p0) bad(`Thử lại khi GET lỗi vẫn ghi (PUT +${D.puts.length - p0}): ghi mù`);
  if (!/Chưa lưu được dự toán/.test(await body())) bad('Thử lại khi GET lỗi: câu báo phải còn');
  if ((await slider()) !== 40) bad(`Thử lại khi GET lỗi: thanh phải còn 40, thấy ${await slider()}`);
  await dragTo(pg, 45); await sleep(1800);
  if (D.puts.length !== p0) bad(`chỉnh tiếp khi GET lỗi vẫn ghi (PUT +${D.puts.length - p0}): ghi mù`);
  if (!/Chưa lưu được dự toán/.test(await body())) bad('chỉnh tiếp khi GET lỗi: câu báo phải còn');
  D.getFail = false;
  await pg.getByRole('button', { name: 'Thử lại' }).first().click();
  await waitFor(async () => venue().allocated_tr === 45); await sleep(800);
  if (venue().allocated_tr !== 45) bad(`GET tốt lại, Thử lại phải lưu 45, server ${venue().allocated_tr}`);
  if (/Chưa lưu được dự toán/.test(await body())) bad('lưu thành công mà câu báo còn');
});
