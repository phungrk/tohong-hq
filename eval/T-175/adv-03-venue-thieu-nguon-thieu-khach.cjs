#!/usr/bin/env node
/* T-175 adv-03 (Code Gate, tầng 3): venue không price_basis (back cũ) và venue thiếu số khách (dòng phép so "Chưa có số khách…"), venue đã lưu với giá đổi, min=max.
 * Mong đợi (spec T-170 H1, H1b, H2, H5): venue có price_basis ghi "/bàn", không price_basis thì không "/bàn"; dòng phép so in nguyên văn đúng một lần; không nhãn; không "·" mồ côi
 * ở danh sách chat, chi tiết, danh sách đã lưu, hàng + sheet Ngân sách hạng mục venue.
 * Chạy: node eval/T-175/adv-03-venue-thieu-nguon-thieu-khach.cjs [--repo <tohong-front>] */
const E = require('../T-170/_lib.cjs');
const OLD = E.V('t175_v1', 'Upsilon Hall', 3, 3, { category: 'venue', price_source: 'estimated' });                         // back cũ: không basis, không nhãn
const NOG = E.V('t175_v2', 'Psi Hall', 4.2, 4.2, { category: 'venue', price_source: 'estimated', price_basis: 'estimate_category', price_label: E.L2 });
E.VENDORS.push(OLD, NOG);
const T_NOG = 'Giá ước tính: Chưa có số khách nên chưa tính được tổng tiệc (giá ≈ 4,2tr/bàn)';
const S = E.setup();
S.run(async () => {
  const opts = { vendors: { venue: [OLD, NOG] }, basis: { [NOG.id]: T_NOG }, budget: { total_tr: 100, guests: null, categories: [{ id: 'venue', name: 'Tiệc & nhà hàng', allocated_tr: 60, pct: 60, items: [] }] } };
  let pg = await S.page('__t170a.html', '?cat=venue', opts);
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Psi Hall'), null, { timeout: 15000 });
    await S.checkDangle('venue danh sách chat', pg, '[data-card="0"]');
    const l = await S.bodyText(pg, '[data-card="0"]');
    if (E.FORBID.test(l)) S.bad('venue danh sách chat: còn nhãn ' + l.match(E.FORBID)[0]);
    if (!/4\.2tr\/bàn/.test(l)) S.bad('venue danh sách chat: Psi phải "4.2tr/bàn"');
    if (/(^|\D)3tr\/bàn/.test(l)) S.bad('venue danh sách chat: Upsilon không price_basis không được ghi "/bàn"');
    await pg.locator('[data-card="0"]').getByText('Psi Hall', { exact: false }).first().click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(600);
    await S.checkDangle('venue chi tiết Psi', pg, '[data-card="1"]');
    const d = await S.bodyText(pg, '[data-card="1"]');
    if (d.split(T_NOG).length - 1 !== 1) S.bad('venue chi tiết Psi: dòng phép so thiếu khách phải in nguyên văn đúng một lần');
    const rest = d.split(T_NOG).join(' '); if (E.FORBID.test(rest)) S.bad('venue chi tiết Psi: ngoài dòng phép so còn nhãn ' + rest.match(E.FORBID)[0]);
  } catch (e) { S.bad('venue chat: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  const saved = E.savedDoc('venue', [E.mkSaved(OLD, 3), E.mkSaved(NOG, 3.5)]);
  for (const [surf, q, click] of [['đã lưu', '', null], ['Ngân sách', '?v=budget&cat=venue', null], ['Ngân sách sheet Psi', '?v=budget&cat=venue', 'Psi Hall'], ['Ngân sách sheet Upsilon', '?v=budget&cat=venue', 'Upsilon Hall']]) {
    pg = await S.page('__t170b.html', q, { ...opts, seed: saved });
    try {
      await pg.waitForFunction(() => document.body.innerText.includes('Psi Hall'), null, { timeout: 15000 }); await pg.waitForTimeout(1200);
      if (click) { await pg.getByText(click, { exact: false }).first().click({ timeout: 5000 }); await pg.waitForTimeout(800); }
      const scope = click ? 'body' : '#root';
      await S.checkDangle('venue ' + surf, pg, scope);
      const t = await S.bodyText(pg, scope);
      if (E.FORBID.test(t)) S.bad(`venue ${surf}: còn nhãn ${t.match(E.FORBID)[0]}`);
      if (!click && !/giá đã cập nhật/.test(t)) S.bad(`venue ${surf}: Psi (lưu 3.5tr, nay 4.2tr) phải còn "giá đã cập nhật"`);
      if (click === 'Psi Hall' && !/Bạn đã lưu lúc 3\.5tr\. Giá hiện tại trên Tơ Hồng: 4\.2tr\/bàn(?!\s*·)/.test(t)) S.bad('sheet Psi: phải "Bạn đã lưu lúc 3.5tr. Giá hiện tại trên Tơ Hồng: 4.2tr/bàn" (min=max một số, không "·" treo), thấy: ' + (t.match(/Bạn đã lưu[^]{0,90}/) || ['(không có)'])[0]);
    } catch (e) { S.bad(`venue ${surf}: lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
});
