#!/usr/bin/env node
/* T-170 tiêu chí 1 (app cặp đôi, thẻ chat): danh sách vendor (VMatchChatCard) và chi tiết vendor (VDetailChatCard) vẫn hiện giá, KHÔNG hiện nhãn nguồn giá (kể cả chữ dự phòng khi back cũ không có price_label).
 * Mốc mã main 0221a5c: VendorChatCards.jsx:383 (hàng danh sách) và :617 (đầu chi tiết). Venue vẫn ghi giá theo bàn "4tr–4.6tr/bàn"; hạng mục khác không có "/bàn".
 * Chạy: node eval/T-170/check_1_chat_danh_sach_va_chi_tiet.cjs [--repo <tohong-front>] */
const E = require('./_lib.cjs'); const S = E.setup();
S.run(async () => {
  let pg = await S.page('__t170a.html');
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Alpha Studio'), null, { timeout: 15000 });
    for (const v of E.VENDORS) { const n = v.name.split(' ')[0]; const t = await S.rowText(pg, '[data-card="0"]', n + ' Studio'); S.checkRow('danh sách chat', v.name, t, v); if (t && /\/bàn/.test(t)) S.bad(`danh sách chat: hạng mục chụp ảnh không được ghi "/bàn" (${n})`); }
  } catch (e) { S.bad('danh sách chat: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  for (const v of E.VENDORS) {
    const n = v.name.split(' ')[0]; pg = await S.page('__t170a.html');
    try {
      await pg.waitForFunction(() => document.body.innerText.includes('Alpha Studio'), null, { timeout: 15000 });
      await pg.locator('[data-card="0"]').getByText(new RegExp('^\\s*' + n + ' Studio\\s*$')).first().click({ timeout: 5000 });
      await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(500);
      const d = await S.bodyText(pg, '[data-card="1"]');
      if (!d.includes(`${v.priceMin}tr`)) S.bad(`chi tiết ${n}: mất giá ${v.priceMin}tr`);
      const f = d.match(E.FORBID); if (f) S.bad(`chi tiết ${n}: còn nhãn nguồn giá "${f[0]}"`);
    } catch (e) { S.bad(`chi tiết ${n}: lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
  /* venue: giá theo bàn, không nhãn, ở cả danh sách và chi tiết */
  pg = await S.page('__t170a.html', '?cat=venue');
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Omega Hall'), null, { timeout: 15000 });
    const t = await S.rowText(pg, '[data-card="0"]', 'Omega Hall');
    if (!t || !/4tr\s*[–-]\s*4\.6tr\/bàn/.test(t)) S.bad('venue danh sách chat: giá phải còn ghi theo bàn "4tr–4.6tr/bàn", thấy: ' + String(t).slice(0, 160));
    if (t && E.FORBID.test(t)) S.bad('venue danh sách chat: còn nhãn nguồn giá: ' + t.slice(0, 160));
    await pg.locator('[data-card="0"]').getByText('Omega Hall', { exact: false }).first().click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(500);
    const d = await S.bodyText(pg, '[data-card="1"]');
    if (!/4tr\s*[–-]\s*4\.6tr\/bàn/.test(d)) S.bad('venue chi tiết: giá phải còn ghi theo bàn "4tr–4.6tr/bàn", thấy: ' + d.slice(0, 160));
    if (E.FORBID.test(d)) S.bad('venue chi tiết: còn nhãn nguồn giá: ' + d.match(E.FORBID)[0]);
  } catch (e) { S.bad('venue: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
