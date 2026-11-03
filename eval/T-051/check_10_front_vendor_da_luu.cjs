#!/usr/bin/env node
// T-051 tiêu chí 10: vendor ĐÃ LƯU trong localStorage (mang URL marry.vn cũ) khi pool đã chuyển sang Pages:
//  - danh sách "Vendor đã lưu" và tiêu đề Chi tiết vendor ở màn Ngân sách dùng ảnh của pool hiện tại (tra theo id), không gửi request nào tới marry.vn;
//  - id không còn trong pool (404/5xx) thì dùng ảnh đã lưu; ảnh hỏng nào cũng ra ảnh mặc định (danh sách: gradient danh mục; Ngân sách: nền sage/sand hiện có);
//  - mọi request tra ảnh `GET /api/vendors/<id>` KHÔNG mang coupleId có giá trị (mang là gọi LLM trả phí), mỗi id tối đa một lần mỗi lần mở trang;
//  - localStorage không bị đổi (so sánh chuỗi trước/sau).
// Chạy: NODE_PATH=$(npm root -g) node eval/T-051/check_10_front_vendor_da_luu.cjs <thư-mục-tohong-front>. In PASS hoặc FAIL <lý do>; mã thoát 0/1.
// Dựng trang thử tạm __t051b.html/.jsx trong thư mục front (xoá khi xong); chặn API; ảnh phục vụ bằng server giả.
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process');
const { chromium } = require('playwright');
const REPO = path.resolve(process.argv[2] || '');
let bad = 0; const fail = m => { console.log('FAIL ' + m); bad = 1; };
if (!fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL cần đường dẫn tohong-front'); process.exit(1); }
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const img = http.createServer((q, r) => { if (q.url.startsWith('/good')) { r.writeHead(200, { 'Content-Type': 'image/png' }); r.end(PNG); } else { r.writeHead(404); r.end('no'); } });
const JSX = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ConnectProvider } from '/src/screens/ConnectCtx.jsx';
import { ScreenVendorShortlist } from '/src/screens/Vendors.jsx';
import { ScreenBudget } from '/src/screens/Budget.jsx';
const v = new URLSearchParams(location.search).get('v');
createRoot(document.getElementById('root')).render(
  <VendorProvider coupleId="t051"><ConnectProvider coupleId="t051" role="couple">
    <div style={{ width: 390, height: 800 }}>{v === 'budget'
      ? <ScreenBudget coupleId="t051" openCatId="photography" />
      : <ScreenVendorShortlist onMenuOpen={() => {}} onOpenVendorChat={() => {}} />}</div>
  </ConnectProvider></VendorProvider>);
`;
const HTML = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__t051b.jsx"></script></body></html>';
let b;
(async () => {
  await new Promise(r => img.listen(0, '127.0.0.1', r));
  const O = 'http://127.0.0.1:' + img.address().port, MARRY = 'https://www.marry.vn/images/detailed/1/';
  const css = u => `center/cover no-repeat url("${u}")`;
  const mk = (id, name, stored) => ({ id, name, priceTotal: 10, priceUnit: 'gói', grad: css(stored), gallery: [css(stored)], spec: 'x', rating: 4, rv: 1, match: 80, location: 'HCMC' });
  const S = [
    mk('v_s1', 'Luu Pool Tot', MARRY + 's1.jpg'),        // pool: ảnh tốt
    mk('v_s2', 'Luu Pool Hong', MARRY + 's2.jpg'),       // pool: ảnh 404
    mk('v_s3', 'Luu Mat Pool Tot', O + '/good3.png'),    // id không còn trong pool (404): dùng ảnh đã lưu (tốt)
    mk('v_s4', 'Luu Mat Pool Hong', O + '/404-s4.png'),  // id không còn trong pool: ảnh đã lưu hỏng
    mk('v_s5', 'Luu Loi May Chu', O + '/good5.png'),     // tra pool lỗi 500: dùng ảnh đã lưu
    mk('v_s6', 'Luu Pool Rong', MARRY + 's6.jpg'),       // pool: không còn ảnh nào
  ];
  const pool = { v_s1: [O + '/good1.png'], v_s2: [O + '/404-pool2.png'], v_s6: [] };
  const seeds = { list: JSON.stringify({ photography: { shortlisted: S, confirmed: null } }), budget: JSON.stringify({ photography: { shortlisted: S, confirmed: S[5] } }) };
  let seed = '';
  const jsx = path.join(REPO, '__t051b.jsx'), html = path.join(REPO, '__t051b.html');
  fs.writeFileSync(jsx, JSX); fs.writeFileSync(html, HTML);
  const port = 5600 + Math.floor(Math.random() * 300);
  const vite = cp.spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: REPO, stdio: 'ignore' });
  const cleanup = () => { try { b && b.close(); } catch (e) {} try { vite.kill(); } catch (e) {} try { fs.unlinkSync(jsx); fs.unlinkSync(html); } catch (e) {} img.close(); };
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  try {
    for (let i = 0; i < 60; i++) { try { await new Promise((res, rej) => http.get(`http://127.0.0.1:${port}/__t051b.html`, r => { r.resume(); r.statusCode === 200 ? res() : rej(); }).on('error', rej)); break; } catch (e) { await new Promise(r => setTimeout(r, 500)); if (i === 59) throw new Error('vite không lên'); } }
    b = await chromium.launch();
    const open = async (v) => {
      seed = seeds[v];
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.addInitScript(([s]) => { if (!localStorage.getItem('th_vendors_t051')) localStorage.setItem('th_vendors_t051', s); window.__seed = s; }, [seed]);
      const pg = await ctx.newPage(); const marry = [], logs = [], lookups = [];
      pg.on('request', q => { if (/marry\.vn/.test(q.url())) marry.push(q.url()); });
      pg.on('pageerror', e => logs.push(String(e.message).slice(0, 150)));
      await pg.route(/marry\.vn/, r => r.abort());
      await pg.route('http://localhost:8787/**', r => {
        const m = r.request().method(), u = new URL(r.request().url());
        if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
        const mm = u.pathname.match(/^\/api\/vendors\/([^/]+)$/);
        if (mm && m === 'GET' && !['match', 'categories', 'status'].includes(mm[1])) {
          const id = mm[1]; lookups.push({ id, couple: u.searchParams.get('coupleId') });
          if (id === 'v_s5') return r.fulfill({ status: 500, headers: CORS, body: 'err' });
          if (pool[id]) return r.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ vendor: { id, name: id, category: 'photography', photos: pool[id].map(url => ({ url })) }, match: null }) });
          return r.fulfill({ status: 404, headers: CORS, contentType: 'application/json', body: '{"error":"vendor not found"}' });
        }
        if (u.pathname === '/api/couples/t051/budget') return r.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify({ total_tr: 100, guests: 100, categories: [{ id: 'photography', name: 'Chụp ảnh', allocated_tr: 20, pct: 20, items: [] }] }) });
        if (m === 'POST' && u.pathname === '/api/vendors/status') return r.fulfill({ headers: CORS, contentType: 'application/json', body: '{"vendors":{}}' });
        return r.fulfill({ status: 404, headers: CORS, contentType: 'application/json', body: '{}' });
      });
      await pg.goto(`http://127.0.0.1:${port}/__t051b.html?v=${v}`);
      return { pg, marry, logs, ctx, lookups };
    };
    const bgsOf = (pg, name) => pg.evaluate((n) => {
      const all = [...document.querySelectorAll('*')].filter(e => (e.innerText || '').includes(n));
      const names = ['Luu Pool Tot', 'Luu Pool Hong', 'Luu Mat Pool Tot', 'Luu Mat Pool Hong', 'Luu Loi May Chu', 'Luu Pool Rong'];
      const cnt = e => names.filter(x => (e.innerText || '').includes(x) && !(x !== n && n.includes(x) && !(e.innerText || '').replace(n, '').includes(x))).length;
      const leaf = all.filter(e => cnt(e) === 1).sort((x, y) => x.innerText.length - y.innerText.length)[0];
      if (!leaf) return null;
      let el = leaf; while (el.parentElement && cnt(el.parentElement) === 1 && el.parentElement.tagName !== 'BODY') el = el.parentElement;
      return [el, ...el.querySelectorAll('*')].map(x => getComputedStyle(x).backgroundImage).filter(s => s && s !== 'none');
    }, name);
    const checkLookups = (where, ls) => {
      const withCouple = ls.filter(l => l.couple);
      if (withCouple.length) fail(`${where}: tra ảnh mang coupleId=${withCouple[0].couple} (endpoint sẽ tính ghép và gọi LLM trả phí; phải gọi không kèm coupleId)`);
      const cnt = {}; ls.forEach(l => { cnt[l.id] = (cnt[l.id] || 0) + 1; });
      const dup = Object.entries(cnt).filter(([, c]) => c > 1);
      if (dup.length) fail(`${where}: id ${dup[0][0]} bị tra ${dup[0][1]} lần (tối đa 1)`);
    };
    // --- danh sách "Vendor đã lưu" ---
    {
      const { pg, marry, logs, lookups } = await open('list');
      try { await pg.waitForFunction(() => document.body.innerText.includes('Luu Pool Tot'), null, { timeout: 15000 }); } catch (e) { throw new Error('danh sách đã lưu không hiện vendor: ' + logs.join(' ; ')); }
      await pg.waitForTimeout(3000);
      const g = n => bgsOf(pg, n);
      const T = { 'Luu Pool Tot': ['good1', null], 'Luu Pool Hong': [null, '404-pool2'], 'Luu Mat Pool Tot': ['good3', null], 'Luu Mat Pool Hong': [null, '404-s4'], 'Luu Loi May Chu': ['good5', null], 'Luu Pool Rong': [null, 'marry'] };
      for (const [n, [want, ban]] of Object.entries(T)) {
        const bgs = await g(n);
        if (!bgs) { fail('danh sách đã lưu: không thấy hàng ' + n); continue; }
        if (want && !bgs.some(s => s.includes('url(') && s.includes(want))) fail(`danh sách đã lưu: ${n} phải hiện ảnh ${want}, thấy ${JSON.stringify(bgs).slice(0, 120)}`);
        if (!want && !bgs.some(s => s.includes('linear-gradient'))) fail(`danh sách đã lưu: ${n} phải hiện gradient mặc định`);
        if (bgs.some(s => s.includes('url(') && /404-|marry/.test(s))) fail(`danh sách đã lưu: ${n} còn hiện ảnh hỏng/marry.vn`);
      }
      if (marry.length) fail('danh sách đã lưu: có request tới marry.vn: ' + marry[0]);
      checkLookups('danh sách đã lưu', lookups);
      const after = await pg.evaluate(() => localStorage.getItem('th_vendors_t051'));
      if (after !== seed) fail('danh sách đã lưu: localStorage th_vendors_* bị đổi');
    }
    // --- màn Ngân sách: tiêu đề Chi tiết vendor ---
    const BT = { 'Luu Pool Tot': ['good1', 'url'], 'Luu Mat Pool Tot': ['good3', 'url'], 'Luu Pool Hong': [null, 'none'], 'Luu Mat Pool Hong': [null, 'none'], 'Luu Pool Rong': [null, 'sage'] };
    for (const [n, [want, mode]] of Object.entries(BT)) {
      const { pg, marry, logs, lookups } = await open('budget');
      try {
        try { await pg.waitForFunction((x) => document.body.innerText.includes(x), n, { timeout: 15000 }); } catch (e) { throw new Error('màn Ngân sách không hiện ' + n + ': ' + logs.join(' ; ')); }
        await pg.waitForTimeout(1500);
        await pg.locator('button', { hasText: n }).first().click({ timeout: 5000 });
        await pg.waitForTimeout(2500);
        const bg = await pg.evaluate(() => { const e = [...document.querySelectorAll('div')].find(d => d.style.width === '56px' && d.style.height === '56px'); return e ? getComputedStyle(e).backgroundImage : null; });
        if (bg === null) { fail(`Ngân sách: không thấy tiêu đề Chi tiết vendor của ${n}`); continue; }
        if (want && !bg.includes(want)) fail(`Ngân sách: ${n} phải hiện ảnh ${want}, thấy ${bg.slice(0, 100)}`);
        if (mode !== 'url' && (bg.includes('url(') || bg.includes('rgb(122, 154, 181)') || bg.includes('rgb(212, 160, 160)'))) fail(`Ngân sách: ${n} không có ảnh tốt phải giữ nền sage/sand hiện có của màn này (không ảnh, không gradient danh mục), thấy ${bg.slice(0, 100)}`);
        if (/url\(.*(404-|marry)/.test(bg)) fail(`Ngân sách: ${n} còn hiện ảnh hỏng`);
        if (marry.length) fail(`Ngân sách ${n}: có request tới marry.vn: ` + marry[0]);
        checkLookups('Ngân sách ' + n, lookups);
        const after = await pg.evaluate(() => localStorage.getItem('th_vendors_t051'));
        if (after !== seed) fail(`Ngân sách ${n}: localStorage th_vendors_* bị đổi`);
      } catch (e) { fail('Ngân sách ' + n + ': ' + String(e.message).split('\n')[0]); }
    }
    if (!bad) console.log('PASS vendor đã lưu: ảnh theo pool hiện tại, không gọi marry.vn, localStorage nguyên vẹn, ảnh hỏng ra mặc định ở danh sách đã lưu và Ngân sách');
  } catch (e) { fail('lỗi chạy eval: ' + String(e.message).split('\n')[0]); }
  finally { cleanup(); setTimeout(() => process.exit(bad), 300); }
})();
