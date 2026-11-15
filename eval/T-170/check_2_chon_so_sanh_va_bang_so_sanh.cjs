#!/usr/bin/env node
/* T-170 tiêu chí 2 (app cặp đôi, luồng so sánh): từ chi tiết bấm "So sánh" -> thẻ chọn vendor (VPickerMultiChatCard) -> bảng so sánh (VCompareTableChatCard) vẫn hiện giá, KHÔNG hiện nhãn nguồn giá.
 * Mốc mã main 0221a5c: VendorChatCards.jsx:826 (hàng ở thẻ chọn) và :899 (ô "Giá" của bảng so sánh). Ô "Giá" của bảng vẫn có số giá (và hàng "Giá" vẫn đánh dấu giá thấp nhất nếu app đang làm vậy: không đo ở đây).
 * Chạy: node eval/T-170/check_2_chon_so_sanh_va_bang_so_sanh.cjs [--repo <tohong-front>] */
const E = require('./_lib.cjs'); const S = E.setup();
S.run(async () => {
  const pg = await S.page('__t170a.html');
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Alpha Studio'), null, { timeout: 15000 });
    await pg.locator('[data-card="0"]').getByText('Alpha Studio', { exact: false }).first().click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="1"]', { timeout: 5000 });
    await pg.locator('[data-card="1"]').getByRole('button', { name: 'So sánh' }).first().click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="2"]', { timeout: 5000 });
    await pg.waitForFunction(() => (document.querySelector('[data-card="2"]') || {}).innerText && document.querySelector('[data-card="2"]').innerText.includes('Beta Studio'), null, { timeout: 8000 });
    for (const v of E.VENDORS.slice(1)) { const n = v.name.split(' ')[0]; const t = await S.rowText(pg, '[data-card="2"]', n + ' Studio'); S.checkRow('thẻ chọn so sánh', v.name, t, v); }
    await pg.locator('[data-card="2"]').getByText('Beta Studio', { exact: false }).first().click({ timeout: 5000 });
    await pg.locator('[data-card="2"]').getByText('Zeta Studio', { exact: false }).first().click({ timeout: 5000 });
    await pg.locator('[data-card="2"]').getByRole('button', { name: /So sánh 3 vendor/ }).click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="3"]', { timeout: 5000 }); await pg.waitForTimeout(600);
    const t = await S.bodyText(pg, '[data-card="3"]');
    for (const p of [11, 12, 16]) if (!t.includes(`${p}tr`)) S.bad(`bảng so sánh: mất giá ${p}tr, thấy "${t.slice(0, 200)}"`);
    const f = t.match(E.FORBID); if (f) S.bad(`bảng so sánh: còn nhãn nguồn giá "${f[0]}", thấy "${t.slice(0, 240)}"`);
  } catch (e) { S.bad('luồng so sánh: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
