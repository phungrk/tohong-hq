#!/usr/bin/env node
/* T-193 đối kháng 2: lưu vendor KHÔNG GIÁ qua đường thật (bấm tim ở danh sách chat -> localStorage -> màn Vendors), không seed tay.
 * Spec T-192 H4: dòng vendor đã lưu ở màn Vendors, giá rỗng (kể cả priceMin null/bỏ khuyết) -> "Chưa có giá"; không "0tr" bịa, không "tr" trơ.
 * Vendor: Beta2 priceMin null / priceMax 6 ; Gamma2 bỏ khuyết / 7 ; Delta2 "" / "" ; Eps2 4 / 5 (đối chứng "4tr").
 * Rồi mở lại thẻ chi tiết từ vendor đã lưu không có ở đây (chi tiết chỉ từ danh sách), nên chỉ đo màn Vendors.
 * Chạy: node eval/T-193/adv-02-luu-vendor-khong-gia-qua-duong-that.cjs [--repo <tohong-front>] */
const path = require('path');
const { E, BARE_TR } = require(path.join(__dirname, '../T-192/_mini.cjs')); const S = E.setup(); const dash = E.dash;
const sc = { totalScore: 90, scoreBreakdown: {}, reasons: [] };
const L = [E.V('a193_b', 'Beta Studio', null, 6, { match: sc }), E.V('a193_g', 'Gamma Studio', undefined, 7, { match: sc }), E.V('a193_d', 'Delta Studio', '', '', { match: sc }), E.V('a193_e', 'Epsilon Studio', 4, 5, { match: sc })];
for (const v of L) E.ALL.push(v);
const WANT = { Beta: 'Chưa có giá', Gamma: 'Chưa có giá', Delta: 'Chưa có giá', Epsilon: '4tr' };
S.run(async () => {
  let pg = await S.page('__t187a.html', '?cat=photography', { vendors: { photography: L } });
  let seed = null;
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Epsilon Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(600);
    for (const n of Object.keys(WANT)) {
      const ok = await pg.evaluate((name) => {
        const root = document.querySelector('[data-card="0"]');
        const leaf = [...root.querySelectorAll('div')].filter((e) => (e.innerText || '').trim() === name)[0]; if (!leaf) return false;
        let el = leaf; while (el && !el.querySelector('button svg') && el.parentElement) el = el.parentElement;
        const b = [...el.querySelectorAll('button')].find((x) => x.querySelector('svg') && !(x.innerText || '').trim()); if (!b) return false; b.click(); return true;
      }, n + ' Studio');
      if (!ok) S.bad(`không bấm được nút lưu của ${n} Studio`);
      await pg.waitForTimeout(250);
    }
    await pg.waitForTimeout(500);
    seed = await pg.evaluate(() => localStorage.getItem('th_vendors_t187'));
    if (!seed || !seed.includes('Delta Studio')) S.bad('lưu từ chat không ghi vào localStorage: ' + String(seed).slice(0, 200));
  } catch (e) { S.bad('lưu từ chat: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  if (!seed) return;
  pg = await S.page('__t187b.html', '', { seed });
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Epsilon Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(1200);
    for (const n of Object.keys(WANT)) {
      const t = dash(await S.rowText(pg, '#root', n + ' Studio') || '');
      const at = t.indexOf(WANT[n]);
      if (at < 0) { S.bad(`Vendors (${n} lưu từ chat): mong "${WANT[n]}", thấy "${t.slice(0, 200)}"`); continue; }
      const rest = t.slice(0, at) + ' ' + t.slice(at + WANT[n].length);
      if (/\d[\d,]*\s*tr/.test(rest) || BARE_TR.test(rest) || /NaN|undefined|null/.test(rest)) S.bad(`Vendors (${n}): ngoài "${WANT[n]}" còn số tiền/"tr" lạ (vd "0tr" bịa), thấy "${t.slice(0, 200)}"`);
    }
  } catch (e) { S.bad('Vendors sau khi lưu: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
