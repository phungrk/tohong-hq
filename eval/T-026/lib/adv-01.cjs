#!/usr/bin/env node
/*
 * Eval đối kháng (tầng 3) cho T-026 / spec T-025. Adversary viết lúc review.
 * Chạy: bash eval/T-026/adv-01.sh (cwd = tohong-front, như gate.py --cwd) hoặc node eval/T-026/lib/adv-01.cjs --repo <front> [--dist DIR]
 * Cùng hạ tầng với eval/T-025/check_width.cjs (build tạm, giả backend, chặn mạng ngoài, dữ liệu giả vai owner).
 * Các input mà tầng 1 chưa chạm:
 *   a) 1280: mở sheet Mời rồi chạm vùng NGOÀI khung (hai bên) -> sheet đóng (checklist.md #3, trước đây scrim phủ cả viewport).
 *   b) 1280: chạm scrim TRONG khung -> sheet đóng.
 *   c) 320: sheet Mời và sheet Kết nối nằm trong khung, rộng bằng khung, không cuộn ngang.
 *   d) Xoay 768x1024 -> 1024x768 -> 768x1024 không tải lại: khung 768 rồi 768, viền 1px rồi 0px (checklist #9).
 *   e) Onboarding (không có th_user) ở 1280: phủ đúng khung, không cuộn ngang (checklist #8).
 *   f) Viewport 1440, đổi --app-max = 600 khi sheet Kết nối đang mở: sheet đổi theo khung.
 */
const fs = require('fs'); const os = require('os'); const path = require('path'); const http = require('http');
const { execSync } = require('child_process'); const { createRequire } = require('module');
const args = process.argv.slice(2); const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REPO = arg('--repo');
if (!REPO || !fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo'); process.exit(2); }
function loadPlaywright() {
  for (const t of [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean)) {
    try { return createRequire(path.join(REPO, 'x.js'))(t); } catch { /* tiếp */ }
  }
  try { return require('/opt/node-tools/node_modules/playwright'); } catch { /* hết */ }
  console.log('FAIL không tìm thấy playwright'); process.exit(2);
}
const fails = [];
const check = (n, ok, extra) => { console.log(`${ok ? '  ok ' : '  XX '} ${n}${extra ? '  :: ' + extra : ''}`); if (!ok) fails.push(n + (extra ? ` [${extra}]` : '')); };
const near = (a, b, t) => Math.abs(a - b) <= t;

let DIST = arg('--dist'); let tmp = null;
if (!DIST) {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't026-adv-'));
  try { execSync(`npx vite build --outDir ${JSON.stringify(tmp)} --emptyOutDir`, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: '', VITE_API_BASE: 'http://localhost:8787' } }); }
  catch (e) { console.log('FAIL build lỗi'); process.exit(1); }
  DIST = tmp;
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const summary = { profile: { wedding_date: '2027-03-14', city: 'Hà Nội', bride_name: 'A', groom_name: 'B' }, days_left: 135, total_days: 365, done_days: 230,
  budget: { total_tr: 300, spent_tr: 0, over: false }, timeline: { done: 0, total: 0 }, vendors: { confirmed: 0, shortlisted: 0, empty: 0 }, guests: { yes: 0, pending: 0, no: 0, total: 0, capacity: 200 } };
function mockApi(route) {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  const p = new URL(route.request().url()).pathname; const m = route.request().method();
  const json = (o) => route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(o) });
  if (p === '/api/me') return json({ couples: [{ couple_id: 'cpl_test1', role: 'owner' }] });
  if (p.endsWith('/summary')) return json(summary);
  if (p.endsWith('/conversations')) return json({ conversations: [] });
  if (p.endsWith('/budget') && m === 'GET') return json({ total_tr: 300, guests: 200, mung_tr: 0, categories: [
    { id: 'venue', name: 'Tiệc', allocated_tr: 150, items: [] }, { id: 'photography', name: 'Ảnh', allocated_tr: 20, items: [] }] });
  if (p === '/api/vendors/status') return json({ vendors: {} });
  if (p.startsWith('/api/vendors/')) return json({ vendor: {}, match: {} });
  if (p.endsWith('/members')) return json({ members: [], invites: [] });
  if (p.endsWith('/subscription')) return json({ status: 'trial', trial: { total: 6, remaining: 6 } });
  if (p.endsWith('/connect-requests')) return json({ requests: [] });
  if (p.endsWith('/timeline') || p.endsWith('/guests')) return json({ phases: [], guests: [], summary: {} });
  return json({});
}
let BASE = '';
async function open(browser, W, H, withUser = true) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript((u) => { try {
    if (u) localStorage.setItem('th_user', '{"n":1}');
    localStorage.setItem('th_vendors_cpl_test1', JSON.stringify({ photography: { shortlisted: [{ id: 'pv1', name: 'Studio X', priceTotal: 25, priceMax: null, priceSource: 'verified', spec: 'Ảnh', gallery: [], grad: '#ccc', reviews: [], includes: [], reasons: [] }], confirmed: null } }));
  } catch { /* */ } }, withUser);
  const page = await ctx.newPage();
  await page.route('**/*', (r) => { const u = r.request().url();
    if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
    if (u.startsWith('http://localhost:8787/')) return mockApi(r); return r.abort(); });
  await page.goto(BASE); await page.waitForTimeout(1200);
  return { ctx, page };
}
const frame = (page) => page.evaluate(() => { const f = document.querySelector('.app-frame').getBoundingClientRect(); const cs = getComputedStyle(document.querySelector('.app-frame'));
  return { l: f.left, r: f.right, w: f.width, bl: parseFloat(cs.borderLeftWidth), vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }; });
const dialogs = (page) => page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].map((d) => { const b = d.getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width, name: d.getAttribute('aria-label') }; }).filter((d) => d.w > 0));
const openInvite = async (page) => { await page.getByRole('button', { name: 'Mời người ấy / gia đình cùng xem' }).first().click(); await page.waitForTimeout(600); };
const inviteOpen = async (page) => (await dialogs(page)).some((d) => /Mời/.test(d.name || ''));

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); BASE = `http://127.0.0.1:${server.address().port}/`;
  const { chromium } = loadPlaywright(); const browser = await chromium.launch();

  // a) chạm ngoài khung ở 1280
  { const { ctx, page } = await open(browser, 1280, 844); await openInvite(page);
    check('[a 1280] sheet Mời mở', await inviteOpen(page));
    await page.mouse.click(60, 300); await page.waitForTimeout(600);
    check('[a 1280] chạm vùng ngoài khung (x=60) đóng sheet Mời (checklist #3)', !(await inviteOpen(page)));
    await ctx.close(); }
  // b) chạm scrim trong khung
  { const { ctx, page } = await open(browser, 1280, 844); await openInvite(page); const f = await frame(page);
    await page.mouse.click(f.l + 20, 40); await page.waitForTimeout(600);
    check('[b 1280] chạm scrim trong khung đóng sheet Mời', !(await inviteOpen(page)));
    await ctx.close(); }
  // c) 320
  { const { ctx, page } = await open(browser, 320, 640); await openInvite(page); const f = await frame(page); const ds = await dialogs(page);
    check('[c 320] sheet Mời nằm trong và rộng bằng khung', ds.length > 0 && ds.every((d) => d.l >= f.l - 2 && d.r <= f.r + 2 && near(d.w, f.w, 2)), JSON.stringify(ds));
    check('[c 320] không cuộn ngang khi sheet mở', f.sw <= f.vw, `sw ${f.sw} vw ${f.vw}`);
    await ctx.close(); }
  // d) xoay
  { const { ctx, page } = await open(browser, 768, 1024); let f = await frame(page);
    check('[d 768x1024] khung 768, viền 0', near(f.w, 768, 0.6) && f.bl === 0, JSON.stringify(f));
    await page.setViewportSize({ width: 1024, height: 768 }); await page.waitForTimeout(400); f = await frame(page);
    check('[d 1024x768] khung 768, căn giữa, viền 1', near(f.w, 768, 0.6) && near(f.l, 1024 - f.r, 1) && f.bl > 0, JSON.stringify(f));
    await page.setViewportSize({ width: 768, height: 1024 }); await page.waitForTimeout(400); f = await frame(page);
    check('[d quay lại 768x1024] khung 768, viền 0', near(f.w, 768, 0.6) && f.bl === 0, JSON.stringify(f));
    await ctx.close(); }
  // e) onboarding
  { const { ctx, page } = await open(browser, 1280, 844, false); const f = await frame(page);
    const ob = await page.evaluate(() => [...document.querySelectorAll('.app-frame *')].filter((e) => { const cs = getComputedStyle(e); const b = e.getBoundingClientRect();
      return (cs.position === 'absolute' || cs.position === 'fixed') && b.width >= 300 && b.height >= 300 && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0; })
      .map((e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right }; }));
    check('[e 1280 onboarding] phần tử phủ lớn nằm trong khung', ob.every((o) => o.l >= f.l - 2 && o.r <= f.r + 2), `${ob.length} phần tử, khung ${f.l}..${f.r}`);
    check('[e 1280 onboarding] không cuộn ngang', f.sw <= f.vw);
    await ctx.close(); }
  // f) đổi biến khi sheet đang mở
  { const { ctx, page } = await open(browser, 1440, 900); await openInvite(page);
    await page.evaluate(() => document.documentElement.style.setProperty('--app-max', '600px')); await page.waitForTimeout(300);
    const f = await frame(page); const ds = await dialogs(page);
    check('[f 1440, biến 600 khi sheet mở] sheet theo khung 600', near(f.w, 600, 0.6) && ds.length > 0 && ds.every((d) => near(d.w, f.w, 2) && d.l >= f.l - 2), JSON.stringify({ f, ds }));
    await ctx.close(); }

  await browser.close(); server.close(); if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
})().catch((e) => { console.log('FAIL eval không chạy được: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); process.exit(2); });
