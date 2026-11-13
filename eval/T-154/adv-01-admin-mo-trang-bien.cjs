#!/usr/bin/env node
/* T-154 adv-01 (adversary, tầng 3): biên khi vào ?admin: tham số lạ + hash, tải lại khi ở tab khác, /me chậm, /me 500 rồi Thử lại,
 * Sửa vendor này -> bấm lại tab -> sang tab khác -> quay lại; đúng một aria-current trên toàn trang mọi bước; đếm request lúc mở.
 * Chạy: bash eval/T-154/adv-01-admin-mo-trang-bien.sh (từ gốc tohong-hq). */

const fs = require('fs'); const os = require('os'); const path = require('path'); const http = require('http');
const { execSync } = require('child_process'); const { createRequire } = require('module');
const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REPO = arg('--repo') && path.resolve(arg('--repo'));
const CASE = arg('--case');
if (!REPO || !fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo trỏ tới tohong-front'); process.exit(2); }

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean);
  for (const t of tries) { try { return createRequire(path.join(REPO, 'x.js'))(t); } catch { /* thử tiếp */ } }
  console.log('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)'); process.exit(2);
}
const { chromium } = loadPlaywright();
const fails = [];
const check = (name, ok, extra) => {
  console.log(`${ok ? '  ok ' : '  XX '} ${name}${!ok && extra ? '  :: ' + String(extra).slice(0, 220) : ''}`);
  if (!ok) fails.push(`${name}${extra ? ' [' + String(extra).slice(0, 160) + ']' : ''}`);
};
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const ROW = { n: 1, id: 'vd1', name: 'Alpha Hall', category: 'venue', catLabel: 'Tiệc & nhà hàng', group: 'full',
  marry: { address: 'Số 1 đường thử', price_min_vnd: null, price_max_vnd: null, price_unit: null, source_url: null },
  google: { matched: true, place_id: 'ChIJ1', name: 'Google Alpha', similarity: 1, address: 'Địa chỉ G', address_match: true, rating: 4, review_count: 1, photo_count: 1, maps_url: 'https://www.google.com/maps/place/?q=place_id:ChIJ1', reject_reason: null },
  approvable: false, override: null, review: null };
const VENDOR_ID = 'vd-focus-153';

let DIST = arg('--dist');
if (!DIST) {
  DIST = fs.mkdtempSync(path.join(os.tmpdir(), 't154-adv-dist-'));
  try {
    execSync(`npx vite build --outDir ${JSON.stringify(DIST)} --emptyOutDir`, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: '', VITE_ADMIN_DEV_TOKEN: 'dev:admin', VITE_API_BASE: 'http://api.test' } });
  } catch (e) { console.log('FAIL build lỗi: ' + String(e.stderr || e.message).split('\n').filter(Boolean).slice(-2).join(' | ')); process.exit(1); }
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});


let browser;
// mode: { me: 'ok' | 'slow' | 'e500then-ok' }
async function open({ me = 'ok', url = '/?admin', ctx } = {}) {
  ctx = ctx || await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  const S = { page, ctx, calls: [], external: [], meHits: 0 };
  S.n = (re) => S.calls.filter((c) => re.test(c)).length;
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(S.base)) return route.continue();
    if (!/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)) S.external.push(u);
    return route.abort();
  });
  await page.route('http://api.test/**', async (route) => {
    const req = route.request(); const u = new URL(req.url()); const m = req.method();
    const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(o) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    S.calls.push(`${m} ${u.pathname}`);
    if (u.pathname === '/api/admin/me') {
      S.meHits++;
      if (me === 'slow') { S.meStart = S.calls.length; await new Promise((r) => setTimeout(r, 1500)); S.callsDuringMe = S.calls.slice(S.meStart); }
      if (me === 'e500then-ok' && S.meHits === 1) return json({ error: 'boom' }, 500);
      return json({ admin: true, user_id: 'user_admin', counts: { connect_new: 1, upgrade_pending: 0, legacy_active: 0 } });
    }
    if (u.pathname === '/api/admin/vendor-enrich') return json({ data_as_of: '2026-11-11T13:08:22', summary: { total: 1, groups: { full: 1 }, chips: { full: 1, no_google_photo: 0, name_similar: 0, addr_diff: 0 }, approvable: 0 }, total: 1, offset: 0, limit: 50, rows: [ROW] });
    if (u.pathname === '/api/admin/members-summary') return json({ accounts: { status: 'ok', total: 1, new_7d: 0, new_7d_capped: false }, couples: { total: 1, new_7d: 0, by_owner: { account: 1, guest: 0, unknown: 0 } }, computed_at: '2026-11-13T00:00:00Z' });
    if (u.pathname === '/api/admin/members') return json({ members: [], total: 0, page: 1, size: 20 });
    if (u.pathname === '/api/admin/connect-requests') return json({ requests: [{ id: 'c1', status: 'new', waiting_hours: 2, couple: { id: 'u1', name: 'Cặp Thử', email: 'a@b.test' }, vendor: { id: VENDOR_ID, name: 'Vendor Focus 153', category: 'venue' } }] });
    if (u.pathname === '/api/admin/connect-requests/c1') return json({ request: { id: 'c1', status: 'new', source: 'chat', created_at: '2026-11-13T00:00:00Z', waiting_hours: 2, couple: { id: 'u1', name: 'Cặp Thử', email: 'a@b.test' }, contact: null, note: '', vendor: { id: VENDOR_ID, name: 'Vendor Focus 153', category: 'venue', contact: {} } } });
    if (u.pathname === '/api/admin/vendors') return json({ vendors: [], total: 0 });
    if (u.pathname.startsWith('/api/admin/vendors/')) return json({ vendor: { id: VENDOR_ID, name: 'Vendor Focus 153', category: 'venue' }, override: null });
    if (u.pathname === '/api/admin/audit') return json({ entries: [], items: [], next_cursor: null });
    return json({ requests: [], items: [], entries: [], rows: [] });
  });
  S.base = `http://127.0.0.1:${server.address().port}`;
  await page.goto(`${S.base}${url}`);
  return S;
}
const nav = (page) => page.getByRole('navigation', { name: 'Các mục admin' });
const tabs = (page) => nav(page).getByRole('button');
const tabNames = async (page) => (await tabs(page).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').replace(/\s*\d+$/, '').trim());
const currentAll = async (page) => page.evaluate(() => [...document.querySelectorAll('[aria-current]')].map((e) => `${e.getAttribute('aria-current')}:${e.innerText.replace(/\s+/g, ' ').replace(/\s*\d+$/, '').trim()}`));
const tab = (page, name) => nav(page).getByRole('button', { name: new RegExp('^' + name) });
const table = (page) => page.getByRole('table', { name: 'Bảng enrich vendor' });
const settle = (page) => page.waitForTimeout(600);
const pressed = async (page, name) => page.getByRole('button', { name }).getAttribute('aria-pressed');
const isEnrich = async (page) => (await table(page).count()) === 1 && (await pressed(page, 'Enrich Google Maps')) === 'true';
const oneCurrent = async (page, label, want) => { const c = await currentAll(page); check(`${label}: đúng một phần tử mang aria-current, là "page:${want}"`, c.length === 1 && c[0] === `page:${want}`, c.join(' | ')); };
const OTHER = /connect-requests|\/api\/admin\/members|\/api\/admin\/audit|upgrade|legacy|subscription|GET \/api\/admin\/vendors/;

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  browser = await chromium.launch();
  const step = async (name, fn) => { try { await fn(); } catch (e) { fails.push(`${name}: lỗi chạy: ` + String(e.message).split('\n')[0]); console.log(`  XX  ${name}: lỗi chạy ${String(e.message).split('\n')[0]}`); } };
  // A: tham số lạ + hash; đếm request khi mở
  await step('A', async () => {
    const S = await open({ url: '/?admin=abc&foo=bar&utm_source=x#section-2' }); const { page } = S;
    await table(page).waitFor(); await settle(page);
    check('A ?admin=abc&foo=bar#hash: tab đầu là "Dữ liệu vendor", đủ sáu tab', (await tabNames(page))[0] === 'Dữ liệu vendor' && (await tabNames(page)).length === 6, (await tabNames(page)).join('|'));
    await oneCurrent(page, 'A', 'Dữ liệu vendor');
    check('A: bảng enrich, "Enrich Google Maps" aria-pressed=true', await isEnrich(page));
    check('A: mở trang gọi /me đúng 1 lần, vendor-enrich đúng 1 lần, không gọi API tab khác', S.n(/GET \/api\/admin\/me$/) === 1 && S.n(/GET \/api\/admin\/vendor-enrich$/) === 1 && S.n(OTHER) === 0, S.calls.join(', '));
    await S.ctx.close();
  });
  // B: tải lại khi đang ở tab khác
  await step('B', async () => {
    const S = await open(); const { page } = S;
    await table(page).waitFor();
    await tab(page, 'Nhật ký').click(); await settle(page);
    await page.reload(); await table(page).waitFor(); await settle(page);
    await oneCurrent(page, 'B tải lại khi đang ở "Nhật ký"', 'Dữ liệu vendor');
    check('B: sau tải lại là bảng enrich (không nhớ tab cũ)', await isEnrich(page));
    await S.ctx.close();
  });
  // C: /me chậm 1.5s
  await step('C', async () => {
    const S = await open({ me: 'slow' }); const { page } = S;
    await table(page).waitFor(); await settle(page);
    check('C /me chậm: trong lúc chờ /me không gọi API vendor nào', (S.callsDuringMe || []).filter((c) => /vendor/.test(c)).length === 0, (S.callsDuringMe || []).join(', '));
    check('C: sau khi /me về: bảng enrich, vendor-enrich gọi đúng 1 lần', (await isEnrich(page)) && S.n(/GET \/api\/admin\/vendor-enrich$/) === 1, S.calls.join(', '));
    await oneCurrent(page, 'C', 'Dữ liệu vendor');
    await S.ctx.close();
  });
  // D: /me 500 rồi Thử lại
  await step('D', async () => {
    const S = await open({ me: 'e500then-ok' }); const { page } = S;
    await page.getByRole('alert').waitFor(); await settle(page);
    check('D /me 500: không thanh tab, không bảng, không gọi API vendor', (await nav(page).count()) === 0 && (await table(page).count()) === 0 && S.n(/vendor/) === 0, S.calls.join(', '));
    await page.getByRole('button', { name: 'Thử lại' }).click();
    await table(page).waitFor(); await settle(page);
    await oneCurrent(page, 'D sau Thử lại', 'Dữ liệu vendor');
    check('D sau Thử lại: bảng enrich, vendor-enrich đúng 1 lần', (await isEnrich(page)) && S.n(/GET \/api\/admin\/vendor-enrich$/) === 1, S.calls.join(', '));
    await S.ctx.close();
  });
  // E: Sửa vendor này -> bấm lại tab vendor -> sang tab khác -> quay lại
  await step('E', async () => {
    const S = await open(); const { page } = S;
    await table(page).waitFor();
    await tab(page, 'Hộp kết nối').click(); await oneCurrent(page, 'E ở Hộp kết nối', 'Hộp kết nối');
    await page.getByText('Cặp Thử').first().click();
    await page.getByRole('button', { name: 'Sửa vendor này' }).click(); await settle(page);
    await oneCurrent(page, 'E sau "Sửa vendor này"', 'Dữ liệu vendor');
    check('E: chế độ danh sách sau "Sửa vendor này"', (await pressed(page, 'Danh sách vendor')) === 'true' && (await table(page).count()) === 0);
    await tab(page, 'Dữ liệu vendor').click(); await settle(page);
    await oneCurrent(page, 'E bấm lại tab "Dữ liệu vendor" khi đang mở vendor', 'Dữ liệu vendor');
    check('E: bấm lại tab đang chọn không làm sập trang (toolbar còn)', (await page.getByRole('button', { name: 'Danh sách vendor' }).count()) === 1);
    await tab(page, 'Thành viên').click(); await settle(page);
    await oneCurrent(page, 'E sang "Thành viên"', 'Thành viên');
    const before = S.calls.length;
    await tab(page, 'Dữ liệu vendor').click(); await table(page).waitFor(); await settle(page);
    const after = S.calls.slice(before);
    await oneCurrent(page, 'E quay lại "Dữ liệu vendor"', 'Dữ liệu vendor');
    check('E: quay lại từ tab khác sau khi đã mở một vendor -> bảng enrich, không gọi danh sách vendor', (await isEnrich(page)) && after.filter((c) => /GET \/api\/admin\/vendors/.test(c)).length === 0, after.join(', '));
    // Bấm Enrich trong chế độ focus rồi quay lại
    await S.ctx.close();
  });
  await browser.close(); server.close();
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS');
})();
