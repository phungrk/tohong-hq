#!/usr/bin/env node
/* T-164 tiêu chí 5, phần A (tohong-front, app cặp đôi): MỌI chỗ hiện số giá vendor đều hiện nhãn giá; nhãn lấy NGUYÊN VĂN từ price_label của API (một nơi tạo nhãn là back).
 * Bề mặt đo: thẻ chat danh sách vendor (VMatchChatCard), màn chi tiết trong thẻ chat, danh sách đã lưu (ScreenVendorShortlist), màn Ngân sách (vendor đã lưu, qua POST /api/vendors/status).
 * Vendor thử (API giả): V1 price_label "Giá marry.vn · 06/2026", V2 "Ước tính theo hạng mục", V3 "Giá đã xác minh", V4 và V5 là back cũ (có giá, KHÔNG có price_label; V4 price_source "estimated", V5 không price_source):
 *   back cũ => nhãn dự phòng "giá ước tính" (không phân biệt hoa thường), vẫn phải có nhãn. Khi có price_label, chữ "giá ước tính" kiểu cũ KHÔNG được hiện ở hàng đó.
 * Đo theo chữ nhìn thấy trong hàng của vendor (không đọc tên class/hàm). Chạy: node check_5a_nhan_app_cap_doi.cjs --repo <tohong-front> */
const fs = require('fs'), path = require('path'), { createRequire } = require('module');
const A = process.argv.slice(2), arg = (k) => (A.includes(k) ? A[A.indexOf(k) + 1] : null);
const REPO = arg('--repo') && path.resolve(arg('--repo'));
if (!REPO || !fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo trỏ tới tohong-front'); process.exit(2); }
let chromium; for (const t of [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean)) { try { ({ chromium } = createRequire(path.join(REPO, 'x.js'))(t)); break; } catch (e) { /* thử tiếp */ } }
if (!chromium) { console.log('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)'); process.exit(2); }
const { startViteDev } = require(path.join(__dirname, '..', '_lib', 'vite_dev.cjs'));
const fails = []; const bad = (m) => { if (!fails.includes(m)) fails.push(m); };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const L1 = 'Giá marry.vn · 06/2026', L2 = 'Ước tính theo hạng mục', L3 = 'Giá đã xác minh';
const V = (id, name, a, b, extra) => ({ id, name, category: 'photography', priceMin: a, priceMax: b, rating: 4.5, reviewCount: 3, city: 'HCMC', tags: ['modern'], photos: [], match: { totalScore: 80, scoreBreakdown: {}, reasons: [] }, ...extra });
const VENDORS = [
  V('t164_1', 'Alpha Studio', 11, 13, { price_source: 'estimated', price_basis: 'legacy_marry', price_as_of: '2026-06', price_label: L1 }),
  V('t164_2', 'Beta Studio', 12, 14, { price_source: 'estimated', price_basis: 'estimate_category', price_as_of: '2026-06', price_label: L2 }),
  V('t164_3', 'Gamma Studio', 13, 15, { price_source: 'verified', price_basis: 'admin_verified', price_as_of: null, price_label: L3 }),
  V('t164_4', 'Delta Studio', 14, 16, { price_source: 'estimated' }),
  V('t164_5', 'Epsilon Studio', 15, 17, {}),
];
const OMEGA = V('t164_7', 'Omega Hall', 4, 4.6, { category: 'venue', price_source: 'estimated', price_basis: 'legacy_marry', price_as_of: '2026-06', price_label: L1 });
const ZETA = V('t164_6', 'Zeta Studio', 12, 14, { price_source: 'estimated', price_basis: 'estimate_category', price_as_of: '2026-06', price_label: L2 }); // đã lưu lúc 10tr, giá hiện tại 12tr
const WANT = { Alpha: L1, Beta: L2, Gamma: L3 };
const HTML = (f) => `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/${f}"></script></body></html>`;
const JSX_A = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ChatActionsCtx, VMatchChatCard } from '/src/screens/chat/VendorChatCards.jsx';
function App() {
  const [cards, setCards] = React.useState([{ k: 0, C: VMatchChatCard, p: { catId: new URLSearchParams(location.search).get('cat') || 'photography' } }]);
  const push = (C, p) => setCards(c => [...c, { k: c.length, C, p }]);
  return <VendorProvider coupleId="t164"><ChatActionsCtx.Provider value={{ pushUser: () => {}, pushAI: push }}>
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
  <VendorProvider coupleId="t164"><ConnectProvider coupleId="t164" role="couple">
    <div style={{ width: 390, height: 800 }}>{v === 'budget'
      ? <ScreenBudget coupleId="t164" openCatId="photography" />
      : <ScreenVendorShortlist onMenuOpen={() => {}} onOpenVendorChat={() => {}} />}</div>
  </ConnectProvider></VendorProvider>);
`;
const saved = (list) => JSON.stringify({ photography: { shortlisted: list, confirmed: null } });
const mkSaved = (v) => ({ id: v.id, name: v.name, priceTotal: v.priceMin, priceUnit: 'gói', grad: 'linear-gradient(#ccc,#ddd)', gallery: ['linear-gradient(#ccc,#ddd)'], spec: 'x', rating: 4, rv: 1, match: 80, location: 'HCMC' });
const rowText = (pg, scope, name) => pg.evaluate(([scope, name]) => {
  const root = document.querySelector(scope); if (!root) return null;
  const leaf = [...root.querySelectorAll('*')].filter((e) => (e.innerText || '').includes(name)).sort((x, y) => x.innerText.length - y.innerText.length)[0]; if (!leaf) return null;
  const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'];
  let el = leaf; const cnt = (e) => names.filter((n) => (e.innerText || '').includes(n)).length;
  while (el.parentElement && el.parentElement !== root && cnt(el.parentElement) === 1) el = el.parentElement;
  return el.innerText.replace(/\s+/g, ' ');
}, [scope, name]);
const hasPrice = (t, v) => t && t.includes(`${v.priceMin}tr`);
let dev, br;
(async () => {
  dev = await startViteDev({ repo: REPO, files: { '__t164a.jsx': JSX_A, '__t164a.html': HTML('__t164a.jsx'), '__t164b.jsx': JSX_B, '__t164b.html': HTML('__t164b.jsx') } });
  const port = dev.port; br = await chromium.launch();
  const page = async (url, seedKey) => {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
    if (seedKey) await ctx.addInitScript(([s]) => { localStorage.setItem('th_vendors_t164', s); }, [seedKey]);
    const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
    await pg.route(/marry\.vn/, (r) => r.abort());
    await pg.route('http://localhost:8787/**', async (r) => {
      const m = r.request().method(), u = new URL(r.request().url());
      if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
      const j = (o, status = 200) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(o) });
      if (u.pathname === '/api/vendors/match') return j({ vendors: u.searchParams.get('category') === 'venue' ? [OMEGA] : VENDORS, total: VENDORS.length, offset: 0, whyThoseVendors: null });
      if (u.pathname === '/api/vendors/status' && m === 'POST') { let ids = []; try { ids = JSON.parse(r.request().postData() || '{}').ids || []; } catch (e) { /* */ } const o = {}; for (const id of ids) { const v = VENDORS.concat([ZETA, OMEGA]).find((x) => x.id === id); o[id] = v ? { hidden: false, price_source: v.price_source || 'estimated', price_basis: v.price_basis, price_as_of: v.price_as_of, price_label: v.price_label, priceMin: v.priceMin, priceMax: v.priceMax } : null; } return j({ vendors: o }); }
      const x = u.pathname.match(/^\/api\/vendors\/([^/]+)$/);
      if (x && m === 'GET' && !['match', 'categories', 'status'].includes(x[1])) { const v = VENDORS.find((q) => q.id === x[1]); return v ? j({ vendor: v, match: { totalScore: 80, scoreBreakdown: {}, reasons: [], whyThisVendor: 'x' } }) : j({}, 404); }
      if (u.pathname === '/api/couples/t164/budget') return j({ total_tr: 100, guests: 100, categories: [{ id: 'photography', name: 'Chụp ảnh', allocated_tr: 20, pct: 20, items: [] }] });
      return j({}, 404);
    });
    await pg.goto(url, { waitUntil: 'domcontentloaded' });
    return pg;
  };
  const checkRows = (surf, texts) => {
    for (const v of VENDORS) {
      const n = v.name.split(' ')[0]; const t = texts[n];
      if (!t) { bad(`${surf}: không thấy hàng ${v.name}`); continue; }
      if (!hasPrice(t, v)) { bad(`${surf}: hàng ${v.name} không hiện giá ${v.priceMin}tr (eval không đo được nhãn)`); continue; }
      if (WANT[n]) {
        if (!t.includes(WANT[n])) bad(`${surf}: hàng ${v.name} thiếu nhãn "${WANT[n]}"`);
        if (/giá ước tính/i.test(t) && n !== 'Alpha') bad(`${surf}: hàng ${v.name} còn chữ "giá ước tính" kiểu cũ dù API có price_label`);
        if (n === 'Alpha' && /giá ước tính/i.test(t)) bad(`${surf}: hàng ${v.name} còn chữ "giá ước tính" kiểu cũ dù API có price_label`);
      } else if (!/giá ước tính/i.test(t)) bad(`${surf}: hàng ${v.name} (back cũ, không price_label) có giá mà thiếu nhãn dự phòng "giá ước tính"`);
    }
  };
  /* S0 venue: giá theo bàn ("/bàn") ở danh sách và chi tiết; hạng mục khác không có "/bàn" */
  { const pg = await page(`http://127.0.0.1:${port}/__t164a.html?cat=venue`);
    try {
      await pg.waitForFunction(() => document.body.innerText.includes('Omega Hall'), null, { timeout: 15000 });
      const t = await pg.evaluate(() => document.querySelector('[data-card="0"]').innerText.replace(/\s+/g, ' '));
      if (!/4tr\s*[–-]\s*4\.6tr\/bàn/.test(t) || !t.includes(L1)) bad('venue danh sách chat: giá phải ghi theo bàn "4tr–4.6tr/bàn" kèm nhãn, thấy: ' + t.slice(0, 200));
      await pg.locator('[data-card="0"]').getByText('Omega Hall', { exact: false }).first().click({ timeout: 5000 });
      await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(500);
      const d = await pg.evaluate(() => document.querySelector('[data-card="1"]').innerText.replace(/\s+/g, ' '));
      if (!/4tr\s*[–-]\s*4\.6tr\/bàn/.test(d)) bad('venue chi tiết: giá phải ghi theo bàn "4tr–4.6tr/bàn", thấy: ' + d.slice(0, 200));
    } catch (e) { bad('venue: lỗi chạy ' + String(e.message).split('\n')[0]); }
    await pg.context().close(); }
  /* S1 danh sách thẻ chat + S2 chi tiết */
  { const pg = await page(`http://127.0.0.1:${port}/__t164a.html`);
    try {
      await pg.waitForFunction(() => document.body.innerText.includes('Alpha Studio'), null, { timeout: 15000 });
      const t = {}; for (const n of ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']) t[n] = await rowText(pg, '[data-card="0"]', n + ' Studio'); checkRows('danh sách chat', t);
      for (const n of Object.keys(t)) if (t[n] && /\/bàn/.test(t[n])) bad(`danh sách chat: hạng mục chụp ảnh không được ghi "/bàn" (${n})`);
    } catch (e) { bad('thẻ chat: lỗi chạy ' + String(e.message).split('\n')[0]); }
    await pg.context().close(); }
  for (const n of ['Alpha', 'Gamma', 'Epsilon']) {
    const pg = await page(`http://127.0.0.1:${port}/__t164a.html`);
    try {
      await pg.waitForFunction(() => document.body.innerText.includes('Alpha Studio'), null, { timeout: 15000 });
      await pg.locator('[data-card="0"]').getByText(n + ' Studio', { exact: false }).first().click({ timeout: 5000 });
      await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(500);
      const d = await pg.evaluate(() => document.querySelector('[data-card="1"]').innerText.replace(/\s+/g, ' '));
      const v = VENDORS.find((x) => x.name.startsWith(n));
      if (!d.includes(`${v.priceMin}tr`)) bad(`chi tiết ${n}: không hiện giá ${v.priceMin}tr`);
      else if (WANT[n] ? !d.includes(WANT[n]) : !/giá ước tính/i.test(d)) bad(`chi tiết ${n}: thiếu nhãn ${WANT[n] || '"giá ước tính" dự phòng'}`);
    } catch (e) { bad(`chi tiết ${n}: lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
  /* S3 danh sách đã lưu (không có snapshot nhãn: nhãn lấy từ API trạng thái; thiếu thì dự phòng) */
  { const pg = await page(`http://127.0.0.1:${port}/__t164b.html`, saved(VENDORS.map(mkSaved)));
    try {
      await pg.waitForFunction(() => document.body.innerText.includes('Alpha Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(1200);
      const t = {}; for (const n of ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']) t[n] = await rowText(pg, '#root', n + ' Studio'); checkRows('danh sách đã lưu', t);
    } catch (e) { bad('danh sách đã lưu: lỗi chạy ' + String(e.message).split('\n')[0]); }
    await pg.context().close(); }
  /* S4 màn Ngân sách, hạng mục ảnh: vendor đã lưu */
  { const pg = await page(`http://127.0.0.1:${port}/__t164b.html?v=budget`, saved(VENDORS.concat([ZETA]).map((v) => (v === ZETA ? { ...mkSaved(v), priceTotal: 10 } : mkSaved(v)))));
    try {
      await pg.waitForFunction(() => document.body.innerText.includes('Alpha Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(1200);
      const t = {}; for (const n of ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']) t[n] = await rowText(pg, '#root', n + ' Studio'); checkRows('màn Ngân sách', t);
      const z = await rowText(pg, '#root', 'Zeta Studio');
      if (!z || !z.includes('giá đã cập nhật') || !z.includes(L2)) bad('màn Ngân sách: vendor đã lưu lúc 10tr, giá hiện tại 12tr phải hiện "giá đã cập nhật" VÀ nhãn "' + L2 + '" của giá hiện tại, thấy: ' + z);
    } catch (e) { bad('màn Ngân sách: lỗi chạy ' + String(e.message).split('\n')[0]); }
    await pg.context().close(); }
})().catch((e) => bad('lỗi khung chạy: ' + String(e.message).split('\n')[0])).finally(async () => {
  try { br && await br.close(); } catch (e) { /* */ } try { dev && await dev.stop(); } catch (e) { /* */ }
  if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); if (process.env.T164_ALL) console.log(fails.map((f) => '  - ' + f).join('\n')); process.exit(1); }
  console.log('PASS'); process.exit(0);
});
