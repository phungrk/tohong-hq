#!/usr/bin/env node
// Eval tầng 1 của T-114 (products/T-114-bo-chu-anh-minh-hoa.md). Đo trên DOM thật (Chromium 390px, vite dev qua eval/_lib/vite_dev.cjs),
// dữ liệu giả + ảnh hỏng/thiếu/chậm/treo giả. Dựng từ khung đo của bất biến vendor-images (cùng dữ liệu, cùng 6 bề mặt).
//   cd /home/user/tohong-hq && NODE_PATH=$(npm root -g) node eval/T-114/check_ui.cjs --repo /home/user/tohong-front [--only 1,2,3,4,5]
// C1 không còn chữ "Ảnh minh hoạ" nhìn thấy ở 6 bề mặt | C2 tên truy cập, khung, title ô nhỏ | C3 ô có ảnh thật / đang kiểm không đổi
// C4 ô lớn (>=80px) không chặn chuột | C5 không cuộn ngang. Mỗi dòng "C<n> PASS|FAIL"; dòng cuối PASS/FAIL; mã thoát 0/1.
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process');
const { chromium } = require('playwright');
const { startViteDev } = require('../_lib/vite_dev.cjs');
const A = process.argv.slice(2), arg = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const REPO = path.resolve(arg('--repo', ''));
const ONLY = (arg('--only', '1,2,3,4,5')).split(',').map(Number);
const SHOTS = arg('--shots', null), TAG = arg('--tag', 'sau');
if (!fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL cần --repo <tohong-front>'); process.exit(1); }
const F = { 1: [], 2: [], 3: [], 4: [], 5: [] };
const bad1 = (m) => { if (!F[1].includes(m)) F[1].push(m); }, bad4 = (m) => { if (!F[4].includes(m)) F[4].push(m); };
const miss = (m) => bad(2, m);
const bad = (n, m) => { if (!F[n].includes(m)) F[n].push(m); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const hits = [];
const img = http.createServer((q, r) => {
  hits.push(q.url);
  if (q.url.startsWith('/good')) { r.writeHead(200, { 'Content-Type': 'image/png' }); r.end(PNG); }
  else if (q.url.startsWith('/slow')) { setTimeout(() => { r.writeHead(200, { 'Content-Type': 'image/png' }); r.end(PNG); }, 3500); }
  else if (q.url.startsWith('/hang')) { /* không bao giờ trả lời */ }
  else if (q.url.startsWith('/html')) { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end('<html>denied</html>'); }
  else { r.writeHead(404); r.end('no'); }
});
const CATS = { venue: 'Tiệc & nhà hàng', ceremony: 'Ăn hỏi & sính lễ', photography: 'Chụp ảnh / quay', jewelry: 'Nhẫn cưới & trang sức', attire: 'Trang phục',
  decor: 'Trang trí & hoa', makeup: 'Trang điểm & làm tóc', transport: 'Xe hoa & đưa đón', stationery: 'Thiệp & quà tặng', honeymoon: 'Tuần trăng mật' };
const JSX_A = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ChatActionsCtx, VMatchChatCard } from '/src/screens/chat/VendorChatCards.jsx';
const cat = new URLSearchParams(location.search).get('cat') || 'photography';
function App() {
  const [cards, setCards] = React.useState([{ k: 0, C: VMatchChatCard, p: { catId: cat } }]);
  const push = (C, p) => setCards(c => [...c, { k: c.length, C, p }]);
  return <VendorProvider coupleId="t066"><ChatActionsCtx.Provider value={{ pushUser: () => {}, pushAI: push }}>
    <div id="cards" style={{ width: 390 }}>{cards.map(c => <div key={c.k} data-card={c.k}><c.C {...c.p} /></div>)}</div>
  </ChatActionsCtx.Provider></VendorProvider>;
}
createRoot(document.getElementById('root')).render(<App />);
`;
const JSX_B = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ConnectProvider } from '/src/screens/ConnectCtx.jsx';
import { ScreenVendorShortlist } from '/src/screens/Vendors.jsx';
import { ScreenBudget } from '/src/screens/Budget.jsx';
const v = new URLSearchParams(location.search).get('v');
createRoot(document.getElementById('root')).render(
  <VendorProvider coupleId="t066"><ConnectProvider coupleId="t066" role="couple">
    <div style={{ width: 390, height: 800 }}>{v === 'budget'
      ? <ScreenBudget coupleId="t066" openCatId="photography" />
      : <ScreenVendorShortlist onMenuOpen={() => {}} onOpenVendorChat={() => {}} />}</div>
  </ConnectProvider></VendorProvider>);
`;
const JSX_C = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<div id="stage" />);
`;
const HTML = (f) => `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/${f}"></script></body></html>`;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

/* ── Hàm chạy trong trang: đo mọi ô minh hoạ trong một vùng ── */
const PAGE_LIB = `
window.__L = (() => {
  const LAB = 'Ảnh minh hoạ';
  const lum = (r, g, b) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const parse = s => { const m = String(s).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const cr = (a, b) => { const x = lum(a.r, a.g, a.b), y = lum(b.r, b.g, b.b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (c, bg) => ({ r: c.r * c.a + bg * (1 - c.a), g: c.g * c.a + bg * (1 - c.a), b: c.b * c.a + bg * (1 - c.a) });
  const rect = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const inter = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
  const tiles = (root) => [...root.querySelectorAll('[role="img"]')].filter(e => (e.getAttribute('aria-label') || '').startsWith(LAB));
  const paperRgb = () => { const d = document.createElement('div'); d.style.color = 'var(--paper)'; document.body.appendChild(d); const c = parse(getComputedStyle(d).color); d.remove(); return c || { r: 255, g: 255, b: 255, a: 1 }; };
  /* Cặp nét/nền đặt cạnh nhau của một svg: nền = màu tô của hình có bbox lớn nhất (huy hiệu/khung; không có thì nền giấy --paper), nét = màu (tô hoặc nét) xuất hiện ở nhiều phần tử nhất trong các màu còn lại. */
  const inkPair = (svg) => {
    const shapes = [...svg.querySelectorAll('*')].filter(e => !/^(defs|title|desc|style|clippath|mask|lineargradient|radialgradient|stop|g)$/i.test(e.tagName));
    let bg = null, bgA = -1; const rows = [];
    for (const e of shapes) { const cs = getComputedStyle(e); let A = 0; try { const bb = e.getBBox(); A = bb.width * bb.height; } catch (x) {}
      const f = parse(cs.fill), st = parse(cs.stroke), sw = parseFloat(cs.strokeWidth) || 0;
      const fv = f && f.a > 0.05 ? cs.fill : null, sv = st && st.a > 0.05 && sw > 0 ? cs.stroke : null; rows.push({ fv, sv });
      if (fv && A > bgA) { bgA = A; bg = fv; } }
    const bgC = bg ? parse(bg) : paperRgb(); const cnt = {};
    for (const r of rows) for (const v of [r.fv, r.sv]) if (v && v !== bg) cnt[v] = (cnt[v] || 0) + 1;
    const best = Object.entries(cnt).sort((x, y) => y[1] - x[1])[0];
    if (!best) return { bg: bg || 'paper', ink: null, c: 0, all: Object.keys(cnt) };
    return { bg: bg || 'paper', ink: best[0], c: cr(over(parse(best[0]), 255), over(bgC, 255)), all: [bg, ...Object.keys(cnt)] };
  };
  const invert = () => { const props = new Set(); for (const ss of document.styleSheets) { let rules; try { rules = ss.cssRules; } catch (e) { continue; } for (const r of rules) if (r.selectorText === ':root') for (const p of r.style) if (p.startsWith('--') && /^#[0-9a-f]{6}$/i.test(r.style.getPropertyValue(p).trim())) props.add(p); }
    const rs = getComputedStyle(document.documentElement); let css = ':root{'; for (const p of props) { const h = rs.getPropertyValue(p).trim(); if (!/^#[0-9a-f]{6}$/i.test(h)) continue; const n = [1, 3, 5].map(i => 255 - parseInt(h.slice(i, i + 2), 16)); css += p + ':rgb(' + n.join(',') + ');'; } css += '}'; const st = document.createElement('style'); st.id = '__inv'; st.textContent = css; document.head.appendChild(st); return props.size; };
  const uninvert = () => document.getElementById('__inv')?.remove();
  /* Mô tả một ô: rect, nhãn, title, svg, chip, đo tương phản */
  const visible = (e) => { const r = e.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return false; for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false; } return true; };
  const ownText = (e) => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
  /* Mô tả một ô: rect, nhãn, title, svg, chip (tìm trong CẢ tài liệu theo chữ nhìn thấy, không phụ thuộc cách dựng DOM), chồng lấn với mọi phần tử nhìn thấy */
  const describe = (tile) => {
    tile.scrollIntoView({ block: 'center' }); const R = rect(tile), svg = tile.querySelector('svg');
    const chip = [...document.body.querySelectorAll('*')].filter(e => ownText(e) === LAB && visible(e) && (() => { const c = rect(e); const cx = (c.l + c.r) / 2, cy = (c.t + c.b) / 2; return cx >= R.l && cx <= R.r && cy >= R.t && cy <= R.b; })())[0] || null;
    const d = { label: tile.getAttribute('aria-label'), title: tile.getAttribute('title'), w: R.w, h: R.h, hitSelf: (() => { const h = document.elementFromPoint((R.l + R.r) / 2, (R.t + R.b) / 2); return !!h && tile.contains(h); })(), hasSvg: !!svg, imgs: tile.querySelectorAll('img').length, bgUrl: /url\\(/.test(getComputedStyle(tile).backgroundImage) };
    if (svg) { const html = svg.outerHTML.replace(/xmlns(:\\w+)?="[^"]*"/g, '').replace(/url\\(#[^)]*\\)/g, '').replace(/\\s(id|class|href|xlink:href|data-[\\w-]+|aria-[\\w-]+)="[^"]*"/g, ''); d.svgLen = svg.outerHTML.length; d.svgHtml = svg.outerHTML; d.literalColor = /#[0-9a-fA-F]{3,8}\\b|rgba?\\(|hsla?\\(/.test(html); d.netRef = /https?:|<image|@import|url\\((?!#)/.test(html); d.pairLight = inkPair(svg); }
    if (chip) { const C = rect(chip), cs = getComputedStyle(chip); const bg = parse(cs.backgroundColor) || { r: 0, g: 0, b: 0, a: 0 }; const fg = parse(cs.color);
      const others = [...document.body.querySelectorAll('*')].filter(e => e !== chip && !chip.contains(e) && !e.contains(chip) && !tile.contains(e) && !e.contains(tile) && visible(e) && (ownText(e) || e.tagName === 'BUTTON')).map(rect);
      const inTile = [...tile.querySelectorAll('*')].filter(e => e !== chip && !chip.contains(e) && !e.contains(chip) && !(svg && (svg === e || svg.contains(e))) && visible(e) && (ownText(e) || e.tagName === 'BUTTON')).map(rect);
      d.chip = { inside: C.l >= R.l - 0.5 && C.r <= R.r + 0.5 && C.t >= R.t - 0.5 && C.b <= R.b + 0.5, lowerHalf: (C.t + C.b) / 2 > R.t + R.h / 2, fs: parseFloat(cs.fontSize), area: (C.w * C.h) / (R.w * R.h),
        overlaps: [...others, ...inTile].some(o => inter(C, o)), contrast: fg ? Math.min(cr(fg, over(bg, 255)), cr(fg, over(bg, 0))) : 0 }; }
    return d;
  };
  const darkPair = (tile) => { const svg = tile.querySelector('svg'); if (!svg) return null; invert(); const p = inkPair(svg); uninvert(); return p; };
  /* svg "lớn" nhìn thấy trong một vùng (ngoài nút): dùng để bắt minh hoạ vẽ lúc đang kiểm, có nhãn hay không */
  const bigSvgIn = (root) => [...root.querySelectorAll('svg')].filter(e => !e.closest('button') && visible(e) && (rect(e).w >= 28 || rect(e).h >= 28)).length;
  const scrollW = () => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, vw: window.innerWidth });
  const scanText = () => { const out = []; const re = /[ảẢ]nh\\s+minh\\s+ho[ạẠ]/i; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (re.test((n.textContent || '').normalize('NFC')) && n.parentElement && visible(n.parentElement)) out.push('text:' + n.textContent.trim().slice(0, 40)); }
    for (const e of document.body.querySelectorAll('*')) { if (!visible(e)) continue; for (const ps of ['::before', '::after']) { const c = getComputedStyle(e, ps).content; if (c && c !== 'none' && c !== 'normal' && re.test(c.normalize('NFC'))) out.push('css' + ps); } }
    return out; };
  return { scanText, LAB, tiles, describe, darkPair, bigSvgIn, scrollW, rect, visible };
})();
`;

let b, dev, port, O;
const scan = async (surf, pg) => { const r = await pg.evaluate(() => window.__L.scanText()); if (r.length) bad1(`${surf}: còn chữ "Ảnh minh hoạ" nhìn thấy (${r.slice(0, 2).join(' ; ')})`); };
const TMPF = ['__t114a.jsx', '__t114a.html', '__t114b.jsx', '__t114b.html', '__t114c.jsx', '__t114c.html'];
const cleanup = async () => {
  try { b && await b.close(); } catch (e) {}                       // chờ trình duyệt đóng hẳn (không để /tmp/.org.chromium.*)
  try { dev && await dev.stop(); } catch (e) {}
  for (const f of TMPF) { try { fs.unlinkSync(path.join(REPO, f)); } catch (e) {} }
  try { for (const f of fs.readdirSync(REPO)) if (/^vite\.config\.[a-z]+\.timestamp-/.test(f)) fs.unlinkSync(path.join(REPO, f)); } catch (e) {}
  try { img.closeAllConnections && img.closeAllConnections(); img.close(); } catch (e) {}
};

async function newPage(url, external, extraRoutes) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  pg.on('request', q => { const u = q.url(); const own = u.startsWith(`http://127.0.0.1:${port}`) || u.startsWith('http://localhost:8787') || u.startsWith(O) || u.startsWith('data:') || u.startsWith('blob:') || /fonts\.(googleapis|gstatic)/.test(u); if (!own) external.push(u); if (/\.svg(\?|$)/i.test(u.split('#')[0])) external.push('SVG-FILE ' + u); });
  pg.on('pageerror', e => (globalThis.__logs = globalThis.__logs || []).push('pageerror ' + String(e.message).slice(0, 160)));
  await pg.route(/marry\.vn/, r => r.abort());
  await extraRoutes(pg);
  await pg.goto(url, { waitUntil: 'domcontentloaded' });
  await pg.addScriptTag({ content: PAGE_LIB });
  return pg;
}
const apiRoutes = (vendors) => async (pg) => {
  await pg.route('http://localhost:8787/**', r => r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ status: 404, headers: CORS, contentType: 'application/json', body: '{}' }));
  await pg.route('http://localhost:8787/api/vendors/match*', r => r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ vendors, total: vendors.length, whyThoseVendors: '' }) }));
};

/* Tìm hàng/ô theo tên (phần tử gần nhất chỉ chứa đúng một trong các tên) và trả mô tả mọi ô minh hoạ + ảnh nền URL trong đó. */
const ROWFN = `(root, names, n) => {
  const count = el => names.filter(x => (el.innerText || '').includes(x)).length;
  const leaf = [...root.querySelectorAll('*')].filter(e => (e.innerText || '').includes(n) && count(e) === 1).sort((x, y) => x.innerText.length - y.innerText.length)[0];
  if (!leaf) return null; let el = leaf; while (el.parentElement && el.parentElement !== root && count(el.parentElement) === 1) el = el.parentElement; return el; }`;
async function rowInfo(pg, scope, names, n) {
  return pg.evaluate(([scope, names, n, ROWFN]) => {
    const root = document.querySelector(scope); if (!root) return { err: 'không thấy ' + scope };
    const row = eval(ROWFN)(root, names, n); if (!row) return { err: 'không thấy hàng ' + n };
    const L = window.__L, tiles = L.tiles(row).map(t => L.describe(t));
    const urlBg = [...row.querySelectorAll('*')].map(x => getComputedStyle(x).backgroundImage).filter(s => /url\(/.test(s) && !/\.svg/.test(s));
    const urlImg = [...row.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth > 0).length;
    return { tiles, bigSvg: L.bigSvgIn(row), urlBg, urlImg, hasLabelText: (row.innerText || '').includes(L.LAB), size: L.rect(row).w };
  }, [scope, names, n, ROWFN.toString().trim() === '' ? '' : ROWFN]);
}

(async () => {
  await new Promise(r => img.listen(0, '127.0.0.1', r));
  O = 'http://127.0.0.1:' + img.address().port;
  const ven = (id, name, cat, urls) => ({ id, name, category: cat, priceMin: 10, priceMax: 20, rating: 4.5, reviewCount: 3, city: 'HCMC', tags: ['modern'], photos: urls.map(url => ({ url })), match: { totalScore: 80, scoreBreakdown: {}, reasons: [] } });
  const NAMES = ['Tot Studio', 'Hong Studio', 'Khong Studio', 'Cham Studio', 'Treo Studio'];
  // Hong (ảnh hỏng) ở HẠNG 1 để ô có dải "PHÙ HỢP NHẤT"; Treo (ảnh không bao giờ trả lời) chỉ có ở photography
  const vendorsFor = (cat) => [ven('h_' + cat, NAMES[1], cat, [O + '/404-a.png']), ven('t_' + cat, NAMES[0], cat, [O + '/good1.png']), ven('k_' + cat, NAMES[2], cat, []), ven('c_' + cat, NAMES[3], cat, [O + '/slow-1.png']), ...(cat === 'photography' ? [ven('x_' + cat, NAMES[4], cat, [O + '/hang-1.png'])] : [])];
  fs.writeFileSync(path.join(REPO, '__t114a.jsx'), JSX_A); fs.writeFileSync(path.join(REPO, '__t114a.html'), HTML('__t114a.jsx'));
  fs.writeFileSync(path.join(REPO, '__t114c.jsx'), JSX_C); fs.writeFileSync(path.join(REPO, '__t114c.html'), HTML('__t114c.jsx'));
  fs.writeFileSync(path.join(REPO, '__t114b.jsx'), JSX_B); fs.writeFileSync(path.join(REPO, '__t114b.html'), HTML('__t114b.jsx'));
  dev = await startViteDev({ repo: REPO, files: {} }); port = dev.port;
  try {
    b = await chromium.launch();
    const external = [];
    const shot = async (pg, sel, name) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); try { await (sel ? pg.locator(sel).first() : pg).screenshot({ path: path.join(SHOTS, `${name}-390-${TAG}.png`) }); } catch (e) {} };
    const svgByCat = {}, svgKhong = {}, lightDark = {}; const wait = (t) => new Promise(r => setTimeout(r, Math.max(0, t)));

    /* Kiểm một ô minh hoạ ở một bề mặt: mọi tiêu chí đo trên ô đó. */
    const checkTile = (surf, cat, t, want) => {
      const exp = cat ? CATS[cat] : null;
      if (!t.label || !t.label.startsWith('Ảnh minh hoạ')) bad(2, `${surf}: tên truy cập phải bắt đầu bằng "Ảnh minh hoạ"`);
      if (exp && !(t.label || '').toLowerCase().includes(exp.toLowerCase())) bad(2, `${surf}: ô minh hoạ phải ghi đúng hạng mục "${exp}" trong tên truy cập, thấy "${t.label}"`);
      if (Math.abs(t.w - want.w) > 1.5 || (want.minH ? t.h < want.minH - 1.5 : Math.abs(t.h - want.h) > 1.5)) bad(2, `${surf}: ô minh hoạ phải đúng khung ảnh cũ ${want.w}x${want.minH ? '>=' + want.minH : want.h}, thấy ${Math.round(t.w)}x${Math.round(t.h)}`);
      if (!t.hasSvg) bad(2, `${surf}: ô minh hoạ phải chứa <svg> nằm trong trang`);
      if (t.imgs > 0 || t.bgUrl) bad(2, `${surf}: minh hoạ không được là <img> hay nền url()`);
      const small = Math.min(t.w, t.h) < 80;
      if (small) { if (t.title !== t.label) bad(2, `${surf}: ô nhỏ (<80px) giữ title = tên truy cập (INV-004), thấy ${JSON.stringify(t.title)}`); }
      else {
        if (t.chip) bad1(`${surf}: ô >= 80px còn chữ "Ảnh minh hoạ" nhìn thấy trên ảnh`);
        if (t.title) bad(2, `${surf}: ô >= 80px không được có title (không thêm tooltip mới), thấy ${JSON.stringify(t.title)}`);
        if (t.hitSelf) bad4(`${surf}: ô >= 80px phải để chuột/chạm xuyên qua (phần tử trúng chuột ở tâm ô không được nằm trong ô minh hoạ)`);
      }
      if (t.svgLen > 4096) bad(2, `${surf}: svg ${t.svgLen} byte > 4096`);
      if (t.literalColor) bad(2, `${surf}: svg có màu viết cứng (hex/rgb/hsl), chỉ được dùng token màu var(--…)`);
      if (t.netRef) bad(2, `${surf}: svg tham chiếu mạng/ảnh ngoài (http, <image>, url() ngoài)`);
    };

    /* ── Bề mặt 1-4 (chuỗi thẻ chat), theo hạng mục ── */
    const FULL = ['photography', 'transport'];
    for (const cat of Object.keys(CATS)) {
      const vs = vendorsFor(cat);
      const pg = await newPage(`http://127.0.0.1:${port}/__t114a.html?cat=${cat}`, external, apiRoutes(vs));
      try {
        await pg.waitForFunction(() => document.body.innerText.includes('Tot Studio'), null, { timeout: 15000 });
        const tVis = Date.now();
        await pg.waitForTimeout(250);
        const early = await rowInfo(pg, '[data-card="0"]', NAMES, 'Cham Studio');
        if (!early.err && (early.tiles.length || early.hasLabelText || early.bigSvg)) bad(3, `S1 ${cat}: lúc đang kiểm ảnh (ảnh chưa tải xong) vẫn phải giữ cách hiện cũ: không vẽ BẤT KỲ minh hoạ nào (svg lớn trong hàng: ${early.bigSvg}), có nhãn hay không`);
        await pg.waitForFunction(() => window.__L.tiles(document.querySelector('[data-card="0"]')).length >= 2, null, { timeout: 4500 }).catch(() => {});
        const hong = await rowInfo(pg, '[data-card="0"]', NAMES, 'Hong Studio'), khong = await rowInfo(pg, '[data-card="0"]', NAMES, 'Khong Studio'), tot = await rowInfo(pg, '[data-card="0"]', NAMES, 'Tot Studio'); await scan(`S1 ${cat}`, pg);
        for (const [nm, r] of [['Hong', hong], ['Khong', khong]]) {
          if (r.err) { miss(`S1 ${cat}: ${r.err}`); continue; }
          if (r.tiles.length !== 1) { miss(`S1 ${cat}: ${nm} Studio (ảnh ${nm === 'Hong' ? 'hỏng' : 'thiếu'}) phải có đúng 1 ô minh hoạ, thấy ${r.tiles.length}`); continue; }
          checkTile(`S1 ${cat} ${nm}`, cat, r.tiles[0], { w: 100, minH: 100 });
          if (nm === 'Hong') svgByCat[cat] = r.tiles[0].svgHtml;
          if (nm === 'Khong') svgKhong[cat] = r.tiles[0].svgHtml;
        }
        if (!tot.err && tot.tiles.length) bad(3, `S1 ${cat}: vendor có ảnh tốt không được hiện minh hoạ`);
        if (!tot.err && !(tot.urlBg.length || tot.urlImg)) bad(3, `S1 ${cat}: vendor có ảnh tốt phải hiện ảnh thật`);
        // sáng/tối: đảo toàn bộ token màu, ô vẫn phải có cặp nét/nền tương phản >= 3:1 và màu phải đổi theo token
        if (!lightDark[cat]) {
          const ld = await pg.evaluate(() => { const t = window.__L.tiles(document.querySelector('[data-card="0"]'))[0]; if (!t) return null; return { l: window.__L.describe(t).pairLight, d: window.__L.darkPair(t) }; });
          lightDark[cat] = ld;
          if (!ld || !ld.l || !ld.d) bad(2, `S1 ${cat}: không có ô để đo sáng/tối`);
          else {
            if (!ld.l.ink || ld.l.c < 3) bad(2, `S1 ${cat}: cặp nét/nền đặt cạnh nhau (nền = hình tô lớn nhất, nét = màu phổ biến nhất còn lại) tương phản ${ld.l.c.toFixed(1)}:1 < 3:1`);
            if (!ld.d.ink || ld.d.c < 3) bad(2, `S1 ${cat}: bảng token đảo sang tối, cặp nét/nền tương phản ${ld.d.c.toFixed(1)}:1 < 3:1`);
            if (ld.l.ink === ld.d.ink && ld.l.bg === ld.d.bg) bad(2, `S1 ${cat}: màu minh hoạ không đổi khi đổi token (không dùng token màu của app)`);
          }
        }
        if (cat === 'photography') { // ảnh treo: dưới 8s vẫn là "đang kiểm"
          await wait(tVis + 5500 - Date.now());
          const tr = await rowInfo(pg, '[data-card="0"]', NAMES, 'Treo Studio');
          if (tr.err) bad(3, 'S1: không thấy hàng Treo Studio (ảnh treo)'); else if (tr.tiles.length || tr.hasLabelText || tr.bigSvg) bad(3, 'S1 ảnh treo: trước 8 giây vẫn là "đang kiểm", không được vẽ minh hoạ/nhãn');
        }
        const sw = await pg.evaluate(() => window.__L.scrollW()); if (sw.doc > sw.vw || sw.body > sw.vw) bad(5, `S1 ${cat}: cuộn ngang (doc ${sw.doc}, body ${sw.body}, vw ${sw.vw})`);
        if (cat === 'photography') await shot(pg, '[data-card="0"]', 's1-danh-sach');
        await pg.waitForTimeout(FULL.includes(cat) ? 3600 : 0);
        const cham = FULL.includes(cat) ? await rowInfo(pg, '[data-card="0"]', NAMES, 'Cham Studio') : { err: 'skip' };
        if (!cham.err && (cham.tiles.length || !(cham.urlBg.length || cham.urlImg))) bad(3, `S1 ${cat}: ảnh tải chậm nhưng cuối cùng tốt phải hiện ảnh thật, không minh hoạ/nhãn`);
        if (!FULL.includes(cat)) { await pg.context().close(); continue; }

        /* S2 chi tiết */
        await pg.locator('[data-card="0"]').getByText('Hong Studio', { exact: false }).first().click({ timeout: 5000 });
        await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(600);
        const s2 = await pg.evaluate(() => { const r = document.querySelector('[data-card="1"]'); const t = window.__L.tiles(r); const R = r.getBoundingClientRect(); return { n: t.length, d: t.map(x => window.__L.describe(x)), cardW: R.width }; });
        if (s2.n !== 1) miss( `S2 ${cat}: gallery chi tiết của vendor ảnh hỏng phải có đúng 1 ô minh hoạ, thấy ${s2.n}`);
        else { const w = s2.d[0].w; if (Math.abs(s2.d[0].h - 150) > 1.5 || w < s2.cardW - 4) bad(2, `S2 ${cat}: ô minh hoạ phải phủ hết khung gallery (rộng bằng thẻ, cao 150), thấy ${Math.round(w)}x${Math.round(s2.d[0].h)}`); checkTile(`S2 ${cat}`, cat, s2.d[0], { w, h: 150 }); }
        if (cat === 'photography') await shot(pg, '[data-card="1"]', 's2-chi-tiet'); await scan(`S2 ${cat}`, pg);
        const sw2 = await pg.evaluate(() => window.__L.scrollW()); if (sw2.doc > sw2.vw || sw2.body > sw2.vw) bad(5, `S2 ${cat}: cuộn ngang (doc ${sw2.doc})`);

        /* S3 chọn so sánh (anchor = Hong) */
        await pg.locator('[data-card="1"]').getByText('So sánh', { exact: true }).first().click({ timeout: 5000 });
        await pg.waitForSelector('[data-card="2"]', { timeout: 5000 });
        await pg.waitForFunction(() => document.querySelector('[data-card="2"]').innerText.includes('Khong Studio'), null, { timeout: 8000 });
        await pg.waitForTimeout(2500);
        const anchor = await pg.evaluate(() => { const r = document.querySelector('[data-card="2"]'); return window.__L.tiles(r).map(x => window.__L.describe(x)); });
        const s3Khong = await rowInfo(pg, '[data-card="2"]', NAMES, 'Khong Studio'), s3Tot = await rowInfo(pg, '[data-card="2"]', NAMES, 'Tot Studio');
        const s3Hong = await rowInfo(pg, '[data-card="2"]', NAMES, 'Hong Studio');
        // anchor là hàng đầu: tính theo toàn thẻ trừ các hàng; ô của anchor = ô minh hoạ mà không nằm trong hàng nào
        const rowTiles = (s3Khong.tiles?.length || 0) + (s3Tot.tiles?.length || 0) + (s3Hong.err ? 0 : 0);
        if (anchor.length < 2) miss( `S3 ${cat}: thẻ chọn so sánh phải có minh hoạ cho anchor (ảnh hỏng) và hàng Khong Studio (ảnh thiếu), thấy ${anchor.length} ô`);
        else for (const t of anchor) checkTile(`S3 ${cat}`, cat, t, { w: 40, h: 40 });
        if (s3Tot.tiles?.length) bad(3, `S3 ${cat}: hàng có ảnh tốt không được hiện minh hoạ`);
        if (!s3Tot.err && !(s3Tot.urlBg.length || s3Tot.urlImg)) bad(3, `S3 ${cat}: hàng có ảnh tốt phải hiện ảnh thật`);
        if (cat === 'photography') await shot(pg, '[data-card="2"]', 's3-chon-so-sanh'); await scan(`S3 ${cat}`, pg);
        await pg.locator('[data-card="2"]').getByText('Khong Studio', { exact: false }).first().click({ timeout: 5000 });
        await pg.locator('[data-card="2"]').getByText('Tot Studio', { exact: false }).first().click({ timeout: 5000 });
        await pg.locator('[data-card="2"]').getByText(/So sánh \d+ vendor/).first().click({ timeout: 5000 });
        await pg.waitForSelector('[data-card="3"]', { timeout: 5000 }); await pg.waitForTimeout(2500);
        /* S4 bảng so sánh: cột theo tên đầu tiên của vendor */
        const cols = await pg.evaluate(() => {
          const card = document.querySelector('[data-card="3"]'); const out = {}; const L = window.__L;
          const boxes = [...card.querySelectorAll('*')].filter(e => { const R = e.getBoundingClientRect(); return Math.abs(R.height - 30) < 1.5 && Math.abs(R.width - 74) < 2.5; });
          for (const w of ['Hong', 'Khong', 'Tot']) {
            const leaf = [...card.querySelectorAll('*')].find(e => e.children.length === 0 && (e.textContent || '').trim() === w); if (!leaf) { out[w] = null; continue; }
            const LR = leaf.getBoundingClientRect(), cx = LR.left + LR.width / 2;
            const cand = boxes.filter(e => e.getBoundingClientRect().bottom <= LR.top + 1).sort((x, y) => Math.abs(x.getBoundingClientRect().left + 37 - cx) - Math.abs(y.getBoundingClientRect().left + 37 - cx))[0];
            if (!cand) { out[w] = null; continue; }
            const isI = (cand.getAttribute('role') === 'img' && (cand.getAttribute('aria-label') || '').startsWith(L.LAB));
            out[w] = { tiles: isI ? [L.describe(cand)] : L.tiles(cand).map(x => L.describe(x)), urlBg: [cand, ...cand.querySelectorAll('*')].map(x => getComputedStyle(x).backgroundImage).filter(s => /url\(/.test(s) && !/\.svg/.test(s)) };
          } return out; });
        for (const w of ['Hong', 'Khong']) { const c = cols[w]; if (!c) { miss(`S4 ${cat}: không thấy cột ${w} trong bảng so sánh`); continue; } if (c.tiles.length !== 1) { miss( `S4 ${cat}: cột ${w} (ảnh hỏng/thiếu) phải có đúng 1 ô minh hoạ, thấy ${c.tiles.length}`); continue; } checkTile(`S4 ${cat} ${w}`, cat, c.tiles[0], { w: 74, h: 30 }); }
        if (cols.Tot && cols.Tot.tiles.length) bad(3, `S4 ${cat}: cột có ảnh tốt không được hiện minh hoạ`); await scan(`S4 ${cat}`, pg);
         if (cols.Tot && !cols.Tot.urlBg.length) bad(3, `S4 ${cat}: cột có ảnh tốt phải hiện ảnh thật`);
        if (cat === 'photography') await shot(pg, '[data-card="3"]', 's4-bang-so-sanh');
        const sw4 = await pg.evaluate(() => window.__L.scrollW()); if (sw4.doc > sw4.vw || sw4.body > sw4.vw) bad(5, `S4 ${cat}: cuộn ngang (doc ${sw4.doc})`);
        if (cat === 'photography') { // ảnh treo quá 8 giây = hỏng -> minh hoạ có nhãn
          await wait(tVis + 10500 - Date.now());
          const tr = await rowInfo(pg, '[data-card="0"]', NAMES, 'Treo Studio');
          if (tr.err || tr.tiles.length !== 1) miss('S1 ảnh treo: sau 8 giây (đo ở giây 10,5) phải hiện đúng 1 ô minh hoạ có nhãn, thấy ' + (tr.err || tr.tiles.length));
          else checkTile('S1 ảnh treo', cat, tr.tiles[0], { w: 100, minH: 100 });
        }
      } catch (e) { for (const n of [1, 2, 3, 4, 5]) bad(n, `chuỗi thẻ chat (${cat}) lỗi chạy: ${String(e.message).split('\n')[0]} ${(globalThis.__logs || []).slice(0, 2).join(' ; ')}`); }
      await pg.context().close();
    }
    /* ── Tiêu chí 3: mỗi hạng mục một hình khác nhau, đo bằng ĐIỂM ẢNH ─────────────────────────
       Mỗi minh hoạ được render riêng, cùng kích thước 96x96 trên nền giấy (--paper), chụp ảnh, ngưỡng hoá: điểm "mực" = điểm ảnh
       cách xa mọi màu nền (hai màu chiếm nhiều nhất, thường là giấy và huy hiệu) hơn 48 đơn vị RGB. Khoảng cách giữa hai hình =
       1 - |mực chung| / |mực của một trong hai|. Hai hạng mục khác nhau phải cách nhau >= 0.35 (hai hình vẽ khác nhau hiếm khi
       chung quá 65% nét; cùng một hình chỉ đổi class, data, id hay màu nét thì cách ~0). Vendor ảnh hỏng và ảnh thiếu của cùng hạng mục cách <= 0.10. */
    const DIST_MIN = 0.35, INK_MIN = 0.015;
    const pxPg = await newPage(`http://127.0.0.1:${port}/__t114c.html`, external, async () => {});
    const renderMasks = async (items) => {
      await pxPg.evaluate((items) => { const st = document.getElementById('stage'); const sty = document.createElement('style'); sty.textContent = '#stage svg{width:100%;height:100%;display:block}'; document.head.appendChild(sty);
        st.innerHTML = items.map((svg, i) => `<div id="p${i}" style="width:96px;height:96px;background:var(--paper);margin:8px;display:inline-block;position:relative">${svg}</div>`).join(''); }, items);
      const pngs = []; for (let i = 0; i < items.length; i++) pngs.push((await pxPg.locator('#p' + i).screenshot()).toString('base64'));
      return pxPg.evaluate(async (pngs) => { const out = [];
        for (const b64 of pngs) { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()); const c = new OffscreenCanvas(bm.width, bm.height), x = c.getContext('2d'); x.drawImage(bm, 0, 0); const d = x.getImageData(0, 0, bm.width, bm.height).data, N = bm.width * bm.height;
          const h = new Map(); for (let i = 0; i < N; i++) { const k = ((d[4 * i] >> 4) << 8) | ((d[4 * i + 1] >> 4) << 4) | (d[4 * i + 2] >> 4); const e = h.get(k); if (e) e.n++; else h.set(k, { n: 1, i }); }
          const top = [...h.values()].sort((a, b) => b.n - a.n), gr = [top[0]]; if (top[1] && top[1].n >= 0.08 * N) gr.push(top[1]);
          const gc = gr.map(g => [d[4 * g.i], d[4 * g.i + 1], d[4 * g.i + 2]]); let m = '';
          for (let i = 0; i < N; i++) { let far = true; for (const g of gc) if (Math.hypot(d[4 * i] - g[0], d[4 * i + 1] - g[1], d[4 * i + 2] - g[2]) <= 48) far = false; m += far ? '1' : '0'; }
          out.push(m); }
        return out; }, pngs);
    };
    const dist = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { const x = a[k] === '1', y = b[k] === '1'; if (x && y) i++; if (x || y) u++; } return u ? 1 - i / u : 0; };
    const inkOf = (m) => m.split('1').length - 1;
    // tự kiểm thước đo (luôn chạy, kể cả khi app chưa có minh hoạ): hình chung chỉ khác class, data, id hay màu nét phải bị bắt; hai hình khác nhau phải qua
    const bg0 = '<circle cx="50" cy="50" r="42" style="fill:var(--paper)"/>';
    const SA = `<svg viewBox="0 0 100 100">${bg0}<rect x="24" y="34" width="52" height="32" style="fill:none;stroke:var(--ink-700);stroke-width:5"/><circle cx="50" cy="50" r="9" style="fill:var(--ink-700)"/></svg>`;
    const SA2 = `<svg viewBox="0 0 100 100" class="cat-b" data-cat="b" id="zz">${bg0}<rect x="24" y="34" width="52" height="32" style="fill:none;stroke:var(--son-600);stroke-width:5"/><circle cx="50" cy="50" r="9" style="fill:var(--son-600)"/></svg>`;
    const SB = `<svg viewBox="0 0 100 100">${bg0}<circle cx="50" cy="58" r="18" style="fill:none;stroke:var(--ink-700);stroke-width:6"/><path d="M38 30 L50 16 L62 30" style="fill:none;stroke:var(--ink-700);stroke-width:5"/></svg>`;
    const st = await renderMasks([SA, SA2, SB]);
    if (dist(st[0], st[1]) >= DIST_MIN) bad(2, `eval hỏng: hình chung chỉ khác class, data, id hay màu nét phải bị bắt (cách ${dist(st[0], st[1]).toFixed(2)} >= ${DIST_MIN})`);
    if (dist(st[0], st[2]) < DIST_MIN) bad(2, `eval hỏng: hai hình khác nhau phải qua (cách ${dist(st[0], st[2]).toFixed(2)} < ${DIST_MIN})`);
    const ids = Object.keys(svgByCat);
    if (ids.length < 10) bad(2, `chỉ lấy được minh hoạ của ${ids.length}/10 hạng mục: ${Object.keys(CATS).filter(c => !svgByCat[c]).join(', ')}`);
    if (ids.length >= 2) {
      const ms = await renderMasks(ids.map(c => svgByCat[c]));
      ids.forEach((c, i) => { if (inkOf(ms[i]) < INK_MIN * ms[i].length) bad(2, `hạng mục ${c}: minh hoạ gần như trống khi render 96px trên nền giấy`); });
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const dd = dist(ms[i], ms[j]); if (dd < DIST_MIN) bad(2, `hạng mục ${ids[i]} và ${ids[j]} trông giống nhau (render 96px, khác ${(dd * 100).toFixed(0)}% < ${DIST_MIN * 100}% điểm mực): mỗi hạng mục phải có hình vẽ riêng`); }
      const both = ids.filter(c => svgKhong[c]);
      if (both.length) { const mk = await renderMasks(both.map(c => svgKhong[c])); const mh = await renderMasks(both.map(c => svgByCat[c])); both.forEach((c, i) => { if (dist(mk[i], mh[i]) > 0.10) bad(2, `hạng mục ${c}: vendor ảnh hỏng và vendor không ảnh phải ra cùng một minh hoạ`); }); }
      if (SHOTS && TAG === 'sau') { // contact sheet: 10 minh hoạ kèm tên hạng mục (người duyệt nhìn, đưa vào PR)
        await pxPg.evaluate((items) => { document.getElementById('stage').innerHTML = '<div id="sheet" style="display:grid;grid-template-columns:repeat(5,120px);gap:12px;padding:16px;background:var(--paper);width:min-content;font-family:var(--font-ui)">' + items.map(([n, svg]) => `<figure style="margin:0;text-align:center"><div style="width:96px;height:96px;margin:0 auto;background:var(--paper);outline:1px solid var(--line-200)">${svg}</div><figcaption style="font-size:12px;color:var(--ink-700);margin-top:4px">${n}</figcaption></figure>`).join('') + '</div>'; }, Object.keys(CATS).filter(c => svgByCat[c]).map(c => [CATS[c], svgByCat[c]]));
        fs.mkdirSync(SHOTS, { recursive: true }); await pxPg.locator('#sheet').screenshot({ path: path.join(SHOTS, 'contact-sheet.png') });
      }
    }
    await pxPg.context().close();

    /* ── Bề mặt 5 và 6: Vendor đã lưu / Ngân sách ── */
    const MARRY = 'https://www.marry.vn/images/detailed/1/';
    const css = u => `center/cover no-repeat url("${u}")`;
    const mk = (id, name, stored) => ({ id, name, priceTotal: 10, priceUnit: 'gói', grad: css(stored), gallery: [css(stored)], spec: 'x', rating: 4, rv: 1, match: 80, location: 'HCMC' });
    const SN = ['Luu Pool Tot', 'Luu Pool Hong', 'Luu Pool Rong', 'Luu Cham', 'Luu Nhan Hong'];
    const S = [mk('v_s1', SN[0], MARRY + 's1.jpg'), mk('v_s2', SN[1], MARRY + 's2.jpg'), mk('v_s3', SN[2], MARRY + 's3.jpg'), mk('v_s4', SN[3], MARRY + 's4.jpg')];
    const SJ = [mk('v_j1', SN[4], MARRY + 'j1.jpg')];
    const pool = { v_s1: [O + '/good1.png'], v_s2: [O + '/404-p2.png'], v_s3: [], v_s4: [O + '/good4.png'], v_j1: [O + '/404-j1.png'] };
    const catOf = id => (id === 'v_j1' ? 'jewelry' : 'photography');
    const seedList = JSON.stringify({ photography: { shortlisted: S, confirmed: null }, jewelry: { shortlisted: SJ, confirmed: null } });
    const seedBudget = JSON.stringify({ photography: { shortlisted: S, confirmed: S[2] } });
    const openB = async (v, seed) => {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.addInitScript(([s]) => { if (!localStorage.getItem('th_vendors_t066')) localStorage.setItem('th_vendors_t066', s); }, [seed]);
      const pg = await ctx.newPage(); const stored = [];
      pg.on('request', q => { const u = q.url(); if (/marry\.vn/.test(u)) stored.push(u); const own = u.startsWith(`http://127.0.0.1:${port}`) || u.startsWith('http://localhost:8787') || u.startsWith(O) || u.startsWith('data:') || u.startsWith('blob:') || /fonts\.(googleapis|gstatic)/.test(u) || /marry\.vn/.test(u); if (!own) external.push(u); if (/\.svg(\?|$)/i.test(u.split('#')[0])) external.push('SVG-FILE ' + u); });
      pg.on('pageerror', e => (globalThis.__logs = globalThis.__logs || []).push('pageerror ' + String(e.message).slice(0, 160)));
      await pg.route(/marry\.vn/, r => r.abort());
      await pg.route('http://localhost:8787/**', async r => {
        const m = r.request().method(), u = new URL(r.request().url());
        if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
        const mm = u.pathname.match(/^\/api\/vendors\/([^/]+)$/);
        if (mm && m === 'GET' && !['match', 'categories', 'status'].includes(mm[1])) {
          const id = mm[1];
          if (id === 'v_s4') await new Promise(res => setTimeout(res, 3500));
          if (pool[id]) return r.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ vendor: { id, name: id, category: catOf(id), photos: pool[id].map(url => ({ url })) }, match: null }) });
          return r.fulfill({ status: 404, headers: CORS, contentType: 'application/json', body: '{"error":"vendor not found"}' });
        }
        if (u.pathname === '/api/couples/t066/budget') return r.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ total_tr: 100, guests: 100, categories: [{ id: 'photography', name: 'Chụp ảnh', allocated_tr: 20, pct: 20, items: [] }] }) });
        if (m === 'POST' && u.pathname === '/api/vendors/status') return r.fulfill({ headers: CORS, contentType: 'application/json', body: '{"vendors":{}}' });
        return r.fulfill({ status: 404, headers: CORS, contentType: 'application/json', body: '{}' });
      });
      await pg.goto(`http://127.0.0.1:${port}/__t114b.html?v=${v}`, { waitUntil: 'domcontentloaded' });
      await pg.addScriptTag({ content: PAGE_LIB });
      return { pg, ctx, stored };
    };
    // S5
    try {
      const { pg, ctx, stored } = await openB('list', seedList);
      await pg.waitForFunction(() => document.body.innerText.includes('Luu Pool Tot'), null, { timeout: 15000 });
      await pg.waitForTimeout(300);
      const early = await rowInfo(pg, 'body', SN, 'Luu Cham');
      if (!early.err && (early.tiles.length || early.hasLabelText || early.bigSvg)) bad(3, 'S5: lúc đang tra ảnh trong pool (chưa xác định) vẫn phải giữ cách hiện cũ, không hiện minh hoạ/nhãn');
      if (stored.length) bad(3, 'S5: có request tới URL ảnh đã lưu (marry.vn) lúc đang tra pool: ' + stored[0]);
      await pg.waitForTimeout(3000);
      const rows = {}; for (const n of SN) rows[n] = await rowInfo(pg, 'body', SN, n);
      const want = { 'Luu Pool Hong': 'photography', 'Luu Pool Rong': 'photography', 'Luu Nhan Hong': 'jewelry' };
      for (const [n, cat] of Object.entries(want)) { const r = rows[n]; if (r.err) { miss(`S5: ${r.err}`); continue; } if (r.tiles.length !== 1) { miss( `S5: ${n} (ảnh hỏng/hết ảnh) phải có đúng 1 ô minh hoạ, thấy ${r.tiles.length}`); continue; } checkTile(`S5 ${n}`, cat, r.tiles[0], { w: 32, h: 32 }); }
      for (const n of ['Luu Pool Tot']) { const r = rows[n]; if (!r.err && r.tiles.length) bad(3, `S5: ${n} có ảnh tốt không được hiện minh hoạ`); if (!r.err && !(r.urlBg.length || r.urlImg)) bad(3, `S5: ${n} có ảnh tốt phải hiện ảnh thật`); }
      await pg.waitForTimeout(2500);
      const cham = await rowInfo(pg, 'body', SN, 'Luu Cham'); if (!cham.err && (cham.tiles.length || !(cham.urlBg.length || cham.urlImg))) bad(3, 'S5: tra xong ảnh tốt phải hiện ảnh thật, không minh hoạ/nhãn');
      const sw = await pg.evaluate(() => window.__L.scrollW()); if (sw.doc > sw.vw || sw.body > sw.vw) bad(5, `S5: cuộn ngang (doc ${sw.doc})`);
      await shot(pg, null, 's5-vendor-da-luu'); await scan('S5', pg);
      await ctx.close();
    } catch (e) { for (const n of [1, 2, 3, 4, 5]) bad(n, 'S5 (Vendor đã lưu) lỗi chạy: ' + String(e.message).split('\n')[0]); }
    // S6
    for (const [n, kind] of [['Luu Pool Hong', 'minh hoạ'], ['Luu Pool Rong', 'minh hoạ'], ['Luu Pool Tot', 'ảnh'], ['Luu Cham', 'chậm']]) {
      try {
        const { pg, ctx, stored } = await openB('budget', seedBudget);
        await pg.waitForFunction((x) => document.body.innerText.includes(x), n, { timeout: 15000 });
        await pg.waitForTimeout(1200);
        await pg.locator('button', { hasText: n }).first().click({ timeout: 5000 });
        await pg.waitForTimeout(kind === 'chậm' ? 400 : 2800);
        const measure = () => pg.evaluate((n) => {
          const L = window.__L; const tiles = [...document.querySelectorAll('div')].filter(d => { const R = d.getBoundingClientRect(); return Math.abs(R.width - 56) < 1.5 && Math.abs(R.height - 56) < 1.5 && d.parentElement && (d.parentElement.innerText || '').includes(n); });
          if (!tiles.length) return null; const t = tiles[0];
          return { ill: L.tiles(t.parentElement).map(x => L.describe(x)), box: L.rect(t).w, urlBg: [t, ...t.querySelectorAll('*')].map(x => getComputedStyle(x).backgroundImage).filter(s => /url\(/.test(s) && !/\.svg/.test(s)), sc: L.scrollW(), big: L.bigSvgIn(t.parentElement) };
        }, n);
        let r = await measure();
        if (kind === 'chậm') { // đang tra pool: giữ cách hiện cũ (không vẽ minh hoạ nào), rồi ảnh tốt hiện ra
          if (r && (r.ill.length || r.big)) bad(3, 'S6: lúc đang tra pool vẫn phải giữ cách hiện cũ (nền sage/sand + biểu tượng cửa hàng), không vẽ minh hoạ nào');
          await pg.waitForTimeout(4200); r = await measure();
          if (r && (r.ill.length || !r.urlBg.length)) bad(3, 'S6: tra xong ảnh tốt phải hiện ảnh thật, không minh hoạ/nhãn');
        } else
        if (!r) { miss(`S6 ${n}: không thấy tiêu đề Chi tiết vendor 56px`); }
        if (!r || kind === 'chậm') {}
        else if (kind === 'minh hoạ') {
          if (r.ill.length !== 1) miss( `S6 ${n}: tiêu đề Chi tiết vendor phải có đúng 1 ô minh hoạ, thấy ${r.ill.length}`);
          else checkTile(`S6 ${n}`, 'photography', r.ill[0], { w: 56, h: 56 });
          if (r.urlBg.some(s => /marry|404-/.test(s))) bad(2, `S6 ${n}: còn hiện ảnh hỏng`);
        } else {
          if (r.ill.length) bad(3, `S6 ${n}: vendor có ảnh tốt không được hiện minh hoạ`);
          if (!r.urlBg.length) bad(3, `S6 ${n}: vendor có ảnh tốt phải hiện ảnh thật`);
        }
        if (r && (r.sc.doc > r.sc.vw || r.sc.body > r.sc.vw)) bad(5, `S6 ${n}: cuộn ngang (doc ${r.sc.doc})`);
        if (n === 'Luu Pool Hong') await shot(pg, null, 's6-ngan-sach-chi-tiet'); await scan(`S6 ${n}`, pg);
        await ctx.close();
      } catch (e) { for (const k of [1, 2, 3, 4, 5]) bad(k, `S6 ${n} lỗi chạy: ` + String(e.message).split('\n')[0]); }
    }
    // mạng ngoài (tiêu chí 3)
    if (external.length) bad(2, 'front gọi ra ngoài hoặc tải file svg: ' + [...new Set(external)].slice(0, 3).join(', '));
  } catch (e) { for (const n of [1, 2, 3, 4, 5]) bad(n, 'lỗi chạy eval: ' + String(e.message).split('\n')[0] + ' | ' + (globalThis.__logs || []).slice(0, 4).join(' ; ')); }
  await cleanup();
  const T = { 1: 'không còn chữ "Ảnh minh hoạ" nhìn thấy ở 6 bề mặt', 2: 'tên truy cập, khung ảnh, title ô nhỏ vẫn đúng', 3: 'ô có ảnh thật / đang kiểm không đổi', 4: 'ô lớn không chặn chuột', 5: 'khung 390 không cuộn ngang' };
  let rc = 0;
  for (const n of ONLY) { if (F[n].length) { rc = 1; console.log(`C${n} FAIL ${F[n].slice(0, +(process.env.MAXF || 4)).join(' || ')}${F[n].length > 4 ? ` (+${F[n].length - 4} lỗi nữa)` : ''}`); } else console.log(`C${n} PASS ${T[n]}`); }
  console.log(rc ? 'FAIL có tiêu chí đỏ' : 'PASS');
  setTimeout(() => process.exit(rc), 200);
})();
