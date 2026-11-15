#!/usr/bin/env node
/* T-171 tiêu chí 2 (tohong-front): sau khi đổi dự toán Tiệc cưới 90 -> 40 (kéo thanh "Dự toán" ở màn Ngân sách), (a) màn chi tiết vendor ĐANG MỞ trong chat đổi tại chỗ: "Phân tích AI · 70% phù hợp",
 * thanh Ngân sách 0%, dòng phép so "≈ 3,9tr/bàn × 20 bàn = 78tr so với 40tr tiệc cưới"; (b) bảng so sánh ĐÃ TẠO cũng đổi: cột Alpha 70% (không còn 100%); (c) mở chi tiết Alpha lần nữa từ danh sách hiện đúng số mới.
 * Không tải lại trang. Chạy từ gốc tohong-hq: node eval/T-171/check_2_chi_tiet_va_so_sanh.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async ({ dev, br, bad, newServer, mount, open, goBudget, goChat, dragTo, cardText, waitText, openDetail }) => {
  const S = newServer(); const { ctx, pg } = await mount(br, S); await open(dev, pg);
  await openDetail(pg, 'Alpha Hall', 1);
  const d0 = await cardText(pg, 1);
  if (!/100% phù hợp/i.test(d0 || '') || !/20 bàn = 78tr so với 90tr tiệc cưới/.test(d0 || '')) bad('khởi điểm: chi tiết phải ghi 100% phù hợp và "20 bàn = 78tr so với 90tr tiệc cưới", thấy: ' + (d0 || '').slice(0, 200));
  await pg.locator('[data-card="1"]').getByText('So sánh', { exact: false }).first().click();
  await pg.waitForSelector('[data-card="2"]'); await pg.locator('[data-card="2"]').getByText('Beta Hall', { exact: false }).first().waitFor();
  await pg.locator('[data-card="2"]').getByText('Beta Hall', { exact: false }).first().click();
  await pg.locator('[data-card="2"]').getByRole('button', { name: /So sánh 2 vendor/ }).click();
  await pg.waitForSelector('[data-card="3"]'); await pg.waitForTimeout(500);
  const c0 = await cardText(pg, 3);
  if (!/100%/.test(c0 || '') || !/80%/.test(c0 || '')) bad('khởi điểm: bảng so sánh phải có Phù hợp 100% và 80%, thấy: ' + (c0 || '').slice(0, 200));
  await goBudget(pg); await dragTo(pg, 40); const t0 = Date.now(); while (S.venue !== 40 && Date.now() - t0 < 6000) await sleep(100);
  await goChat(pg);
  const d1 = await waitText(pg, 1, /so với 40tr tiệc cưới/, 5000);
  if (!/20 bàn = 78tr so với 40tr tiệc cưới/.test(d1 || '')) bad('(a) chi tiết đang mở phải ghi "20 bàn = 78tr so với 40tr tiệc cưới", thấy: ' + (d1 || '').slice(0, 220));
  if (!/Phân tích AI · 70% phù hợp/i.test(d1 || '')) bad('(a) chi tiết phải ghi 70% phù hợp sau khi đổi dự toán, thấy: ' + (d1 || '').slice(0, 220));
  if (!/Ngân sách 0%/.test(d1 || '')) bad('(a) thanh Ngân sách trong chi tiết phải là 0% (78tr vượt 40tr hơn 20%)');
  let c1 = null; const t1 = Date.now(); while (Date.now() - t1 < 4000) { c1 = await cardText(pg, 3); if (c1 && !/100%/.test(c1)) break; await sleep(150); }
  if (/100%/.test(c1 || '') || !/70%/.test(c1 || '')) bad('(b) bảng so sánh đã tạo phải hiện Alpha 70% (không còn 100%), thấy: ' + (c1 || '').slice(0, 220));
  await pg.locator('[data-card="0"]').getByText('Alpha Hall', { exact: false }).first().click();
  await pg.waitForSelector('[data-card="4"]'); const d2 = await waitText(pg, 4, /so với \d+tr tiệc cưới/, 4000);
  if (!/20 bàn = 78tr so với 40tr tiệc cưới/.test(d2 || '')) bad('(c) mở chi tiết Alpha lần nữa phải ghi "so với 40tr tiệc cưới", thấy: ' + (d2 || '').slice(0, 220));
  if (!(await pg.evaluate(() => window.__noReload === 1))) bad('trang bị tải lại; điểm phải đổi không cần tải lại trang');
  await ctx.close();
});
