#!/usr/bin/env node
/* T-174 adversary 05 (tohong-front, spec T-171 H1/H3/H5): lưu nhanh liên tiếp với lỗi mạng XEN KẼ.
 * Input: 90 -> 40 (mạng đứt) ; 40 -> 45 (500) ; 45 -> 50 (thành công) ; 50 -> 55 (mạng đứt) ; kéo về 50 (thành công, trùng bản đã lưu).
 * Mong đợi: câu báo "Chưa lưu được dự toán" có sau mỗi lần lỗi và mất sau mỗi lần thành công; thẻ chat lấy lại đúng MỘT lần cho lần lưu 50 (sự kiện duy nhất đổi số)
 * và KHÔNG gọi thêm cho lần lưu về 50 (không đổi so với bản đã lưu, H3); thẻ hiện theo 50tr (Alpha 70% vì 78tr > 60tr), không bao giờ theo số chưa lưu.
 * Chạy từ gốc tohong-hq: node eval/T-174/adv-05-luu-nhanh-loi-xen-ke.cjs [--repo <tohong-front>] */
const { run, sleep } = require('../T-171/_lib.cjs');
run(async ({ dev, br, bad, newServer, mount, open, goBudget, goChat, dragTo, rowOf }) => {
  const S = newServer(); const { ctx, pg } = await mount(br, S); await open(dev, pg);
  const body = () => pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  const banner = async () => /Chưa lưu được dự toán/.test(await body());
  const m0 = S.calls.match; await goBudget(pg);
  const step = async (to, fail, label) => {
    S.putFail = fail; const p = S.calls.put; await dragTo(pg, to);
    const t0 = Date.now(); while (S.calls.put <= p && Date.now() - t0 < 6000) await sleep(80); await sleep(700);
    const b = await banner();
    if (fail && !b) bad(`${label}: lưu lỗi (${fail}) mà không có câu báo`);
    if (!fail && b) bad(`${label}: lưu thành công mà câu báo còn`);
  };
  await step(40, 'abort', '90->40'); await step(45, '500', '40->45');
  if (S.calls.match !== m0) bad(`lưu lỗi mà thẻ gọi lại match (+${S.calls.match - m0})`);
  await step(50, null, '45->50'); if (S.venue !== 50) bad('khung: server phải có 50');
  await sleep(800); const m1 = S.calls.match; if (m1 - m0 !== 1) bad(`lưu 50 thành công phải lấy lại đúng 1 lần, thấy +${m1 - m0}`);
  await step(55, 'abort', '50->55'); await step(50, null, '55->50 (về bản đã lưu)');
  await sleep(800); if (S.calls.match !== m1) bad(`lưu về đúng 50 (đã lưu) hoặc lưu lỗi vẫn gọi lại match (+${S.calls.match - m1}); H3: không gọi thừa`);
  await goChat(pg); const a = await rowOf(pg, 'Alpha Hall');
  if (a.pct !== '70') bad(`thẻ phải theo 50tr (Alpha 70%), thấy ${a.pct}%`);
  await ctx.close();
});
