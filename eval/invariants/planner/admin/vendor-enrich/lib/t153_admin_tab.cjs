#!/usr/bin/env node
/*
 * BẢN CHỤP CỐ ĐỊNH cho bất biến planner/admin/vendor-enrich inv-008 (nguồn T-153, Spec Gate 2026-11-13). Không sửa cho khớp code; sửa phải qua Chief of Staff + decisions/.
 * Eval tầng 1 của T-153 (repo tohong-front): vào ?admin= mở thẳng tab "Dữ liệu vendor" ở bảng enrich.
 * Chạy: bash eval/T-153/check_1_tab_dau_va_bang_enrich.sh (từ gốc tohong-hq). Trực tiếp: node check_ui_admin_tab.cjs --repo <tohong-front> --case 1|2|3|4 [--dist DIR]
 * Tự `vite build` ra thư mục tạm (VITE_ADMIN_DEV_TOKEN=dev:admin, VITE_API_BASE=http://api.test, không Clerk), tự phục vụ, giả API. Request ra ngoài bị chặn.
 * Không đọc mã nguồn: đo theo nhãn, role, aria và request người dùng gây ra.
 *  case 1: vào ?admin= (admin): thanh tab "Các mục admin" có "Dữ liệu vendor" là tab ĐẦU TIÊN, có aria-current="page" (và chỉ tab đó có); bảng "Bảng enrich vendor" hiện;
 *          nút "Enrich Google Maps" aria-pressed=true; không gọi GET /api/admin/vendors (danh sách) và không gọi members-summary.
 *  case 2: các tab Thành viên, Hộp kết nối, Nâng cấp gói, Gói tự kích hoạt, Nhật ký, Dữ liệu vendor bấm qua lại được: aria-current đổi theo, bảng enrich biến mất khi rời tab,
 *          quay lại "Dữ liệu vendor" thì lại là bảng enrich. Thứ tự các tab còn lại giữ nguyên như trước: Thành viên, Hộp kết nối, Nâng cấp gói, Gói tự kích hoạt, Nhật ký.
 *  case 3: Hộp kết nối > chọn yêu cầu > "Sửa vendor này": tab Dữ liệu vendor được chọn, chế độ danh sách ("Danh sách vendor" aria-pressed=true, không có bảng enrich),
 *          trong các request SAU thao tác bấm: GET /api/admin/vendors/<đúng id> đúng một lần, không có GET /api/admin/vendor-enrich.
 *  case 4: người không phải admin (GET /api/admin/me trả 403): thấy "Bạn không có quyền xem trang này", không có thanh tab, không có bảng; không gọi /api/admin/vendor-enrich* hay /api/admin/vendors*.
 * In dòng cuối PASS hoặc FAIL <lý do đầu tiên> (+n lỗi nữa); thoát 0/1 (2 = eval không chạy được).
 */
const fs = require('fs'); const os = require('os'); const path = require('path'); const http = require('http');
const { execSync } = require('child_process'); const { createRequire } = require('module');
const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REPO = arg('--repo') && path.resolve(arg('--repo'));
const CASE = arg('--case');
if (!REPO || !fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo trỏ tới tohong-front'); process.exit(2); }
if (!['1', '2', '3', '4'].includes(CASE)) { console.log('FAIL thiếu --case 1|2|3|4'); process.exit(2); }
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
  DIST = fs.mkdtempSync(path.join(os.tmpdir(), 't153-dist-'));
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
async function open({ admin = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(4000);
  const S = { page, calls: [], external: [] };
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
    if (u.pathname === '/api/admin/me') return admin ? json({ admin: true, user_id: 'user_admin', counts: { connect_new: 1, upgrade_pending: 0, legacy_active: 0 } }) : json({ error: 'forbidden' }, 403);
    if (!admin) return json({ error: 'forbidden' }, 403);
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
  await page.goto(`${S.base}/?admin`);
  return S;
}
const tabs = (page) => page.getByRole('navigation', { name: 'Các mục admin' }).getByRole('button');
const tabNames = async (page) => (await tabs(page).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').replace(/\s*\d+$/, '').trim());
const current = async (page) => (await tabs(page).evaluateAll((els) => els.filter((e) => e.getAttribute('aria-current') === 'page').map((e) => e.innerText.replace(/\s+/g, ' ').replace(/\s*\d+$/, '').trim())));
const tab = (page, name) => page.getByRole('navigation', { name: 'Các mục admin' }).getByRole('button', { name: new RegExp('^' + name) });
const table = (page) => page.getByRole('table', { name: 'Bảng enrich vendor' });
const settle = (page) => page.waitForTimeout(500);

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  browser = await chromium.launch();
  try {
    if (CASE === '1') {
      const S = await open(); const { page } = S;
      await tabs(page).first().waitFor();
      await table(page).waitFor().catch(() => {});
      await settle(page);
      const names = await tabNames(page);
      check('tab đầu tiên của thanh tab là "Dữ liệu vendor"', names[0] === 'Dữ liệu vendor', names.join(' | '));
      check('đủ sáu tab', names.length === 6, names.join(' | '));
      const cur = await current(page);
      check('chỉ "Dữ liệu vendor" có aria-current="page"', cur.length === 1 && cur[0] === 'Dữ liệu vendor', cur.join(' | '));
      check('bảng "Bảng enrich vendor" hiện, có dòng Alpha Hall', (await table(page).count()) === 1 && (await table(page).innerText()).includes('Alpha Hall'));
      check('nút "Enrich Google Maps" đang chọn (aria-pressed=true), "Danh sách vendor" không', (await page.getByRole('button', { name: 'Enrich Google Maps' }).getAttribute('aria-pressed')) === 'true' && (await page.getByRole('button', { name: 'Danh sách vendor' }).getAttribute('aria-pressed')) === 'false');
      check('đã gọi API enrich; không gọi danh sách vendor, không gọi members-summary', S.n(/GET \/api\/admin\/vendor-enrich$/) >= 1 && S.n(/GET \/api\/admin\/vendors/) === 0 && S.n(/members-summary/) === 0, S.calls.join(', '));
      check('không có request ra ngoài', S.external.length === 0, S.external.join(' '));
    }
    if (CASE === '2') {
      const S = await open(); const { page } = S;
      await table(page).waitFor();
      check('thứ tự năm tab còn lại giữ nguyên', (await tabNames(page)).slice(1).join('|') === 'Thành viên|Hộp kết nối|Nâng cấp gói|Gói tự kích hoạt|Nhật ký', (await tabNames(page)).join('|'));
      for (const name of ['Thành viên', 'Hộp kết nối', 'Nâng cấp gói', 'Gói tự kích hoạt', 'Nhật ký']) {
        await tab(page, name).click(); await settle(page);
        const cur = await current(page);
        check(`bấm "${name}": chỉ tab đó được chọn`, cur.length === 1 && cur[0] === name, cur.join(' | '));
        check(`bấm "${name}": bảng enrich biến mất`, (await table(page).count()) === 0);
      }
      check('"Thành viên" gọi members-summary khi được mở', S.n(/members-summary/) >= 1, S.calls.join(', '));
      check('"Hộp kết nối" gọi API danh sách yêu cầu kết nối khi được mở', S.n(/GET \/api\/admin\/connect-requests$/) >= 1);
      await tab(page, 'Dữ liệu vendor').click(); await table(page).waitFor();
      const cur = await current(page);
      check('quay lại "Dữ liệu vendor": được chọn và là bảng enrich', cur.join('|') === 'Dữ liệu vendor' && (await page.getByRole('button', { name: 'Enrich Google Maps' }).getAttribute('aria-pressed')) === 'true', cur.join('|'));
      await page.getByRole('button', { name: 'Danh sách vendor' }).click(); await settle(page);
      check('trong tab vẫn đổi được sang "Danh sách vendor" và về lại bảng enrich', (await table(page).count()) === 0 && (await (async () => { await page.getByRole('button', { name: 'Enrich Google Maps' }).click(); await table(page).waitFor(); return true; })()));
    }
    if (CASE === '3') {
      const S = await open(); const { page } = S;
      await table(page).waitFor();
      await tab(page, 'Hộp kết nối').click();
      await page.getByText('Cặp Thử').first().click();
      const before = S.calls.length;
      await page.getByRole('button', { name: 'Sửa vendor này' }).click();
      await settle(page);
      const after = S.calls.slice(before);
      const cur = await current(page);
      check('sau "Sửa vendor này": tab "Dữ liệu vendor" được chọn', cur.join('|') === 'Dữ liệu vendor', cur.join('|'));
      check('chế độ danh sách: "Danh sách vendor" aria-pressed=true, không có bảng enrich', (await page.getByRole('button', { name: 'Danh sách vendor' }).getAttribute('aria-pressed')) === 'true' && (await table(page).count()) === 0);
      check(`gọi đúng một lần GET /api/admin/vendors/${VENDOR_ID}`, after.filter((c) => new RegExp('GET /api/admin/vendors/' + VENDOR_ID + '$').test(c)).length === 1, after.join(', '));
      check('sau "Sửa vendor này" không gọi API enrich', after.filter((c) => /GET \/api\/admin\/vendor-enrich$/.test(c)).length === 0, after.join(', '));
    }
    if (CASE === '4') {
      const S = await open({ admin: false }); const { page } = S;
      await page.getByText('Bạn không có quyền xem trang này').waitFor();
      await settle(page);
      check('thấy "Bạn không có quyền xem trang này"', true);
      check('không có thanh tab, không có bảng enrich', (await page.getByRole('navigation', { name: 'Các mục admin' }).count()) === 0 && (await table(page).count()) === 0);
      check('không gọi /api/admin/vendor-enrich* hay /api/admin/vendors*', S.n(/\/api\/admin\/vendor/) === 0, S.calls.join(', '));
    }
  } catch (e) { fails.push('lỗi chạy: ' + String(e.message).split('\n')[0]); }
  await browser.close(); server.close();
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS');
})();
