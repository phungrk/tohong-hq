/* Bất biến (planner/front/budget, front) · Ghi lại dự toán (Thử lại hoặc tự lưu sau lỗi) KHÔNG xoá hay thay khoản do một lần ghi khác đã lưu mà người dùng không đụng tới,
 * và không để số người dùng chỉnh biến mất im lặng. Nguồn: T-174 adversary (adv-02, adv-03, adv-11), spec T-171 v3.1 H5, ADR-104.
 * Khung tự đủ (không phụ thuộc eval/T-171, eval/T-174): vite dev qua helper eval/_lib/vite_dev.cjs (gốc HQ dò ngược tới scripts/gate.py), Playwright,
 * màn Ngân sách thật nối VendorProvider như App.jsx (onBudgetSync -> refreshKey), server giả lưu NGUYÊN tài liệu dự toán (cả items). Chỉ đo chữ người dùng thấy và body lệnh ghi.
 * Ca A: lưu 90 -> 40 lỗi; Chốt vendor (khoản vendor_inv_a ghi xen thành công) nhưng lần tải lại màn đứt mạng; mạng tốt, Thử lại -> server 40 VÀ còn vendor_inv_a.
 * Ca B: lưu 90 -> 40 lỗi; Chốt vendor (màn tải lại được); lần ghi khác đổi TÊN khoản vendor_inv_a thành "Alpha Hall (đã cọc)" (không tải lại); Thử lại -> server 40, tên giữ.
 *   (Không dùng số tiền: amt của khoản vendor đang chốt do màn tính theo số bàn — INV-001/003 planner/front/budget.)
 * Ca C: lưu 90 -> 40 lỗi; Chốt vendor, màn tải lại được -> hoặc server 40, hoặc thanh còn 40 kèm "Chưa lưu được dự toán" (số 40 không mất im lặng).
 * Biến: TOHONG_FRONT_REPO (hoặc --repo; mặc định <gốc HQ>/../tohong-front), PLAYWRIGHT_PATH. */
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/__invbud.jsx"></script></body></html>`;
const JSX = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ScreenBudget } from '/src/screens/Budget.jsx';
function App() {
  const [rk, setRk] = React.useState(0);
  return <VendorProvider coupleId="inv" onBudgetSync={() => setRk((n) => n + 1)}>
    <div style={{ width: 360 }}><ScreenBudget me={{ status: 'ok', retry: () => {} }} coupleId="inv" refreshKey={rk} openCatId="venue" onOpenCat={() => {}} onCatMissing={() => {}} onOpenVendorChat={() => {}} onMenuOpen={() => {}} onOpenAI={() => {}} /></div>
  </VendorProvider>;
}
createRoot(document.getElementById('root')).render(<App />);
`;
const VENDOR = { id: 'inv_a', name: 'Alpha Hall', category: 'venue', priceMin: 3.9, priceMax: 3.9, price: 3.9, priceTotal: 3.9, priceSource: 'estimated', spec: '' };

async function page(br, dev) {
  const D = { doc: { total_tr: 200, guests: 200, mung_tr: 0, categories: [
    { id: 'venue', name: 'Nhà hàng tiệc cưới', allocated_tr: 90, items: [] }, { id: 'reserve', name: 'Dự phòng', allocated_tr: 110, items: [] }] },
    putFail: null, failGetsAfterPut: null, puts: [] };
  const ctx = await br.newContext({ viewport: { width: 360, height: 900 } });
  await ctx.addInitScript((v) => { localStorage.setItem('th_vendors_inv', JSON.stringify({ venue: { shortlisted: [v], confirmed: null } })); }, VENDOR);
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.route(/marry\.vn/, (r) => r.abort());
  await pg.route('http://localhost:8787/**', async (r) => {
    const m = r.request().method(), p = new URL(r.request().url()).pathname;
    const j = (o, status = 200) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(o) });
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    if (p === '/api/couples/inv/budget') {
      if (m === 'GET') { if (D.failGetsAfterPut != null && D.puts.length > D.failGetsAfterPut) return r.abort(); return j(D.doc); }
      if (m === 'PUT') {
        const b = JSON.parse(r.request().postData() || '{}'); D.puts.push(b);
        if (D.putFail) return j({ error: 'boom' }, 500);
        D.doc = JSON.parse(JSON.stringify({ total_tr: b.total_tr, guests: b.guests, mung_tr: b.mung_tr, categories: b.categories.map((c) => ({ ...c, items: c.items || [] })) }));
        return j(D.doc);
      }
    }
    if (p === '/api/vendors/status' && m === 'POST') return j({ vendors: {} });
    return j({}, 404);
  });
  await pg.goto(`http://127.0.0.1:${dev.port}/__invbud.html`, { waitUntil: 'domcontentloaded' });
  await pg.getByRole('slider', { name: 'Dự toán' }).waitFor({ timeout: 15000 });
  await pg.getByText('Alpha Hall').first().waitFor({ timeout: 8000 });
  return { ctx, pg, D };
}
const venue = (D) => D.doc.categories.find((c) => c.id === 'venue');
const itemOf = (D) => (venue(D).items || []).find((x) => x.id === 'vendor_inv_a');
async function dragTo(pg, to) {
  const sl = pg.getByRole('slider', { name: 'Dự toán' }); await sl.focus();
  for (let i = 0; i < 200; i++) { const now = Number(await sl.getAttribute('aria-valuenow')); if (now === to) break; await pg.keyboard.press(now > to ? 'ArrowLeft' : 'ArrowRight'); }
}
const waitFor = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(100); } return false; };

(async () => {
  const fails = []; const bad = (m) => fails.push(m);
  let dev, br;
  try {
    dev = await startViteDev({ repo: REPO, files: { '__invbud.jsx': JSX, '__invbud.html': HTML } });
    br = await chromium.launch();
    for (const ca of ['A', 'B', 'C']) {
      const { ctx, pg, D } = await page(br, dev);
      const body = () => pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
      const banner = async () => /Chưa lưu được dự toán/.test(await body());
      D.putFail = '500'; await dragTo(pg, 40);
      if (!(await waitFor(banner))) { bad(`[${ca}] lưu lỗi phải hiện "Chưa lưu được dự toán" (tiền đề của bất biến)`); await ctx.close(); continue; }
      D.putFail = null; const p0 = D.puts.length;
      if (ca === 'A') D.failGetsAfterPut = p0;
      await pg.getByRole('button', { name: 'Chốt', exact: true }).first().click();
      await waitFor(async () => !!itemOf(D)); await sleep(1500);
      if (!itemOf(D)) { bad(`[${ca}] khung: chốt vendor phải ghi khoản vendor_inv_a`); await ctx.close(); continue; }
      if (ca === 'A') D.failGetsAfterPut = null;
      if (ca === 'B') itemOf(D).name = 'Alpha Hall (đã cọc)'; // lần ghi khác (server) đổi khoản, màn không tải lại
      if (ca === 'C') {
        const sl = Number(await pg.getByRole('slider', { name: 'Dự toán' }).getAttribute('aria-valuenow'));
        if (venue(D).allocated_tr !== 40 && !(sl === 40 && await banner())) bad(`[C] số 40 mất im lặng sau khi màn tải lại: server ${venue(D).allocated_tr}, thanh ${sl}, câu báo ${await banner() ? 'còn' : 'không'}`);
        await ctx.close(); continue;
      }
      const retry = pg.getByRole('button', { name: 'Thử lại' }).first();
      if (await retry.isVisible().catch(() => false)) { await retry.click(); await waitFor(async () => !(await banner())); await sleep(800); }
      const it = itemOf(D);
      if (!it) bad(`[${ca}] ghi lại dự toán đã XOÁ khoản vendor_inv_a do lần ghi khác đã lưu (items ${JSON.stringify((venue(D).items || []).map((x) => x.id))})`);
      else if (ca === 'B' && it.name !== 'Alpha Hall (đã cọc)') bad(`[B] ghi lại dự toán đã THAY khoản vendor_inv_a của lần ghi khác (tên server "Alpha Hall (đã cọc)" -> "${it.name}") dù người dùng không đụng`);
      if (venue(D).allocated_tr !== 40) bad(`[${ca}] ghi lại phải lưu số người dùng chỉnh (40), server ${venue(D).allocated_tr}`);
      await ctx.close();
    }
  } catch (e) { bad('lỗi chạy ' + String(e.message).split('\n')[0]); }
  try { br && await br.close(); } catch (e) { /* */ } try { dev && await dev.stop(); } catch (e) { /* */ }
  if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
