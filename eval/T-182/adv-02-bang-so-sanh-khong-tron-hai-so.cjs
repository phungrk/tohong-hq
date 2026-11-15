#!/usr/bin/env node
/* T-182 adv-02 (adversary, spec T-179 H4 câu cuối: "Bảng so sánh tạo từ thẻ chi tiết cũng chấm theo số đã lưu lúc tạo (một lần `ids`, T-171 H8), rồi đóng băng";
 * H2 "mọi thẻ chỉ ghi số tại lúc nó ra đời"; bản thay inv-006: "thẻ chi tiết/so sánh MỚI luôn theo số đã lưu tại lúc mở").
 * Kịch bản (App thật): dự toán 90 -> Tìm vendor -> mở chi tiết Alpha (100%, so với 90tr) -> đổi dự toán 40 (đã lưu) -> Tìm vendor (danh sách mới 40tr) ->
 * trên thẻ chi tiết đã hiện bấm "So sánh" -> chọn Beta -> "So sánh 2 vendor". Bảng là thẻ MỚI tạo lúc số đã lưu = 40: Alpha phải 70% (không 100% của số 90),
 * Beta 80%; bảng không được đặt điểm theo hai số khác nhau cạnh nhau. Không gọi chi tiết từng vendor để lấy điểm (T-171 H8).
 * Chạy từ gốc tohong-hq: node eval/T-182/adv-02-bang-so-sanh-khong-tron-hai-so.cjs [--repo <tohong-front>] */
const path = require('path');
const { run, sleep } = require(path.join(__dirname, '..', 'T-179', '_lib.cjs'));
run(async ({ dev, br, bad, newServer, openApp, dragTo, body, pressFind, closeChat }) => {
  const S = newServer(); const { ctx, pg } = await openApp(dev, br, S);
  await pressFind(pg, 1);
  await pg.locator('a.vm-card-in', { hasText: 'Alpha' }).first().click();
  await pg.waitForFunction(() => /so với 90tr/.test(document.body.innerText) && /Phân tích AI · 100% phù hợp/i.test(document.body.innerText), null, { timeout: 8000 }); await sleep(600);
  await closeChat(pg); await dragTo(pg, 40, { settleMs: 2000 });
  if (S.venue !== 40) bad(`dự toán chưa lưu 40 (server ${S.venue})`);
  await pressFind(pg, 2);
  await pg.getByRole('button', { name: 'So sánh', exact: true }).first().click();
  await pg.waitForFunction(() => /Chọn tối đa/.test(document.body.innerText), null, { timeout: 8000 }); await sleep(800);
  await pg.locator('button', { hasText: 'Beta' }).last().click(); await sleep(300);
  const d0 = S.calls.detail;
  await pg.getByRole('button', { name: /So sánh 2 vendor/ }).first().click();
  await pg.waitForFunction(() => /vendor đặt cạnh nhau/.test(document.body.innerText), null, { timeout: 8000 }); await sleep(1500);
  const tbl = await pg.evaluate(() => {
    const el = [...document.querySelectorAll('*')].filter((e) => /vendor đặt cạnh nhau/.test(e.innerText || '')).pop();
    let c = el; while (c && !/Đánh giá/i.test(c.innerText || '')) c = c.parentElement;
    return c ? c.innerText.replace(/\s+/g, ' ') : '';
  });
  const pcts = (tbl.match(/\d+%/g) || []); if (process.env.T171_ALL) console.log('bảng: ' + tbl);
  if (pcts.includes('100%')) bad(`bảng so sánh tạo khi số đã lưu = 40tr vẫn đặt Alpha 100% (điểm theo 90tr) cạnh Beta (điểm theo 40tr): ${JSON.stringify(pcts)}`);
  if (!pcts.includes('70%')) bad(`bảng so sánh phải chấm Alpha theo số đã lưu lúc tạo (70% ở 40tr), thấy ${JSON.stringify(pcts)}`);
  if (S.calls.detail - d0 > 0) bad(`tạo bảng không được gọi chi tiết từng vendor để lấy điểm (+${S.calls.detail - d0})`);
  void body;
  await ctx.close();
});
