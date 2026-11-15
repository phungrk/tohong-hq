#!/usr/bin/env node
/* T-178 tiêu chí 4 (tohong-front): chip lý do theo bàn có tổng ("≈ 3.9tr/bàn × 360 bàn = 1404tr") hiện NGUYÊN VĂN, trọn vẹn và trên MỘT dòng trong thẻ chat danh sách vendor (VMatchChatCard, dải "Tơ Hồng gợi ý")
 * ở khung 360px: không bị cắt (…), không tràn khỏi thẻ, không đẩy trang rộng quá 360px, không ngắt chữ giữa chip; front không tự tính lại số (chip lạ vẫn in y nguyên).
 * Khung theo eval/T-167/check_4_dong_front.cjs (vite dev + Playwright, API giả, không mạng ngoài). Chạy từ gốc tohong-hq: node eval/T-178/check_4_chip_front_360.cjs [--repo <tohong-front>] · Biến: TOHONG_FRONT_REPO, PLAYWRIGHT_PATH. */
const fs = require('fs'), path = require('path'), { createRequire } = require('module');
const A = process.argv.slice(2), arg = (k) => (A.includes(k) ? A[A.indexOf(k) + 1] : null);
const REPO = path.resolve(arg('--repo') || process.env.TOHONG_FRONT_REPO || path.join(__dirname, '..', '..', '..', 'tohong-front'));
if (!fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu repo tohong-front (--repo hoặc TOHONG_FRONT_REPO)'); process.exit(2); }
let chromium; for (const t of [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean)) { try { ({ chromium } = createRequire(path.join(REPO, 'x.js'))(t)); break; } catch (e) { /* thử tiếp */ } }
if (!chromium) { console.log('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)'); process.exit(2); }
const { startViteDev } = require(path.join(__dirname, '..', '_lib', 'vite_dev.cjs'));
const fails = []; const bad = (m) => { if (!fails.includes(m)) fails.push(m); };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const R = (label, icon = 'wallet') => ({ icon, label });
// Mỗi vendor: hai chip đầu là hai chip thẻ chat hiện (slice(0,2)); chip lý do lấy y nguyên từ back.
const CASES = [
  ['Alpha', [R('≈ 3tr/bàn × 20 bàn = 60tr'), R('Đủ 200 khách', 'users')]],
  ['Beta', [R('Hợp gu Hiện đại tối giản', 'palette'), R('≈ 12.5tr/bàn × 360 bàn = 4500tr')]],            // chip dài nhất có thể, đứng sau một chip dài
  ['Gamma', [R('≈ 3.9tr/bàn × 360 bàn = 1404tr'), R('Còn lịch 31.12', 'calendar-check')]],
  ['Delta', [R('≈ 4.3tr/bàn × 33 bàn = 999.9tr'), R('Đánh giá cao (4.9★)', 'star')]],                        // front không tính lại: 4.3 x 33 != 999.9 vẫn in y nguyên
];
const V = (n, reasons, i) => ({ id: 't178_' + i, name: n + ' Hall', category: 'venue', priceMin: 3.9, priceMax: 3.9, rating: 4.5, reviewCount: 3, city: 'HCMC', tags: ['modern'], photos: [], price_source: 'estimated', price_basis: 'legacy_marry', price_as_of: '2026-06', price_label: 'Giá marry.vn · 06/2026',
  match: { totalScore: 78, scoreBreakdown: { budget: 1, style: 0.5, availability: 1 }, reasons } });
const VENDORS = CASES.map(([n, rs], i) => V(n, rs, i + 1));
const HTML = (f) => `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/${f}"></script></body></html>`;
const JSX_A = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ChatActionsCtx, VMatchChatCard } from '/src/screens/chat/VendorChatCards.jsx';
function App() {
  return <VendorProvider coupleId="t178"><ChatActionsCtx.Provider value={{ pushUser: () => {}, pushAI: () => {} }}>
    <div id="cards" style={{ width: 360 }}><div data-card="0"><VMatchChatCard catId="venue" /></div></div>
  </ChatActionsCtx.Provider></VendorProvider>;
}
createRoot(document.getElementById('root')).render(<App />);
`;
let dev, br;
(async () => {
  dev = await startViteDev({ repo: REPO, files: { '__t178a.jsx': JSX_A, '__t178a.html': HTML('__t178a.jsx') } });
  br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 360, height: 900 } });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.route(/marry\.vn/, (r) => r.abort());
  await pg.route('http://localhost:8787/**', async (r) => {
    const m = r.request().method(), u = new URL(r.request().url());
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    const j = (o, status = 200) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.pathname === '/api/vendors/match') return j({ vendors: VENDORS, total: VENDORS.length, offset: 0, whyThoseVendors: null });
    if (u.pathname === '/api/vendors/status' && m === 'POST') return j({ vendors: {} });
    if (u.pathname === '/api/couples/t178/budget') return j({ total_tr: 200, guests: 200, categories: [] });
    return j({}, 404);
  });
  try {
    await pg.goto(`http://127.0.0.1:${dev.port}/__t178a.html`, { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => document.body.innerText.includes('Alpha Hall'), null, { timeout: 15000 });
    await pg.waitForTimeout(600);
    for (const [n, rs] of CASES) {
      const chipText = rs[0].icon === 'wallet' ? rs[0].label : rs[1].label;
      const r = await pg.evaluate(([chipText]) => {
        const card = document.querySelector('[data-card="0"]'); const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
        const eq = [...card.querySelectorAll('*')].filter((e) => norm(e.innerText) === chipText); const hits = eq.filter((e) => !eq.some((o) => o !== e && e.contains(o)));
        const el = hits[0]; if (!el) return { n: 0 };
        const b = el.getBoundingClientRect(), cs = getComputedStyle(el), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
        let clipped = el.scrollWidth > el.clientWidth + 1; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o !== 'visible' && p.scrollWidth > p.clientWidth + 1) clipped = true; }
        return { n: hits.length, right: b.right, left: b.left, lines: Math.round(b.height / lh * 10) / 10, ellipsis: cs.textOverflow === 'ellipsis', clipped, bodyW: document.documentElement.scrollWidth, undef: /undefined|NaN/.test(card.innerText) };
      }, [chipText]);
      if (r.n !== 1) { bad(`${n}: chip "${chipText}" phải hiện nguyên văn đúng một lần ở thẻ chat, thấy ${r.n} phần tử`); continue; }
      if (r.right > 360.5 || r.left < -0.5) bad(`${n}: chip tràn khỏi khung 360px (left ${Math.round(r.left)}, right ${Math.round(r.right)})`);
      if (r.clipped || r.ellipsis) bad(`${n}: chip bị cắt (scroll/ellipsis)`);
      if (r.lines > 1.9) bad(`${n}: chip ngắt xuống ${r.lines} dòng trong một pill (phải gọn một dòng)`);
      if (r.bodyW > 361) bad(`${n}: trang rộng ${r.bodyW}px > 360px`);
      if (r.undef) bad(`${n}: thẻ có chữ undefined/NaN`);
    }
  } catch (e) { bad('lỗi chạy ' + String(e.message).split('\n')[0]); }
  await ctx.close();
})().catch((e) => bad('lỗi khung chạy: ' + String(e.message).split('\n')[0])).finally(async () => {
  try { br && await br.close(); } catch (e) { /* */ } try { dev && await dev.stop(); } catch (e) { /* */ }
  if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); if (process.env.T178_ALL) console.log(fails.map((f) => '  - ' + f).join('\n')); process.exit(1); }
  console.log('PASS'); process.exit(0);
});
