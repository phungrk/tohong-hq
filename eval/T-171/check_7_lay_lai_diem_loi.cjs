#!/usr/bin/env node
/* T-171 tiêu chí 7 (tohong-front): lấy lại điểm LỖI (server 500 sau khi dự toán đã lưu 90 -> 40) không im lặng và không hiện số cũ.
 * (a) thẻ danh sách: hiện đúng chữ "Chưa cập nhật được điểm. Thử lại" và nút "Thử lại"; không còn Alpha 100%; khi server tốt lại, bấm "Thử lại" -> Alpha 70%, thứ tự Beta, Alpha, câu lỗi biến mất.
 * (b) thẻ chi tiết đang mở: cùng câu và nút, không còn "100% phù hợp" hay "so với 90tr"; bấm "Thử lại" khi server tốt -> "70% phù hợp" và "so với 40tr tiệc cưới".
 * Chạy từ gốc tohong-hq: node eval/T-171/check_7_lay_lai_diem_loi.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async ({ dev, br, bad, newServer, mount, open, goBudget, goChat, dragTo, rowOf, cardText, waitText, openDetail }) => {
  const S = newServer(); const { ctx, pg } = await mount(br, S); await open(dev, pg);
  await openDetail(pg, 'Alpha Hall', 1);
  const m0 = S.calls.match, d0 = S.calls.detail;
  S.matchFail = true; S.detailFail = true; S.detailFailFrom = d0; // mọi lần lấy lại từ giờ lỗi
  await goBudget(pg); await dragTo(pg, 40); const t0 = Date.now(); while (S.venue !== 40 && Date.now() - t0 < 6000) await sleep(100);
  await goChat(pg); await sleep(2500);
  if (S.calls.match <= m0) bad('khung: thẻ không gọi lại match sau khi lưu thành công');
  const c0 = await cardText(pg, 0), c1 = await cardText(pg, 1);
  if (!/Chưa cập nhật được điểm\. Thử lại/.test(c0 || '')) bad('(a) lấy lại điểm lỗi: thẻ danh sách phải hiện "Chưa cập nhật được điểm. Thử lại", thấy: ' + (c0 || '').slice(0, 160));
  if (/\b100%/.test(c0 || '')) bad('(a) thẻ danh sách vẫn hiện 100% (điểm theo 90tr) sau khi lấy lại lỗi');
  if (!(await pg.locator('[data-card="0"]').getByRole('button', { name: /Thử lại/ }).first().isVisible().catch(() => false))) bad('(a) thẻ danh sách phải có nút "Thử lại"');
  if (!/Chưa cập nhật được điểm\. Thử lại/.test(c1 || '')) bad('(b) lấy lại điểm lỗi: thẻ chi tiết phải hiện "Chưa cập nhật được điểm. Thử lại", thấy: ' + (c1 || '').slice(0, 160));
  if (/100% phù hợp/i.test(c1 || '') || /so với 90tr/.test(c1 || '')) bad('(b) thẻ chi tiết vẫn hiện điểm hoặc phép so theo 90tr sau khi lấy lại lỗi');
  if (!(await pg.locator('[data-card="1"]').getByRole('button', { name: /Thử lại/ }).first().isVisible().catch(() => false))) bad('(b) thẻ chi tiết phải có nút "Thử lại"');
  S.matchFail = false; S.detailFail = false;
  const btn0 = pg.locator('[data-card="0"]').getByRole('button', { name: /Thử lại/ }).first(); if (await btn0.isVisible().catch(() => false)) await btn0.click();
  const btn1 = pg.locator('[data-card="1"]').getByRole('button', { name: /Thử lại/ }).first(); if (await btn1.isVisible().catch(() => false)) await btn1.click();
  let a = null; const t1 = Date.now(); while (Date.now() - t1 < 5000) { a = await rowOf(pg, 'Alpha Hall'); if (a.pct === '70') break; await sleep(150); }
  if (a.pct !== '70' || a.order.join() !== 'Beta,Alpha') bad(`(a) bấm "Thử lại" khi server tốt: thẻ danh sách phải hiện Alpha 70% và thứ tự Beta, Alpha, thấy ${a.pct}% ${a.order.join('>')}`);
  const d1 = await waitText(pg, 1, /so với 40tr tiệc cưới/, 5000);
  if (!/Phân tích AI · 70% phù hợp/i.test(d1 || '') || !/so với 40tr tiệc cưới/.test(d1 || '')) bad('(b) bấm "Thử lại" khi server tốt: chi tiết phải hiện 70% phù hợp và "so với 40tr tiệc cưới", thấy: ' + (d1 || '').slice(0, 200));
  if (/Chưa cập nhật được điểm/.test((await cardText(pg, 0)) || '') || /Chưa cập nhật được điểm/.test(d1 || '')) bad('câu lỗi vẫn còn sau khi lấy lại thành công');
  await ctx.close();
});
