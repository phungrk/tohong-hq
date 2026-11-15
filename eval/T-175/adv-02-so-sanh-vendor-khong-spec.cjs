#!/usr/bin/env node
/* T-175 adv-02 (Code Gate, tầng 3): vendor không có tags/spec (back trả tags [] , không spec) đi qua luồng so sánh: thẻ chọn (VPickerMultiChatCard, chỗ #3) và bảng so sánh (#4), cùng danh sách + chi tiết chat.
 * Mong đợi (spec T-170 H1b): xét innerText thô từng dòng, không dòng nào chỉ gồm một "·" hay kết thúc bằng "·"; giá còn; không nhãn nguồn giá.
 * Trên thẻ chọn, chữ "· {spec}" là phần tử flex riêng: spec rỗng thì dòng còn trơ "·".
 * Chạy: node eval/T-175/adv-02-so-sanh-vendor-khong-spec.cjs [--repo <tohong-front>] */
const E = require('../T-170/_lib.cjs');
const X = ['Pi', 'Rho', 'Tau', 'Phi'].map((n, i) => E.V('t175_s' + i, n + ' Studio', 11 + i, 13 + i, { tags: [], price_source: 'estimated', price_label: E.L2 }));
const S = E.setup();
S.run(async () => {
  const pg = await S.page('__t170a.html', '', { vendors: { photography: X } });
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Pi Studio'), null, { timeout: 15000 });
    await S.checkDangle('danh sách chat (không spec)', pg, '[data-card="0"]');
    await pg.locator('[data-card="0"]').getByText('Pi Studio', { exact: false }).first().click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(400);
    await S.checkDangle('chi tiết (không spec)', pg, '[data-card="1"]');
    await pg.locator('[data-card="1"]').getByRole('button', { name: 'So sánh' }).first().click({ timeout: 5000 });
    await pg.waitForFunction(() => (document.querySelector('[data-card="2"]') || {}).innerText && document.querySelector('[data-card="2"]').innerText.includes('Rho Studio'), null, { timeout: 8000 });
    await S.checkDangle('thẻ chọn so sánh (không spec)', pg, '[data-card="2"]');
    const t2 = await S.bodyText(pg, '[data-card="2"]');
    for (const p of ['12tr', '13tr', '14tr']) if (!t2.includes(p)) S.bad(`thẻ chọn so sánh: mất giá ${p}`);
    if (E.FORBID.test(t2)) S.bad('thẻ chọn so sánh: còn nhãn ' + t2.match(E.FORBID)[0]);
    await pg.locator('[data-card="2"]').getByText('Rho Studio', { exact: false }).first().click({ timeout: 5000 });
    await pg.locator('[data-card="2"]').getByText('Tau Studio', { exact: false }).first().click({ timeout: 5000 });
    await pg.locator('[data-card="2"]').getByRole('button', { name: /So sánh 3 vendor/ }).click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="3"]', { timeout: 5000 }); await pg.waitForTimeout(600);
    await S.checkDangle('bảng so sánh (không spec)', pg, '[data-card="3"]');
    const t3 = await S.bodyText(pg, '[data-card="3"]');
    if (E.FORBID.test(t3)) S.bad('bảng so sánh: còn nhãn ' + t3.match(E.FORBID)[0]);
  } catch (e) { S.bad('luồng so sánh: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
