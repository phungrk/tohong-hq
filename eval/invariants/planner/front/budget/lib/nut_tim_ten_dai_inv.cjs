/* Bất biến INV-007 (planner/front/budget, front) · Nút "Tìm ..." ở chi tiết hạng mục (khối Vendor) với TÊN HẠNG MỤC DÀI, ở khung 320px và 360px,
 * cả tên KHÔNG có dấu cách (một "từ" dài) lẫn tên có dấu cách:
 *   - mọi dòng chữ trong nút nằm trong hộp nút và trong khung (không tràn ngang/dọc khỏi nút, không ra ngoài màn hình);
 *   - chữ không bị cắt: không ellipsis, không line-clamp, không overflow ẩn ở nút hay phần tử con (nội dung cuộn/ẩn lớn hơn hộp);
 *   - chữ nút đọc đủ tên hạng mục (không phân biệt hoa thường, gộp khoảng trắng);
 *   - nút nằm trong khung, trang không cuộn ngang;
 *   - icon tìm (svg) còn trong nút, không bị bóp (rộng >= 15px).
 * KHÔNG khoá cách viết nhãn: không so nguyên văn, không đòi số dòng, không đòi số tiền.
 * Nguồn: T-181 (adversary, adv-02-ten-dai-320-360; lỗ bể ADR-110: bỏ ngắt chữ trong nhãn làm tên không dấu cách tràn nút mà check_5 T-177 và INV-006 vẫn xanh); spec T-177 H6.
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
const HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/__invtimdai.jsx"></script></body></html>`;
const JSX = `
import '/src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VendorProvider } from '/src/screens/VendorCtx.jsx';
import { ScreenBudget } from '/src/screens/Budget.jsx';
const q = new URLSearchParams(location.search);
const cat = q.get('cat') || 'venue', w = Number(q.get('w') || 360);
createRoot(document.getElementById('root')).render(
  <VendorProvider coupleId="invtimdai"><div style={{ width: w }}>
    <ScreenBudget me={{ status: 'ok', retry: () => {} }} coupleId="invtimdai" openCatId={cat} onOpenCat={() => {}} onCatMissing={() => {}} onOpenVendorChat={() => {}} onMenuOpen={() => {}} onOpenAI={() => {}} />
  </div></VendorProvider>);
`;
const mkDoc = (cats) => ({ total_tr: 1500, guests: 200, mung_tr: 0, categories: cats.map((c) => ({ items: [], ...c })) });

async function openCat(br, dev, doc, cat, W) {
  const ctx = await br.newContext({ viewport: { width: W, height: 900 } });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
  await pg.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
  await pg.route('http://localhost:8787/**', async (r) => {
    const m = r.request().method(), p = new URL(r.request().url()).pathname;
    const j = (o, status = 200) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(o) });
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    if (p === '/api/couples/invtimdai/budget') return j(doc);
    if (p === '/api/me') return j({ couples: [{ couple_id: 'invtimdai', role: 'owner' }] });
    return j({}, 404);
  });
  await pg.goto(`http://127.0.0.1:${dev.port}/__invtimdai.html?cat=${cat}&w=${W}`, { waitUntil: 'domcontentloaded' });
  await pg.getByRole('slider', { name: 'Dự toán' }).waitFor({ timeout: 15000 });
  await pg.waitForTimeout(400);
  return { ctx, pg };
}
const readBtn = (pg, W) => pg.evaluate((W) => {
  const bs = [...document.querySelectorAll('button')].filter((b) => /^\s*Tìm\s/.test(b.innerText));
  if (bs.length !== 1) return { n: bs.length };
  const b = bs[0], r = b.getBoundingClientRect(), cut = [];
  const clipsOf = (el) => { const o = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (e === b || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') o.push(e); if (e === b) break; } return o; };
  for (const e of [b, ...b.querySelectorAll('*')]) {
    const cs = getComputedStyle(e); if (e !== b && !(e.innerText || '').trim()) continue;
    if (cs.textOverflow === 'ellipsis' && (e.scrollWidth > e.clientWidth + 1)) cut.push(`ellipsis ở <${e.tagName.toLowerCase()}>`);
    if (/-webkit-box/.test(cs.display) && cs.webkitLineClamp && cs.webkitLineClamp !== 'none') cut.push(`line-clamp ở <${e.tagName.toLowerCase()}>`);
    const clips = e === b || cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
    if (clips && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)) cut.push(`<${e.tagName.toLowerCase()}> nội dung ${e.scrollWidth}x${e.scrollHeight} > hộp ${e.clientWidth}x${e.clientHeight}`);
  }
  const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!n.textContent.trim()) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const clips = clipsOf(n.parentElement);
    for (const q of rg.getClientRects()) {
      if (q.width < 1) continue;
      if (q.left < -0.5 || q.right > W + 0.5) cut.push(`dòng chữ ra ngoài khung ${W}px (${Math.round(q.left)}..${Math.round(q.right)})`);
      for (const c of clips) { const k = c.getBoundingClientRect(); if (q.right > k.right + 1 || q.left < k.left - 1 || q.bottom > k.bottom + 1 || q.top < k.top - 1) cut.push(`dòng chữ vượt hộp <${c.tagName.toLowerCase()}>`); }
    }
  }
  const s = b.querySelector('svg'); let icon = null;
  if (s) { const a = s.getBoundingClientRect(); icon = { w: a.width, inside: a.left >= r.left - 0.5 && a.right <= r.right + 0.5 && a.top >= r.top - 0.5 && a.bottom <= r.bottom + 0.5 }; }
  return { n: 1, text: b.innerText.replace(/\s+/g, ' ').trim(), left: r.left, right: r.right, docW: document.documentElement.scrollWidth, cut: [...new Set(cut)], icon };
}, W);
(async () => {
  const fails = []; const bad = (m) => { if (!fails.includes(m)) fails.push(m); };
  let dev, br;
  const names = [
    'Nhẫncướitrangsứcquàtặnghaihọrấtdàikhôngcódấucáchnàocảđâu',
    'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
    'Nhẫn cưới + trang sức + quà tặng hai họ và lễ vật nhà trai rất rất dài',
  ];
  try {
    dev = await startViteDev({ repo: REPO, files: { '__invtimdai.jsx': JSX, '__invtimdai.html': HTML } });
    br = await chromium.launch();
    for (const W of [320, 360]) for (const name of names) for (const amt of [1440, 0]) {
      const tag = `[${W}px "${name.slice(0, 14)}…" dự toán ${amt}]`;
      const { ctx, pg } = await openCat(br, dev, mkDoc([{ id: 'jewelry', name, allocated_tr: amt }, { id: 'reserve', name: 'Dự phòng', allocated_tr: 10 }]), 'jewelry', W);
      try {
        const b = await readBtn(pg, W);
        if (b.n !== 1) { bad(`${tag} cần đúng một nút bắt đầu bằng "Tìm", thấy ${b.n}`); continue; }
        const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!norm(b.text).includes(norm(name))) bad(`${tag} chữ nút không đọc đủ tên hạng mục: "${b.text}"`);
        if (b.cut.length) bad(`${tag} chữ nút bị cắt/tràn: ${b.cut.join('; ')}`);
        if (b.right > W + 0.5 || b.left < -0.5) bad(`${tag} nút tràn khung (trái ${b.left}, phải ${b.right})`);
        if (b.docW > W) bad(`${tag} trang cuộn ngang (rộng ${b.docW} > ${W})`);
        if (!b.icon) bad(`${tag} mất icon tìm`);
        else { if (b.icon.w < 15) bad(`${tag} icon tìm bị bóp còn ${b.icon.w}px`); if (!b.icon.inside) bad(`${tag} icon tìm nằm ngoài nút`); }
      } finally { await ctx.close(); }
    }
  } catch (e) { bad('lỗi chạy ' + String(e.message).split('\n')[0]); }
  try { br && await br.close(); } catch (e) { /* */ } try { dev && await dev.stop(); } catch (e) { /* */ }
  if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); fails.slice(1).forEach((f) => console.log('  - ' + f)); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
