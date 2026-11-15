#!/usr/bin/env node
/* T-175 adv-01 (Code Gate, tầng 3): price_label rỗng / chỉ dấu cách / chữ lạ (kể cả có "·"), price_source thiếu hoặc giá trị lạ, giá min=max, giá 0.
 * Mong đợi (spec T-170 H1, H1b, H2): ở danh sách chat, chi tiết chat, danh sách đã lưu, hàng + sheet Ngân sách: không chữ nhãn nào (kể cả nhãn lạ "NHANLA…" và chữ dự phòng "giá ước tính"/"giá đã xác minh"),
 * không phần tử data-testid="price-tag", không dấu "·" mồ côi; giá vẫn hiện; min=max chỉ một số ("9tr", không "9tr–9tr").
 * Dùng khung eval/T-170/_lib.cjs (không sửa nó: chỉ thêm vendor vào mảng VENDORS để API giả /status trả về).
 * Chạy: node eval/T-175/adv-01-nhan-rong-la-thieu-nguon.cjs [--repo <tohong-front>] */
const E = require('../T-170/_lib.cjs');
const X = [
  E.V('t175_k', 'Kappa Studio', 21, 23, { price_source: 'estimated', price_label: '' }),
  E.V('t175_l', 'Lambda Studio', 22, 24, { price_label: '   ' }),                                       // không price_source
  E.V('t175_m', 'Mu Studio', 25, 27, { price_source: 'weird', price_basis: 'x', price_label: 'NHANLA Nguồn XYZ · 01/2027' }),
  E.V('t175_n', 'Nu Studio', 9, 9, {}),                                                                 // không nguồn, không nhãn, min=max
  E.V('t175_x', 'Xi Studio', 0, 0, { price_source: 'verified', price_label: 'NHANLA verified' }),      // giá 0
];
E.VENDORS.push(...X);
const S = E.setup();
const BAD = /NHANLA|giá marry|marry\.vn|ước tính theo hạng mục|giá do tơ hồng|giá cũ marry|giá đã xác minh|giá ước tính/i;
const tagCount = (pg) => pg.evaluate(() => document.querySelectorAll('[data-testid="price-tag"]').length);
const check = async (surf, pg, scope) => {
  const t = await S.bodyText(pg, scope);
  const f = t.match(BAD); if (f) S.bad(`${surf}: còn nhãn nguồn giá "${f[0]}"`);
  if (/9tr\s*[–-]\s*9tr/.test(t)) S.bad(`${surf}: min=max hiện hai lần "9tr–9tr"`);
  if (await tagCount(pg)) S.bad(`${surf}: còn phần tử price-tag`);
  await S.checkDangle(surf, pg, scope);
  return t;
};
S.run(async () => {
  const vendors = { photography: X };
  /* chat: danh sách + chi tiết từng vendor */
  let pg = await S.page('__t170a.html', '', { vendors });
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Kappa Studio'), null, { timeout: 15000 });
    const t = await check('danh sách chat', pg, '[data-card="0"]');
    for (const p of ['21tr', '22tr', '25tr', '9tr']) if (!t.includes(p)) S.bad(`danh sách chat: mất giá ${p}`);
  } catch (e) { S.bad('danh sách chat: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  for (const v of X.slice(0, 4)) {
    pg = await S.page('__t170a.html', '', { vendors });
    try {
      await pg.waitForFunction(() => document.body.innerText.includes('Kappa Studio'), null, { timeout: 15000 });
      await pg.locator('[data-card="0"]').getByText(v.name, { exact: false }).first().click({ timeout: 5000 });
      await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(500);
      const d = await check(`chi tiết ${v.name}`, pg, '[data-card="1"]');
      if (!d.includes(`${v.priceMin}tr`)) S.bad(`chi tiết ${v.name}: mất giá ${v.priceMin}tr`);
    } catch (e) { S.bad(`chi tiết ${v.name}: lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
  /* đã lưu + Ngân sách: Mu lưu lúc 20tr (giá đổi, nhãn lạ), còn lại giá không đổi */
  const saved = E.savedDoc('photography', X.map((v) => (v.id === 't175_m' ? E.mkSaved(v, 20) : E.mkSaved(v))));
  pg = await S.page('__t170b.html', '', { seed: saved });
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Kappa Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(1200);
    const t = await check('danh sách đã lưu', pg, '#root');
    if (!/giá đã cập nhật/.test(t)) S.bad('danh sách đã lưu: Mu (lưu 20tr, nay 25tr) phải còn "giá đã cập nhật"');
  } catch (e) { S.bad('danh sách đã lưu: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  for (const n of [null, 'Mu Studio', 'Lambda Studio', 'Nu Studio']) {
    pg = await S.page('__t170b.html', '?v=budget', { seed: saved });
    try {
      await pg.waitForFunction(() => document.body.innerText.includes('Kappa Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(1200);
      if (!n) { const t = await check('màn Ngân sách (hàng)', pg, '#root'); if (!/Chưa có giá/.test(t)) S.bad('màn Ngân sách: vendor giá 0 phải hiện "Chưa có giá"'); }
      else {
        await pg.getByText(n, { exact: false }).first().click({ timeout: 5000 }); await pg.waitForTimeout(800);
        const b = await check(`màn Ngân sách (sheet ${n})`, pg, 'body');
        if (n === 'Mu Studio' && !/Bạn đã lưu lúc 20tr\. Giá hiện tại trên Tơ Hồng: 25\s*[–-]\s*27tr(?!\s*·)/.test(b)) S.bad('sheet Mu: phải còn "Bạn đã lưu lúc 20tr. Giá hiện tại trên Tơ Hồng: 25–27tr" không "·" treo, thấy: ' + (b.match(/Bạn đã lưu[^]{0,100}/) || ['(không có)'])[0]);
      }
    } catch (e) { S.bad(`màn Ngân sách (${n || 'hàng'}): lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
});
