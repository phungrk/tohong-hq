'use strict';
/* T-170: khung chung cho eval front app cặp đôi (tohong-front, vite dev + Playwright, API giả, không mạng ngoài). Theo khung eval/T-164/check_5a_nhan_app_cap_doi.cjs.
 * Đo HÀNH VI: chữ nhìn thấy (innerText). Cầu nối với mã nguồn chỉ là các export mà eval T-164 đã dùng để dựng bề mặt:
 *   VMatchChatCard, ChatActionsCtx (chat); ScreenVendorShortlist (Vendors.jsx), ScreenBudget (Budget.jsx); VendorProvider, ConnectProvider.
 * Chạy: node <check>.cjs [--repo <tohong-front>]  · Biến: TOHONG_FRONT_REPO, PLAYWRIGHT_PATH, T170_ALL=1 (in mọi lỗi). */
const fs = require('fs'), path = require('path'), { createRequire } = require('module');
const A = process.argv.slice(2), arg = (k) => (A.includes(k) ? A[A.indexOf(k) + 1] : null);
const REPO = path.resolve(arg('--repo') || process.env.TOHONG_FRONT_REPO || path.join(__dirname, '..', '..', '..', 'tohong-front'));
if (!fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu repo tohong-front (--repo hoặc TOHONG_FRONT_REPO)'); process.exit(2); }
let chromium; for (const t of [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean)) { try { ({ chromium } = createRequire(path.join(REPO, 'x.js'))(t)); break; } catch (e) { /* thử tiếp */ } }
if (!chromium) { console.log('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)'); process.exit(2); }
const { startViteDev } = require(path.join(__dirname, '..', '_lib', 'vite_dev.cjs'));
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

/* Nhãn nguồn giá (chữ do back trả ở price_label, và chữ dự phòng của app khi back cũ). Không chữ nào được nhìn thấy ở app cặp đôi. */
const L1 = 'Giá marry.vn · 06/2026', L2 = 'Ước tính theo hạng mục', L3 = 'Giá đã xác minh', L4 = 'Giá do Tơ Hồng cập nhật', L5 = 'Giá cũ marry.vn';
const FORBID = /giá marry|marry\.vn|ước tính theo hạng mục|giá do tơ hồng cập nhật|giá cũ marry|giá đã xác minh|giá ước tính/i;
const V = (id, name, a, b, extra) => ({ id, name, category: 'photography', priceMin: a, priceMax: b, rating: 4.5, reviewCount: 3, city: 'HCMC', tags: ['modern'], photos: [], match: { totalScore: 80, scoreBreakdown: {}, reasons: [] }, ...extra });
const VENDORS = [   // danh sách chat hiện 5 hàng đầu: đủ nhãn mới (L1-L3) và hai dạng back cũ không có price_label
  V('t170_1', 'Alpha Studio', 11, 13, { price_source: 'estimated', price_basis: 'legacy_marry', price_as_of: '2026-06', price_label: L1 }),
  V('t170_2', 'Beta Studio', 12, 14, { price_source: 'estimated', price_basis: 'estimate_category', price_as_of: '2026-06', price_label: L2 }),
  V('t170_3', 'Gamma Studio', 13, 15, { price_source: 'verified', price_basis: 'admin_verified', price_as_of: null, price_label: L3 }),
  V('t170_6', 'Zeta Studio', 16, 18, { price_source: 'estimated' }),                       // back cũ: không price_label (nhãn dự phòng "giá ước tính" kiểu cũ)
  V('t170_7', 'Eta Studio', 17, 19, { price_source: 'verified' }),                          // back cũ: verified không price_label (nhãn dự phòng "giá đã xác minh")
];
const NAMES = ['Alpha', 'Beta', 'Gamma', 'Zeta', 'Eta'];
const DELTA = V('t170_4', 'Delta Studio', 14, 16, { price_source: 'estimated', price_basis: 'admin', price_label: L4 });      // chỉ ở màn đã lưu/Ngân sách (nhãn từ /api/vendors/status)
const EPSILON = V('t170_5', 'Epsilon Studio', 15, 17, { price_source: 'estimated', price_basis: 'legacy_marry', price_label: L5 });
const THETA = V('t170_8', 'Theta Studio', 12, 14, { price_source: 'estimated', price_basis: 'estimate_category', price_as_of: '2026-06', price_label: L2 }); // đã lưu lúc 10tr, giá hiện tại 12tr
const OMEGA = V('t170_9', 'Omega Hall', 4, 4.6, { category: 'venue', price_source: 'estimated', price_basis: 'legacy_marry', price_as_of: '2026-06', price_label: L1 });
const SIGMA = V('t170_10', 'Sigma Hall', 3.9, 3.9, { category: 'venue', price_source: 'estimated', price_basis: 'estimate_category', price_as_of: '2026-06', price_label: L2 });
const HTML = (f) => `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/${f}"></script></body></html>`;
const JSX_CHAT = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ChatActionsCtx, VMatchChatCard } from '/src/screens/chat/VendorChatCards.jsx';
function App() {
  const [cards, setCards] = React.useState([{ k: 0, C: VMatchChatCard, p: { catId: new URLSearchParams(location.search).get('cat') || 'photography' } }]);
  const push = (C, p) => setCards(c => [...c, { k: c.length, C, p }]);
  return <VendorProvider coupleId="t170"><ChatActionsCtx.Provider value={{ pushUser: () => {}, pushAI: push }}>
    <div id="cards" style={{ width: 390 }}>{cards.map(c => <div key={c.k} data-card={c.k}><c.C {...c.p} /></div>)}</div>
  </ChatActionsCtx.Provider></VendorProvider>;
}
createRoot(document.getElementById('root')).render(<App />);
`;
const JSX_SAVED = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ConnectProvider } from '/src/screens/ConnectCtx.jsx';
import { ScreenVendorShortlist } from '/src/screens/Vendors.jsx';
import { ScreenBudget } from '/src/screens/Budget.jsx';
const q = new URLSearchParams(location.search), v = q.get('v'), cat = q.get('cat') || 'photography';
createRoot(document.getElementById('root')).render(
  <VendorProvider coupleId="t170"><ConnectProvider coupleId="t170" role="couple">
    <div style={{ width: 390, height: 800 }}>{v === 'budget'
      ? <ScreenBudget coupleId="t170" openCatId={cat} />
      : <ScreenVendorShortlist onMenuOpen={() => {}} onOpenVendorChat={() => {}} />}</div>
  </ConnectProvider></VendorProvider>);
`;
const mkSaved = (v, priceTotal) => ({ id: v.id, name: v.name, priceTotal: priceTotal != null ? priceTotal : v.priceMin, priceUnit: v.category === 'venue' ? 'bàn' : 'gói', grad: 'linear-gradient(#ccc,#ddd)', gallery: ['linear-gradient(#ccc,#ddd)'], spec: 'x', rating: 4, rv: 1, match: 80, location: 'HCMC' });
const savedDoc = (cat, list) => JSON.stringify({ [cat]: { shortlisted: list, confirmed: null } });
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function setup(files) {
  const fails = []; const bad = (m) => { if (!fails.includes(m)) fails.push(m); };
  const st = { dev: null, br: null };
  const start = async () => {
    st.dev = await startViteDev({ repo: REPO, files: { '__t170a.jsx': JSX_CHAT, '__t170a.html': HTML('__t170a.jsx'), '__t170b.jsx': JSX_SAVED, '__t170b.html': HTML('__t170b.jsx'), ...(files || {}) } });
    st.br = await chromium.launch(); st.port = st.dev.port;
  };
  /* opts: vendors (match), budgetBasis (map id -> text), budget {total_tr, guests, categories} */
  const page = async (file, query, opts = {}) => {
    const ctx = await st.br.newContext({ viewport: { width: 390, height: 844 } });
    if (opts.seed) await ctx.addInitScript(([s]) => { localStorage.setItem('th_vendors_t170', s); }, [opts.seed]);
    const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
    await pg.route(/marry\.vn/, (r) => r.abort());
    const all = VENDORS.concat([DELTA, EPSILON, THETA, OMEGA, SIGMA]);
    await pg.route('http://localhost:8787/**', async (r) => {
      const m = r.request().method(), u = new URL(r.request().url());
      if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
      const j = (o, status = 200) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(o) });
      const withMatch = (v) => ({ ...v, match: { ...v.match, ...(opts.basis && opts.basis[v.id] ? { budgetBasis: { kind: 'per_table', text: opts.basis[v.id] } } : {}) } });
      if (u.pathname === '/api/vendors/match') { const cat = u.searchParams.get('category'); const l = (opts.vendors && opts.vendors[cat]) || (cat === 'venue' ? [OMEGA, SIGMA] : VENDORS); return j({ vendors: l.map(withMatch), total: l.length, offset: 0, whyThoseVendors: null }); }
      if (u.pathname === '/api/vendors/status' && m === 'POST') { let ids = []; try { ids = JSON.parse(r.request().postData() || '{}').ids || []; } catch (e) { /* */ } const o = {}; for (const id of ids) { const v = all.find((x) => x.id === id); o[id] = v ? { hidden: false, price_source: v.price_source || 'estimated', price_basis: v.price_basis, price_as_of: v.price_as_of, price_label: v.price_label, priceMin: v.priceMin, priceMax: v.priceMax } : null; } return j({ vendors: o }); }
      const x = u.pathname.match(/^\/api\/vendors\/([^/]+)$/);
      if (x && m === 'GET' && !['match', 'categories', 'status'].includes(x[1])) { const v = all.find((q) => q.id === x[1]); return v ? j({ vendor: v, match: { ...withMatch(v).match, whyThisVendor: 'x' } }) : j({}, 404); }
      if (u.pathname === '/api/couples/t170/budget') return j(opts.budget || { total_tr: 100, guests: 100, categories: [{ id: 'photography', name: 'Chụp ảnh', allocated_tr: 20, pct: 20, items: [] }, { id: 'venue', name: 'Tiệc & nhà hàng', allocated_tr: 60, pct: 60, items: [] }] });
      return j({}, 404);
    });
    await pg.goto(`http://127.0.0.1:${st.port}/${file}${query || ''}`, { waitUntil: 'domcontentloaded' });
    return pg;
  };
  const finish = async () => {
    try { st.br && await st.br.close(); } catch (e) { /* */ } try { st.dev && await st.dev.stop(); } catch (e) { /* */ }
    if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); if (process.env.T170_ALL) console.log(fails.map((f) => '  - ' + f).join('\n')); process.exit(1); }
    console.log('PASS'); process.exit(0);
  };
  const run = (fn) => start().then(fn).catch((e) => bad('lỗi khung chạy: ' + String(e.message).split('\n')[0])).finally(finish);
  /* văn bản hàng của một vendor: phần tử nhỏ nhất chứa tên, nới lên tới khi sắp chứa tên vendor khác */
  const rowText = (pg, scope, name) => pg.evaluate(([scope, name, names]) => {
    const root = document.querySelector(scope); if (!root) return null;
    const leaf = [...root.querySelectorAll('*')].filter((e) => (e.innerText || '').includes(name)).sort((x, y) => x.innerText.length - y.innerText.length)[0]; if (!leaf) return null;
    let el = leaf; const cnt = (e) => names.filter((n) => new RegExp('(^|\\W)' + n + ' (Studio|Hall)').test(e.innerText || '')).length;
    while (el.parentElement && el.parentElement !== root && cnt(el.parentElement) === 1) el = el.parentElement;
    return el.innerText.replace(/\s+/g, ' ');
  }, [scope, name, ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Omega', 'Sigma']]);
  /* Dấu "·" mồ côi: đo trên innerText THÔ (chưa gộp khoảng trắng), từng dòng: dòng kết thúc bằng "·", dòng bắt đầu bằng "·", hoặc hai "·" liền nhau (kể cả "·" sau đơn vị "gói"/"bàn" hay sau spec). */
  const checkDangle = async (surf, pg, scope) => {
    const raw = await pg.evaluate((s) => (document.querySelector(s) || document.body).innerText, scope || 'body');
    const l = raw.split('\n').find((x) => /·\s*$/m.test(x) || /^\s*·/m.test(x) || /·\s*·/.test(x));
    if (l !== undefined) bad(`${surf}: còn dấu "·" mồ côi ở dòng "${l.trim().slice(0, 120)}"`);
  };
  const bodyText = (pg, scope) => pg.evaluate((s) => (document.querySelector(s) || document.body).innerText.replace(/\s+/g, ' '), scope || 'body');
  /* mỗi hàng: còn giá, không nhãn nguồn, không dấu "·" treo */
  const checkRow = (surf, name, t, v) => {
    if (!t) return bad(`${surf}: không thấy hàng ${name}`);
    if (!t.includes(`${v.priceMin}tr`)) bad(`${surf}: hàng ${name} mất giá ${v.priceMin}tr, thấy "${t.slice(0, 160)}"`);
    const f = t.match(FORBID); if (f) bad(`${surf}: hàng ${name} còn nhãn nguồn giá "${f[0]}", thấy "${t.slice(0, 200)}"`);
    if (/·\s*·/.test(t)) bad(`${surf}: hàng ${name} còn dấu "·" thừa sau khi bỏ nhãn, thấy "${t.slice(0, 200)}"`);
  };
  return { fails, bad, run, page, rowText, bodyText, checkRow, checkDangle, st };
}
module.exports = { REPO, setup, L1, L2, L3, L4, L5, FORBID, VENDORS, NAMES, DELTA, EPSILON, THETA, OMEGA, SIGMA, V, mkSaved, savedDoc, norm };
