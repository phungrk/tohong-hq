#!/usr/bin/env node
/*
 * Eval đối kháng T-068 (adversary, Code Gate). Spec: products/T-066-anh-minh-hoa-tu-tao.md.
 * Thư viện chung cho eval/T-068/adv-0N.sh (tên bắt đầu bằng "_" để gate.py không chạy riêng file này).
 * Input mà eval tầng 1 (eval/T-066/check_ui.cjs) không chạm:
 *   tooltip   M4: ô < 80px "thay bằng thuộc tính title ... (tooltip khi rê chuột)". Tầng 1 chỉ đọc thuộc tính title;
 *             ở đây đo điều người dùng rê chuột thật sự nhận: phần tử trúng chuột ở tâm ô (elementFromPoint) và
 *             title gần nhất của nó (cách trình duyệt chọn tooltip) phải bằng aria-label. Bề mặt 3, 4, 5.
 *   generic   M5 / checklist C6: hạng mục lạ reserve, mc, rỗng, undefined, null, constructor, __proto__, toString,
 *             hasOwnProperty, valueOf, 'VENUE', ' venue' -> cùng một minh hoạ chung, tên "Ảnh minh hoạ", khác cả 10
 *             hình (điểm ảnh, cùng thước đo C3), <= 4096 byte, không màu viết cứng/mạng, không lỗi trang.
 *   multi     M1 "ảnh treo": vendor nhiều ảnh (404+treo, treo+chậm-tốt, 404+html+404, tốt+treo) và ảnh về ở giây 9.
 *   switch    Thẻ chi tiết (bề mặt 2) khi prop vendor đổi giữa chừng: hỏng -> tốt (3 ảnh, đang ở ảnh 3) -> rỗng
 *             -> URL mới chưa kiểm (chậm 3,5s) -> hỏng -> tốt 1 ảnh.
 *   touch     v2: ô < 80px nhận chuột. Chạm/bấm qua ô vẫn chọn hàng (bề mặt 3), chạm kéo trên ô vẫn cuộn (3, 5), ô không vào Tab, nút cạnh ô (5) bấm được.
 *   many      50 vendor trong thẻ danh sách (mở rộng): mỗi ô hỏng/thiếu đúng 1 minh hoạ, ô tốt không; không cuộn ngang;
 *             ô hạng 1 cao > 100px (giá rất dài) vẫn không đè dải "PHÙ HỢP NHẤT"; bấm tim trên ô minh hoạ vẫn lưu;
 *             bấm giữa ô minh hoạ vẫn mở chi tiết; thời gian mở rộng.
 * Chạy: cd /home/user/tohong-hq && NODE_PATH=$(npm root -g) node eval/T-068/_advlib.cjs --repo /home/user/tohong-front --case tooltip
 * Dựng trang thử tạm __adv068*.{jsx,html} trong repo front, xoá khi xong. In "  ok"/"  XX" từng kiểm, dòng cuối PASS/FAIL.
 */
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process');
const { chromium } = require('playwright');
const A = process.argv.slice(2), arg = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const REPO = path.resolve(arg('--repo', ''));
const CASE = arg('--case', '');
if (!fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL cần --repo <tohong-front>'); process.exit(1); }
const fails = [];
const check = (name, ok, extra) => { console.log(`${ok ? '  ok ' : '  XX '} [${CASE}] ${name}${!ok && extra !== undefined ? '  :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 400) : ''}`); if (!ok) fails.push(name); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const img = http.createServer((q, r) => {
  const ok = () => { r.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }); r.end(PNG); };
  if (q.url.startsWith('/good')) ok();
  else if (q.url.startsWith('/slow')) setTimeout(ok, 3500);
  else if (q.url.startsWith('/late9')) setTimeout(ok, 9000);
  else if (q.url.startsWith('/hang')) { /* không bao giờ trả lời */ }
  else if (q.url.startsWith('/html')) { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end('<html>denied</html>'); }
  else { r.writeHead(404); r.end('no'); }
});
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const HTML = (f) => `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/${f}"></script></body></html>`;
const LAB = 'Ảnh minh hoạ';

const PAGE_LIB = `
window.__L = (() => {
  const LAB = ${JSON.stringify(LAB)};
  const rect = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const inter = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
  const tiles = (root) => [...(root || document).querySelectorAll('[role="img"]')].filter(e => (e.getAttribute('aria-label') || '').startsWith(LAB));
  const visible = (e) => { const r = e.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return false; for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false; } return true; };
  const ownText = (e) => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
  /* tooltip trình duyệt: phần tử trúng chuột tại (x,y), rồi title gần nhất đi lên cây */
  const tipAt = (x, y) => { let e = document.elementFromPoint(x, y); const hit = e ? (e.tagName + (e.getAttribute('role') ? '[role=' + e.getAttribute('role') + ']' : '')) : null; for (; e && e.nodeType === 1; e = e.parentElement) if (e.hasAttribute('title')) return { hit, title: e.getAttribute('title') }; return { hit, title: null }; };
  const urlBgIn = (el) => [el, ...el.querySelectorAll('*')].map(x => getComputedStyle(x).backgroundImage).filter(s => /url\\(/.test(s));
  const bigSvgIn = (root) => [...root.querySelectorAll('svg')].filter(e => !e.closest('button') && visible(e) && (rect(e).w >= 28 || rect(e).h >= 28)).length;
  const scrollW = () => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, vw: window.innerWidth });
  return { LAB, rect, inter, tiles, visible, ownText, tipAt, urlBgIn, bigSvgIn, scrollW };
})();
`;
/* hàng thẻ danh sách theo tên vendor: thẻ <a> chứa đúng tên */
const ROW = (name) => `[...document.querySelectorAll('a')].find(a => (a.innerText || '').split('\\n').some(l => l.trim() === ${JSON.stringify(name)}))`;

let b, vite, port, O;
const TMPF = [];
const tmp = (name, content) => { fs.writeFileSync(path.join(REPO, name), content); TMPF.push(name); };
const cleanup = async () => {
  try { b && await b.close(); } catch (e) {}
  try { if (vite && vite.pid) { try { process.kill(-vite.pid, 'SIGTERM'); } catch (e) { vite.kill(); } await new Promise(r => { vite.once('exit', r); setTimeout(r, 3000); }); } } catch (e) {}
  for (const f of TMPF) { try { fs.unlinkSync(path.join(REPO, f)); } catch (e) {} }
  try { for (const f of fs.readdirSync(REPO)) if (/^vite\.config\.[a-z]+\.timestamp-/.test(f)) fs.unlinkSync(path.join(REPO, f)); } catch (e) {}
  try { img.closeAllConnections && img.closeAllConnections(); img.close(); } catch (e) {}
};
const wait = (ms) => new Promise(r => setTimeout(r, Math.max(0, ms)));

const ven = (id, name, cat, urls, extra = {}) => ({ id, name, category: cat, priceMin: 10, priceMax: 20, rating: 4.5, reviewCount: 3, city: 'HCMC', tags: ['modern'], photos: urls.map(url => ({ url })), match: { totalScore: 80, scoreBreakdown: {}, reasons: [] }, ...extra });
const cssv = (u) => `center/cover no-repeat url("${u}")`;
/* vendor đã map (shape của thẻ): gallery là chuỗi nền CSS */
const mapped = (id, name, urls) => ({ id, name, priceTotal: 10, priceMax: 20, priceUnit: 'modern', spec: 'modern', rating: 4.5, rv: 3, match: 80, location: 'HCMC', gallery: urls.length ? urls.map(cssv) : ['linear-gradient(135deg,#7a9ab5,#4a6a85)'], grad: urls.length ? cssv(urls[0]) : 'linear-gradient(135deg,#7a9ab5,#4a6a85)', reasons: [], why: '', includes: [], breakdown: { budget: 50, style: 50, avail: 50 } });

async function newPage(file, routes, logs) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript({ content: PAGE_LIB }); // sống qua lần vite tải lại trang (tối ưu deps lần đầu)
  const pg = await ctx.newPage();
  pg.on('pageerror', e => logs.push('pageerror ' + String(e.message).slice(0, 200)));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) logs.push('console ' + m.text().slice(0, 200)); });
  await pg.route(/marry\.vn/, r => r.abort());
  await pg.route('http://localhost:8787/**', async r => {
    const m = r.request().method(), u = new URL(r.request().url());
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    if (routes) { const out = await routes(u, m); if (out) return r.fulfill({ headers: CORS, contentType: 'application/json', ...out }); }
    return r.fulfill({ status: 404, headers: CORS, contentType: 'application/json', body: '{}' });
  });
  await pg.goto(`http://127.0.0.1:${port}/${file}`, { waitUntil: 'domcontentloaded' });
  
  return pg;
}
const PROVIDERS = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ChatActionsCtx, VMatchChatCard, VDetailChatCard, VPickerMultiChatCard, VCompareTableChatCard } from '/src/screens/chat/VendorChatCards.jsx';
`;

/* ───────────────────────── tooltip ───────────────────────── */
async function caseTooltip() {
  const logs = [];
  const anchor = mapped('a_hong', 'Neo Hong', [O + '/404-anchor.png']);
  const others = [ven('o_hong', 'Hang Hong', 'photography', [O + '/404-o1.png']), ven('o_khong', 'Hang Khong', 'photography', []), ven('o_tot', 'Hang Tot', 'photography', [O + '/good-o3.png'])];
  const cmp = [mapped('c_hong', 'Cot Hong', [O + '/404-c1.png']), mapped('c_khong', 'Cot Khong', []), mapped('c_tot', 'Cot Tot', [O + '/good-c3.png'])];
  tmp('__adv068t.jsx', PROVIDERS + `
import { ScreenVendorShortlist } from '/src/screens/Vendors.jsx';
const anchor = ${JSON.stringify(anchor)}; const cmp = ${JSON.stringify(cmp)};
createRoot(document.getElementById('root')).render(<VendorProvider coupleId="adv068"><ChatActionsCtx.Provider value={{ pushUser: () => {}, pushAI: () => {} }}>
  <div style={{ width: 390 }}>
    <div id="s3"><VPickerMultiChatCard catId="photography" anchor={anchor} /></div>
    <div id="s4"><VCompareTableChatCard catId="photography" vendors={cmp} /></div>
    <div id="s5" style={{ height: 900 }}><ScreenVendorShortlist onMenuOpen={() => {}} onOpenVendorChat={() => {}} /></div>
  </div></ChatActionsCtx.Provider></VendorProvider>);
`); tmp('__adv068t.html', HTML('__adv068t.jsx'));
  const S = [mapped('s_hong', 'Luu Hong', [O + '/404-s1.png']), mapped('s_khong', 'Luu Khong', [])];
  const seed = JSON.stringify({ photography: { shortlisted: S, confirmed: null } });
  const pgFile = '__adv068t.html';
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(([s]) => { if (!localStorage.getItem('th_vendors_adv068')) localStorage.setItem('th_vendors_adv068', s); }, [seed]);
  await ctx.addInitScript({ content: PAGE_LIB });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => logs.push('pageerror ' + String(e.message).slice(0, 200)));
  await pg.route(/marry\.vn/, r => r.abort());
  await pg.route('http://localhost:8787/**', async r => {
    const m = r.request().method(), u = new URL(r.request().url());
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    if (u.pathname.startsWith('/api/vendors/match')) return r.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ vendors: others, total: others.length }) });
    if (m === 'POST' && u.pathname === '/api/vendors/status') return r.fulfill({ headers: CORS, contentType: 'application/json', body: '{"vendors":{}}' });
    return r.fulfill({ status: 404, headers: CORS, contentType: 'application/json', body: '{"error":"vendor not found"}' });
  });
  await pg.goto(`http://127.0.0.1:${port}/${pgFile}`, { waitUntil: 'domcontentloaded' });
  
  // tự kiểm thước đo: ADV068_SELFTEST=1 cho ô minh hoạ nhận chuột lại (pointer-events:auto) -> mọi kiểm tooltip phải xanh
  if (process.env.ADV068_SELFTEST) await pg.addStyleTag({ content: '[role="img"]{pointer-events:auto !important}' });
  await pg.waitForFunction(() => document.body.innerText.includes('Hang Khong') && document.body.innerText.includes('Luu Khong'), null, { timeout: 15000 });
  await wait(2500);
  for (const sel of ['#s3', '#s4', '#s5']) {
    const res = await pg.evaluate((sel) => {
      const L = window.__L, root = document.querySelector(sel);
      return L.tiles(root).map(t => { t.scrollIntoView({ block: 'center' }); const R = L.rect(t); const tip = L.tipAt(R.l + R.w / 2, R.t + R.h / 2); return { label: t.getAttribute('aria-label'), attrTitle: t.getAttribute('title'), w: Math.round(R.w), h: Math.round(R.h), ...tip }; });
    }, sel);
    check(`${sel}: có ô minh hoạ để đo (ảnh hỏng + ảnh thiếu)`, res.length >= 2, res.length);
    for (const t of res) {
      if (Math.min(t.w, t.h) >= 80) continue;
      check(`${sel} ô ${t.w}x${t.h} "${t.label}": rê chuột vào tâm ô phải ra tooltip = tên truy cập (thuộc tính title trên ô: ${JSON.stringify(t.attrTitle)})`, t.title === t.label, `phần tử trúng chuột ${t.hit}, title gần nhất ${JSON.stringify(t.title)}`);
    }
  }
  check('không lỗi trang', !logs.length, logs);
  await ctx.close();
}

/* ───────────────────────── generic ───────────────────────── */
async function caseGeneric() {
  const logs = [];
  const KNOWN = ['venue', 'ceremony', 'photography', 'jewelry', 'attire', 'decor', 'makeup', 'transport', 'stationery', 'honeymoon'];
  const ODD = ['reserve', 'mc', '', undefined, null, 'constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', 'VENUE', ' venue'];
  tmp('__adv068g.jsx', `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorIllustration } from '/src/vendorIllustrations.jsx';
const KNOWN = ${JSON.stringify(KNOWN)};
const ODD = ['reserve', 'mc', '', undefined, null, 'constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', 'VENUE', ' venue'];
const box = (k, id, c) => <div key={k} data-k={k} style={{ width: 96, height: 96, position: 'relative', display: 'inline-block', margin: 6, background: 'var(--paper)' }}><VendorIllustration catId={c} /></div>;
createRoot(document.getElementById('root')).render(<div id="stage">{KNOWN.map((c, i) => box('k' + i, c, c))}{ODD.map((c, i) => box('o' + i, String(c), c))}</div>);
`); tmp('__adv068g.html', HTML('__adv068g.jsx'));
  const pg = await newPage('__adv068g.html', null, logs);
  await pg.waitForSelector('[data-k="o11"] [role="img"]', { timeout: 15000 }).catch(() => {});
  await wait(300);
  const info = await pg.evaluate((n) => { const out = {}; for (const el of document.querySelectorAll('[data-k]')) { const t = el.querySelector('[role="img"]'); const s = t && t.querySelector('svg'); out[el.dataset.k] = t ? { label: t.getAttribute('aria-label'), title: t.getAttribute('title'), svg: s ? s.outerHTML : null, len: s ? s.outerHTML.length : 0 } : null; } return out; });
  const oddKeys = ODD.map((_, i) => 'o' + i);
  for (let i = 0; i < ODD.length; i++) {
    const d = info['o' + i]; const nm = JSON.stringify(ODD[i] === undefined ? 'undefined' : ODD[i]);
    check(`hạng mục lạ ${nm}: có ô role=img chứa svg`, !!(d && d.svg), d);
    if (!d || !d.svg) continue;
    check(`hạng mục lạ ${nm}: tên truy cập đúng "${LAB}" (không kèm hạng mục)`, d.label === LAB, d.label);
    check(`hạng mục lạ ${nm}: svg <= 4096 byte`, d.len <= 4096, d.len);
    const html = d.svg.replace(/url\(#[^)]*\)/g, '');
    check(`hạng mục lạ ${nm}: không màu viết cứng, không tham chiếu mạng`, !/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(html) && !/https?:|<image|url\((?!#)/.test(html));
  }
  const g0 = info.o0 && info.o0.svg;
  check('mọi hạng mục lạ ra CÙNG một minh hoạ chung', oddKeys.every(k => info[k] && info[k].svg === g0), oddKeys.filter(k => !info[k] || info[k].svg !== g0).map(k => ODD[+k.slice(1)]));
  // điểm ảnh: minh hoạ chung khác cả 10 hình (cùng thước đo tiêu chí 3: >= 35% điểm mực không chung)
  const keys = [...KNOWN.map((_, i) => 'k' + i), 'o0'];
  const pngs = []; for (const k of keys) pngs.push((await pg.locator(`[data-k="${k}"]`).screenshot()).toString('base64'));
  const masks = await pg.evaluate(async (pngs) => { const out = [];
    for (const b64 of pngs) { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()); const c = new OffscreenCanvas(bm.width, bm.height), x = c.getContext('2d'); x.drawImage(bm, 0, 0); const d = x.getImageData(0, 0, bm.width, bm.height).data, N = bm.width * bm.height;
      const h = new Map(); for (let i = 0; i < N; i++) { const k = ((d[4 * i] >> 4) << 8) | ((d[4 * i + 1] >> 4) << 4) | (d[4 * i + 2] >> 4); const e = h.get(k); if (e) e.n++; else h.set(k, { n: 1, i }); }
      const top = [...h.values()].sort((a, b) => b.n - a.n), gr = [top[0]]; if (top[1] && top[1].n >= 0.08 * N) gr.push(top[1]);
      const gc = gr.map(g => [d[4 * g.i], d[4 * g.i + 1], d[4 * g.i + 2]]); let m = '';
      for (let i = 0; i < N; i++) { let far = true; for (const g of gc) if (Math.hypot(d[4 * i] - g[0], d[4 * i + 1] - g[1], d[4 * i + 2] - g[2]) <= 48) far = false; m += far ? '1' : '0'; }
      out.push(m); } return out; }, pngs);
  const dist = (a, c) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { const x = a[k] === '1', y = c[k] === '1'; if (x && y) i++; if (x || y) u++; } return u ? 1 - i / u : 0; };
  const gm = masks[masks.length - 1];
  check('minh hoạ chung không gần như trống (>= 1,5% điểm mực)', (gm.split('1').length - 1) >= 0.015 * gm.length);
  const near = KNOWN.map((c, i) => [c, dist(gm, masks[i])]).filter(([, d]) => d < 0.35);
  check('minh hoạ chung khác cả 10 minh hoạ hạng mục (>= 35% điểm mực không chung)', !near.length, near.map(([c, d]) => `${c} ${(d * 100).toFixed(0)}%`).join(', '));
  check('không lỗi trang/console khi render hạng mục lạ', !logs.length, logs);
  await pg.context().close();
}

/* ───────────────────────── multi ───────────────────────── */
async function caseMulti() {
  const logs = [];
  const V = [
    ven('m1', 'Hong Hong', 'photography', [O + '/404-m1a.png', O + '/html-m1b', O + '/404-m1c.png']),
    ven('m2', 'Hong Treo', 'photography', [O + '/404-m2a.png', O + '/hang-m2b.png']),
    ven('m3', 'Treo Cham', 'photography', [O + '/hang-m3a.png', O + '/slow-m3b.png']),
    ven('m4', 'Ve Muon', 'photography', [O + '/late9-m4.png']),
    ven('m5', 'Tot Treo', 'photography', [O + '/good-m5a.png', O + '/hang-m5b.png']),
  ];
  tmp('__adv068m.jsx', PROVIDERS + `
createRoot(document.getElementById('root')).render(<VendorProvider coupleId="adv068"><ChatActionsCtx.Provider value={{ pushUser: () => {}, pushAI: () => {} }}>
  <div id="cards" style={{ width: 390 }}><VMatchChatCard catId="photography" /></div></ChatActionsCtx.Provider></VendorProvider>);
`); tmp('__adv068m.html', HTML('__adv068m.jsx'));
  const pg = await newPage('__adv068m.html', (u) => u.pathname.startsWith('/api/vendors/match') ? { body: JSON.stringify({ vendors: V, total: V.length }) } : null, logs);
  await pg.waitForFunction(() => document.body.innerText.includes('Tot Treo'), null, { timeout: 15000 });
  const t0 = Date.now();
  const rowState = (name) => pg.evaluate((src) => { const a = eval(src); if (!a) return null; const th = a.querySelector('div > div'); const L = window.__L; const t = L.tiles(a); return { tiles: t.length, chip: (a.innerText || '').includes(L.LAB), bigSvg: L.bigSvgIn(a), urlBg: L.urlBgIn(a).length }; }, ROW(name));
  await wait(t0 + 2000 - Date.now());
  let r = await rowState('Hong Hong'); check('t=2s Hong Hong (404 + html + 404): đúng 1 ô minh hoạ có nhãn chữ', r && r.tiles === 1 && r.chip, r);
  r = await rowState('Tot Treo'); check('t=2s Tot Treo (tốt + treo): ảnh thật, không minh hoạ', r && r.tiles === 0 && !r.chip && r.urlBg > 0, r);
  await wait(t0 + 5000 - Date.now());
  r = await rowState('Hong Treo'); check('t=5s Hong Treo (404 + treo): còn "đang kiểm", không vẽ svg minh hoạ/nhãn', r && r.tiles === 0 && !r.chip && r.bigSvg === 0, r);
  r = await rowState('Treo Cham'); check('t=5s Treo Cham (treo + chậm-tốt 3,5s): ảnh thật, không minh hoạ', r && r.tiles === 0 && !r.chip && r.urlBg > 0, r);
  r = await rowState('Ve Muon'); check('t=5s Ve Muon (ảnh về ở giây 9): còn "đang kiểm"', r && r.tiles === 0 && !r.chip && r.bigSvg === 0, r);
  await wait(t0 + 10500 - Date.now());
  r = await rowState('Hong Treo'); check('t=10,5s Hong Treo: mọi URL đã hỏng (404 + treo > 8s) -> 1 ô minh hoạ có nhãn', r && r.tiles === 1 && r.chip, r);
  r = await rowState('Treo Cham'); check('t=10,5s Treo Cham: vẫn ảnh thật (một URL treo không kéo vendor có ảnh tốt sang minh hoạ)', r && r.tiles === 0 && !r.chip && r.urlBg > 0, r);
  r = await rowState('Tot Treo'); check('t=10,5s Tot Treo: vẫn ảnh thật', r && r.tiles === 0 && !r.chip && r.urlBg > 0, r);
  r = await rowState('Ve Muon'); check('t=10,5s Ve Muon: quá 8s là hỏng -> minh hoạ + nhãn (M1 "từ sau giây thứ 8")', r && r.tiles === 1 && r.chip, r);
  await wait(t0 + 12500 - Date.now());
  r = await rowState('Ve Muon'); check('t=12,5s Ve Muon: ảnh về muộn không làm ô nhấp nháy về ảnh thật (vẫn 1 minh hoạ, không khung vỡ)', r && r.tiles === 1, r);
  check('không lỗi trang', !logs.length, logs);
  await pg.context().close();
}

/* ───────────────────────── switch ───────────────────────── */
async function caseSwitch() {
  const logs = [];
  const SEQ = [
    ['hong', mapped('d1', 'Chi Tiet Hong', [O + '/404-d1.png'])],
    ['tot3', mapped('d2', 'Chi Tiet Tot', [O + '/good-d2a.png', O + '/good-d2b.png', O + '/good-d2c.png'])],
    ['rong', mapped('d3', 'Chi Tiet Rong', [])],
    ['moi-cham', mapped('d4', 'Chi Tiet Cham', [O + '/slow-d4.png'])],
    ['hong2', mapped('d1', 'Chi Tiet Hong', [O + '/404-d1.png'])],
    ['tot1', mapped('d5', 'Chi Tiet Tot Mot', [O + '/good-d5.png'])],
  ];
  tmp('__adv068s.jsx', PROVIDERS + `
const SEQ = ${JSON.stringify(SEQ.map(x => x[1]))};
function App() { const [i, setI] = React.useState(0); window.__go = setI;
  return <VendorProvider coupleId="adv068"><ChatActionsCtx.Provider value={{ pushUser: () => {}, pushAI: () => {} }}>
    <div id="cards" style={{ width: 390 }}><VDetailChatCard catId="photography" vendor={SEQ[i]} /></div></ChatActionsCtx.Provider></VendorProvider>; }
createRoot(document.getElementById('root')).render(<App />);
`); tmp('__adv068s.html', HTML('__adv068s.jsx'));
  const pg = await newPage('__adv068s.html', null, logs);
  await pg.waitForFunction(() => document.body.innerText.includes('Chi Tiet Hong'), null, { timeout: 15000 });
  const gal = () => pg.evaluate(() => { const L = window.__L; const g = [...document.querySelectorAll('#cards div')].find(d => Math.abs(d.getBoundingClientRect().height - 150) < 1.5); if (!g) return null;
    const layer = g.firstElementChild; const bg = layer ? getComputedStyle(layer).backgroundImage : ''; const dots = [...g.querySelectorAll('button')].filter(x => x.getBoundingClientRect().height <= 8).length;
    return { tiles: L.tiles(g).length, chip: (g.innerText || '').includes(L.LAB), bigSvg: L.bigSvgIn(g), photo: /url\(/.test(bg), bg: bg.slice(0, 60), dots, name: document.body.innerText.includes('Chi Tiet') ? [...document.body.innerText.matchAll(/Chi Tiet[ A-Za-z]*/g)][0][0] : '' }; });
  await wait(1200);
  let r = await gal(); check('hỏng: 1 minh hoạ phủ gallery, có nhãn, không chấm', r && r.tiles === 1 && r.chip && r.dots === 0, r);
  await pg.evaluate(() => window.__go(1)); await wait(1200);
  r = await gal(); check('đổi sang vendor 3 ảnh tốt: ảnh thật, không minh hoạ, 3 chấm', r && r.tiles === 0 && !r.chip && r.photo && r.dots === 3, r);
  await pg.evaluate(() => { const g = [...document.querySelectorAll('#cards button')].filter(x => x.getBoundingClientRect().height <= 8); g[2] && g[2].click(); }); await wait(400);
  await pg.evaluate(() => window.__go(2)); await wait(250);
  r = await gal(); check('đang ở ảnh 3 rồi đổi sang vendor không ảnh: minh hoạ ngay (không qua đang kiểm), nhãn, không khung trống', r && r.tiles === 1 && r.chip && r.dots === 0, r);
  await pg.evaluate(() => window.__go(3)); await wait(300);
  r = await gal(); check('đổi sang vendor có URL mới chưa kiểm (chậm 3,5s): lúc đang kiểm không vẽ svg minh hoạ/nhãn', r && r.tiles === 0 && !r.chip && r.bigSvg === 0, r);
  await wait(4200);
  r = await gal(); check('URL chậm tải xong: ảnh thật, không minh hoạ', r && r.tiles === 0 && !r.chip && r.photo, r);
  await pg.evaluate(() => window.__go(4)); await wait(300);
  r = await gal(); check('quay lại vendor hỏng (đã biết hỏng): minh hoạ ngay', r && r.tiles === 1 && r.chip, r);
  await pg.evaluate(() => window.__go(5)); await wait(1200);
  r = await gal(); check('đổi sang vendor 1 ảnh tốt: ảnh thật hiện ra (nền không rỗng), không minh hoạ', r && r.tiles === 0 && r.photo, r);
  check('không lỗi trang', !logs.length, logs);
  await pg.context().close();
}

/* ───────────────────────── many ───────────────────────── */
async function caseMany() {
  const logs = [];
  const V = [];
  for (let i = 0; i < 50; i++) {
    const k = i % 3; const nm = `V${String(i + 1).padStart(2, '0')} ${['Hong', 'Khong', 'Tot'][k]}`;
    V.push(ven('n' + i, nm, 'photography', k === 0 ? [O + `/404-n${i}.png`] : k === 1 ? [] : [O + `/good-n${i}.png`], i === 0 ? { priceMin: 123456789, priceMax: 987654321, price_source: 'estimated' } : {}));
  }
  const pushed = [];
  tmp('__adv068n.jsx', PROVIDERS + `
function App() { const [cards, setCards] = React.useState([{ k: 0, C: VMatchChatCard, p: { catId: 'photography' } }]);
  const push = (C, p) => { setCards(c => [...c, { k: c.length, C, p }]); };
  return <VendorProvider coupleId="adv068"><ChatActionsCtx.Provider value={{ pushUser: () => {}, pushAI: push }}>
    <div id="cards" style={{ width: 390 }}>{cards.map(c => <div key={c.k} data-card={c.k}><c.C {...c.p} /></div>)}</div></ChatActionsCtx.Provider></VendorProvider>; }
createRoot(document.getElementById('root')).render(<App />);
`); tmp('__adv068n.html', HTML('__adv068n.jsx'));
  const pg = await newPage('__adv068n.html', (u) => u.pathname.startsWith('/api/vendors/match') ? { body: JSON.stringify({ vendors: V, total: V.length }) } : null, logs);
  await pg.waitForFunction(() => document.body.innerText.includes('V02 Khong'), null, { timeout: 15000 });
  await wait(1500);
  // ô hạng 1 cao hơn 100 (giá rất dài xuống dòng): nhãn không đè dải PHÙ HỢP NHẤT
  const r1 = await pg.evaluate((src) => { const a = eval(src); const L = window.__L; const t = L.tiles(a)[0]; if (!t) return null; const R = L.rect(t);
    const chip = [...a.querySelectorAll('*')].find(e => L.ownText(e) === L.LAB && L.visible(e)); const band = [...a.querySelectorAll('*')].find(e => /PHÙ HỢP NHẤT/.test(L.ownText(e)));
    return { h: Math.round(R.h), chip: chip && L.rect(chip), band: band && L.rect(band), overlap: !!(chip && band && L.inter(L.rect(chip), L.rect(band))) }; }, ROW('V01 Hong'));
  check('ô hạng 1 (giá dài) có minh hoạ + nhãn + dải', r1 && r1.chip && r1.band, r1);
  if (r1 && r1.chip && r1.band) check(`ô hạng 1 cao ${r1.h}px: nhãn nằm trên dải PHÙ HỢP NHẤT, không chồng`, !r1.overlap && r1.chip.b <= r1.band.t + 0.5, r1);
  console.log(`  .. ô hạng 1 cao ${r1 && r1.h}px`);
  // mở rộng 50 vendor
  const t0 = Date.now();
  await pg.locator('[data-card="0"] button', { hasText: /Xem|thêm/i }).first().click({ timeout: 5000 });
  await pg.waitForFunction(() => document.body.innerText.includes('V50 Khong'), null, { timeout: 10000 });
  const tExp = Date.now() - t0;
  await wait(2500);
  const st = await pg.evaluate((names) => { const L = window.__L; const out = { bad: [], svg: document.querySelectorAll('svg').length };
    for (const n of names) { const a = [...document.querySelectorAll('[data-card="0"] a')].find(x => (x.innerText || '').split('\n').some(l => l.trim() === n)); if (!a) { out.bad.push(n + ': không thấy'); continue; }
      const t = L.tiles(a).length, ph = L.urlBgIn(a).length; const want = /Tot$/.test(n) ? 0 : 1; if (t !== want) out.bad.push(`${n}: ${t} ô minh hoạ, muốn ${want}`); if (want === 0 && !ph) out.bad.push(`${n}: thiếu ảnh thật`); }
    out.sw = L.scrollW(); return out; }, V.map(v => v.name));
  check('50 vendor: mỗi ô hỏng/thiếu đúng 1 minh hoạ, ô tốt là ảnh thật', !st.bad.length, st.bad.slice(0, 5));
  check('50 vendor: không cuộn ngang ở 390', st.sw.doc <= st.sw.vw && st.sw.body <= st.sw.vw, st.sw);
  check(`50 vendor: mở rộng hiện đủ trong < 2000 ms (đo ${tExp} ms, ${st.svg} svg trong trang)`, tExp < 2000, tExp);
  console.log(`  .. mở rộng 50 vendor: ${tExp} ms, ${st.svg} svg`);
  // tim và bấm qua lớp phủ
  const hv = await pg.evaluate((src) => { const a = eval(src); a.scrollIntoView({ block: 'center' }); const L = window.__L; const t = L.tiles(a)[0]; const btn = a.querySelector('button'); const B = L.rect(btn), R = L.rect(t);
    const hb = document.elementFromPoint(B.l + B.w / 2, B.t + B.h / 2); const hc = document.elementFromPoint(R.l + R.w / 2, R.t + R.h / 2);
    return { heartHit: !!hb && btn.contains(hb), centerInA: !!hc && a.contains(hc), heartBg: getComputedStyle(btn).backgroundColor, btnBox: B, center: { x: R.l + R.w / 2, y: R.t + R.h / 2 } }; }, ROW('V04 Hong'));
  check('ô minh hoạ: tâm nút tim trúng đúng nút (lớp phủ không chặn)', hv.heartHit, hv);
  await pg.mouse.click(hv.btnBox.l + hv.btnBox.w / 2, hv.btnBox.t + hv.btnBox.h / 2); await wait(600);
  const hb2 = await pg.evaluate((src) => getComputedStyle(eval(src).querySelector('button')).backgroundColor, ROW('V04 Hong'));
  check('bấm tim trên ô minh hoạ: vendor được lưu (nút đổi màu)', hb2 !== hv.heartBg, [hv.heartBg, hb2]);
  // focus bàn phím tới nút tim
  const foc = await pg.evaluate((src) => { const b = eval(src).querySelector('button'); b.focus(); return document.activeElement === b; }, ROW('V07 Hong'));
  check('nút tim trên ô minh hoạ nhận focus', foc);
  const before = await pg.evaluate(() => document.querySelectorAll('[data-card]').length);
  const hv2 = await pg.evaluate((src) => { const a = eval(src); a.scrollIntoView({ block: 'center' }); const R = window.__L.rect(window.__L.tiles(a)[0]); return { x: R.l + R.w / 2, y: R.t + R.h / 2 + 10 }; }, ROW('V10 Hong'));
  await pg.mouse.click(hv2.x, hv2.y); await wait(800);
  const after = await pg.evaluate(() => document.querySelectorAll('[data-card]').length);
  check('bấm giữa ô minh hoạ: mở thẻ chi tiết như cũ', after === before + 1, [before, after]);
  check('không lỗi trang', !logs.length, logs);
  await pg.context().close();
}


/* ───────────────────────── touch ─────────────────────────
   v2: ô < 80px nhận chuột (để có tooltip). Không được chặn: chạm/bấm vào ô trong hàng-nút (bề mặt 3) vẫn chọn/bỏ chọn hàng;
   chạm kéo bắt đầu trên ô (bề mặt 3, 5) vẫn cuộn trang trên điện thoại; ô không vào thứ tự Tab, không giữ focus;
   nút Chốt/Bỏ lưu cạnh ô (bề mặt 5) vẫn trúng chuột. */
async function caseTouch() {
  const logs = [];
  const anchor = mapped('a_hong', 'Neo Hong', [O + '/404-anchor.png']);
  const others = [ven('o_hong', 'Hang Hong', 'photography', [O + '/404-o1.png']), ven('o_khong', 'Hang Khong', 'photography', []), ven('o_tot', 'Hang Tot', 'photography', [O + '/good-o3.png'])];
  tmp('__adv068u.jsx', PROVIDERS + `
import { ScreenVendorShortlist } from '/src/screens/Vendors.jsx';
const anchor = ${JSON.stringify(anchor)};
createRoot(document.getElementById('root')).render(<VendorProvider coupleId="adv068"><ChatActionsCtx.Provider value={{ pushUser: () => {}, pushAI: () => {} }}>
  <div style={{ width: 390 }}>
    <div id="s3"><VPickerMultiChatCard catId="photography" anchor={anchor} /></div>
    <div id="s5"><ScreenVendorShortlist onMenuOpen={() => {}} onOpenVendorChat={() => {}} /></div>
    <div style={{ height: 1500 }} />
  </div></ChatActionsCtx.Provider></VendorProvider>);
`); tmp('__adv068u.html', HTML('__adv068u.jsx'));
  const S = [mapped('s_hong', 'Luu Hong', [O + '/404-s1.png']), mapped('s_khong', 'Luu Khong', [])];
  const seed = JSON.stringify({ photography: { shortlisted: S, confirmed: null } });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(([s]) => { if (!localStorage.getItem('th_vendors_adv068')) localStorage.setItem('th_vendors_adv068', s); }, [seed]);
  await ctx.addInitScript({ content: PAGE_LIB });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => logs.push('pageerror ' + String(e.message).slice(0, 200)));
  await pg.route(/marry\.vn/, r => r.abort());
  await pg.route('http://localhost:8787/**', async r => {
    const m = r.request().method(), u = new URL(r.request().url());
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    if (u.pathname.startsWith('/api/vendors/match')) return r.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ vendors: others, total: others.length }) });
    if (m === 'POST' && u.pathname === '/api/vendors/status') return r.fulfill({ headers: CORS, contentType: 'application/json', body: '{"vendors":{}}' });
    return r.fulfill({ status: 404, headers: CORS, contentType: 'application/json', body: '{"error":"vendor not found"}' });
  });
  await pg.goto(`http://127.0.0.1:${port}/__adv068u.html`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.body.innerText.includes('Hang Khong') && document.body.innerText.includes('Luu Khong'), null, { timeout: 15000 });
  await wait(2500);
  const rowTile = (sel, name) => pg.evaluate(([sel, name]) => { const L = window.__L; const root = document.querySelector(sel);
    const t = L.tiles(root).find(x => { let p = x; for (let i = 0; i < 6 && p; i++, p = p.parentElement) if ((p.innerText || '').includes(name) && !(p.innerText || '').includes(name === 'Hang Hong' ? 'Hang Khong' : name === 'Luu Hong' ? 'Luu Khong' : '@@')) return true; return false; });
    if (!t) return null; window.scrollTo(0, 0); const btn = t.closest('button'); const R = L.rect(t); const hit = document.elementFromPoint(R.l + R.w / 2, R.t + R.h / 2);
    return { x: R.l + R.w / 2, y: R.t + R.h / 2, pe: getComputedStyle(t).pointerEvents, ta: getComputedStyle(t).touchAction, inBtn: !!btn, hitInBtn: !!(btn && hit && btn.contains(hit)), tab: t.tabIndex, btnBg: btn ? getComputedStyle(btn).backgroundColor : null }; }, [sel, name]);
  const btnBg = (name) => pg.evaluate((name) => { const b = [...document.querySelectorAll('#s3 button')].find(x => (x.innerText || '').includes(name)); return b ? getComputedStyle(b).backgroundColor : null; }, name);
  // S3: chạm vào ô minh hoạ trong hàng-nút -> chọn, chạm lần nữa -> bỏ chọn
  let t = await rowTile('#s3', 'Hang Hong');
  check('S3 Hang Hong có ô minh hoạ nằm trong hàng-nút', t && t.inBtn, t);
  if (t) {
    console.log(`  .. S3 ô: pointer-events ${t.pe}, touch-action ${t.ta}, tabIndex ${t.tab}`);
    check('S3: tâm ô minh hoạ trúng chính hàng-nút (phần tử trong nút)', t.hitInBtn, t);
    const bg0 = await btnBg('Hang Hong');
    await pg.touchscreen.tap(t.x, t.y); await wait(500);
    const bg1 = await btnBg('Hang Hong');
    check('S3: chạm vào ô minh hoạ chọn được hàng (nền hàng đổi)', bg1 !== bg0, [bg0, bg1]);
    const act = await pg.evaluate(() => { const a = document.activeElement; return { tag: a && a.tagName, role: a && a.getAttribute('role') }; });
    check('S3: sau khi chạm, focus không nằm trên lớp ô minh hoạ', act.role !== 'img', act);
    await pg.mouse.click(t.x, t.y); await wait(500);
    const bg2 = await btnBg('Hang Hong');
    check('S3: bấm chuột vào ô minh hoạ bỏ chọn được hàng (nền về như cũ)', bg2 === bg0, [bg0, bg2]);
  }
  // không vào thứ tự Tab
  const tabs = await pg.evaluate(() => window.__L.tiles(document).filter(x => x.tabIndex >= 0 || x.querySelector('[tabindex]:not([tabindex="-1"]),a,button,input')).length);
  check('mọi ô minh hoạ không vào thứ tự Tab (không tabindex, không chứa phần tử focus được)', tabs === 0, tabs);
  // Tab qua bề mặt 3: focus đi lần lượt các hàng-nút, không dừng ở ô
  const seen = []; await pg.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  for (let i = 0; i < 8; i++) { await pg.keyboard.press('Tab'); seen.push(await pg.evaluate(() => { const a = document.activeElement; return a ? (a.getAttribute('role') || a.tagName) : null; })); }
  check('Tab 8 lần không dừng ở ô role=img', !seen.includes('img'), seen);
  // cuộn bằng chạm kéo bắt đầu trên ô (S3 40px và S5 32px), có ca đối chứng bắt đầu ngoài ô
  const cdp = await ctx.newCDPSession(pg);
  const drag = async (x, y) => { await pg.evaluate(() => window.scrollTo(0, 0)); await wait(200); const y0 = await pg.evaluate(() => scrollY);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let k = 1; k <= 10; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - k * 25 }] }); await wait(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(700);
    return (await pg.evaluate(() => scrollY)) - y0; };
  const ctl = await drag(380, 600);
  check(`đối chứng: chạm kéo ngoài ô cuộn được trang (${ctl}px)`, ctl > 50, ctl);
  for (const [sel, name] of [['#s3', 'Hang Khong'], ['#s5', 'Luu Hong']]) {
    await pg.evaluate((sel) => { document.querySelector(sel).scrollIntoView({ block: 'start' }); }, sel);
    const tt = await pg.evaluate(([sel, name]) => { const L = window.__L; const t = L.tiles(document.querySelector(sel)).find(x => { let p = x; for (let i = 0; i < 8 && p; i++, p = p.parentElement) if ((p.innerText || '').split('\n').some(l => l.trim() === name)) return true; return false; }); if (!t) return null;
      const top = t.getBoundingClientRect().top + scrollY; window.scrollTo(0, Math.max(0, top - 600)); const R = L.rect(t); return { x: R.l + R.w / 2, y: R.t + R.h / 2, sy: scrollY }; }, [sel, name]);
    if (!tt) { check(`${sel} ${name}: có ô minh hoạ`, false); continue; }
    const y0 = tt.sy;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tt.x, y: tt.y }] });
    for (let k = 1; k <= 10; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tt.x, y: tt.y - k * 25 }] }); await wait(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(700);
    const d = (await pg.evaluate(() => scrollY)) - y0;
    check(`${sel} ${name}: chạm kéo bắt đầu trên ô minh hoạ vẫn cuộn trang (${d}px)`, d > 50, d);
  }
  // S5: nút Chốt và Bỏ lưu cạnh ô vẫn trúng chuột và bấm được
  const s5 = await pg.evaluate(() => { const L = window.__L; const t = L.tiles(document.querySelector('#s5'))[0]; let row = t; while (row && !row.querySelector('button')) row = row.parentElement; row.scrollIntoView({ block: 'center' });
    const bs = [...row.querySelectorAll('button')].map(b => { const R = L.rect(b); const h = document.elementFromPoint(R.l + R.w / 2, R.t + R.h / 2); return { name: b.getAttribute('aria-label') || b.innerText.trim(), ok: !!h && b.contains(h), x: R.l + R.w / 2, y: R.t + R.h / 2 }; }); return bs; });
  check('S5: các nút trong hàng có ô minh hoạ đều trúng chuột ở tâm', s5.length >= 2 && s5.every(b => b.ok), s5);
  const chot = s5.find(b => /Chốt/.test(b.name));
  if (chot) { const before = await pg.evaluate(() => document.querySelector('#s5').innerText); await pg.touchscreen.tap(chot.x, chot.y); await wait(600); const after = await pg.evaluate(() => document.querySelector('#s5').innerText);
    check('S5: chạm "Chốt" ở hàng có ô minh hoạ có tác dụng (nội dung màn đổi)', before !== after); }
  check('không lỗi trang', !logs.length, logs);
  await ctx.close();
}

(async () => {
  const CASES = { tooltip: caseTooltip, generic: caseGeneric, multi: caseMulti, switch: caseSwitch, many: caseMany, touch: caseTouch };
  if (!CASES[CASE]) { console.log('FAIL --case phải là một trong ' + Object.keys(CASES).join(', ')); process.exit(1); }
  await new Promise(r => img.listen(0, '127.0.0.1', r));
  O = 'http://127.0.0.1:' + img.address().port;
  port = 5800 + Math.floor(Math.random() * 400);
  try {
    tmp('__adv068x.html', HTML('__adv068x.jsx')); tmp('__adv068x.jsx', "import '/src/index.css';");
    vite = cp.spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: REPO, stdio: 'ignore', detached: true });
    for (let i = 0; i < 60; i++) { try { await new Promise((res, rej) => http.get(`http://127.0.0.1:${port}/__adv068x.html`, r => { r.resume(); r.statusCode === 200 ? res() : rej(); }).on('error', rej)); break; } catch (e) { await wait(500); if (i === 59) throw new Error('vite không lên'); } }
    b = await chromium.launch();
    await CASES[CASE]();
  } catch (e) { check('lỗi chạy eval', false, String(e && e.message || e).split('\n')[0]); }
  await cleanup();
  console.log(fails.length ? `FAIL ${fails.length} kiểm đỏ: ${fails.slice(0, 3).join(' | ')}` : 'PASS');
  setTimeout(() => process.exit(fails.length ? 1 : 0), 200);
})();
