#!/usr/bin/env node
// T-051 tiêu chí 9: ở front, ảnh vendor lỗi (404, trả HTML) không bao giờ hiện khung vỡ/khoảng trống: hiện ảnh mặc định (gradient theo danh mục, sẵn có), và không gửi yêu cầu nào tới www.marry.vn khi pool đã chuyển sang Pages.
// Chạy: NODE_PATH=$(npm root -g) node eval/T-051/check_9_front_anh_mac_dinh.cjs <thư-mục-tohong-front>
// Dựng một trang thử tạm (__t051.html/.jsx) trong thư mục front, mount VMatchChatCard + VDetailChatCard thật, chặn /api/*, phục vụ ảnh bằng server giả; xoá trang thử khi xong.
// In PASS hoặc FAIL <lý do>; mã thoát 0/1.
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process');
const { chromium } = require('playwright');
const REPO = path.resolve(process.argv[2] || '');
const fail = m => { console.log('FAIL ' + m); process.exitCode = 1; };
if (!fs.existsSync(path.join(REPO, 'package.json'))) { fail('cần đường dẫn tohong-front'); process.exit(1); }
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const hits = [];
const img = http.createServer((q, r) => {
  hits.push(q.url);
  if (q.url.startsWith('/good')) { r.writeHead(200, { 'Content-Type': 'image/png' }); r.end(PNG); }
  else if (q.url.startsWith('/html')) { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end('<html>denied</html>'); }
  else { r.writeHead(404); r.end('no'); }
});
const HARNESS_JSX = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ChatActionsCtx, VMatchChatCard, VDetailChatCard } from '/src/screens/chat/VendorChatCards.jsx';
function App() {
  const [cards, setCards] = React.useState([{ k: 0, C: VMatchChatCard, p: { catId: 'photography' } }]);
  const push = (C, p) => setCards(c => [...c, { k: c.length, C, p }]);
  return <VendorProvider coupleId="t051"><ChatActionsCtx.Provider value={{ pushUser: () => {}, pushAI: push }}>
    <div id="cards" style={{ width: 390 }}>{cards.map(c => <div key={c.k} data-card={c.k}><c.C {...c.p} /></div>)}</div>
  </ChatActionsCtx.Provider></VendorProvider>;
}
createRoot(document.getElementById('root')).render(<App />);
`;
const HARNESS_HTML = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__t051.jsx"></script></body></html>';
let b;
(async () => {
  await new Promise(r => img.listen(0, '127.0.0.1', r));
  const O = 'http://127.0.0.1:' + img.address().port;
  const PAGES = 'https://tohong-img.pages.dev';
  const ven = (id, name, urls) => ({ id, name, category: 'photography', priceMin: 10, priceMax: 20, rating: 4.5, reviewCount: 3, city: 'HCMC', tags: ['modern'], photos: urls.map(url => ({ url })), match: { totalScore: 80, scoreBreakdown: {}, reasons: [] } });
  const vendors = [
    ven('v_good', 'Vendor Tot', [O + '/good1.png']),
    ven('v_bad', 'Vendor Anh Hong', [O + '/404-a.png']),
    ven('v_html', 'Vendor HTML', [O + '/html-a.png']),
    ven('v_mixed', 'Vendor Lan Lon', [O + '/404-b.png', O + '/good2.png']),
    ven('v_none', 'Vendor Khong Anh', []),
  ];
  const jsx = path.join(REPO, '__t051.jsx'), html = path.join(REPO, '__t051.html');
  fs.writeFileSync(jsx, HARNESS_JSX); fs.writeFileSync(html, HARNESS_HTML);
  const port = 5100 + Math.floor(Math.random() * 500);
  const vite = cp.spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: REPO, stdio: 'ignore' });
  const cleanup = () => { try { b && b.close(); } catch (e) {} try { vite.kill(); } catch (e) {} try { fs.unlinkSync(jsx); fs.unlinkSync(html); } catch (e) {} img.close(); };
  try {
    for (let i = 0; i < 60; i++) { try { await new Promise((res, rej) => http.get(`http://127.0.0.1:${port}/__t051.html`, r => { r.resume(); r.statusCode === 200 ? res() : rej(); }).on('error', rej)); break; } catch (e) { await new Promise(r => setTimeout(r, 500)); if (i === 59) throw new Error('vite không lên'); } }
    b = await chromium.launch();
    const pg = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    const external = [];
    pg.on('request', q => { const u = q.url(); if (!u.startsWith(`http://127.0.0.1:${port}`) && !u.startsWith('http://localhost:8787') && !u.startsWith(O) && !u.startsWith('data:') && !/fonts\.(googleapis|gstatic)/.test(u)) external.push(u); });
    const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    await pg.route('http://localhost:8787/**', r => r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ status: 404, headers: CORS, contentType: 'application/json', body: '{}' }));
    await pg.route('http://localhost:8787/api/vendors/match*', r => r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ vendors, total: vendors.length, whyThoseVendors: '' }) }));
    const logs = []; globalThis.__logs = logs; pg.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 150)); }); pg.on('pageerror', e => logs.push('pageerror ' + String(e.message).slice(0, 200)));
    await pg.goto(`http://127.0.0.1:${port}/__t051.html`);
    try { await pg.waitForFunction(() => document.body.innerText.includes('Vendor Tot'), null, { timeout: 15000 }); } catch (e) { globalThis.__logs.push('BODY=' + (await pg.evaluate(() => document.body.innerText)).slice(0, 200).replace(/\n/g, ' / ')); throw e; }
    await pg.waitForTimeout(2500); // chờ ảnh tải xong/lỗi
    // thu mọi phần tử có background gắn với từng vendor trong thẻ danh sách: lấy phần tử nền nhỏ nằm cùng hàng với tên vendor
    const info = await pg.evaluate(() => {
      const out = {};
      const NAMES = ['Vendor Tot', 'Vendor Anh Hong', 'Vendor HTML', 'Vendor Lan Lon', 'Vendor Khong Anh'];
      const root = document.querySelector('[data-card="0"]');
      const count = el => NAMES.filter(n => (el.innerText || '').includes(n)).length;
      const byName = {};
      for (const n of NAMES) {
        const leaf = [...root.querySelectorAll('*')].filter(e => (e.innerText || '').includes(n) && count(e) === 1).sort((x, y) => x.innerText.length - y.innerText.length)[0];
        if (!leaf) continue;
        let el = leaf; while (el.parentElement && el.parentElement !== root && count(el.parentElement) === 1) el = el.parentElement;
        byName[n] = el;
      }
      for (const [name, row] of Object.entries(byName)) {
        const bgs = [...row.querySelectorAll('*')].map(x => getComputedStyle(x).backgroundImage).filter(s => s && s !== 'none');
        const imgs = [...row.querySelectorAll('img')].map(i => ({ src: i.currentSrc, ok: i.complete && i.naturalWidth > 0 }));
        out[name] = { bgs, imgs };
      }
      return out;
    });
    const showsUrl = (v, frag) => v.bgs.some(s => s.includes('url(') && s.includes(frag)) || v.imgs.some(i => i.src.includes(frag) && i.ok);
    const showsBroken = (v, frag) => v.bgs.some(s => s.includes(frag)) || v.imgs.some(i => i.src.includes(frag) && !i.ok);
    const names = ['Vendor Tot', 'Vendor Anh Hong', 'Vendor HTML', 'Vendor Lan Lon', 'Vendor Khong Anh'];
    for (const n of names) if (!info[n]) { fail('thẻ danh sách: không thấy hàng của ' + n); }
    if (!process.exitCode) {
      if (!showsUrl(info['Vendor Tot'], 'good1')) fail('Vendor Tot: ảnh tốt phải hiện');
      if (showsBroken(info['Vendor Anh Hong'], '404-a')) fail('Vendor Anh Hong: ảnh 404 không được còn hiện (khung vỡ/nền URL hỏng)');
      if (showsBroken(info['Vendor HTML'], 'html-a')) fail('Vendor HTML: ảnh trả HTML không được còn hiện');
      for (const n of ['Vendor Anh Hong', 'Vendor HTML', 'Vendor Khong Anh']) if (!info[n].bgs.some(s => s.includes('linear-gradient'))) fail(n + ': phải hiện ảnh mặc định (gradient danh mục)');
      if (showsBroken(info['Vendor Lan Lon'], '404-b')) fail('Vendor Lan Lon: ảnh hỏng không được hiện ở đầu');
      if (!showsUrl(info['Vendor Lan Lon'], 'good2')) fail('Vendor Lan Lon: ảnh tốt thứ hai phải được dùng thay ảnh hỏng');
    }
    // chi tiết vendor Lan Lon: gallery chỉ còn 1 ảnh tốt, không chấm chuyển ảnh thừa; vendor hỏng hết: gradient
    await pg.evaluate(() => { window.__noop = 1; });
    const sel = async (name) => {
      const btn = pg.locator('[data-card="0"]').getByText(name, { exact: false }).first();
      await btn.click({ timeout: 5000 });
    };
    try {
      await sel('Vendor Lan Lon'); await pg.waitForTimeout(500);
      const dots = await pg.evaluate(() => ([...document.querySelectorAll('[data-card="1"] button')].filter(b => getComputedStyle(b).height === '6px')).length);
      const det = await pg.evaluate(() => [...document.querySelectorAll('[data-card="1"] *')].map(x => getComputedStyle(x).backgroundImage).filter(s => s && s !== 'none'));
      await pg.waitForTimeout(2000);
      const det2 = await pg.evaluate(() => [...document.querySelectorAll('[data-card="1"] *')].map(x => getComputedStyle(x).backgroundImage).filter(s => s && s !== 'none'));
      if (det2.some(s => s.includes('404-b'))) fail('chi tiết: ảnh hỏng không được hiện trong gallery');
      if (!det2.some(s => s.includes('good2'))) fail('chi tiết: gallery phải hiện ảnh tốt');
      if (dots > 0) fail('chi tiết: gallery chỉ còn 1 ảnh tốt thì không được có chấm chuyển ảnh (thấy ' + dots + ')');
    } catch (e) { fail('không mở được chi tiết vendor để kiểm gallery: ' + String(e.message).split('\n')[0]); }
    // thẻ chọn so sánh (anchor + hàng) và bảng so sánh
    try {
      const bgsIn = async (k) => pg.evaluate((k) => [...document.querySelectorAll(`[data-card="${k}"] *`)].map(x => getComputedStyle(x).backgroundImage).filter(s => s && s !== 'none'), k);
      await pg.locator('[data-card="1"]').getByText('So sánh', { exact: true }).first().click({ timeout: 5000 });
      await pg.waitForSelector('[data-card="2"]', { timeout: 5000 });
      await pg.waitForFunction(() => document.querySelector('[data-card="2"]').innerText.includes('Vendor Anh Hong'), null, { timeout: 8000 });
      await pg.waitForTimeout(2500);
      const pk = await bgsIn(2);
      if (pk.some(s => /404-|html-a/.test(s))) fail('thẻ chọn so sánh: còn hiện ảnh hỏng (anchor hoặc hàng)');
      if (!pk.some(s => s.includes('good2'))) fail('thẻ chọn so sánh: anchor phải hiện ảnh tốt còn lại (good2)');
      if (!pk.some(s => s.includes('good1'))) fail('thẻ chọn so sánh: hàng Vendor Tot phải hiện ảnh tốt');
      await pg.locator('[data-card="2"]').getByText('Vendor Anh Hong', { exact: false }).first().click({ timeout: 5000 });
      await pg.locator('[data-card="2"]').getByText('Vendor Tot', { exact: false }).first().click({ timeout: 5000 });
      await pg.locator('[data-card="2"]').getByText(/So sánh \d+ vendor/).first().click({ timeout: 5000 });
      await pg.waitForSelector('[data-card="3"]', { timeout: 5000 });
      await pg.waitForTimeout(2500);
      const cmp = await bgsIn(3);
      if (cmp.some(s => /404-|html-a/.test(s))) fail('bảng so sánh: còn hiện ảnh hỏng');
      if (!cmp.some(s => s.includes('good1')) || !cmp.some(s => s.includes('good2'))) fail('bảng so sánh: cột có ảnh tốt phải hiện ảnh');
      if (!cmp.some(s => s.includes('linear-gradient'))) fail('bảng so sánh: cột Vendor Anh Hong (ảnh hỏng) phải hiện gradient mặc định');
    } catch (e) { fail('không dựng được thẻ chọn/bảng so sánh để kiểm: ' + String(e.message).split('\n')[0]); }
    if (external.length) fail('front gọi ra ngoài ngoài app/ảnh: ' + external.slice(0, 2).join(', '));
    if (!process.exitCode) console.log('PASS ảnh lỗi -> ảnh mặc định ở thẻ danh sách và gallery chi tiết; ảnh hỏng bị bỏ khỏi gallery');
    await b.close();
  } catch (e) { fail('lỗi chạy eval: ' + String(e.message).split('\n')[0] + ' | ' + (globalThis.__logs || []).slice(0, 6).join(' ; ')); }
  finally { cleanup(); setTimeout(() => process.exit(process.exitCode || 0), 300); }
})();
