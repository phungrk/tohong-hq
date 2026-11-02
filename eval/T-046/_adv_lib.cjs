/*
 * Hạ tầng chung cho eval đối kháng T-046 (adversary). Chép cách dựng của eval/T-045/check_ui.cjs (không sửa file đó):
 * vite build ra thư mục tạm, máy chủ tĩnh, API giả trong bộ nhớ ở http://api.test, chặn mạng ngoài. Dữ liệu bịa.
 * Chỉ đo chữ trên màn và thân PUT ngân sách; không đọc mã nguồn.
 */
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { execSync } = require('child_process');
const { createRequire } = require('module');

function setup(REPO) {
  if (!REPO || !fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu đường dẫn tohong-front'); process.exit(2); }
  const tries = [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', path.join(execSync('npm root -g').toString().trim(), 'playwright')].filter(Boolean);
  let pw; for (const t of tries) { try { pw = createRequire(path.join(REPO, 'x.js'))(t); break; } catch { /* thử tiếp */ } }
  if (!pw) { console.log('FAIL không tìm thấy playwright'); process.exit(2); }
  const DIST = fs.mkdtempSync(path.join(os.tmpdir(), 't046-adv-'));
  try { execSync(`npx vite build --outDir ${JSON.stringify(DIST)} --emptyOutDir`, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: '', VITE_API_BASE: 'http://api.test' } }); }
  catch (e) { console.log('FAIL build lỗi: ' + String(e.stderr || e.message).split('\n').filter(Boolean).slice(-2).join(' | ')); process.exit(2); }
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(DIST, p);
    if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  return { chromium: pw.chromium, server };
}

const CID = 'c-test';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const venueV = (o = {}) => ({ id: 'v-venue', name: 'Nhà hàng Hoa Sen', priceTotal: 6, spec: '10 người/bàn', ...o });
const mkBudget = (guests, venueItems) => ({
  total_tr: 500, guests, mung_tr: 0,
  categories: [
    { id: 'venue', name: 'Nhà hàng tiệc cưới', pct: 40, priority: 'high', allocated_tr: 200, items: venueItems || [{ id: 'i-keep-venue', name: 'Bánh cưới', amt: 3 }] },
    { id: 'photography', name: 'Chụp ảnh + quay phim', pct: 8, priority: 'high', allocated_tr: 40, items: [] },
    { id: 'reserve', name: 'Dự phòng phát sinh', pct: 10, priority: null, allocated_tr: 50, items: [] },
  ],
});
const withStats = (b) => ({ ...b, categories: b.categories.map((c) => { const est = (c.items || []).reduce((s, i) => s + (Number(i.amt) || 0), 0); return { ...c, estimated_tr: est, variance_tr: (c.allocated_tr || 0) - est, state: 'dang_theo_doi' }; }), total_estimated_tr: 0, total_variance_tr: 0, budget_used_pct: 0 });

async function scenario(browser, BASE, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(5000);
  const S = { base: BASE, page, ctx, puts: [], errors: [], store: mkBudget(opts.guests === undefined ? 205 : opts.guests, opts.venueItems) };
  page.on('pageerror', (e) => S.errors.push(String(e)));
  await page.route('**/*', (route) => { const u = route.request().url(); if (u.startsWith(BASE) || u.startsWith('http://api.test')) return route.continue(); return route.abort(); });
  await page.route('http://api.test/**', async (route) => {
    const req = route.request(), p = new URL(req.url()).pathname, m = req.method();
    const json = (o) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(o) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (p === '/api/me') return json({ couples: [{ couple_id: CID, role: 'owner' }] });
    if (p === `/api/couples/${CID}/budget` && m === 'GET') return json(withStats(S.store));
    if (p === `/api/couples/${CID}/budget` && m === 'PUT') { const b = JSON.parse(req.postData() || '{}'); S.puts.push(b); S.store = { ...S.store, ...b }; return json(withStats(S.store)); }
    if (p === `/api/couples/${CID}/summary`) return json({ profile: {}, budget: { total_tr: S.store.total_tr }, guests: { capacity: S.store.guests, total: 0, yes: 0, pending: 0, no: 0 } });
    if (p === `/api/couples/${CID}/conversations`) return json({ conversations: [] });
    if (p === '/api/vendors/status') return json({ vendors: {} });
    return json({});
  });
  await page.addInitScript(([cid, saved]) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('th_vendors_' + cid, JSON.stringify(saved)); sessionStorage.setItem('seeded', '1'); } } catch { /* bỏ qua */ } },
    [CID, opts.saved || { venue: { shortlisted: [opts.vendor || venueV()], confirmed: null } }]);
  await page.goto(BASE + '/#/ngan-sach'); await page.waitForTimeout(600);
  return S;
}
async function confirmFirst(S) {
  await S.page.goto(S.base + '/#/ngan-sach/venue'); await S.page.waitForTimeout(500);
  await S.page.locator('button:visible', { hasText: /^\s*Chốt\s*$/ }).first().evaluate((b) => b.click());
  await S.page.waitForTimeout(1500);
}
async function listRow(S) {
  await S.page.goto(S.base + '/#/ngan-sach'); await S.page.waitForTimeout(600);
  const rows = S.page.locator('button', { hasText: 'Nhà hàng tiệc cưới' }); const n = await rows.count(); const out = [];
  for (let i = 0; i < n; i++) out.push(await rows.nth(i).innerText()); return out.join('\n');
}
const venueItemAmt = (S) => { const c = (S.store.categories || []).find((x) => x.id === 'venue'); const it = (c?.items || []).find((i) => i.vendor); return it ? it.amt : undefined; };
// Làm tròn nửa lên trên số thập phân chính xác (giá 1 chữ số thập phân): tránh sai số dấu phẩy động của Math.round(x*y).
const halfUpTenths = (tables, priceTenths) => Math.floor((2 * tables * priceTenths + 10) / 20);

function reporter() {
  const fails = [];
  const check = (name, ok, extra) => { console.log(`${ok ? '  ok ' : '  XX '} ${name}${!ok && extra ? '  :: ' + String(extra).replace(/\s+/g, ' ').slice(0, 200) : ''}`); if (!ok) fails.push(name); };
  const finish = () => { if (!fails.length) { console.log('PASS'); process.exit(0); } console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); };
  return { check, finish };
}
module.exports = { setup, scenario, confirmFirst, listRow, venueItemAmt, venueV, halfUpTenths, reporter };
