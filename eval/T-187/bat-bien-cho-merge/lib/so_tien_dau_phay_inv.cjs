/* Bất biến INV-008 (planner/front/budget, front) · Nguồn: T-187 (spec v2, qua Spec Gate 2026-11-16, spec-critic).
 * Số tiền lẻ app cặp đôi tự định dạng: dấu phẩy, tối đa 1 chữ số lẻ, không ",0", không số thập phân dài, không NaN/undefined/null/Infinity,
 * không "-0tr"/"+0tr"/"−0tr" (làm tròn ra 0 thì không dấu). Chỉ đo chữ nhìn thấy (innerText, aria-valuetext), không đọc mã nguồn, không khoá con số hay nhãn.
 * Khung tự đủ: vite dev qua eval/_lib/vite_dev.cjs, Playwright, API giả (không mạng ngoài). Gốc HQ: dò ngược tới scripts/gate.py.
 * Biến: TOHONG_FRONT_REPO (hoặc --repo; mặc định <gốc HQ>/../tohong-front), PLAYWRIGHT_PATH. Thoát 0 = đạt, 1 = vi phạm, 2 = thiếu môi trường. */
const fs = require('fs'), path = require('path'), { createRequire } = require('module');
const A = process.argv.slice(2), arg = (k) => (A.includes(k) ? A[A.indexOf(k) + 1] : null);
const HQ_DIR = (() => { let d = __dirname; for (;;) { if (fs.existsSync(path.join(d, 'scripts', 'gate.py'))) return d; const u = path.dirname(d); if (u === d) return null; d = u; } })();
if (!HQ_DIR) { console.log('FAIL không tìm thấy gốc tohong-hq (scripts/gate.py)'); process.exit(2); }
const REPO = path.resolve(arg('--repo') || process.env.TOHONG_FRONT_REPO || path.join(HQ_DIR, '..', 'tohong-front'));
if (!fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu repo tohong-front (--repo hoặc TOHONG_FRONT_REPO)'); process.exit(2); }
let chromium; for (const t of [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean)) { try { ({ chromium } = createRequire(path.join(REPO, 'x.js'))(t)); break; } catch (e) { /* thử tiếp */ } }
if (!chromium) { console.log('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)'); process.exit(2); }
const { startViteDev } = require(path.join(HQ_DIR, 'eval', '_lib', 'vite_dev.cjs'));
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const HTML = (f) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/${f}"></script></body></html>`;
const PRE = `import '/src/index.css';\nimport React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport { VendorProvider } from '/src/screens/VendorCtx.jsx';\n`;
const JSX_CHAT = PRE + `import { ChatActionsCtx, VMatchChatCard } from '/src/screens/chat/VendorChatCards.jsx';
function App() {
  const cat = new URLSearchParams(location.search).get('cat') || 'photography';
  const [cards, setCards] = React.useState([{ k: 0, C: VMatchChatCard, p: { catId: cat } }]);
  const push = (C, p) => setCards(c => [...c, { k: c.length, C, p }]);
  return <VendorProvider coupleId="inv8"><ChatActionsCtx.Provider value={{ pushUser: () => {}, pushAI: push }}>
    <div style={{ width: 390 }}>{cards.map(c => <div key={c.k} data-card={c.k}><c.C {...c.p} /></div>)}</div>
  </ChatActionsCtx.Provider></VendorProvider>;
}
createRoot(document.getElementById('root')).render(<App />);`;
const JSX_SCREENS = PRE + `import { ConnectProvider } from '/src/screens/ConnectCtx.jsx';
import { ScreenVendorShortlist } from '/src/screens/Vendors.jsx';
import { ScreenBudget } from '/src/screens/Budget.jsx';
import { ScreenDashboard } from '/src/screens/Dashboard.jsx';
const q = new URLSearchParams(location.search), v = q.get('v');
function App() {
  const [open, setOpen] = React.useState(q.get('cat') || null);
  return <VendorProvider coupleId="inv8"><ConnectProvider coupleId="inv8" role="couple">
    <div style={{ width: 390, minHeight: 800, display: 'flex', flexDirection: 'column' }}>{v === 'budget'
      ? <ScreenBudget coupleId="inv8" openCatId={open} onOpenCat={setOpen} />
      : v === 'dashboard' ? <ScreenDashboard coupleId="inv8" role="owner" />
      : <ScreenVendorShortlist onMenuOpen={() => {}} onOpenVendorChat={() => {}} />}</div>
  </ConnectProvider></VendorProvider>;
}
createRoot(document.getElementById('root')).render(<App />);`;
const JSX_MINI = `import '/src/index.css';\nimport React from 'react';\nimport { createRoot } from 'react-dom/client';
import { ChatBudgetMini } from '/src/screens/chat/cards.jsx';
import { useBudget } from '/src/budget/useBudget.js';
function App() { const bud = useBudget('inv8', [], 0); return <div style={{ width: 390 }}>{bud.loaded ? <ChatBudgetMini budgetHook={bud} /> : <span>đang tải</span>}</div>; }
createRoot(document.getElementById('root')).render(<App />);`;

/* Dữ liệu giả: số lẻ, nửa đúng, chuỗi từ API, chênh lệch gần 0 hai phía. */
const V = (id, name, a, b, cat) => ({ id, name, category: cat || 'photography', priceMin: a, priceMax: b, rating: 4.5, reviewCount: 3, city: 'HCMC', tags: ['modern'], photos: [], match: { totalScore: 80, scoreBreakdown: {}, reasons: [] },
  ...(cat === 'venue' ? { price_source: 'estimated', price_basis: 'estimate_category', price_as_of: '2026-06', price_label: 'Ước tính theo hạng mục' } : {}) });
const VENDORS = [V('inv8_1', 'Kappa Studio', 4, 4.6), V('inv8_2', 'Lambda Studio', 3.96, 4.25), V('inv8_3', 'Rho Studio', '12.34', '14.0'), V('inv8_4', 'Tau Studio', 4.25, 4.25), V('inv8_5', 'Phi Studio', 7.96, 8.04)];
const HALLS = [V('inv8_9', 'Chi Hall', 3.9, 4.24, 'venue'), V('inv8_10', 'Zeta Hall', '4.2', '4.24', 'venue')];
const ALL = [...VENDORS, ...HALLS];
const mkSaved = (v, p) => ({ id: v.id, name: v.name, priceTotal: p, priceUnit: v.category === 'venue' ? 'bàn' : 'gói', grad: 'linear-gradient(#ccc,#ddd)', gallery: ['linear-gradient(#ccc,#ddd)'], spec: 'x', rating: 4, rv: 1, match: 80, location: 'HCMC' });
const S425 = mkSaved(VENDORS[3], 4.25), S796 = mkSaved(VENDORS[4], 7.96), S804 = { ...mkSaved(VENDORS[1], 8.04) }, S46 = mkSaved(VENDORS[0], 4.6);
const SEED = JSON.stringify({ photography: { shortlisted: [S425, S796, S804, S46], confirmed: S46 }, jewelry: { shortlisted: [S46], confirmed: null } });
const BUDGET = { total_tr: 120.5, guests: 100, mung_tr: 3.55, categories: [['photography', 'Chụp ảnh', 8], ['jewelry', 'Nhẫn cưới & trang sức', 3.4], ['venue', 'Tiệc & nhà hàng', 60.25], ['reserve', 'Dự phòng', 12.34], ['attire', 'Trang phục', 1.15]].map(([id, name, a]) => ({ id, name, allocated_tr: a, pct: 10, items: [] })) };
const SUMMARY = { profile: { bride_name: 'A', groom_name: 'B' }, budget: { total_tr: 120.5, spent_tr: 125.74, over: true } };

/* Luật: áp cho mọi đoạn chữ nhìn thấy có số tiền. */
const RULES = [
  [/\d\.\d+\s*(?:[–-]\s*\d+(?:[.,]\d+)?\s*)?tr\b/, 'số tiền lẻ dấu chấm'],
  [/\d,\d{2,}\s*(?:[–-]\s*\d+(?:,\d+)?\s*)?tr\b/, 'quá 1 chữ số lẻ'],
  [/\d,0(?!\d)\s*(?:[–-][^t]*)?tr\b/, 'còn ",0"'],
  [/\d[.,]\d{6,}/, 'số thập phân dài (sai số dấu phẩy động)'],
  [/undefined|NaN|Infinity|\bnull\b/, 'chữ thay cho số'],
  [/(?:^|[^\d,.])[-+−]\s?0(?:[,.]0)?\s*tr\b/, 'số 0 có dấu ("-0tr"/"+0tr"/"−0tr")'],
];
const fails = []; const bad = (m) => { if (!fails.includes(m)) fails.push(m); };
const check = (surf, t) => { const s = String(t || ''); for (const [re, why] of RULES) { const m = s.match(re); if (m) bad(`${surf}: ${why} "${m[0].trim()}", thấy "${s.slice(Math.max(0, m.index - 80), m.index + 80)}"`); } };

(async () => {
  let dev, br;
  try {
    dev = await startViteDev({ repo: REPO, files: { '__inv8a.jsx': JSX_CHAT, '__inv8a.html': HTML('__inv8a.jsx'), '__inv8b.jsx': JSX_SCREENS, '__inv8b.html': HTML('__inv8b.jsx'), '__inv8c.jsx': JSX_MINI, '__inv8c.html': HTML('__inv8c.jsx') } });
    br = await chromium.launch();
    const page = async (file, query) => {
      const ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.addInitScript(([s]) => { localStorage.setItem('th_vendors_inv8', s); }, [SEED]);
      const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
      await pg.route(/marry\.vn/, (r) => r.abort());
      await pg.route('http://localhost:8787/**', async (r) => {
        const m = r.request().method(), u = new URL(r.request().url());
        if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
        const j = (o, status = 200) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(o) });
        if (u.pathname === '/api/vendors/match') { const l = u.searchParams.get('category') === 'venue' ? HALLS : VENDORS; return j({ vendors: l, total: l.length, offset: 0, whyThoseVendors: null }); }
        if (u.pathname === '/api/vendors/status' && m === 'POST') { let ids = []; try { ids = JSON.parse(r.request().postData() || '{}').ids || []; } catch (e) { /* */ } const o = {}; for (const id of ids) { const v = ALL.find((x) => x.id === id); o[id] = v ? { hidden: false, price_source: 'estimated', priceMin: v.priceMin, priceMax: v.priceMax } : null; } return j({ vendors: o }); }
        const x = u.pathname.match(/^\/api\/vendors\/([^/]+)$/);
        if (x && m === 'GET' && !['match', 'categories', 'status'].includes(x[1])) { const v = ALL.find((q) => q.id === x[1]); return v ? j({ vendor: v, match: { ...v.match, whyThisVendor: 'x' } }) : j({}, 404); }
        if (u.pathname === '/api/couples/inv8/budget') return j(BUDGET);
        if (u.pathname === '/api/couples/inv8/summary') return j(SUMMARY);
        return j({}, 404);
      });
      await pg.goto(`http://127.0.0.1:${dev.port}/${file}${query || ''}`, { waitUntil: 'domcontentloaded' });
      return pg;
    };
    const text = (pg) => pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' ') + ' ' + [...document.querySelectorAll('[aria-valuetext]')].map((e) => e.getAttribute('aria-valuetext')).join(' '));
    const until = (pg, s) => pg.waitForFunction((s) => document.body.innerText.toLowerCase().includes(s.toLowerCase()), s, { timeout: 15000 });
    const surface = async (name, file, query, wait, after) => {
      const pg = await page(file, query);
      try {
        await until(pg, wait); await pg.waitForTimeout(1000); check(name, await text(pg));
        if (after) await after(pg);
      } catch (e) { bad(`${name}: lỗi chạy ${String(e.message).split('\n')[0]}`); }
      await pg.context().close();
    };
    const openEach = (names, label) => async (pg) => {
      for (const n of names) {
        await pg.getByText(n, { exact: false }).first().click({ timeout: 5000 }); await pg.waitForTimeout(800);
        check(`${label} (${n})`, await text(pg));
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
        if (/Dự toán: /.test(await text(pg))) { await pg.mouse.click(5, 5).catch(() => {}); await pg.waitForTimeout(400); }
      }
    };
    await surface('chat danh sách ảnh', '__inv8a.html', '', 'Kappa Studio', openEach(['Lambda Studio'], 'chat chi tiết'));
    await surface('chat danh sách nhà hàng', '__inv8a.html', '?cat=venue', 'Chi Hall', openEach(['Zeta Hall'], 'chat chi tiết'));
    await surface('Ngân sách tổng quan', '__inv8b.html', '?v=budget', 'Đã phân bổ');
    await surface('hạng mục ảnh', '__inv8b.html', '?v=budget&cat=photography', 'Tau Studio', openEach(['Tau Studio', 'Phi Studio', 'Lambda Studio'], 'sheet vendor'));
    await surface('hạng mục trang sức', '__inv8b.html', '?v=budget&cat=jewelry', 'Kappa Studio', openEach(['Kappa Studio'], 'sheet vendor'));
    await surface('hạng mục trang phục', '__inv8b.html', '?v=budget&cat=attire', 'DỰ TOÁN');
    await surface('Vendor đã lưu', '__inv8b.html', '', 'Vendor đã lưu');
    await surface('trang chủ', '__inv8b.html', '?v=dashboard', 'Ngân sách');
    await surface('thẻ ngân sách chat', '__inv8c.html', '', 'Phân bổ');
  } catch (e) { bad('lỗi khung chạy: ' + String(e.message).split('\n')[0]); }
  try { br && await br.close(); } catch (e) { /* */ } try { dev && await dev.stop(); } catch (e) { /* */ }
  if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); if (process.env.INV_ALL) console.log(fails.map((f) => '  - ' + f).join('\n')); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
