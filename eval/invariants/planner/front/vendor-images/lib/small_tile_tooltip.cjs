#!/usr/bin/env node
/*
 * Bất biến planner/front/vendor-images INV-004 (rút từ eval đối kháng eval/T-068/adv-01.sh, adversary, T-068 Code Gate 2026-11-05).
 * Spec gốc: products/T-066-anh-minh-hoa-tu-tao.md M4: ô minh hoạ cạnh ngắn < 80px không có chữ nhãn, thay bằng title = aria-label
 * "tooltip khi rê chuột". Đo điều người dùng nhận thật: phần tử trúng chuột ở tâm ô (elementFromPoint) và title gần nhất đi lên cây
 * (cách trình duyệt chọn tooltip) phải bằng aria-label. Bề mặt 3 (40x40), 4 (74x30), 5 (32x32). Thuộc tính title có mà lớp ô
 * không nhận chuột (pointer-events:none) thì đỏ. Tự kiểm: ADV068_SELFTEST=1 ép ô nhận chuột -> phải xanh.
 * Chạy qua inv-004-*.sh (có điều kiện áp dụng). Dựng trang thử tạm __inv004*.{jsx,html} trong repo front, xoá khi xong.
 */
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process');
const { chromium } = require('playwright');
const { startViteDev } = require('../../../../../_lib/vite_dev.cjs');
const A = process.argv.slice(2), arg = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const REPO = path.resolve(arg('--repo', ''));
const CASE = 'tooltip';
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

let b, dev, port, O;
const TMPF = [];
const tmp = (name, content) => { fs.writeFileSync(path.join(REPO, name), content); TMPF.push(name); };
const cleanup = async () => {
  try { b && await b.close(); } catch (e) {}
  try { dev && await dev.stop(); } catch (e) {}
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
  tmp('__inv004t.jsx', PROVIDERS + `
import { ScreenVendorShortlist } from '/src/screens/Vendors.jsx';
const anchor = ${JSON.stringify(anchor)}; const cmp = ${JSON.stringify(cmp)};
createRoot(document.getElementById('root')).render(<VendorProvider coupleId="adv068"><ChatActionsCtx.Provider value={{ pushUser: () => {}, pushAI: () => {} }}>
  <div style={{ width: 390 }}>
    <div id="s3"><VPickerMultiChatCard catId="photography" anchor={anchor} /></div>
    <div id="s4"><VCompareTableChatCard catId="photography" vendors={cmp} /></div>
    <div id="s5" style={{ height: 900 }}><ScreenVendorShortlist onMenuOpen={() => {}} onOpenVendorChat={() => {}} /></div>
  </div></ChatActionsCtx.Provider></VendorProvider>);
`); tmp('__inv004t.html', HTML('__inv004t.jsx'));
  const S = [mapped('s_hong', 'Luu Hong', [O + '/404-s1.png']), mapped('s_khong', 'Luu Khong', [])];
  const seed = JSON.stringify({ photography: { shortlisted: S, confirmed: null } });
  const pgFile = '__inv004t.html';
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

(async () => {
  const CASES = { tooltip: caseTooltip };
  if (!CASES[CASE]) { console.log('FAIL --case phải là một trong ' + Object.keys(CASES).join(', ')); process.exit(1); }
  await new Promise(r => img.listen(0, '127.0.0.1', r));
  O = 'http://127.0.0.1:' + img.address().port;
  try {
    tmp('__inv004x.html', HTML('__inv004x.jsx')); tmp('__inv004x.jsx', "import '/src/index.css';");
    dev = await startViteDev({ repo: REPO, files: {} }); port = dev.port;
    b = await chromium.launch();
    await CASES[CASE]();
  } catch (e) { check('lỗi chạy eval', false, String(e && e.message || e).split('\n')[0]); }
  await cleanup();
  console.log(fails.length ? `FAIL ${fails.length} kiểm đỏ: ${fails.slice(0, 3).join(' | ')}` : 'PASS');
  setTimeout(() => process.exit(fails.length ? 1 : 0), 200);
})();
