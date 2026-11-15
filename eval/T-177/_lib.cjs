/* T-177 khung dùng chung (Playwright + vite dev, theo eval/T-171/_lib.cjs). Không mạng ngoài: mọi yêu cầu không thuộc 127.0.0.1 / localhost:8787 bị chặn.
 * Màn thật: ScreenBudget mở thẳng một hạng mục (?cat=<id>) trong VendorProvider, khung 360px. API giả có trạng thái (GET/PUT /budget).
 * Eval chỉ đo CHỮ người dùng thấy trên nút "Tìm ...", số trên thanh "Dự toán", số lần bấm mở tìm vendor (onOpenVendorChat ghi vào window.__opened) và kích thước hộp; không đọc tên hàm/state của front.
 * Biến: TOHONG_FRONT_REPO (mặc định ../tohong-front), PLAYWRIGHT_PATH. Chạy từ gốc tohong-hq. */
const fs = require('fs'), path = require('path'), { createRequire } = require('module');
const A = process.argv.slice(2), arg = (k) => (A.includes(k) ? A[A.indexOf(k) + 1] : null);
const REPO = path.resolve(arg('--repo') || process.env.TOHONG_FRONT_REPO || path.join(__dirname, '..', '..', '..', 'tohong-front'));
const out = (s, code) => { console.log(s); process.exit(code); };
if (!fs.existsSync(path.join(REPO, 'package.json'))) out('FAIL thiếu repo tohong-front (--repo hoặc TOHONG_FRONT_REPO)', 2);
let chromium; for (const t of [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean)) { try { ({ chromium } = createRequire(path.join(REPO, 'x.js'))(t)); break; } catch (e) { /* thử tiếp */ } }
if (!chromium) out('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)', 2);
const { startViteDev } = require(path.join(__dirname, '..', '_lib', 'vite_dev.cjs'));
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (x) => String(Math.round(x * 10) / 10).replace('.', ','); // khuôn T-167 (fmtTr): làm tròn 1 chữ số, dấu phẩy, bỏ ",0", không phân cách nghìn

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__t177.jsx"></script></body></html>`;
const JSX = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ScreenBudget } from '/src/screens/Budget.jsx';
window.__opened = [];
const cat = new URLSearchParams(location.search).get('cat') || 'venue';
createRoot(document.getElementById('root')).render(
  <VendorProvider coupleId="t177"><div style={{ width: 360 }}>
    <ScreenBudget me={{ status: 'ok', retry: () => {} }} coupleId="t177" openCatId={cat} onOpenCat={() => {}} onCatMissing={() => {}} onOpenVendorChat={(id) => { window.__opened.push(id); }} onMenuOpen={() => {}} onOpenAI={() => {}} />
  </div></VendorProvider>);
`;
/* Tài liệu dự toán giả: cats = [{id,name,allocated_tr}], tổng = 1500 để thanh kéo được tới 1440. */
const mkDoc = (cats) => ({ total_tr: 1500, guests: 200, mung_tr: 0, categories: cats.map((c) => ({ items: [], ...c })) });

async function openCat(br, dev, doc, cat, { putFail = false } = {}) {
  const S = { doc, putFail, puts: [], posts: 0 };
  const ctx = await br.newContext({ viewport: { width: 360, height: 900 } });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
  await pg.route('http://localhost:8787/**', async (r) => {
    const m = r.request().method(), p = new URL(r.request().url()).pathname;
    const j = (o, status = 200) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(o) });
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    if (p === '/api/couples/t177/budget') {
      if (m === 'GET') return j(S.doc);
      if (m === 'PUT') { const b = JSON.parse(r.request().postData() || '{}'); S.puts.push(b); if (S.putFail) return j({ error: 'boom' }, 500); S.doc = { ...S.doc, ...b, categories: b.categories.map((c) => ({ ...c, items: c.items || [] })) }; return j(S.doc); }
    }
    if (m === 'POST') S.posts++;
    if (p === '/api/me') return j({ couples: [{ couple_id: 't177', role: 'owner' }] });
    return j({}, 404);
  });
  await pg.goto(`http://127.0.0.1:${dev.port}/__t177.html?cat=${cat}`, { waitUntil: 'domcontentloaded' });
  await pg.getByRole('slider', { name: 'Dự toán' }).waitFor({ timeout: 15000 });
  await pg.waitForTimeout(400);
  return { ctx, pg, S };
}
/* nút "Tìm ..." của màn: chữ nhìn thấy; phải có đúng một */
const findBtn = (pg) => pg.evaluate(() => {
  const bs = [...document.querySelectorAll('button')].filter((b) => /^\s*Tìm\s/.test(b.innerText));
  if (bs.length !== 1) return { n: bs.length };
  const b = bs[0], r = b.getBoundingClientRect();
  return { n: 1, text: b.innerText.replace(/\s+/g, ' ').trim(), scrollW: b.scrollWidth, clientW: b.clientWidth, left: r.left, right: r.right, docW: document.documentElement.scrollWidth,
    clipped: [...b.querySelectorAll('*')].some((e) => { const q = e.getBoundingClientRect(); return q.width > 0 && (q.right > r.right + 0.5 || q.left < r.left - 0.5); }) };
});
const sliderVal = async (pg) => Number(await pg.getByRole('slider', { name: 'Dự toán' }).getAttribute('aria-valuenow'));
async function dragTo(pg, to) {
  const sl = pg.getByRole('slider', { name: 'Dự toán' }); await sl.focus();
  for (let i = 0; i < 400; i++) { const now = Number(await sl.getAttribute('aria-valuenow')); if (now === to) return; await pg.keyboard.press(now > to ? 'ArrowLeft' : 'ArrowRight'); }
  throw new Error('không kéo được thanh Dự toán tới ' + to);
}
async function run(scenario) {
  const fails = []; const bad = (m) => { if (!fails.includes(m)) fails.push(m); };
  let dev, br;
  try {
    dev = await startViteDev({ repo: REPO, files: { '__t177.jsx': JSX, '__t177.html': HTML } });
    br = await chromium.launch();
    await scenario({ dev, br, bad, openCat, findBtn, sliderVal, dragTo, mkDoc, fmt, sleep });
  } catch (e) { bad('lỗi chạy ' + String(e.message).split('\n')[0]); }
  try { br && await br.close(); } catch (e) { /* */ } try { dev && await dev.stop(); } catch (e) { /* */ }
  if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); if (process.env.T177_ALL) console.log(fails.map((f) => '  - ' + f).join('\n')); process.exit(1); }
  console.log('PASS'); process.exit(0);
}
module.exports = { run };
