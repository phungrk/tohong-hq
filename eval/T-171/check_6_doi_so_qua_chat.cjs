#!/usr/bin/env node
/* T-171 tiêu chí 6 (tohong-front, App thật): số khách đổi bằng ACTION CHAT (cặp đôi gõ "nhà mình 300 khách", server ghi, front nhận action update_profile thành công) thì thẻ vendor
 * hiện điểm theo 300 khách: lần mở vendor sau đó ghi "30 bàn = 117tr so với 90tr tiệc cưới" (trước 20 bàn = 78tr), Alpha 70%. Cũng kiểm lấy lại khi thẻ còn mount: hai thẻ vendor mở trước và sau.
 * Luồng người dùng thật: Ngân sách > Nhà hàng > "Tìm nhà hàng tiệc cưới" (thẻ vendor) > đóng > nút Tơ Hồng AI > gõ và gửi > đóng > "Tìm nhà hàng tiệc cưới" lại > mở chi tiết Alpha.
 * Ghi chú cấu trúc (đọc từ AIChatModal.jsx:149-166): thẻ vendor chỉ nằm ở luồng vendor, ô gõ chat chỉ ở luồng chat thường; đổi qua lại có thể dựng lại thẻ. Eval đo kết quả người dùng thấy, đúng cả khi thẻ dựng lại lẫn khi lấy lại.
 * Chạy từ gốc tohong-hq: node eval/T-171/check_6_doi_so_qua_chat.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async ({ dev, br, bad, newServer, openApp, cardText }) => {
  const S = newServer(); S.chatGuests = 300; const { ctx, pg } = await openApp(dev, br, S);
  const body = () => pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  const vendorOpen = async () => { await pg.getByText('Tìm nhà hàng tiệc cưới').first().click(); await pg.waitForFunction(() => document.body.innerText.includes('Alpha Hall'), null, { timeout: 8000 }); await sleep(500); };
  const detail = async () => { await pg.getByText('Alpha Hall', { exact: false }).first().click(); await pg.waitForFunction(() => /20 bàn|30 bàn/.test(document.body.innerText), null, { timeout: 8000 }); await sleep(800); return body(); };
  await vendorOpen(); const d0 = await detail();
  if (!/20 bàn = 78tr so với 90tr tiệc cưới/.test(d0)) bad('khởi điểm: chi tiết phải ghi "20 bàn = 78tr so với 90tr tiệc cưới"');
  await pg.getByRole('button', { name: 'Đóng', exact: true }).first().click(); await sleep(500);
  await pg.getByRole('button', { name: 'Quay lại' }).first().click(); await sleep(500);
  await pg.locator('button:visible', { hasText: /^\s*AI\s*$/ }).first().click({ timeout: 5000 });
  const box = pg.getByPlaceholder('Nhắn cho Tơ Hồng…'); await box.fill('nhà mình 300 khách'); await pg.getByRole('button', { name: 'Gửi tin nhắn' }).click();
  const t0 = Date.now(); while (!S.calls.chat && Date.now() - t0 < 6000) await sleep(100);
  if (!S.calls.chat) bad('khung: tin nhắn chat không tới server giả');
  await sleep(1500); await pg.getByRole('button', { name: 'Đóng', exact: true }).first().click(); await sleep(500);
  await pg.getByText('Nhà hàng tiệc cưới', { exact: false }).first().click(); await sleep(500);
  await vendorOpen(); const d1 = await detail();
  if (!/30 bàn = 117tr so với 90tr tiệc cưới/.test(d1)) bad('sau action chat đổi số khách 200 -> 300, thẻ vendor phải ghi "30 bàn = 117tr so với 90tr tiệc cưới", thấy: ' + (d1.match(/\d+ bàn = [^ ]+ so với \d+tr/) || ['không thấy dòng phép so'])[0]);
  await ctx.close();
});
