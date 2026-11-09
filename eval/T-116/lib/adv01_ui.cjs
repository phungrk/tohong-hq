#!/usr/bin/env node
// Eval đối kháng tầng 3 của T-116 (adversary). Dựng VendorIllustration trực tiếp (không qua dữ liệu giả của bề mặt) ở hai khung:
// desktop 1280x900 và mobile 390x844; mỗi hạng mục trong VENDOR_CATEGORIES + catId lạ + catId rỗng, ở ô lớn 150/100px và ô nhỏ 48/32px.
// D1 không có chữ "minh hoạ" nhìn thấy dưới mọi cách viết (bỏ dấu, NFD, hoa thường): text node, svg <text>, ::before/::after.
// D2 ô lớn: không có thuộc tính title ở ô và mọi con, không có svg <title>/<desc>, mọi con có pointer-events none.
// D3 ô lớn: elementFromPoint ở tâm và 4 góc (lùi 3px) không trúng ô; rê chuột 1,2 giây không sinh chữ "minh hoạ" mới nào.
//   cd /home/user/tohong-hq && NODE_PATH=$(npm root -g) node eval/T-116/lib/adv01_ui.cjs --repo <tohong-front>
// File thử chỉ đi qua tham số files của startViteDev (tên mới, helper tự dọn); không truyền file của repo.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { chromium } = require('playwright');
const { startViteDev } = require('../../_lib/vite_dev.cjs');
const A = process.argv.slice(2), REPO = path.resolve(A.includes('--repo') ? A[A.indexOf('--repo') + 1] : '');
if (!fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL cần --repo <tohong-front>'); process.exit(1); }
const id = crypto.randomBytes(4).toString('hex'), J = `__adv116-${id}.jsx`, H = `__adv116-${id}.html`;
const JSX = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VENDOR_CATEGORIES } from '/src/screens/VendorCtx.jsx';
import { VendorIllustration } from '/src/vendorIllustrations.jsx';
const ids = [...VENDOR_CATEGORIES.map(c => c.id), 'khong-ton-tai', undefined];
const box = (s) => ({ width: s, height: s, position: 'relative', overflow: 'hidden', display: 'inline-block', margin: 4, background: '#eee' });
createRoot(document.getElementById('root')).render(<div>
  {ids.map((c, i) => <div key={i} data-cat={String(c)}>
    {[150, 100].map(s => <div key={s} data-size={s} data-large="1" style={box(s)}><VendorIllustration catId={c} large /></div>)}
    {[48, 32].map(s => <div key={s} data-size={s} style={box(s)}><VendorIllustration catId={c} /></div>)}
  </div>)}
</div>);
`;
const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/${J}"></script></body></html>`;
const SCAN = () => {
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/\s+/g, ' ');
  const hitTxt = s => /minh ?hoa/.test(norm(s));
  const vis = e => { for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) { const p = n.parentElement; if (!p || /^(SCRIPT|STYLE|TITLE|DESC)$/i.test(p.tagName)) continue; if (hitTxt(n.nodeValue) && vis(p)) out.push('text<' + p.tagName + '>: ' + n.nodeValue.trim()); }
  for (const e of document.body.querySelectorAll('*')) for (const ps of ['::before', '::after']) { const c = getComputedStyle(e, ps).content; if (c && c !== 'none' && c !== 'normal' && hitTxt(c) && vis(e)) out.push(ps + ' <' + e.tagName + '>: ' + c); }
  return out;
};
(async () => {
  let dev, b; const fails = [];
  try {
    dev = await startViteDev({ repo: REPO, files: { [J]: JSX, [H]: HTML } });
    b = await chromium.launch();
    for (const vp of [{ width: 1280, height: 900, n: 'desktop' }, { width: 390, height: 844, n: 'mobile' }]) {
      const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height } }); const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', e => errs.push(e.message));
      await pg.goto(`${dev.url}/${H}`); await pg.waitForSelector('[role="img"]', { timeout: 30000 }); await pg.waitForTimeout(300);
      if (errs.length) fails.push(`${vp.n} lỗi trang: ${errs[0]}`);
      const n = await pg.$$eval('[role="img"]', l => l.length); if (n < 20) fails.push(`${vp.n} chỉ thấy ${n} ô role=img`);
      for (const m of await pg.evaluate(SCAN)) fails.push(`D1 ${vp.n} ${m}`);
      const d2 = await pg.evaluate(() => { const o = [];
        for (const box of document.querySelectorAll('[data-large]')) { const t = box.querySelector('[role="img"]'); const tag = box.parentElement.dataset.cat + '/' + box.dataset.size;
          if (!t) { o.push(tag + ' thiếu ô role=img'); continue; }
          for (const e of [t, ...t.querySelectorAll('*')]) { if (e.hasAttribute('title')) o.push(tag + ' title ở <' + e.tagName + '>'); const pe = getComputedStyle(e).pointerEvents; if (pe !== 'none') o.push(tag + ' <' + e.tagName + '> pointer-events ' + pe); }
          if (t.querySelector('title,desc')) o.push(tag + ' có svg <title>/<desc>'); }
        return o; });
      for (const m of d2) fails.push(`D2 ${vp.n} ${m}`);
      const boxes = await pg.$$('[data-large]');
      for (const bx of boxes) {
        await bx.scrollIntoViewIfNeeded(); const r = await bx.boundingBox();
        const pts = [[r.x + r.width / 2, r.y + r.height / 2], [r.x + 3, r.y + 3], [r.x + r.width - 3, r.y + 3], [r.x + 3, r.y + r.height - 3], [r.x + r.width - 3, r.y + r.height - 3]];
        const hit = await bx.evaluate((el, pts) => pts.some(([x, y]) => { const e = document.elementFromPoint(x, y); const t = el.querySelector('[role="img"]'); return e && t && (e === t || t.contains(e)); }), pts);
        if (hit) fails.push(`D3 ${vp.n} ô lớn ${await bx.evaluate(e => e.parentElement.dataset.cat + '/' + e.dataset.size)} bắt chuột`);
      }
      if (boxes[0]) { await boxes[0].scrollIntoViewIfNeeded(); const r = await boxes[0].boundingBox(); await pg.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await pg.waitForTimeout(1200);
        for (const m of await pg.evaluate(SCAN)) fails.push(`D3 ${vp.n} sau khi rê chuột: ${m}`); }
      await ctx.close();
    }
  } catch (e) { fails.push('lỗi chạy: ' + e.message); }
  finally {
    if (b) await b.close().catch(() => {});
    if (dev) await dev.stop().catch(() => {});
    try { for (const f of fs.readdirSync(REPO)) if (/^vite\.config\.[a-z]+\.timestamp-/.test(f)) fs.unlinkSync(path.join(REPO, f)); } catch (e) {}
  }
  const uniq = [...new Set(fails)];
  if (uniq.length) { console.log('FAIL ' + uniq.length + ' lỗi'); for (const m of uniq.slice(0, 20)) console.log('  ' + m); process.exit(1); }
  console.log('PASS không chữ "minh hoạ" nhìn thấy, ô lớn không title/svg title và xuyên chuột ở tâm + 4 góc, desktop và mobile, mọi hạng mục + catId lạ/rỗng');
  process.exit(0);
})();
