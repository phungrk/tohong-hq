'use strict';
/* T-187: khung chung cho eval front (tohong-front, vite dev + Playwright, API giả, không mạng ngoài). Khung của eval/T-170/_lib.cjs.
 * Đo HÀNH VI: chữ người dùng thấy (innerText). Cầu nối với mã nguồn chỉ là các export mà eval T-164/T-170/T-179 đã dùng để dựng bề mặt:
 *   VMatchChatCard, VPickerChatCard, ChatActionsCtx (chat); ScreenVendorShortlist (Vendors.jsx), ScreenBudget (Budget.jsx), ScreenDashboard (Dashboard.jsx), ChatBudgetMini (cards.jsx); VendorProvider, ConnectProvider.
 * Số mong đợi tính bằng `ref` (cài độc lập trong eval, đúng khuôn T-167 H2: Math.round(x*10)/10, dấu phẩy, bỏ ",0", không phân cách nghìn), không đọc từ mã nguồn.
 * Chạy: node <check>.cjs [--repo <tohong-front>] · Biến: TOHONG_FRONT_REPO, PLAYWRIGHT_PATH, T187_ALL=1 (in mọi lỗi). */
const fs = require('fs'), path = require('path'), { createRequire } = require('module');
const A = process.argv.slice(2), arg = (k) => (A.includes(k) ? A[A.indexOf(k) + 1] : null);
const REPO = path.resolve(arg('--repo') || process.env.TOHONG_FRONT_REPO || path.join(__dirname, '..', '..', '..', 'tohong-front'));
if (!fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu repo tohong-front (--repo hoặc TOHONG_FRONT_REPO)'); process.exit(2); }
let chromium; for (const t of [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean)) { try { ({ chromium } = createRequire(path.join(REPO, 'x.js'))(t)); break; } catch (e) { /* thử tiếp */ } }
if (!chromium) { console.log('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)'); process.exit(2); }
const { startViteDev } = require(path.join(__dirname, '..', '_lib', 'vite_dev.cjs'));
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

/* Khuôn số (T-167 H2) viết lại độc lập: 1 chữ số, dấu phẩy, bỏ ",0", không phân cách nghìn. Nhận cả số lẫn chuỗi "12.34" như API có thể trả. */
const ref = (x) => { const r = Math.round(Number(x) * 10) / 10; return (r === 0 ? '0' : String(r)).replace('.', ','); };
const tr = (x) => ref(x) + 'tr';
/* Mọi số tiền lẻ kiểu dấu chấm ("4.6tr", "3.5tr/bàn", "1.1999999999999997tr", "12.3–14.5tr"): không được còn trong chữ nhìn thấy. */
const DOT_MONEY = /\d\.\d+\s*(?:[–-]\s*\d+(?:[.,]\d+)?\s*)?tr\b/;
const LONG_FLOAT = /\d[.,]\d{6,}/; // số thập phân dài (sai số dấu phẩy động) không được lộ

const V = (id, name, a, b, extra) => ({ id, name, category: 'photography', priceMin: a, priceMax: b, rating: 4.5, reviewCount: 3, city: 'HCMC', tags: ['modern'], photos: [], match: { totalScore: 80, scoreBreakdown: {}, reasons: [] }, ...extra });
const score = (n) => ({ totalScore: n, scoreBreakdown: {}, reasons: [] });
/* Hạng mục gói (chụp ảnh), xếp theo điểm giảm dần. */
const ALPHA = V('t187_1', 'Alpha Studio', 4, 4.6, { match: score(90) });                     // "4tr–4,6tr"
const BETA = V('t187_2', 'Beta Studio', 3.5, 3.5, { match: score(80) });                      // "3,5tr" (hai đầu bằng nhau: một số)
const GAMMA = V('t187_3', 'Gamma Studio', 12, 14, { match: score(70) });                      // "12tr–14tr" (nguyên: không ",0")
const DELTA = V('t187_4', 'Delta Studio', '12.34', '13.8', { match: score(60) });             // API trả CHUỖI: "12,3tr–13,8tr"
const EPS = V('t187_5', 'Epsilon Studio', 3.96, 4.25, { match: score(50) });                  // 3,96 -> "4" (bỏ ",0"), 4,25 -> "4,3" (như back, Math.round(x*10)/10)
/* Nhà hàng (venue): giá theo bàn. */
const OMEGA = V('t187_9', 'Omega Hall', 4, 4.6, { category: 'venue', price_source: 'estimated', price_basis: 'legacy_marry', price_as_of: '2026-06', price_label: 'Giá marry.vn · 06/2026', match: score(90) }); // "4tr–4,6tr/bàn"
const SIGMA = V('t187_10', 'Sigma Hall', 3.9, 3.9, { category: 'venue', price_source: 'estimated', price_basis: 'estimate_category', price_as_of: '2026-06', price_label: 'Ước tính theo hạng mục', match: score(80) }); // "3,9tr/bàn"
const PSI = V('t187_11', 'Psi Hall', 4.2, 4.24, { category: 'venue', price_source: 'estimated', price_basis: 'estimate_category', price_as_of: '2026-06', price_label: 'Ước tính theo hạng mục', match: score(70) }); // hai đầu cùng "4,2": một số "4,2tr/bàn"
/* Vendor đã lưu ở app: giá lúc lưu (priceTotal) khác giá hiện tại (priceMin/Max từ /api/vendors/status). */
const NU = V('t187_12', 'Nu Studio', 4.25, 4.8, { match: score(60) });                       // lưu lúc 4,6 -> nay "4,3–4,8tr"
const XI = V('t187_13', 'Xi Studio', '12.34', '13.8', { match: score(60) });                  // lưu lúc 5 -> nay (chuỗi) "12,3–13,8tr"
const MU = V('t187_14', 'Mu Studio', 25, 27, { match: score(60) });                          // lưu lúc 20 -> nay "25–27tr" (nguyên)
const ALL = [ALPHA, BETA, GAMMA, DELTA, EPS, OMEGA, SIGMA, PSI, NU, XI, MU];

const HTML = (f) => `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/${f}"></script></body></html>`;
const JSX_CHAT = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ChatActionsCtx, VMatchChatCard, VPickerChatCard } from '/src/screens/chat/VendorChatCards.jsx';
function App() {
  const q = new URLSearchParams(location.search);
  const first = q.get('v') === 'picker' ? { k: 0, C: VPickerChatCard, p: {} } : { k: 0, C: VMatchChatCard, p: { catId: q.get('cat') || 'photography' } };
  const [cards, setCards] = React.useState([first]);
  const push = (C, p) => setCards(c => [...c, { k: c.length, C, p }]);
  return <VendorProvider coupleId="t187"><ChatActionsCtx.Provider value={{ pushUser: () => {}, pushAI: push }}>
    <div id="cards" style={{ width: 390 }}>{cards.map(c => <div key={c.k} data-card={c.k}><c.C {...c.p} /></div>)}</div>
  </ChatActionsCtx.Provider></VendorProvider>;
}
createRoot(document.getElementById('root')).render(<App />);
`;
const JSX_SCREENS = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ConnectProvider } from '/src/screens/ConnectCtx.jsx';
import { ScreenVendorShortlist } from '/src/screens/Vendors.jsx';
import { ScreenBudget } from '/src/screens/Budget.jsx';
import { ScreenDashboard } from '/src/screens/Dashboard.jsx';
const q = new URLSearchParams(location.search), v = q.get('v');
function App() {
  const [open, setOpen] = React.useState(q.get('cat') || null);
  return <VendorProvider coupleId="t187"><ConnectProvider coupleId="t187" role="couple">
    <div style={{ width: 390, minHeight: 800, display: 'flex', flexDirection: 'column' }}>{v === 'budget'
      ? <ScreenBudget coupleId="t187" openCatId={open} onOpenCat={setOpen} />
      : v === 'dashboard' ? <ScreenDashboard coupleId="t187" role="owner" />
      : <ScreenVendorShortlist onMenuOpen={() => {}} onOpenVendorChat={() => {}} />}</div>
  </ConnectProvider></VendorProvider>;
}
createRoot(document.getElementById('root')).render(<App />);
`;
const JSX_MINI = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatBudgetMini } from '/src/screens/chat/cards.jsx';
import { useBudget } from '/src/budget/useBudget.js';
function App() { const bud = useBudget('t187', [], 0); return <div style={{ width: 390 }}>{bud.loaded ? <ChatBudgetMini budgetHook={bud} /> : <span>đang tải</span>}</div>; }
createRoot(document.getElementById('root')).render(<App />);
`;
/* Một vendor đã lưu (dạng localStorage của app). */
const mkSaved = (v, priceTotal, extra) => ({ id: v.id, name: v.name, priceTotal: priceTotal != null ? priceTotal : v.priceMin, priceUnit: v.category === 'venue' ? 'bàn' : 'gói', grad: 'linear-gradient(#ccc,#ddd)', gallery: ['linear-gradient(#ccc,#ddd)'], spec: 'x', rating: 4, rv: 1, match: 80, location: 'HCMC', ...(extra || {}) });
/* { catId: { shortlisted: [...], confirmed: obj|null } } */
const savedDocs = (o) => JSON.stringify(o);
/* Gộp gạch giữa hai số thành một dấu gạch ngang chuẩn "–" ("4tr - 4,6tr" và "4tr–4,6tr" như nhau); dấu trừ đứng trước số không bị đổi. */
const dash = (s) => String(s).replace(/(\d(?:tr)?)\s*[–-]\s*(?=\d)/g, '$1–');
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
/* Dự toán giả: hạng mục có số lẻ. total_tr = mục tiêu. */
const budgetDoc = (cats, extra) => ({ total_tr: 120.5, guests: 100, mung_tr: 3.5, categories: cats.map(([id, name, a]) => ({ id, name, allocated_tr: a, pct: 10, items: [] })), ...(extra || {}) });

function setup() {
  const fails = []; const bad = (m) => { if (!fails.includes(m)) fails.push(m); };
  const st = { dev: null, br: null };
  const start = async () => {
    st.dev = await startViteDev({ repo: REPO, files: { '__t187a.jsx': JSX_CHAT, '__t187a.html': HTML('__t187a.jsx'), '__t187b.jsx': JSX_SCREENS, '__t187b.html': HTML('__t187b.jsx'), '__t187c.jsx': JSX_MINI, '__t187c.html': HTML('__t187c.jsx') } });
    st.br = await chromium.launch(); st.port = st.dev.port;
  };
  /* opts: vendors {cat: [..]} (danh sách match), live {id: {priceMin, priceMax}} (giá hiện tại, /api/vendors/status), budget (dự toán), summary (Dashboard), seed (localStorage đã lưu) */
  const page = async (file, query, opts = {}) => {
    const ctx = await st.br.newContext({ viewport: { width: 390, height: 844 } });
    if (opts.seed) await ctx.addInitScript(([s]) => { localStorage.setItem('th_vendors_t187', s); }, [opts.seed]);
    const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
    await pg.route(/marry\.vn/, (r) => r.abort());
    await pg.route('http://localhost:8787/**', async (r) => {
      const m = r.request().method(), u = new URL(r.request().url());
      if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
      const j = (o, status = 200) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(o) });
      if (u.pathname === '/api/vendors/match') { const cat = u.searchParams.get('category'); const l = (opts.vendors && opts.vendors[cat]) || (cat === 'venue' ? [OMEGA, SIGMA, PSI] : [ALPHA, BETA, GAMMA, DELTA, EPS]); return j({ vendors: l, total: l.length, offset: 0, whyThoseVendors: null }); }
      if (u.pathname === '/api/vendors/status' && m === 'POST') { let ids = []; try { ids = JSON.parse(r.request().postData() || '{}').ids || []; } catch (e) { /* */ } const o = {}; for (const id of ids) { const v = ALL.find((x) => x.id === id); const lv = (opts.live && opts.live[id]) || {}; o[id] = v ? { hidden: false, price_source: v.price_source || 'estimated', price_basis: v.price_basis, price_as_of: v.price_as_of, price_label: v.price_label, priceMin: v.priceMin, priceMax: v.priceMax, ...lv } : null; } return j({ vendors: o }); }
      const x = u.pathname.match(/^\/api\/vendors\/([^/]+)$/);
      if (x && m === 'GET' && !['match', 'categories', 'status'].includes(x[1])) { const v = ALL.find((q) => q.id === x[1]); return v ? j({ vendor: v, match: { ...v.match, whyThisVendor: 'x' } }) : j({}, 404); }
      if (u.pathname === '/api/couples/t187/budget') return j(opts.budget || budgetDoc([['photography', 'Chụp ảnh', 20], ['venue', 'Tiệc & nhà hàng', 60]]));
      if (u.pathname === '/api/couples/t187/summary') return j(opts.summary || { profile: { bride_name: 'A', groom_name: 'B' }, budget: { total_tr: 100, spent_tr: 50, over: false } });
      return j({}, 404);
    });
    await pg.goto(`http://127.0.0.1:${st.port}/${file}${query || ''}`, { waitUntil: 'domcontentloaded' });
    return pg;
  };
  const finish = async () => {
    try { st.br && await st.br.close(); } catch (e) { /* */ } try { st.dev && await st.dev.stop(); } catch (e) { /* */ }
    if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); if (process.env.T187_ALL) console.log(fails.map((f) => '  - ' + f).join('\n')); process.exit(1); }
    console.log('PASS'); process.exit(0);
  };
  const run = (fn) => start().then(fn).catch((e) => bad('lỗi khung chạy: ' + String(e.message).split('\n')[0])).finally(finish);
  const bodyText = (pg, scope) => pg.evaluate((s) => (document.querySelector(s) || document.body).innerText.replace(/\s+/g, ' '), scope || 'body');
  /* văn bản hàng của một vendor: phần tử nhỏ nhất chứa tên, nới lên tới khi sắp chứa tên vendor khác */
  const rowText = (pg, scope, name) => pg.evaluate(([scope, name, names]) => {
    const root = document.querySelector(scope); if (!root) return null;
    const leaf = [...root.querySelectorAll('*')].filter((e) => (e.innerText || '').includes(name)).sort((x, y) => x.innerText.length - y.innerText.length)[0]; if (!leaf) return null;
    let el = leaf; const cnt = (e) => names.filter((n) => new RegExp('(^|\\W)' + n + ' (Studio|Hall)').test(e.innerText || '')).length;
    while (el.parentElement && el.parentElement !== root && cnt(el.parentElement) === 1) el = el.parentElement;
    return el.innerText.replace(/\s+/g, ' ');
  }, [scope, name, ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Omega', 'Sigma', 'Psi', 'Nu', 'Xi', 'Mu']]);
  /* Không dấu chấm thập phân kiểu tiền, không số thập phân dài: áp cho một đoạn chữ nhìn thấy. */
  const noDot = (surf, t) => {
    const d = String(t).match(DOT_MONEY); if (d) bad(`${surf}: còn số tiền lẻ dấu chấm "${d[0]}" (phải dấu phẩy), thấy "${String(t).slice(0, 200)}"`);
    const u = String(t).match(/undefined|NaN|Infinity|\bnull\b/); if (u) bad(`${surf}: lộ chữ "${u[0]}" thay cho số, thấy "${String(t).slice(0, 200)}"`);
    const l = String(t).match(LONG_FLOAT); if (l) bad(`${surf}: lộ số thập phân dài "${l[0]}" (sai số dấu phẩy động), thấy "${String(t).slice(0, 200)}"`);
  };
  /* Chữ phải chứa đủ các chuỗi mong đợi (nguyên văn; không phân biệt hoa thường vì nhãn có thể viết hoa bằng CSS). */
  const has = (surf, t, wants) => { for (const w of wants) if (!String(t).toLowerCase().includes(String(w).toLowerCase())) bad(`${surf}: thiếu "${w}", thấy "${String(t).slice(0, 260)}"`); };
  return { fails, bad, run, page, rowText, bodyText, noDot, has, st };
}
module.exports = { REPO, setup, ref, tr, V, ALPHA, BETA, GAMMA, DELTA, EPS, OMEGA, SIGMA, PSI, NU, XI, MU, ALL, mkSaved, savedDocs, budgetDoc, norm, dash, DOT_MONEY };
