'use strict';
/* T-156: khung chung cho eval front của app cặp đôi (tohong-front, vite dev, API giả, KHÔNG Google thật, KHÔNG mạng ngoài).
 * Dữ liệu vendor lấy từ POOL THẬT của tohong-back (lib/vendorPool.generated.js): URL và tác giả là của ảnh Google thật trong pool; ảnh được trả bằng PNG giả do trình duyệt thử chặn.
 * Đo HÀNH VI: chữ nhìn thấy được và hình học. Không đọc tên class/hàm. Cầu nối duy nhất với mã nguồn là các export mà eval T-164 đã dùng để dựng bề mặt:
 *   VMatchChatCard, ChatActionsCtx (chat); ScreenVendorShortlist, ScreenBudget (đã lưu); VendorProvider, ConnectProvider. */
const fs = require('fs'), path = require('path'), { createRequire } = require('module');
const HQ = path.resolve(__dirname, '..', '..', '..');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

function repoArgs(argv) {
  const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
  const REPO = arg('--repo') && path.resolve(arg('--repo'));
  if (!REPO || !fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo trỏ tới tohong-front'); process.exit(2); }
  let chromium;
  for (const t of [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean)) {
    try { ({ chromium } = createRequire(path.join(REPO, 'x.js'))(t)); break; } catch (e) { /* thử tiếp */ }
  }
  if (!chromium) { console.log('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)'); process.exit(2); }
  return { REPO, chromium };
}

/* ---------- pool thật ---------- */
function loadPool() {
  const cands = [process.env.TOHONG_BACK_REPO, path.join(HQ, '..', 'tohong-back')].filter(Boolean).map((p) => path.resolve(p));
  const back = cands.find((p) => fs.existsSync(path.join(p, 'lib', 'vendorPool.generated.js')));
  if (!back) { console.log('FAIL không thấy repo tohong-back (đặt TOHONG_BACK_REPO)'); process.exit(2); }
  const t = fs.readFileSync(path.join(back, 'lib', 'vendorPool.generated.js'), 'utf8');
  const i = t.indexOf('= [') + 2;
  return JSON.parse(t.slice(i, t.lastIndexOf(']') + 1));
}
const isGoogleHost = (u) => { try { const h = new URL(String(u).trim()).hostname.toLowerCase(); return h === 'googleusercontent.com' || h.endsWith('.googleusercontent.com'); } catch (e) { return false; } };
const isG = (p) => !!p && ((typeof p.source === 'string' && p.source.trim().toLowerCase() === 'google') || isGoogleHost(p.url));
const hasAttr = (p) => typeof p.attribution === 'string' && p.attribution.trim() !== '';
const stem = (u) => String(u).replace(/=[A-Za-z0-9-]+$/, ''); // bỏ hậu tố kích thước "=s4800-w800"

/* Vendor giả cho API: bản ghi pool thật + khối match; các biến thể ghép từ ảnh thật của pool. */
const SENT = 'MARRY_TAC_GIA_ZZ156';
function buildSets(pool) {
  const used = new Set();
  const takeAuthors = (v) => v.photos.filter(isG).map((p) => p.attribution);
  const lc = (x) => String(x).toLowerCase();
  // tác giả không được trùng/chứa trong tên vendor (nếu không, chữ tên vendor làm eval đỗ oan) và không dùng lại giữa các vendor
  const free = (v) => takeAuthors(v).every((a) => !used.has(a) && !lc(v.name).includes(lc(a)) && !lc(a).includes(lc(v.name)));
  const take = (v) => { takeAuthors(v).forEach((a) => used.add(a)); return v; };
  const byId = [...pool].sort((a, b) => (a.id < b.id ? -1 : 1));
  const pick = (fn) => { const v = byId.find((x) => fn(x) && free(x)); if (!v) { console.log('FAIL pool thật không có vendor phù hợp để dựng ca thử (eval cần cập nhật)'); process.exit(2); } return take(v); };
  const g = (v) => v.photos.filter(isG);
  const two = (v) => g(v).length >= 2 && v.photos[0] === g(v)[0] && v.photos[1] === g(v)[1] && g(v)[0].attribution !== g(v)[1].attribution && hasAttr(g(v)[0]) && hasAttr(g(v)[1]);
  const photo = (v) => v.category === 'photography';
  const P1 = pick((v) => photo(v) && two(v));                                   // hai ảnh Google, hai tác giả khác nhau
  const P2 = pick((v) => two(v) && v.id !== P1.id);                             // ảnh đầu hỏng khi tải => hiện ảnh thứ hai
  const LONGV = [...byId].filter((v) => g(v).length && free(v) && v.id !== P1.id && v.id !== P2.id).sort((a, b) => Math.max(...g(b).map((p) => p.attribution.length)) - Math.max(...g(a).map((p) => p.attribution.length)))[0];
  const P3 = take(LONGV);                                                       // tên tác giả dài nhất pool (có "&")
  const marryPhoto = byId.find((v) => v.photos.some((p) => !isG(p))).photos.find((p) => !isG(p));
  const gOther = pick((v) => g(v).length >= 1 && hasAttr(g(v)[0]) && v.id !== P1.id && v.id !== P2.id && v.id !== P3.id);
  const mk = (id, name, photos, extra) => ({ ...P1, id, name, photos, ...extra });
  const clone = (v, id, name, photos) => ({ ...v, id, name, photos });
  const sets = { P1, P2, P3 };
  sets.P4 = mk('t156_mixed', 'Mixed Studio Thu', [{ url: marryPhoto.url, source: 'marry' }, { url: g(gOther)[0].url, source: 'google', attribution: g(gOther)[0].attribution }]); // marry rồi Google
  sets.AUTH_P4 = g(gOther)[0].attribution;
  sets.P5 = mk('t156_label', 'Label Sai Studio', [{ url: 'https://lh3.googleusercontent.com/t156/label-sai', source: 'marry', attribution: 'Nhãn <b>Sai</b> & Co' }]); // nguồn gắn sai nhưng host Google => vẫn ghi công, chữ thuần
  sets.N0 = mk('t156_marry', 'Marry Only Studio', [{ url: marryPhoto.url, source: 'marry', attribution: SENT }]);                 // ảnh marry mang trường attribution: KHÔNG hiện
  sets.N1 = mk('t156_noattr', 'Khong Cong Studio', [{ url: 'https://lh3.googleusercontent.com/t156/khong-cong=s800-w800', source: 'google' }]);
  sets.N2 = mk('t156_first_noattr', 'Hai Anh Studio', [{ url: 'https://lh3.googleusercontent.com/t156/hai-anh-1=s800-w800', source: 'google' }, { url: 'https://lh3.googleusercontent.com/t156/hai-anh-2=s800-w800', source: 'google', attribution: 'Tac Gia Hai ZZ' }]);
  sets.N3 = mk('t156_blank', 'Trang Studio Thu', [{ url: 'https://lh3.googleusercontent.com/t156/trang=s800-w800', source: 'google', attribution: '   ' }, { url: marryPhoto.url, source: 'marry' }]);
  sets.MARRY_URL = marryPhoto.url;
  return sets;
}
const withMatch = (v) => ({ ...v, match: { totalScore: 80, scoreBreakdown: {}, reasons: [], whyThisVendor: 'x' } });

/* ---------- đo trong trình duyệt ---------- */
/* Chạy trong trang. Trả về { found, visible, near, why }.
 *  - found: có phần tử chứa NGUYÊN VĂN `needle` trong chữ hiển thị (innerText; không tính title/aria-label/tooltip).
 *  - visible: chữ không bị ẩn (display/visibility/opacity<.5), cỡ chữ >= 10px, không bị cắt (overflow, ellipsis, line-clamp) so với mọi tổ tiên.
 *  - near: khoảng cách nhỏ nhất giữa chữ ghi công và khung ảnh (phần tử có nền/ảnh trỏ tới `thumbStem`) <= 32px. */
function probeFn(args) {
  const { scopeSel, needle, thumbStem, onlyThumb } = args;
  const scope = document.querySelector(scopeSel);
  if (!scope) return { found: false, why: 'không thấy vùng ' + scopeSel };
  const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
  const N = norm(needle);
  const all = [scope, ...scope.querySelectorAll('*')];
  const has = (e) => norm(e.innerText || '').includes(N);
  const leaf = all.filter((e) => has(e) && ![...e.children].some(has));
  if (!leaf.length) return { found: false, why: 'không có chữ "' + needle + '"' };
  const rectDist = (a, b) => { const dx = Math.max(0, Math.max(a.left - b.right, b.left - a.right)); const dy = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom)); return Math.hypot(dx, dy); };
  let thumbs = thumbStem ? all.filter((e) => { const cs = getComputedStyle(e); return (cs.backgroundImage || '').includes(thumbStem) || (e.tagName === 'IMG' && (e.currentSrc || e.src || '').includes(thumbStem)); }) : [];
  if (typeof onlyThumb === 'number') thumbs = thumbs.slice(onlyThumb, onlyThumb + 1);
  let best = { found: true, visible: false, near: false, why: 'chữ có nhưng không nhìn thấy được' };
  for (const el of leaf) {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    let why = null;
    if (r.width < 1 || r.height < 1) why = 'kích thước 0';
    else if (cs.display === 'none' || cs.visibility === 'hidden') why = 'bị ẩn';
    else if (parseFloat(cs.fontSize) < 10) why = 'cỡ chữ ' + cs.fontSize + ' < 10px';
    else if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) why = 'bị cắt bằng ellipsis';
    else if ((cs.webkitLineClamp && cs.webkitLineClamp !== 'none') && el.scrollHeight > el.clientHeight + 1) why = 'bị cắt bằng line-clamp';
    if (!why) {
      let op = 1;
      for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
        const c = getComputedStyle(a); op *= parseFloat(c.opacity);
        if (a !== el && (c.display === 'none' || c.visibility === 'hidden')) { why = 'tổ tiên bị ẩn'; break; }
        if (a !== el && (c.overflowX !== 'visible' || c.overflowY !== 'visible')) {
          const ar = a.getBoundingClientRect();
          if (r.left < ar.left - 1.5 || r.right > ar.right + 1.5 || r.top < ar.top - 1.5 || r.bottom > ar.bottom + 1.5) { why = 'bị cắt bởi khung cuộn/ẩn tràn'; break; }
        }
      }
      if (!why && op < 0.5) why = 'độ mờ ' + op.toFixed(2);
    }
    if (why) { best = { found: true, visible: false, near: false, why }; continue; }
    const near = thumbs.length ? Math.min(...thumbs.map((t) => rectDist(r, t.getBoundingClientRect()))) : 0;
    const res = { found: true, visible: true, near: near <= 32, dist: Math.round(near), thumbs: thumbs.length, why: near <= 32 ? '' : 'chữ cách khung ảnh ' + Math.round(near) + 'px (> 32px)' };
    if (!thumbs.length && thumbStem) res.why = 'không thấy khung ảnh ' + thumbStem.slice(-30), res.near = false;
    if (res.visible && res.near) return res;
    best = res;
  }
  return best;
}
/* Có phần tử nào đang hiện ảnh trỏ tới `thumbStem` (nền CSS hoặc <img>) trong vùng? */
function urlInDomFn(args) {
  const scope = document.querySelector(args.scopeSel); if (!scope) return false;
  return [scope, ...scope.querySelectorAll('*')].some((e) => (getComputedStyle(e).backgroundImage || '').includes(args.thumbStem) || (e.tagName === 'IMG' && ((e.currentSrc || e.src || '').includes(args.thumbStem))));
}
const textIn = (pg, scopeSel) => pg.evaluate((s) => (document.querySelector(s)?.innerText || '').replace(/\s+/g, ' '), scopeSel);

/* ---------- vite dev + trang ---------- */
const HTML = (f) => `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/${f}"></script></body></html>`;
const JSX_CHAT = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ChatActionsCtx, VMatchChatCard } from '/src/screens/chat/VendorChatCards.jsx';
function App() {
  const [cards, setCards] = React.useState([{ k: 0, C: VMatchChatCard, p: { catId: 'photography' } }]);
  const push = (C, p) => setCards(c => [...c, { k: c.length, C, p }]);
  return <VendorProvider coupleId="t156"><ChatActionsCtx.Provider value={{ pushUser: () => {}, pushAI: push }}>
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
const v = new URLSearchParams(location.search).get('v');
createRoot(document.getElementById('root')).render(
  <VendorProvider coupleId="t156"><ConnectProvider coupleId="t156" role="couple">
    <div style={{ width: 390, height: 800 }}>{v === 'budget'
      ? <ScreenBudget coupleId="t156" openCatId="photography" />
      : <ScreenVendorShortlist onMenuOpen={() => {}} onOpenVendorChat={() => {}} />}</div>
  </ConnectProvider></VendorProvider>);
`;
async function startApp(REPO, chromium) {
  const { startViteDev } = require(path.join(HQ, 'eval', '_lib', 'vite_dev.cjs'));
  const dev = await startViteDev({ repo: REPO, files: { '__t156c.jsx': JSX_CHAT, '__t156c.html': HTML('__t156c.jsx'), '__t156s.jsx': JSX_SAVED, '__t156s.html': HTML('__t156s.jsx') } });
  const br = await chromium.launch();
  /* opts: vendors (mảng cho /match), byId (id => vendor|null|'500'), blockUrls (mảng stem bị abort), requests (mảng ghi lại URL ảnh đã yêu cầu) */
  const open = async (file, query, { vendors = [], byId = {}, blockStems = [], saved = null, requests = [] } = {}) => {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
    if (saved) await ctx.addInitScript(([s]) => { localStorage.setItem('th_vendors_t156', s); }, [JSON.stringify(saved)]);
    const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
    await pg.route(/^https:\/\/(lh3\.googleusercontent\.com|www\.marry\.vn)\//, (r) => {
      const u = r.request().url(); requests.push(u);
      if (blockStems.some((s) => u.includes(s))) return r.abort();
      return r.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    });
    await pg.route('http://localhost:8787/**', async (r) => {
      const m = r.request().method(), u = new URL(r.request().url());
      if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
      const j = (o, status = 200) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(o) });
      if (u.pathname === '/api/vendors/match') return j({ vendors: vendors.map(withMatch), total: vendors.length, offset: 0, whyThoseVendors: null });
      if (u.pathname === '/api/vendors/status' && m === 'POST') { const o = {}; let ids = []; try { ids = JSON.parse(r.request().postData() || '{}').ids || []; } catch (e) { /* */ } for (const id of ids) { const v = byId[id]; o[id] = v && typeof v === 'object' ? { hidden: false, price_source: 'estimated', priceMin: v.priceMin, priceMax: v.priceMax } : null; } return j({ vendors: o }); }
      const x = u.pathname.match(/^\/api\/vendors\/([^/]+)$/);
      if (x && m === 'GET' && !['match', 'categories', 'status'].includes(x[1])) {
        const v = byId[x[1]] !== undefined ? byId[x[1]] : vendors.find((q) => q.id === x[1]);
        if (v === '500') return j({ error: 'x' }, 500);
        return v ? j({ vendor: v, match: { totalScore: 80, scoreBreakdown: {}, reasons: [], whyThisVendor: 'x' } }) : j({}, 404);
      }
      if (u.pathname === '/api/couples/t156/budget') return j({ total_tr: 100, guests: 100, categories: [{ id: 'photography', name: 'Chụp ảnh', allocated_tr: 20, pct: 20, items: [] }] });
      return j({}, 404);
    });
    await pg.goto(`http://127.0.0.1:${dev.port}/${file}${query || ''}`, { waitUntil: 'domcontentloaded' });
    return pg;
  };
  return { open, probe: (pg, a) => pg.evaluate(probeFn, a), inDom: (pg, a) => pg.evaluate(urlInDomFn, a), dev, br,
    async stop() { try { await br.close(); } catch (e) { /* */ } try { await dev.stop(); } catch (e) { /* */ } } };
}
const mkSaved = (v, catId = 'photography') => ({ id: v.id, name: v.name, priceTotal: v.priceMin || 10, priceUnit: 'gói', grad: 'linear-gradient(#ccc,#ddd)', gallery: (v.photos || []).map((p) => `center/cover no-repeat url("${p.url}")`).concat(v.photos?.length ? [] : ['linear-gradient(#ccc,#ddd)']), spec: 'x', rating: 4, rv: 1, match: 80, location: 'HCMC' });
const savedDoc = (list) => ({ photography: { shortlisted: list, confirmed: null } });
function reporter(label) {
  const fails = [];
  const bad = (m) => { if (!fails.includes(m)) fails.push(m); };
  const check = (name, ok, extra) => { if (process.env.T156_VERBOSE) console.log(`${ok ? '  ok ' : '  XX '} ${name}${!ok && extra ? ' :: ' + extra : ''}`); if (!ok) bad(`${name}${extra ? ' [' + String(extra).slice(0, 160) + ']' : ''}`); };
  const finish = () => {
    if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); if (process.env.T156_ALL) console.log(fails.map((f) => '  - ' + f).join('\n')); process.exit(1); }
    console.log('PASS'); process.exit(0);
  };
  return { fails, bad, check, finish };
}
module.exports = { repoArgs, loadPool, buildSets, startApp, probeFn, urlInDomFn, textIn, mkSaved, savedDoc, reporter, stem, isG, hasAttr, withMatch, SENT, CORS, PNG, HQ };
