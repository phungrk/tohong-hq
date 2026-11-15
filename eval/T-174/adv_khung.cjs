/* T-174 adversary · khung cho eval đối kháng adv-02/adv-03 (tohong-front): màn Ngân sách thật nối với VendorProvider ĐÚNG như App.jsx
 * (onBudgetSync -> refreshKey của ScreenBudget, App.jsx:387-392), để dựng ca "lưu dự toán lỗi rồi chốt vendor (syncBudgetItem ghi xen) rồi Thử lại".
 * Server giả lưu NGUYÊN tài liệu dự toán (cả items), để thấy khoản bị đè. Dùng lại _lib.cjs của T-171 (run/mount: playwright, route API giả) và
 * eval/_lib/vite_dev.cjs (helper vite dev bắt buộc). Không đọc mã nguồn front; chỉ chữ người dùng thấy + body các lệnh ghi.
 * Biến: TOHONG_FRONT_REPO (mặc định ../tohong-front), PLAYWRIGHT_PATH. */
const path = require('path');
const A = process.argv.slice(2), arg = (k) => (A.includes(k) ? A[A.indexOf(k) + 1] : null);
const REPO = path.resolve(arg('--repo') || process.env.TOHONG_FRONT_REPO || path.join(__dirname, '..', '..', '..', 'tohong-front'));
const { run, sleep } = require(path.join(__dirname, '..', 'T-171', '_lib.cjs'));
const { startViteDev } = require(path.join(__dirname, '..', '_lib', 'vite_dev.cjs'));
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/__t174adv.jsx"></script></body></html>`;
const JSX = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ScreenBudget } from '/src/screens/Budget.jsx';
function App() {
  const [rk, setRk] = React.useState(0); // như App.jsx: VendorProvider onBudgetSync -> refreshKeys.budget + 1 -> ScreenBudget refreshKey
  return <VendorProvider coupleId="t171" onBudgetSync={() => setRk((n) => n + 1)}>
    <div style={{ width: 360 }}><ScreenBudget me={{ status: 'ok', retry: () => {} }} coupleId="t171" refreshKey={rk} openCatId="venue" onOpenCat={() => {}} onCatMissing={() => {}} onOpenVendorChat={() => {}} onMenuOpen={() => {}} onOpenAI={() => {}} /></div>
  </VendorProvider>;
}
createRoot(document.getElementById('root')).render(<App />);
`;
const ALPHA = { id: 't171_a', name: 'Alpha Hall', category: 'venue', priceMin: 3.9, priceMax: 3.9, price: 3.9, priceTotal: 3.9, priceSource: 'estimated', spec: '' };

/* scenario({ pg, D, bad, body, slider, dragTo, waitFor }) ; D = trạng thái tài liệu dự toán server */
function runAdv(scenario) {
  return run(async ({ br, bad, newServer, mount, dragTo }) => {
    const dev = await startViteDev({ repo: REPO, files: { '__t174adv.jsx': JSX, '__t174adv.html': HTML } });
    try {
      const S = newServer();
      const D = { doc: { total_tr: 200, guests: 200, mung_tr: 0, categories: [
        { id: 'venue', name: 'Nhà hàng tiệc cưới', allocated_tr: 90, items: [] }, { id: 'reserve', name: 'Dự phòng', allocated_tr: 110, items: [] }] },
        putFail: null, getFail: false, failGetsAfterPut: null, gets: 0, puts: [] };
      const ctx = await br.newContext({ viewport: { width: 360, height: 900 } });
      await ctx.addInitScript((v) => { localStorage.setItem('th_vendors_t171', JSON.stringify({ venue: { shortlisted: [v], confirmed: null } })); }, ALPHA);
      const { pg } = await mount(br, S, { ctx });
      await pg.route('http://localhost:8787/api/couples/t171/budget', async (r) => { // đăng ký sau nên chạy trước route của _lib
        const m = r.request().method();
        const j = (o, status = 200) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(o) });
        if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
        if (m === 'GET') { D.gets++; if (D.getFail || (D.failGetsAfterPut != null && D.puts.length > D.failGetsAfterPut)) return r.abort(); return j(D.doc); }
        if (m === 'PUT') {
          const b = JSON.parse(r.request().postData() || '{}'); D.puts.push(b);
          if (D.putFail === 'abort') return r.abort(); if (D.putFail) return j({ error: 'boom' }, 500);
          D.doc = { total_tr: b.total_tr, guests: b.guests, mung_tr: b.mung_tr, categories: b.categories.map((c) => ({ ...c, items: c.items || [] })) };
          return j(D.doc);
        }
        return r.fallback();
      });
      await pg.goto(`http://127.0.0.1:${dev.port}/__t174adv.html`, { waitUntil: 'domcontentloaded' });
      await pg.getByRole('slider', { name: 'Dự toán' }).waitFor({ timeout: 15000 });
      await pg.getByText('Alpha Hall').first().waitFor({ timeout: 8000 });
      const body = () => pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
      const slider = async () => Number(await pg.getByRole('slider', { name: 'Dự toán' }).getAttribute('aria-valuenow'));
      const waitFor = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(100); } return false; };
      const venue = () => D.doc.categories.find((c) => c.id === 'venue');
      await scenario({ pg, D, bad, body, slider, dragTo, waitFor, venue, sleep });
      await ctx.close();
    } finally { await dev.stop(); }
  });
}
module.exports = { runAdv };
