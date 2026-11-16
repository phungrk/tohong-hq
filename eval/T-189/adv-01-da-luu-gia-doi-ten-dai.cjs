#!/usr/bin/env node
/* T-189 adv-01 (adversary): hàng Vendors đã lưu khi dòng phụ DÀI NHẤT có thể: giá đã cập nhật (priceMin hiện tại khác giá lúc lưu) + tên vendor dài
 * + tên tác giả dài nhất pool. T-189 đặt tên tác giả xuống dòng riêng dưới dòng giá; dòng giá dài nhiều dòng có thể đẩy chữ ghi công xa ô ảnh 32px.
 * Mong đợi (T-156 tiêu chí 4 / inv-006): tên tác giả hiện, nhìn thấy, cách khung ảnh <= 32px, ở 390px. Eval inv-006 chỉ thử giá KHÔNG đổi, tên ngắn.
 * Chạy: node adv-01-da-luu-gia-doi-ten-dai.cjs --repo <tohong-front> */
const path = require('path');
const HQ = path.resolve(__dirname, '..', '..');
const L = require(path.join(HQ, 'eval/T-156/lib/f156.cjs')), F = require(path.join(HQ, 'eval/T-156/lib/flows156.cjs'));
const { REPO, chromium } = L.repoArgs(process.argv.slice(2));
const R = L.reporter();
let A;
(async () => {
  const S = L.buildSets(L.loadPool());
  A = await L.startApp(REPO, chromium);
  // Vendor THẬT của pool: ảnh đầu là ảnh Google có tác giả, tên vendor dài nhất (pool có tên tới 60+ ký tự); priceUnit = spec thật như lúc lưu từ chat.
  const pool = L.loadPool();
  const okG = (v) => v.photos && v.photos[0] && L.isG(v.photos[0]) && L.hasAttr(v.photos[0]) && !v.name.toLowerCase().includes(v.photos[0].attribution.trim().toLowerCase());
  const longest = pool.filter(okG).sort((a, b) => b.name.length - a.name.length || (a.id < b.id ? -1 : 1)).slice(0, 2);
  const longAuthor = S.P3;
  const specOf = (v) => v.spec || (v.tags || []).slice(0, 2).join(' · ');
  const cases = [];
  for (const v of [...longest, longAuthor]) for (const changed of [false, true]) cases.push({ v, changed, label: `${v.name.length} ký tự tên${v === longAuthor ? ' (tác giả dài nhất pool)' : ''}, giá ${changed ? 'ĐÃ cập nhật' : 'không đổi'}` });
  for (const c of cases) {
    const saved = L.mkSaved(c.v); saved.priceTotal = 15000000; saved.priceUnit = specOf(c.v);
    const live = { ...c.v, priceMin: c.changed ? 23500000 : 15000000, priceMax: c.changed ? 48900000 : null };
    const pg = await A.open('__t156s.html', '', { vendors: [], byId: { [c.v.id]: live }, saved: L.savedDoc([saved]) });
    try {
      await pg.waitForFunction((n) => document.body.innerText.includes(n), c.v.name, { timeout: 20000 }); await pg.waitForTimeout(2000);
      const txt = await L.textIn(pg, '#root');
      if (c.changed && !/cập nhật/.test(txt)) R.bad(`${c.label}: ca thử không dựng được dòng "giá đã cập nhật" (eval cần sửa)`);
      await F.assertSurface(A, pg, '#root', [F.expectOf(c.v)], `đã lưu, giá đổi, ${c.label}`, R.bad, {});
      if (process.env.T189_DEBUG) { const e = F.expectOf(c.v); console.log('DBG', c.label, JSON.stringify(await A.probe(pg, { scopeSel: '#root', needle: e.author, thumbStem: e.stem }))); }
    } catch (e) { R.bad(`${c.label}: lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
})().catch((e) => R.bad('lỗi khung chạy: ' + String(e.message).split('\n')[0])).finally(async () => { try { A && await A.stop(); } catch (e) { /* */ } R.finish(); });
