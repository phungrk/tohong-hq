/* Khung chép từ eval/T-171/_lib.cjs (T-171 v2, qua Spec Gate 2026-11-15), chỉ đổi cách tìm gốc HQ; dùng riêng cho bất biến the-ghep-khong-hien-diem-cu.
 * Nội dung gốc: */
/* T-171 khung dùng chung cho 5 eval front (Playwright + vite dev, theo eval/T-167/check_4_dong_front.cjs).
 * API giả CÓ TRẠNG THÁI: dự toán hạng mục venue, số khách, và mọi lệnh ghi (PUT budget, PATCH hồ sơ) đổi trạng thái đó; GET match/chi tiết tính điểm từ trạng thái theo đúng luật cũ
 * (tổng <= ngân sách hạng mục -> 1; vượt > 20% -> 0; giữa: 1 - vượt/0,2). Eval đo CHỮ NGƯỜI DÙNG THẤY và số lần gọi API; không đọc tên hàm/state của front.
 * Màn thật: ScreenBudget (mở hạng mục Nhà hàng tiệc cưới, kéo thanh "Dự toán" bằng bàn phím = đường lưu thật của front) + VMatchChatCard cùng một VendorProvider, hai khung bật/tắt bằng display như App.
 * Biến: TOHONG_FRONT_REPO (mặc định ../tohong-front), PLAYWRIGHT_PATH. */
const fs = require('fs'), path = require('path'), { createRequire } = require('module');
const A = process.argv.slice(2), arg = (k) => (A.includes(k) ? A[A.indexOf(k) + 1] : null);
/* gốc tohong-hq: dò ngược tới scripts/gate.py (không đếm cấp; INV-004 _shared), để file chạy đúng cả ở eval/T-171/bat-bien-cho-merge/lib/ lẫn trong bể. */
const HQ_DIR = (() => { let d = __dirname; for (;;) { if (fs.existsSync(path.join(d, 'scripts', 'gate.py'))) return d; const u = path.dirname(d); if (u === d) return null; d = u; } })();
if (!HQ_DIR) { console.log('FAIL không tìm thấy gốc tohong-hq (scripts/gate.py)'); process.exit(2); }
const REPO = path.resolve(arg('--repo') || process.env.TOHONG_FRONT_REPO || path.join(HQ_DIR, '..', 'tohong-front'));
const out = (s, code) => { console.log(s); process.exit(code); };
if (!fs.existsSync(path.join(REPO, 'package.json'))) out('FAIL thiếu repo tohong-front (--repo hoặc TOHONG_FRONT_REPO)', 2);
let chromium; for (const t of [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean)) { try { ({ chromium } = createRequire(path.join(REPO, 'x.js'))(t)); break; } catch (e) { /* thử tiếp */ } }
if (!chromium) out('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)', 2);
const { startViteDev } = require(path.join(HQ_DIR, 'eval', '_lib', 'vite_dev.cjs'));
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r1 = (x) => Math.round(x * 10) / 10;
const fmt = (x) => String(r1(x)).replace('.', ',');

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__t171.jsx"></script></body></html>`;
const JSX = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ScreenBudget } from '/src/screens/Budget.jsx';
import { api } from '/src/api.js';
import { ChatActionsCtx, VMatchChatCard } from '/src/screens/chat/VendorChatCards.jsx';
window.__t171api = api;
function App() {
  const [tab, setTab] = React.useState('chat');
  const [cards, setCards] = React.useState([{ k: 0, C: VMatchChatCard, p: { catId: 'venue' } }]);
  const push = (C, p) => setCards((c) => [...c, { k: c.length, C, p }]);
  return <VendorProvider coupleId="t171"><ChatActionsCtx.Provider value={{ pushUser: () => {}, pushAI: push }}>
    <button id="go-chat" onClick={() => setTab('chat')}>go-chat</button><button id="go-budget" onClick={() => setTab('budget')}>go-budget</button>
    <div id="chatPane" style={{ width: 360, display: tab === 'chat' ? 'block' : 'none' }}>{cards.map((c) => <div key={c.k} data-card={c.k}><c.C {...c.p} /></div>)}</div>
    <div id="budgetPane" style={{ width: 360, display: tab === 'budget' ? 'block' : 'none' }}>
      <ScreenBudget me={{ status: 'ok', retry: () => {} }} coupleId="t171" openCatId="venue" onOpenCat={() => {}} onCatMissing={() => {}} onOpenVendorChat={() => {}} onMenuOpen={() => {}} onOpenAI={() => {}} />
    </div>
  </ChatActionsCtx.Provider></VendorProvider>;
}
createRoot(document.getElementById('root')).render(<App />);
`;

/* Trạng thái server giả. Alpha: 3,9tr/bàn; Beta: 2tr/bàn. Số khách 200 -> 20 bàn: Alpha 78tr, Beta 40tr.
 * Alpha: tổng điểm = 70 + 30 x điểm ngân sách (100 ở 90tr, 70 ở 40tr). Beta: 80 cố định. => đổi 90 -> 40 làm Alpha tụt xuống sau Beta. */
function newServer() {
  const S = { venue: 90, guests: 200, totalTr: 200, putFail: null, patchFail: false, delayMatchMs: 0, calls: { match: 0, detail: 0, put: 0, patch: 0, budgetGet: 0 }, puts: [] };
  const score = (price) => {
    const tables = Math.ceil(S.guests / 10), total = r1(price * tables), cat = S.venue;
    const b = total <= cat ? 1 : total > cat * 1.2 ? 0 : 1 - (total / cat - 1) / 0.2;
    return { tables, total, cat, b, text: `≈ ${fmt(price)}tr/bàn × ${tables} bàn = ${fmt(total)}tr so với ${cat}tr tiệc cưới` };
  };
  const V = (id, name, price, totalOf) => {
    const s = score(price);
    return { id, name, category: 'venue', priceMin: price, priceMax: price, rating: 4.5, reviewCount: 3, city: 'HCMC', tags: ['modern'], photos: [], price_source: 'estimated', price_basis: 'legacy_marry', price_as_of: '2026-06', price_label: 'Giá marry.vn · 06/2026',
      match: { totalScore: totalOf(s.b), scoreBreakdown: { budget: s.b, style: 0.5, availability: 1 }, reasons: [], budgetBasis: { kind: 'per_table', text: s.text } } };
  };
  S.vendors = () => [V('t171_a', 'Alpha Hall', 3.9, (b) => Math.round(70 + 30 * b)), V('t171_b', 'Beta Hall', 2, () => 80)].sort((x, y) => y.match.totalScore - x.match.totalScore);
  S.budgetDoc = () => ({ total_tr: S.totalTr, guests: S.guests, mung_tr: 0, categories: [
    { id: 'venue', name: 'Nhà hàng tiệc cưới', allocated_tr: S.venue, items: [] }, { id: 'reserve', name: 'Dự phòng', allocated_tr: Math.max(0, S.totalTr - S.venue), items: [] }] });
  return S;
}

async function mount(br, S, { width = 360, ctx: c0 } = {}) {
  const ctx = c0 || await br.newContext({ viewport: { width, height: 900 } });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.route(/marry\.vn/, (r) => r.abort());
  await pg.route('http://localhost:8787/**', async (r) => {
    const m = r.request().method(), u = new URL(r.request().url());
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    const j = (o, status = 200) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(o) });
    const p = u.pathname;
    if (p === '/api/vendors/match') { const idx = S.calls.match++; const vs = S.vendors(); const dl = S.matchDelays ? (S.matchDelays[idx] || 0) : S.delayMatchMs; if (dl) await sleep(dl); if (S.matchFail) return j({ error: 'boom' }, 500); return j({ vendors: vs, total: vs.length, offset: 0, whyThoseVendors: null }); }
    if (p === '/api/vendors/status' && m === 'POST') return j({ vendors: {} });
    const x = p.match(/^\/api\/vendors\/([^/]+)$/);
    if (x && m === 'GET' && !['match', 'categories', 'status'].includes(x[1])) { let idx = -1; if (u.searchParams.get('coupleId')) idx = S.calls.detail++; const q = S.vendors().find((e) => e.id === x[1]); const dl = S.detailDelays && idx >= 0 ? (S.detailDelays[idx] || 0) : 0; if (dl) await sleep(dl); if (S.detailFail && idx >= 0 && S.detailFailFrom != null && idx >= S.detailFailFrom) return j({ error: 'boom' }, 500); return q ? j({ vendor: q, match: { ...q.match, whyThisVendor: 'x' } }) : j({}, 404); }
    if (p === '/api/couples/t171/budget') {
      if (m === 'GET') { S.calls.budgetGet++; return j(S.budgetDoc()); }
      if (m === 'PUT') {
        S.calls.put++; const body = JSON.parse(r.request().postData() || '{}'); S.puts.push(body);
        if (S.putFail === 'abort') return r.abort();
        if (S.putFail) return j({ error: 'boom' }, 500);
        const v = (body.categories || []).find((c) => c.id === 'venue'); if (v) S.venue = Number(v.allocated_tr);
        if (typeof body.guests === 'number') S.guests = body.guests; if (typeof body.total_tr === 'number') S.totalTr = body.total_tr;
        return j(S.budgetDoc());
      }
    }
    if (p === '/api/me') return j({ couples: [{ couple_id: 't171', role: 'owner' }] });
    if (p === '/api/couples/t171/conversations') return j({ conversations: [] });
    if (p === '/api/couples/t171/chat' && m === 'POST') { // SSE: chat action update_profile thành công, server ghi số khách 300 (như actionExecutor ở back)
      S.calls.chat = (S.calls.chat || 0) + 1; if (S.chatGuests) S.guests = S.chatGuests;
      const ev = (n, d) => `event: ${n}\ndata: ${JSON.stringify(d)}\n\n`;
      return r.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/event-stream' }, body: ev('conversation', { id: 'c1' }) + ev('chunk', { text: 'Đã ghi 300 khách.' }) + ev('action', { type: 'update_profile', success: true }) + ev('done', {}) });
    }
    if (p === '/api/couples/t171' && m === 'PATCH') {
      S.calls.patch++; if (S.patchFail) return j({ error: 'boom' }, 500);
      const body = JSON.parse(r.request().postData() || '{}'); const g = body?.couple?.guest_count ?? body?.guest_count; if (typeof g === 'number') S.guests = g; return j({ id: 't171' });
    }
    return j({}, 404);
  });
  return { ctx, pg };
}
const openApp = async (dev, br, S) => { // App thật (Root), hồ sơ cục bộ có sẵn để bỏ onboarding
  const ctx = await br.newContext({ viewport: { width: 390, height: 800 } }); await ctx.addInitScript(() => { localStorage.setItem('th_user', '{}'); });
  const { pg } = await mount(br, S, { ctx }); await pg.goto(`http://127.0.0.1:${dev.port}/#/ngan-sach/venue`); await pg.getByText('Tìm nhà hàng tiệc cưới').first().waitFor({ timeout: 15000 }); return { ctx, pg };
};
const open = async (dev, pg) => {
  await pg.goto(`http://127.0.0.1:${dev.port}/__t171.html`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.body.innerText.includes('Alpha Hall'), null, { timeout: 15000 });
  await pg.evaluate(() => { window.__noReload = 1; });
  await pg.waitForTimeout(500);
};
const goBudget = async (pg) => { await pg.click('#go-budget'); await pg.getByRole('slider', { name: 'Dự toán' }).waitFor({ timeout: 8000 }); };
const goChat = async (pg) => { await pg.click('#go-chat'); await pg.waitForTimeout(100); };
/* kéo thanh Dự toán bằng bàn phím tới đúng `to` (đường lưu thật: useBudget tự lưu sau ~800ms). */
async function dragTo(pg, to, { settleMs = 0 } = {}) {
  const sl = pg.getByRole('slider', { name: 'Dự toán' }); await sl.focus();
  for (let i = 0; i < 200; i++) {
    const now = Number(await sl.getAttribute('aria-valuenow'));
    if (now === to) break; await pg.keyboard.press(now > to ? 'ArrowLeft' : 'ArrowRight');
  }
  if (Number(await sl.getAttribute('aria-valuenow')) !== to) throw new Error('không kéo được thanh Dự toán tới ' + to);
  if (settleMs) await pg.waitForTimeout(settleMs);
}
/* chữ trong hàng/thẻ, dùng chữ nhìn thấy */
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
const cardText = (pg, k) => pg.evaluate((k) => { const c = document.querySelector(`[data-card="${k}"]`); return c ? c.innerText.replace(/\s+/g, ' ').trim() : null; }, k);
const rowOf = (pg, name) => pg.evaluate((n) => { const rows = [...document.querySelectorAll('[data-card="0"] a')].filter((a) => a.innerText.includes(n)); const t = rows.length ? rows[0].innerText.replace(/\s+/g, ' ').trim() : null; const order = [...document.querySelectorAll('[data-card="0"] a')].map((a) => (/(Alpha|Beta) Hall/.exec(a.innerText) || [])[1]).filter(Boolean); return { t, pct: t ? (/(\d+)%/.exec(t) || [])[1] : null, order: [...new Set(order)] }; }, name);
const waitText = async (pg, k, re, ms = 4000) => { const t0 = Date.now(); let t = null; while (Date.now() - t0 < ms) { t = await cardText(pg, k); if (t && re.test(t)) return t; await sleep(120); } return t; };
const openDetail = async (pg, name, k) => { await pg.locator('[data-card="0"]').getByText(name, { exact: false }).first().click(); await pg.waitForSelector(`[data-card="${k}"]`, { timeout: 5000 }); await pg.waitForTimeout(500); };

/* run(scenario): scenario({dev, br, S, mount, open, ...}) trả về mảng lỗi (chuỗi). In PASS / FAIL <lý do đầu> (+n lỗi nữa). */
async function run(scenario) {
  const fails = []; const bad = (m) => { if (!fails.includes(m)) fails.push(m); };
  let dev, br;
  try {
    dev = await startViteDev({ repo: REPO, files: { '__t171.jsx': JSX, '__t171.html': HTML } });
    br = await chromium.launch();
    await scenario({ dev, br, bad, newServer, mount, open, openApp, goBudget, goChat, dragTo, cardText, rowOf, waitText, openDetail, sleep, fmt });
  } catch (e) { bad('lỗi chạy ' + String(e.message).split('\n').slice(0, process.env.T171_ALL ? 4 : 1).join(' | ')); }
  try { br && await br.close(); } catch (e) { /* */ } try { dev && await dev.stop(); } catch (e) { /* */ }
  if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); if (process.env.T171_ALL) console.log(fails.map((f) => '  - ' + f).join('\n')); process.exit(1); }
  console.log('PASS'); process.exit(0);
}
module.exports = { run, sleep, norm };
