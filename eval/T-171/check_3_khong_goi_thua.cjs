#!/usr/bin/env node
/* T-171 tiêu chí 3 (tohong-front): KHÔNG gọi lại điểm khi không có gì đổi, và đổi một lần chỉ gọi đúng một lần mỗi thẻ.
 * (a) chuyển qua lại tab Ngân sách / chat nhiều lần, không đổi gì: số lần gọi /api/vendors/match và chi tiết không tăng.
 * (b) kéo dự toán 90 -> 95 -> 90 liền nhau (giá trị cuối bằng giá trị đã lưu): không tăng.
 * (c) kéo 90 -> 40 (nhiều lần bấm liên tiếp, một lần lưu): đúng 1 lần ghi, danh sách gọi match đúng +1, chi tiết đang mở gọi đúng +1.
 * Chạy từ gốc tohong-hq: node eval/T-171/check_3_khong_goi_thua.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async ({ dev, br, bad, newServer, mount, open, goBudget, goChat, dragTo, cardText, waitText, openDetail }) => {
  const S = newServer(); const { ctx, pg } = await mount(br, S); await open(dev, pg);
  await openDetail(pg, 'Alpha Hall', 1); await pg.waitForTimeout(800);
  let m0 = S.calls.match, d0 = S.calls.detail;
  for (let i = 0; i < 3; i++) { await goBudget(pg); await goChat(pg); }
  await sleep(1500);
  if (S.calls.match !== m0 || S.calls.detail !== d0) bad(`(a) chuyển tab qua lại không đổi gì mà gọi lại (match +${S.calls.match - m0}, chi tiết +${S.calls.detail - d0}); phải +0`);
  m0 = S.calls.match; d0 = S.calls.detail;
  await goBudget(pg); await dragTo(pg, 95); await dragTo(pg, 90); await sleep(2200); await goChat(pg); await sleep(1200);
  if (S.calls.match !== m0 || S.calls.detail !== d0) bad(`(b) giá trị cuối bằng giá trị đã lưu (90) mà gọi lại (match +${S.calls.match - m0}, chi tiết +${S.calls.detail - d0}); phải +0`);
  m0 = S.calls.match; d0 = S.calls.detail; const p0 = S.calls.put;
  await goBudget(pg); await dragTo(pg, 40); const t0 = Date.now(); while (S.venue !== 40 && Date.now() - t0 < 6000) await sleep(100);
  await goChat(pg); const d1 = await waitText(pg, 1, /so với 40tr tiệc cưới/, 5000); await sleep(2000);
  if (!/so với 40tr tiệc cưới/.test(d1 || '')) bad('(c) khung: chi tiết chưa đổi sang 40tr nên không đếm được');
  if (S.calls.put - p0 !== 1) bad(`(c) nhiều lần bấm liên tiếp phải gộp thành đúng 1 lần ghi, thấy ${S.calls.put - p0}`);
  if (S.calls.match - m0 !== 1) bad(`(c) đổi dự toán một lần phải gọi match đúng +1 lần cho thẻ danh sách, thấy +${S.calls.match - m0}`);
  if (S.calls.detail - d0 !== 1) bad(`(c) đổi dự toán một lần phải gọi chi tiết đúng +1 lần cho thẻ chi tiết đang mở, thấy +${S.calls.detail - d0}`);
  await ctx.close();
});
