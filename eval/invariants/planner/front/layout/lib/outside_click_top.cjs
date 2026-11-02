#!/usr/bin/env node
/*
 * Bất biến front/layout inv-006 (bản chụp cố định, rút từ eval đối kháng eval/T-026/adv-02, adversary 2026-11-01).
 * Bất biến: khi nhiều sheet/modal chồng nhau và viewport rộng hơn khung, chạm vùng ngoài khung chỉ đóng LỚP TRÊN CÙNG
 * (như chạm lớp tối của lớp đó); lớp bên dưới vẫn mở, chạm lần nữa mới đóng.
 * Kiểm: 1280, Ngân sách -> sheet vendor -> sheet Kết nối. Ai thêm cặp sheet chồng mới phải thêm bước mở vào đây (qua Chief of Staff).
 * Chạy: bash eval/invariants/planner/front/layout/inv-006-cham-ngoai-khung-chi-dong-lop-tren.sh (cwd = tohong-front) hoặc node <file> --repo <front>
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
  const W = 1280; const { ctx, page } = await open(browser, W, 844);
  const connectOpen = async () => (await dialogs(page)).some((d) => /kết nối/i.test(d.name || ''));
  const vendorOpen = async () => { const b = page.getByTestId('connect-btn'); return (await b.count()) > 0 && await b.first().isVisible(); };
  try {
    await page.getByRole('button', { name: 'Ngân sách', exact: true }).first().click(); await page.waitForTimeout(500);
    await page.getByText('Ảnh', { exact: true }).first().click(); await page.waitForTimeout(500);
    await page.getByText('Studio X').first().click(); await page.waitForTimeout(700);
    await page.getByTestId('connect-btn').click(); await page.waitForTimeout(700);
    check('[1280] sheet Kết nối mở chồng trên sheet vendor', await connectOpen());
    const f = await frame(page); await page.mouse.click(f.l / 2, 300); await page.waitForTimeout(700);
    check('[1280] chạm ngoài khung lần 1: sheet Kết nối đóng', !(await connectOpen()));
    check('[1280] chạm ngoài khung lần 1: sheet vendor bên dưới vẫn mở', await vendorOpen());
    await page.mouse.click(f.l / 2, 300); await page.waitForTimeout(700);
    check('[1280] chạm ngoài khung lần 2: sheet vendor đóng', !(await vendorOpen()));
  } catch (e) { check('[1280] dựng được luồng Ngân sách -> vendor -> Kết nối', false, e.message.split('\n')[0]); }
  await ctx.close();

  await browser.close(); server.close(); if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
})().catch((e) => { console.log('FAIL eval không chạy được: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); process.exit(2); });
