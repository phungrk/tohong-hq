#!/usr/bin/env node
/* T-189 adv-04 (adversary, v2): hàng Vendors đã lưu ở 320px (khung và viewport 320) với:
 *  (a) vendor THẬT tên dài nhất pool + giá đã cập nhật; (b) tên tác giả rất dài (dài nhất pool x3, có một "từ" 60 ký tự không dấu cách);
 *  (c) ảnh Google đầu thiếu tác giả, ảnh sau có tác giả (chỉ ảnh sau được hiện, tác giả của nó); (d) chỉ ảnh không phải Google có trường attribution (không ghi công).
 * Mong đợi (T-156 tiêu chí 4/5, inv-006): tác giả nhìn thấy, không cắt, cách ô ảnh <= 32px; ảnh Google thiếu tên không hiện; ảnh marry không có chữ ghi công;
 *  và không tràn ngang ở 320px (scrollWidth <= 320).
 * Chạy: node adv-04-da-luu-320-tac-gia-rat-dai.cjs --repo <tohong-front> */
const path = require('path');
const HQ = path.resolve(__dirname, '..', '..');
const L = require(path.join(HQ, 'eval/T-156/lib/f156.cjs')), F = require(path.join(HQ, 'eval/T-156/lib/flows156.cjs'));
const { REPO, chromium } = L.repoArgs(process.argv.slice(2));
const R = L.reporter();
let A;
(async () => {
  const S = L.buildSets(L.loadPool());
  const pool = L.loadPool();
  const okG = (v) => v.photos && v.photos[0] && L.isG(v.photos[0]) && L.hasAttr(v.photos[0]) && !v.name.toLowerCase().includes(v.photos[0].attribution.trim().toLowerCase());
  const longest = pool.filter(okG).sort((a, b) => b.name.length - a.name.length || (a.id < b.id ? -1 : 1))[0];
  const LA = `${S.P3.photos.find(L.isG).attribution.trim()} ${'X'.repeat(60)} ${S.P3.photos.find(L.isG).attribution.trim()}`;
  const veryLong = { ...longest, id: 't189_longauth', name: 'Tac Gia Rat Dai Studio', photos: [{ url: 'https://lh3.googleusercontent.com/t189/rat-dai=s800-w800', source: 'google', attribution: LA }] };
  A = await L.startApp(REPO, chromium);
  const cases = [
    { v: longest, changed: true, label: `tên ${longest.name.length} ký tự + giá đã cập nhật` },
    { v: veryLong, changed: true, label: `tác giả ${LA.length} ký tự (có từ 60 ký tự liền)` },
    { v: S.N2, changed: false, label: 'ảnh Google đầu thiếu tác giả, ảnh sau có' },
    { v: S.N0, changed: false, label: 'chỉ ảnh marry mang trường attribution', forbid: [L.SENT] },
  ];
  for (const c of cases) {
    const saved = L.mkSaved(c.v); saved.priceTotal = 15000000; saved.priceUnit = c.v.spec || (c.v.tags || []).slice(0, 2).join(' · ') || 'gói';
    const live = { ...c.v, priceMin: c.changed ? 23500000 : 15000000, priceMax: c.changed ? 48900000 : null };
    const pg = await A.open('__t156s.html', '', { vendors: [], byId: { [c.v.id]: live }, saved: L.savedDoc([saved]) });
    try {
      await pg.setViewportSize({ width: 320, height: 700 });
      await pg.waitForFunction((n) => document.body.innerText.includes(n), c.v.name, { timeout: 20000 });
      await pg.evaluate(() => { const d = document.querySelector('#root > div'); if (d) d.style.width = '320px'; });
      await pg.waitForTimeout(2000);
      await F.assertSurface(A, pg, '#root', [F.expectOf(c.v)], `đã lưu 320px, ${c.label}`, R.bad, { forbid: c.forbid || [] });
      if (c.forbid) { const t = await L.textIn(pg, '#root'); if (/Ảnh:/.test(t)) R.bad(`đã lưu 320px, ${c.label}: có chữ "Ảnh:" dù ảnh không phải Google`); }
      const sw = await pg.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
      if (sw > 321) R.bad(`đã lưu 320px, ${c.label}: tràn ngang (scrollWidth ${sw}px > 320)`);
      if (process.env.T189_DEBUG) { const e = F.expectOf(c.v); if (e.author) console.log('DBG', c.label, sw, JSON.stringify(await A.probe(pg, { scopeSel: '#root', needle: e.author, thumbStem: e.stem }))); }
    } catch (e) { R.bad(`${c.label}: lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
})().catch((e) => R.bad('lỗi khung chạy: ' + String(e.message).split('\n')[0])).finally(async () => { try { A && await A.stop(); } catch (e) { /* */ } R.finish(); });
