#!/usr/bin/env node
/* T-171 tiêu chí 1 (tohong-front): đổi dự toán Tiệc cưới 90 -> 40 ở màn Ngân sách (đường lưu thật, kéo thanh "Dự toán") thì thẻ danh sách vendor trong chat
 * (a) hiện điểm mới và thứ tự mới của server mà không tải lại trang; (b) trong lúc chờ điểm mới không hiện điểm cũ như điểm hiện hành, hiện "Đang cập nhật điểm".
 * Alpha Hall: 100% ở 90tr, 70% ở 40tr (78tr so với 40tr vượt > 20%); Beta Hall 80% cố định => thứ tự Alpha, Beta -> Beta, Alpha.
 * Chạy từ gốc tohong-hq: node eval/T-171/check_1_doi_du_toan_the_danh_sach.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async ({ dev, br, bad, newServer, mount, open, goBudget, goChat, dragTo, rowOf }) => {
  { // (a)
    const S = newServer(); const { ctx, pg } = await mount(br, S); await open(dev, pg);
    const a0 = await rowOf(pg, 'Alpha Hall');
    if (a0.pct !== '100' || a0.order.join() !== 'Alpha,Beta') bad(`(a) khởi điểm sai: Alpha ${a0.pct}% thứ tự ${a0.order.join('>')} (cần 100%, Alpha>Beta)`);
    await goBudget(pg); await dragTo(pg, 40);
    const t0 = Date.now(); while (S.calls.put < 1 && Date.now() - t0 < 6000) await sleep(100);
    if (S.venue !== 40) bad(`(a) lưu không tới server giả (venue=${S.venue}); khung eval hỏng`);
    await goChat(pg);
    let a1 = null; const t1 = Date.now(); while (Date.now() - t1 < 5000) { a1 = await rowOf(pg, 'Alpha Hall'); if (a1.pct === '70') break; await sleep(150); }
    if (a1.pct !== '70') bad(`(a) sau khi đổi dự toán 90 -> 40, thẻ danh sách vẫn hiện Alpha Hall ${a1.pct}% (cần 70%, điểm theo 40tr)`);
    if (a1.order.join() !== 'Beta,Alpha') bad(`(a) thứ tự trên thẻ phải theo server sau khi đổi (Beta>Alpha), thấy ${a1.order.join('>')}`);
    if (!(await pg.evaluate(() => window.__noReload === 1))) bad('(a) trang bị tải lại; điểm phải đổi không cần tải lại trang');
    await ctx.close();
  }
  { // (b)
    const S = newServer(); S.delayMatchMs = 1800; const { ctx, pg } = await mount(br, S); await open(dev, pg);
    await pg.waitForFunction(() => /\d+%/.test(document.querySelector('[data-card="0"]')?.innerText || ''), null, { timeout: 8000 });
    const m0 = S.calls.match;
    await goBudget(pg); await dragTo(pg, 40); await goChat(pg);
    const t0 = Date.now(); while (S.calls.match <= m0 && Date.now() - t0 < 6000) await sleep(40);
    if (S.calls.match <= m0) bad('(b) không thấy thẻ lấy lại điểm sau khi lưu (không có lần gọi match mới)');
    else {
      await sleep(250); // đang chờ phản hồi chậm 1,8s
      const mid = await rowOf(pg, 'Alpha Hall'); const card = await pg.evaluate(() => document.querySelector('[data-card="0"]').innerText);
      if (mid.pct === '100') bad('(b) trong lúc chờ điểm mới, thẻ vẫn hiện Alpha Hall 100% (điểm theo 90tr) như điểm hiện hành');
      if (!/Đang cập nhật điểm/i.test(card)) bad('(b) trong lúc chờ điểm mới, thẻ phải hiện chữ "Đang cập nhật điểm"');
    }
    await ctx.close();
  }
});
