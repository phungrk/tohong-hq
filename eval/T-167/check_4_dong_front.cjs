#!/usr/bin/env node
/* T-167 tiêu chí 4 (tohong-front): chi tiết vendor trong thẻ chat (VMatchChatCard -> chi tiết, khối "Phân tích AI") in NGUYÊN VĂN match.budgetBasis.text ngay dưới thanh "Ngân sách"
 * (sau chữ Ngân sách NN%, trước chữ Phong cách), đúng một dòng; không tự tính lại số (text lạ chứa 117tr vẫn in y nguyên); back cũ không có budgetBasis thì không "undefined", không dòng thừa;
 * khung 360px không tràn ngang. Khung theo eval/T-164/check_5a_nhan_app_cap_doi.cjs (vite dev + Playwright, API giả, đo theo chữ nhìn thấy).
 * Chạy từ gốc tohong-hq: node eval/T-167/check_4_dong_front.cjs [--repo <tohong-front>]  · Biến: TOHONG_FRONT_REPO, PLAYWRIGHT_PATH. */
const fs = require('fs'), path = require('path'), { createRequire } = require('module');
const A = process.argv.slice(2), arg = (k) => (A.includes(k) ? A[A.indexOf(k) + 1] : null);
const REPO = path.resolve(arg('--repo') || process.env.TOHONG_FRONT_REPO || path.join(__dirname, '..', '..', '..', 'tohong-front'));
if (!fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu repo tohong-front (--repo hoặc TOHONG_FRONT_REPO)'); process.exit(2); }
let chromium; for (const t of [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean)) { try { ({ chromium } = createRequire(path.join(REPO, 'x.js'))(t)); break; } catch (e) { /* thử tiếp */ } }
if (!chromium) { console.log('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)'); process.exit(2); }
const { startViteDev } = require(path.join(__dirname, '..', '_lib', 'vite_dev.cjs'));
const fails = []; const bad = (m) => { if (!fails.includes(m)) fails.push(m); };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const T_ALPHA = '≈ 3,9tr/bàn × 20 bàn = 78tr so với 90tr tiệc cưới';
const T_BETA = 'Giá ước tính: ≈ 3,9tr/bàn × 20 bàn = 78tr so với 90tr tiệc cưới';
const T_GAMMA = '≈ 3,9tr/bàn × 30 bàn = 117tr so với 90tr tiệc cưới'; // front không được tính lại: in y nguyên dù thanh Ngân sách 0%
const T_EPS = 'Chưa có số khách nên chưa tính được tổng tiệc (giá ≈ 3,9tr/bàn) và một câu rất rất dài để thử xuống dòng ở màn hẹp 360px không bị tràn ngang';
const V = (id, name, bud, text) => ({ id, name, category: 'venue', priceMin: 3.9, priceMax: 3.9, rating: 4.5, reviewCount: 3, city: 'HCMC', tags: ['modern'], photos: [], price_source: 'estimated', price_basis: 'legacy_marry', price_as_of: '2026-06', price_label: 'Giá marry.vn · 06/2026',
  match: { totalScore: 70, scoreBreakdown: { budget: bud, style: 0.5, availability: 1 }, reasons: [], ...(text ? { budgetBasis: { kind: 'per_table', text } } : {}) } });
const VENDORS = [V('t167_1', 'Alpha Hall', 1, T_ALPHA), V('t167_2', 'Beta Hall', 1, T_BETA), V('t167_3', 'Gamma Hall', 0, T_GAMMA), V('t167_4', 'Delta Hall', 0.5, null), V('t167_5', 'Epsilon Hall', 0.5, T_EPS)];
const HTML = (f) => `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/${f}"></script></body></html>`;
const JSX_A = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ChatActionsCtx, VMatchChatCard } from '/src/screens/chat/VendorChatCards.jsx';
function App() {
  const [cards, setCards] = React.useState([{ k: 0, C: VMatchChatCard, p: { catId: 'venue' } }]);
  const push = (C, p) => setCards(c => [...c, { k: c.length, C, p }]);
  return <VendorProvider coupleId="t167"><ChatActionsCtx.Provider value={{ pushUser: () => {}, pushAI: push }}>
    <div id="cards" style={{ width: 360 }}>{cards.map(c => <div key={c.k} data-card={c.k}><c.C {...c.p} /></div>)}</div>
  </ChatActionsCtx.Provider></VendorProvider>;
}
createRoot(document.getElementById('root')).render(<App />);
`;
let dev, br;
(async () => {
  dev = await startViteDev({ repo: REPO, files: { '__t167a.jsx': JSX_A, '__t167a.html': HTML('__t167a.jsx') } });
  br = await chromium.launch();
  for (const v of VENDORS) {
    const n = v.name.split(' ')[0];
    const ctx = await br.newContext({ viewport: { width: 360, height: 800 } });
    const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
    await pg.route(/marry\.vn/, (r) => r.abort());
    await pg.route('http://localhost:8787/**', async (r) => {
      const m = r.request().method(), u = new URL(r.request().url());
      if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
      const j = (o, status = 200) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(o) });
      if (u.pathname === '/api/vendors/match') return j({ vendors: VENDORS, total: VENDORS.length, offset: 0, whyThoseVendors: null });
      if (u.pathname === '/api/vendors/status' && m === 'POST') return j({ vendors: {} });
      const x = u.pathname.match(/^\/api\/vendors\/([^/]+)$/);
      if (x && m === 'GET' && !['match', 'categories', 'status'].includes(x[1])) { const q = VENDORS.find((e) => e.id === x[1]); return q ? j({ vendor: q, match: { ...q.match, whyThisVendor: 'x' } }) : j({}, 404); }
      if (u.pathname === '/api/couples/t167/budget') return j({ total_tr: 200, guests: 200, categories: [] });
      return j({}, 404);
    });
    try {
      await pg.goto(`http://127.0.0.1:${dev.port}/__t167a.html`, { waitUntil: 'domcontentloaded' });
      await pg.waitForFunction(() => document.body.innerText.includes('Alpha Hall'), null, { timeout: 15000 });
      await pg.locator('[data-card="0"]').getByText(n + ' Hall', { exact: false }).first().click({ timeout: 5000 });
      await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(600);
      const r = await pg.evaluate(([want]) => {
        const card = document.querySelector('[data-card="1"]'); const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
        const all = [...card.querySelectorAll('*')];
        // khối Phân tích AI = tổ tiên nhỏ nhất của chữ "Ngân sách" có chứa "Phân tích AI"
        const lab = all.find((e) => e.children.length === 0 && norm(e.innerText) === 'Ngân sách');
        let blk = lab; while (blk && blk !== card && !norm(blk.innerText).includes('Phân tích AI')) blk = blk.parentElement;
        const t = blk ? norm(blk.innerText) : '';
        const i = t.indexOf('Ngân sách'), k = t.indexOf('Phong cách');
        const slice = i >= 0 && k > i ? t.slice(i, k).trim() : null;
        const eq = want ? all.filter((e) => norm(e.innerText) === want) : []; const hits = eq.filter((e) => !eq.some((o) => o !== e && e.contains(o)));  // phần tử trong cùng, bỏ lớp bọc
        const leaf = hits.length ? hits[hits.length - 1] : null;
        const bodyW = document.documentElement.scrollWidth;
        return { slice, nHits: hits.length, over: leaf ? leaf.scrollWidth > leaf.clientWidth + 1 || leaf.getBoundingClientRect().right > 360.5 : null, bodyW, undef: /undefined|null|NaN/.test(card.innerText) };
      }, [v.match.budgetBasis ? v.match.budgetBasis.text : null]);
      if (r.slice === null) { bad(`${n}: không thấy khối Phân tích AI với thanh "Ngân sách" trong chi tiết`); }
      else if (v.match.budgetBasis) {
        const want = v.match.budgetBasis.text;
        if (r.slice.replace(/^Ngân sách\s*\d+%\s*/, '') !== want) bad(`${n}: dưới thanh Ngân sách phải là đúng nguyên văn "${want}", thấy "${r.slice}"`);
        if (r.nHits !== 1) bad(`${n}: câu phải xuất hiện đúng một dòng, thấy ${r.nHits} phần tử`);
        if (r.over) bad(`${n}: dòng phép so tràn ngang ở 360px`);
      } else if (!/^Ngân sách\s*\d+%$/.test(r.slice)) bad(`${n}: back cũ không có budgetBasis => dưới thanh Ngân sách không có gì thêm, thấy "${r.slice}"`);
      if (r.undef) bad(`${n}: chi tiết có chữ undefined/null/NaN`);
      if (r.bodyW > 361) bad(`${n}: trang rộng ${r.bodyW}px > 360px (tràn ngang)`);
    } catch (e) { bad(`${n}: lỗi chạy ` + String(e.message).split('\n')[0]); }
    await ctx.close();
  }
})().catch((e) => bad('lỗi khung chạy: ' + String(e.message).split('\n')[0])).finally(async () => {
  try { br && await br.close(); } catch (e) { /* */ } try { dev && await dev.stop(); } catch (e) { /* */ }
  if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); if (process.env.T167_ALL) console.log(fails.map((f) => '  - ' + f).join('\n')); process.exit(1); }
  console.log('PASS'); process.exit(0);
});
