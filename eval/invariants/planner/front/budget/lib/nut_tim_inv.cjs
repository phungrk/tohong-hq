/* Bất biến (planner/front/budget, front) · Nút "Tìm ..." ở chi tiết hạng mục (khối Vendor):
 *   (a) nếu chữ nút có số tiền "<n>tr" thì n bằng dự toán ĐANG HIỆN trên thanh "Dự toán" của hạng mục (sai lệch <= 0,05 do làm tròn), kể cả ngay sau khi kéo thanh và khi lưu lỗi;
 *       dự toán 0 / thiếu / làm tròn về 0 thì không hiện số 0 ("0tr", "0,0tr"); chữ không bao giờ có NaN, undefined, null, Infinity;
 *   (b) ở khung 360px chữ nút đọc đủ: không bị cắt (ellipsis, line-clamp, overflow ẩn ở nút hay phần tử con), không tràn khung, trang không cuộn ngang.
 * Không khoá cách viết nhãn: nhãn không có số vẫn qua (a).
 * Nguồn: T-177 (spec products/T-177-nut-tim-ghi-du-toan.md v2, qua Spec Gate 2026-11-15, spec-critic); D1 (bản cài ellipsis lọt eval v1).
 * Khung tự đủ: vite dev qua eval/_lib/vite_dev.cjs, Playwright, màn Ngân sách thật trong VendorProvider, API giả (không mạng ngoài). Chỉ đo chữ người dùng thấy và hộp.
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
const HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/__invtim.jsx"></script></body></html>`;
const JSX = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ScreenBudget } from '/src/screens/Budget.jsx';
const cat = new URLSearchParams(location.search).get('cat') || 'venue';
createRoot(document.getElementById('root')).render(
  <VendorProvider coupleId="invtim"><div style={{ width: 360 }}>
    <ScreenBudget me={{ status: 'ok', retry: () => {} }} coupleId="invtim" openCatId={cat} onOpenCat={() => {}} onCatMissing={() => {}} onOpenVendorChat={() => {}} onMenuOpen={() => {}} onOpenAI={() => {}} />
  </div></VendorProvider>);
`;
const mkDoc = (cats) => ({ total_tr: 1500, guests: 200, mung_tr: 0, categories: cats.map((c) => ({ items: [], ...c })) });

async function openCat(br, dev, doc, cat, putFail) {
  const S = { doc };
  const ctx = await br.newContext({ viewport: { width: 360, height: 900 } });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
  await pg.route('http://localhost:8787/**', async (r) => {
    const m = r.request().method(), p = new URL(r.request().url()).pathname;
    const j = (o, status = 200) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(o) });
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    if (p === '/api/couples/invtim/budget') {
      if (m === 'GET') return j(S.doc);
      if (m === 'PUT') { if (putFail) return j({ error: 'boom' }, 500); const b = JSON.parse(r.request().postData() || '{}'); S.doc = { ...S.doc, ...b }; return j(S.doc); }
    }
    if (p === '/api/me') return j({ couples: [{ couple_id: 'invtim', role: 'owner' }] });
    return j({}, 404);
  });
  await pg.goto(`http://127.0.0.1:${dev.port}/__invtim.html?cat=${cat}`, { waitUntil: 'domcontentloaded' });
  await pg.getByRole('slider', { name: 'Dự toán' }).waitFor({ timeout: 15000 });
  await pg.waitForTimeout(400);
  return { ctx, pg };
}
const readBtn = (pg) => pg.evaluate(() => {
  const bs = [...document.querySelectorAll('button')].filter((b) => /^\s*Tìm\s/.test(b.innerText));
  if (bs.length !== 1) return { n: bs.length };
  const b = bs[0], r = b.getBoundingClientRect(), cut = [];
  const clipsOf = (el) => { const o = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (e === b || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') o.push(e); if (e === b) break; } return o; };
  for (const e of [b, ...b.querySelectorAll('*')]) {
    const cs = getComputedStyle(e); if (e !== b && !(e.innerText || '').trim()) continue;
    const clips = e === b || cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.textOverflow === 'ellipsis' || /-webkit-box/.test(cs.display);
    if (clips && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)) cut.push(`${e.tagName.toLowerCase()} ${e.scrollWidth}x${e.scrollHeight} > ${e.clientWidth}x${e.clientHeight}`);
  }
  const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!n.textContent.trim()) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const clips = clipsOf(n.parentElement);
    for (const q of rg.getClientRects()) { if (q.width < 1) continue; for (const c of clips) { const k = c.getBoundingClientRect(); if (q.right > k.right + 1 || q.left < k.left - 1 || q.bottom > k.bottom + 1 || q.top < k.top - 1) cut.push(`dòng chữ vượt hộp <${c.tagName.toLowerCase()}>`); } }
  }
  return { n: 1, text: b.innerText.replace(/\s+/g, ' ').trim(), left: r.left, right: r.right, docW: document.documentElement.scrollWidth, cut: [...new Set(cut)] };
});
const sliderVal = async (pg) => Number(await pg.getByRole('slider', { name: 'Dự toán' }).getAttribute('aria-valuenow'));
async function dragTo(pg, to) {
  const sl = pg.getByRole('slider', { name: 'Dự toán' }); await sl.focus();
  for (let i = 0; i < 400; i++) { const now = Number(await sl.getAttribute('aria-valuenow')); if (now === to) return; await pg.keyboard.press(now > to ? 'ArrowLeft' : 'ArrowRight'); }
  throw new Error('không kéo được thanh Dự toán tới ' + to);
}
/* (a): số trong chữ nút (nếu có) khớp dự toán đang hiện; không số 0; không NaN... */
function checkNumber(tag, b, shown, bad) {
  if (b.n !== 1) { bad(`[${tag}] cần đúng một nút bắt đầu bằng "Tìm", thấy ${b.n}`); return; }
  if (/NaN|undefined|null|Infinity/.test(b.text)) bad(`[${tag}] chữ nút có giá trị hỏng: "${b.text}"`);
  const nums = [...b.text.matchAll(/(\d+(?:[.,]\d+)?)\s*tr\b/g)].map((m) => Number(m[1].replace(',', '.')));
  for (const n of nums) {
    if (!(n > 0)) bad(`[${tag}] chữ nút hiện số tiền 0: "${b.text}"`);
    else if (!(Math.abs(n - shown) <= 0.05 + 1e-9)) bad(`[${tag}] số trong chữ nút (${n}tr) khác dự toán đang hiện (${shown}tr): "${b.text}"`);
  }
}
(async () => {
  const fails = []; const bad = (m) => { if (!fails.includes(m)) fails.push(m); };
  let dev, br;
  try {
    dev = await startViteDev({ repo: REPO, files: { '__invtim.jsx': JSX, '__invtim.html': HTML } });
    br = await chromium.launch();
    for (const [tag, amt] of [['90', 90], ['12,34', 12.34], ['0', 0], ['0,04', 0.04], ['thiếu', undefined]]) {
      const c = { id: 'photography', name: 'Chụp ảnh + quay phim' }; if (amt !== undefined) c.allocated_tr = amt;
      const { ctx, pg } = await openCat(br, dev, mkDoc([c, { id: 'reserve', name: 'Dự phòng', allocated_tr: 100 }]), 'photography', false);
      checkNumber(tag, await readBtn(pg), amt || 0, bad); await ctx.close();
    }
    { // kéo thanh, lưu lỗi: số (nếu có) theo thanh
      const { ctx, pg } = await openCat(br, dev, mkDoc([{ id: 'venue', name: 'Nhà hàng tiệc cưới', allocated_tr: 90 }, { id: 'reserve', name: 'Dự phòng', allocated_tr: 110 }]), 'venue', true);
      for (const to of [40, 0, 65]) { await dragTo(pg, to); await sleep(100); checkNumber(`kéo ${to}`, await readBtn(pg), await sliderVal(pg), bad); }
      await sleep(2500); checkNumber('sau lưu lỗi', await readBtn(pg), await sliderVal(pg), bad);
      await ctx.close();
    }
    for (const [id, name] of [['jewelry', 'Nhẫn cưới + trang sức + quà tặng hai họ rất dài'], ['honeymoon', 'Tuần trăng mật']]) { // (b) 360px
      const { ctx, pg } = await openCat(br, dev, mkDoc([{ id, name, allocated_tr: 1440 }, { id: 'reserve', name: 'Dự phòng', allocated_tr: 10 }]), id, false);
      const b = await readBtn(pg);
      if (b.n !== 1) bad(`[${id}] cần đúng một nút "Tìm", thấy ${b.n}`);
      else {
        checkNumber(id, b, 1440, bad);
        if (!b.text.toLowerCase().includes(name.toLowerCase())) bad(`[${id}] chữ nút không đọc đủ tên hạng mục: "${b.text}"`);
        if (b.right > 360.5 || b.left < -0.5) bad(`[${id}] nút tràn khung 360px (trái ${b.left}, phải ${b.right})`);
        if (b.cut.length) bad(`[${id}] chữ nút bị cắt/tràn: ${b.cut.join('; ')}`);
        if (b.docW > 360) bad(`[${id}] trang có cuộn ngang (rộng ${b.docW} > 360)`);
      }
      await ctx.close();
    }
  } catch (e) { bad('lỗi chạy ' + String(e.message).split('\n')[0]); }
  try { br && await br.close(); } catch (e) { /* */ } try { dev && await dev.stop(); } catch (e) { /* */ }
  if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); fails.slice(1).forEach((f) => console.log('  - ' + f)); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
