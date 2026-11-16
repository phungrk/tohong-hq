/* Bất biến INV-009 và INV-010 (planner/front/budget, front) · Nguồn: T-192 (spec products/T-192-the-ngan-sach-chat-so-tien-hang-muc.md v2, qua Spec Gate 2026-11-16, spec-critic).
 * --which mini  (INV-009): mỗi hàng hạng mục của thẻ ngân sách trong chat ghi số tiền đã phân bổ của CHÍNH hạng mục đó (cùng khuôn INV-008), kể cả 0 ("0tr")
 *               và khi API trả số dạng chuỗi (kể cả chuỗi rỗng "" -> "0tr", thêm bởi adversary T-193 adv-01); không hàng nào còn "tr" đứng riêng, "undefined", "NaN".
 * --which price (INV-010): giá vendor có một hoặc cả hai đầu rỗng ("", null, bỏ khuyết) không bao giờ hiện "tr" đứng riêng, "tr–", "–tr",
 *               hay "0tr" bịa cho đầu rỗng, ở chat (danh sách, chi tiết, thẻ chọn so sánh) và màn Vendor đã lưu. Không khoá chữ thay thế ("Đến…", "Chưa có giá"…).
 * Chỉ đo chữ nhìn thấy (innerText), không đọc mã nguồn. Khung tự đủ: vite dev qua eval/_lib/vite_dev.cjs, Playwright, API giả (không mạng ngoài). Gốc HQ: dò ngược tới scripts/gate.py.
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
const WHICH = arg('--which') || 'price';
const HTML = (f) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/${f}"></script></body></html>`;
const PRE = `import '/src/index.css';\nimport React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport { VendorProvider } from '/src/screens/VendorCtx.jsx';\n`;
const JSX_CHAT = PRE + `import { ChatActionsCtx, VMatchChatCard } from '/src/screens/chat/VendorChatCards.jsx';
function App() {
  const cat = new URLSearchParams(location.search).get('cat') || 'photography';
  const [cards, setCards] = React.useState([{ k: 0, C: VMatchChatCard, p: { catId: cat } }]);
  const push = (C, p) => setCards(c => [...c, { k: c.length, C, p }]);
  return <VendorProvider coupleId="inv9"><ChatActionsCtx.Provider value={{ pushUser: () => {}, pushAI: push }}>
    <div style={{ width: 390 }}>{cards.map(c => <div key={c.k} data-card={c.k}><c.C {...c.p} /></div>)}</div>
  </ChatActionsCtx.Provider></VendorProvider>;
}
createRoot(document.getElementById('root')).render(<App />);`;
const JSX_SAVED = PRE + `import { ConnectProvider } from '/src/screens/ConnectCtx.jsx';
import { ScreenVendorShortlist } from '/src/screens/Vendors.jsx';
function App() {
  return <VendorProvider coupleId="inv9"><ConnectProvider coupleId="inv9" role="couple">
    <div style={{ width: 390, minHeight: 800, display: 'flex', flexDirection: 'column' }}><ScreenVendorShortlist onMenuOpen={() => {}} onOpenVendorChat={() => {}} /></div>
  </ConnectProvider></VendorProvider>;
}
createRoot(document.getElementById('root')).render(<App />);`;
const JSX_MINI = `import '/src/index.css';\nimport React from 'react';\nimport { createRoot } from 'react-dom/client';
import { ChatBudgetMini } from '/src/screens/chat/cards.jsx';
import { useBudget } from '/src/budget/useBudget.js';
function App() { const bud = useBudget('inv9', [], 0); return <div style={{ width: 390 }}>{bud.loaded ? <ChatBudgetMini budgetHook={bud} /> : <span>đang tải</span>}</div>; }
createRoot(document.getElementById('root')).render(<App />);`;

/* Khuôn số độc lập (như INV-008): 1 chữ số, dấu phẩy, bỏ ",0", không phân cách nghìn. */
const ref = (x) => { const r = Math.round(Number(x) * 10) / 10; return (r === 0 ? '0' : String(r)).replace('.', ','); };
const BARE_TR = /(?<![\p{L}\p{N}])tr(?![\p{L}\p{N}])/u;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const V = (id, name, a, b, cat, score) => { const o = { id, name, category: cat || 'photography', priceMax: b, rating: 4.5, reviewCount: 3, city: 'HCMC', tags: ['modern'], photos: [], match: { totalScore: score || 80, scoreBreakdown: {}, reasons: [] },
  ...(cat === 'venue' ? { price_source: 'estimated', price_basis: 'estimate_category', price_as_of: '2026-06', price_label: 'Ước tính theo hạng mục' } : {}) }; if (a !== undefined) o.priceMin = a; return o; };
/* Không có vendor giá 0 thật ở đây: mọi "0tr" trong hàng các vendor này là số bịa cho đầu rỗng. */
const PH = [V('inv9_1', 'Kappa Studio', '', 5, null, 95), V('inv9_2', 'Lambda Studio', null, 6, null, 90), V('inv9_3', 'Rho Studio', undefined, 7, null, 85), V('inv9_4', 'Tau Studio', '', '', null, 80), V('inv9_5', 'Phi Studio', 4, null, null, 75)];
const PH2 = [V('inv9_6', 'Psi Studio', 4, '', null, 90), V('inv9_7', 'Omi Studio', null, null, null, 85), V('inv9_8', 'Eta Studio', undefined, undefined, null, 80)];
const HALLS = [V('inv9_9', 'Chi Hall', '', 5, 'venue', 90), V('inv9_10', 'Zeta Hall', null, null, 'venue', 85), V('inv9_11', 'Ups Hall', 4, '', 'venue', 80)];
const ALL = [...PH, ...PH2, ...HALLS];
const mkSaved = (v, p) => ({ id: v.id, name: v.name, priceTotal: p, priceUnit: v.category === 'venue' ? 'bàn' : 'gói', grad: 'linear-gradient(#ccc,#ddd)', gallery: ['linear-gradient(#ccc,#ddd)'], spec: 'x', rating: 4, rv: 1, match: 80, location: 'HCMC' });
/* Lưu lúc có giá 4, nay đầu dưới rỗng (Kappa) / cả hai rỗng (Tau); lưu không giá (Lambda ""), Ups (nhà hàng) lưu 4 nay đầu trên rỗng. */
const SEED = JSON.stringify({ photography: { shortlisted: [mkSaved(PH[0], 4), mkSaved(PH[3], 4), mkSaved(PH[1], '')], confirmed: null }, venue: { shortlisted: [mkSaved(HALLS[2], 4), mkSaved(HALLS[1], '')], confirmed: null } });
/* Dự toán: số nguyên, 0, chuỗi từ API, và chuỗi rỗng "" (T-193 adv-01: rỗng ghi "0tr" như màn Ngân sách, không "tr" trơ). Cột 4 = số mong đợi khi khác số gửi. */
const CATS = [['photography', 'Chụp ảnh', 20], ['venue', 'Tiệc & nhà hàng', '60'], ['jewelry', 'Nhẫn cưới & trang sức', 0], ['attire', 'Trang phục', '3.4'], ['reserve', 'Dự phòng', 12.34], ['makeup', 'Trang điểm & làm tóc', '', 0]];
const BUDGET = { total_tr: 100, guests: 100, mung_tr: 5, categories: CATS.map(([id, name, a]) => ({ id, name, allocated_tr: a, pct: 10, items: [] })) };

const fails = []; const bad = (m) => { if (!fails.includes(m)) fails.push(m); };
const PRICE_RULES = [
  [BARE_TR, '"tr" đứng riêng (không có số)'],
  [/(?:^|[^\d,])0\s?tr/, '"0tr" bịa cho đầu giá rỗng'],
  [/undefined|NaN|\bnull\b/, 'chữ thay cho số'],
];
const checkPrice = (surf, t) => { const s = String(t || '').replace(/\s+/g, ' '); for (const [re, why] of PRICE_RULES) { const m = s.match(re); if (m) bad(`${surf}: ${why}, thấy "${s.slice(Math.max(0, m.index - 80), m.index + 60)}"`); } };

(async () => {
  let dev, br;
  try {
    dev = await startViteDev({ repo: REPO, files: { '__inv9a.jsx': JSX_CHAT, '__inv9a.html': HTML('__inv9a.jsx'), '__inv9b.jsx': JSX_SAVED, '__inv9b.html': HTML('__inv9b.jsx'), '__inv9c.jsx': JSX_MINI, '__inv9c.html': HTML('__inv9c.jsx') } });
    br = await chromium.launch();
    const page = async (file, query, list) => {
      const ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.addInitScript(([s]) => { localStorage.setItem('th_vendors_inv9', s); }, [SEED]);
      const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
      await pg.route(/marry\.vn/, (r) => r.abort());
      await pg.route('http://localhost:8787/**', async (r) => {
        const m = r.request().method(), u = new URL(r.request().url());
        if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
        const j = (o, status = 200) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(o) });
        if (u.pathname === '/api/vendors/match') { const l = u.searchParams.get('category') === 'venue' ? HALLS : (list || PH); return j({ vendors: l, total: l.length, offset: 0, whyThoseVendors: null }); }
        if (u.pathname === '/api/vendors/status' && m === 'POST') { let ids = []; try { ids = JSON.parse(r.request().postData() || '{}').ids || []; } catch (e) { /* */ } const o = {}; for (const id of ids) { const v = ALL.find((x) => x.id === id); o[id] = v ? { hidden: false, price_source: 'estimated', priceMin: v.priceMin === undefined ? null : v.priceMin, priceMax: v.priceMax === undefined ? null : v.priceMax, ...(v.price_basis ? { price_basis: v.price_basis } : {}) } : null; } return j({ vendors: o }); }
        const x = u.pathname.match(/^\/api\/vendors\/([^/]+)$/);
        if (x && m === 'GET' && !['match', 'categories', 'status'].includes(x[1])) { const v = ALL.find((q) => q.id === x[1]); return v ? j({ vendor: v, match: { ...v.match, whyThisVendor: 'x' } }) : j({}, 404); }
        if (u.pathname === '/api/couples/inv9/budget') return j(BUDGET);
        return j({}, 404);
      });
      await pg.goto(`http://127.0.0.1:${dev.port}/${file}${query || ''}`, { waitUntil: 'domcontentloaded' });
      return pg;
    };
    const until = (pg, s) => pg.waitForFunction((s) => document.body.innerText.includes(s), s, { timeout: 15000 });
    /* chữ của hàng chứa tên vendor: phần tử nhỏ nhất chứa tên mà có thêm chữ giá (đi lên tới khi hàng có hơn tên) */
    const rowOf = (pg, scope, name) => pg.evaluate(([scope, name]) => {
      const root = document.querySelector(scope) || document.body;
      const leaf = [...root.querySelectorAll('*')].filter((e) => (e.innerText || '').includes(name)).sort((a, b) => a.innerText.length - b.innerText.length)[0];
      let el = leaf; while (el && el.parentElement && el !== root && (el.innerText || '').replace(/\s+/g, ' ').trim().length < name.length + 6) el = el.parentElement;
      while (el && el.parentElement && el.parentElement !== root && !/\d|giá/i.test((el.innerText || '').replace(name, ''))) el = el.parentElement;
      return el ? el.innerText.replace(/\s+/g, ' ') : null;
    }, [scope, name]);

    if (WHICH === 'mini') {
      const pg = await page('__inv9c.html', '');
      try {
        await pg.waitForFunction(() => /Phân bổ/.test(document.body.innerText) && document.querySelectorAll('button').length > 0, null, { timeout: 15000 }); await pg.waitForTimeout(800);
        const r = await pg.evaluate((names) => {
          const out = {};
          for (const n of names) {
            const leaf = [...document.querySelectorAll('span,div')].filter((e) => (e.innerText || '').trim() === n).sort((a, b) => a.innerText.length - b.innerText.length)[0];
            let el = leaf; while (el && !el.querySelector('button') && el.parentElement) el = el.parentElement;
            out[n] = el && el.querySelector('button') ? el.innerText.replace(/\s+/g, ' ').trim() : null;
          }
          return out;
        }, CATS.map((c) => c[1]));
        for (const [, name, a0, exp] of CATS) {
          const a = exp !== undefined ? exp : a0;
          const t = r[name], want = `${name} ${ref(a)}tr`;
          if (!t) { bad(`thẻ ngân sách chat: không thấy hàng "${name}"`); continue; }
          if (BARE_TR.test(t) || /undefined|NaN|null/.test(t) || !new RegExp('^' + esc(name) + '\\s*' + esc(ref(a)) + '\\s?tr$').test(t)) bad(`thẻ ngân sách chat, hàng "${name}": mong "${want}", thấy "${t}"`);
        }
      } catch (e) { bad('thẻ ngân sách chat: lỗi chạy ' + String(e.message).split('\n')[0]); }
      await pg.context().close();
    } else {
      /* chat ảnh: danh sách, chi tiết của vendor đầu dưới rỗng, thẻ chọn so sánh */
      let pg = await page('__inv9a.html', '?cat=photography', PH);
      try {
        await until(pg, 'Kappa Studio'); await pg.waitForTimeout(800);
        for (const v of PH) checkPrice(`chat danh sách (${v.name})`, await rowOf(pg, '[data-card="0"]', v.name));
        await pg.locator('[data-card="0"]').getByText('Kappa Studio', { exact: false }).first().click({ timeout: 5000 });
        await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(800);
        checkPrice('chat chi tiết (Kappa, đầu dưới rỗng)', await pg.evaluate(() => document.querySelector('[data-card="1"]').innerText));
        await pg.locator('[data-card="1"]').getByText('So sánh', { exact: false }).first().click({ timeout: 5000 });
        await pg.waitForSelector('[data-card="2"]', { timeout: 5000 }); await pg.waitForFunction(() => document.querySelector('[data-card="2"]').innerText.includes('Tau Studio'), null, { timeout: 8000 }); await pg.waitForTimeout(500);
        for (const v of PH.slice(1)) checkPrice(`thẻ chọn so sánh (${v.name})`, await rowOf(pg, '[data-card="2"]', v.name));
      } catch (e) { bad('chat ảnh: lỗi chạy ' + String(e.message).split('\n')[0]); }
      await pg.context().close();
      /* chat ảnh, trang hai: đầu trên rỗng, cả hai null, cả hai bỏ khuyết */
      pg = await page('__inv9a.html', '?cat=photography', PH2);
      try {
        await until(pg, 'Psi Studio'); await pg.waitForTimeout(800);
        for (const v of PH2) checkPrice(`chat danh sách (${v.name})`, await rowOf(pg, '[data-card="0"]', v.name));
      } catch (e) { bad('chat ảnh (trang hai): lỗi chạy ' + String(e.message).split('\n')[0]); }
      await pg.context().close();
      /* chat nhà hàng (giá theo bàn) */
      pg = await page('__inv9a.html', '?cat=venue');
      try {
        await until(pg, 'Chi Hall'); await pg.waitForTimeout(800);
        for (const v of HALLS) checkPrice(`chat nhà hàng (${v.name})`, await rowOf(pg, '[data-card="0"]', v.name));
      } catch (e) { bad('chat nhà hàng: lỗi chạy ' + String(e.message).split('\n')[0]); }
      await pg.context().close();
      /* Vendor đã lưu */
      pg = await page('__inv9b.html', '');
      try {
        await until(pg, 'Kappa Studio'); await pg.waitForTimeout(1500);
        for (const n of ['Kappa Studio', 'Tau Studio', 'Lambda Studio', 'Ups Hall', 'Zeta Hall']) checkPrice(`Vendor đã lưu (${n})`, await rowOf(pg, '#root', n));
      } catch (e) { bad('Vendor đã lưu: lỗi chạy ' + String(e.message).split('\n')[0]); }
      await pg.context().close();
    }
  } catch (e) { bad('lỗi khung chạy: ' + String(e.message).split('\n')[0]); }
  try { br && await br.close(); } catch (e) { /* */ } try { dev && await dev.stop(); } catch (e) { /* */ }
  if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); if (process.env.INV_ALL) console.log(fails.map((f) => '  - ' + f).join('\n')); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
