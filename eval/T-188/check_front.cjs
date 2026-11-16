#!/usr/bin/env node
/*
 * T-188 (tohong-front): eval hành vi cho cờ build VITE_ADMIN_OPEN. Tự `vite build` ra thư mục tạm (không ghi vào repo), tự phục vụ, giả API (http://api.test), request ra ngoài bị chặn.
 * Không đặt biến thật: mọi giá trị dùng trong eval là giả (khoá Clerk giả dựng lúc chạy, không phải khoá thật). Không đọc mã nguồn: đo theo nhãn, role và request người dùng gây ra.
 * Dùng: node check_front.cjs --repo <tohong-front> --case 5|6   (dòng cuối PASS hoặc FAIL <lý do>; thoát 0/1, 2 = không chạy được)
 *  case 5 (tiêu chí 5): build với VITE_ADMIN_OPEN=1 (đúng chuỗi "1"):
 *     (a) KHÔNG có khoá Clerk, KHÔNG có token dev: vào /?admin= thấy ngay thanh tab "Các mục admin" (đủ sáu tab), không có nút "Đăng nhập", không có chữ "Chưa cấu hình đăng nhập";
 *         trang gọi GET /api/admin/me; bấm được từng tab (Thành viên, Hộp kết nối, Nâng cấp gói, Gói tự kích hoạt, Nhật ký, Dữ liệu vendor) mà vẫn không có nút "Đăng nhập" và không tab nào báo lỗi quyền;
 *     (b) CÓ khoá Clerk (giả): vẫn không có nút "Đăng nhập", thấy thanh tab, và trình duyệt không gửi request nào tới máy chủ Clerk;
 *     (c) API trả 403 cho /me (Worker chưa bật cờ): trang vẫn chỉ nói "Bạn không có quyền xem trang này", không thanh tab, không gọi /api/admin/vendor-enrich* hay /api/admin/vendors*;
 *     (d) trang không phải admin (không có ?admin) không đổi: không có thanh tab "Các mục admin" và không gọi /api/admin/*.
 *  case 6 (tiêu chí 6): cờ VẮNG HẲN khỏi môi trường build (giống Vercel; biến bị gỡ khỏi env, không gán rỗng) hoặc khác "1" ("", "0", "true", "yes", " 1") thì y như hôm nay:
 *     (0) quét cấu hình repo front: không file .env*, vercel.json, vite.config.*, package.json nào đặt VITE_ADMIN_OPEN thành 1 (vite.config.* không được nhắc tới cờ này);
 *     (a0) cờ vắng + không khoá Clerk + không token dev: như (a) bên dưới (bắt mặc định `?? '1'` và file .env.production bật cờ);
 *     (c0) cờ vắng + có khoá Clerk: như (c) bên dưới (cùng lượt build như Vercel);
 *     (a) không khoá Clerk, không token dev: thấy "Chưa cấu hình đăng nhập", không thanh tab, không gọi /api/admin/*;
 *     (b) có token dev (VITE_ADMIN_DEV_TOKEN) như cấu hình chạy local hôm nay: thấy thanh tab và gọi /api/admin/me (hành vi cũ giữ nguyên);
 *     (c) có khoá Clerk (giả) mà Clerk không tải được: KHÔNG thấy thanh tab "Các mục admin" và không gọi /api/admin/* (cổng đăng nhập vẫn chặn trước khi gọi API).
 */
const fs = require('fs'); const os = require('os'); const path = require('path'); const http = require('http');
const { execSync } = require('child_process'); const { createRequire } = require('module');
const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REPO = arg('--repo') && path.resolve(arg('--repo'));
const CASE = arg('--case');
if (!REPO || !fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo trỏ tới tohong-front'); process.exit(2); }
if (!['5', '6'].includes(CASE)) { console.log('FAIL thiếu --case 5|6'); process.exit(2); }
function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean);
  for (const t of tries) { try { return createRequire(path.join(REPO, 'x.js'))(t); } catch { /* thử tiếp */ } }
  console.log('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)'); process.exit(2);
}
const { chromium } = loadPlaywright();
process.on('uncaughtException', (e) => { console.log('FAIL ngoại lệ khi chạy: ' + String(e && e.message).slice(0, 200)); process.exit(1); });
const fails = [];
const check = (name, ok, extra) => {
  console.log(`${ok ? '  ok ' : '  XX '}${name}${!ok && extra ? '  :: ' + String(extra).slice(0, 220) : ''}`);
  if (!ok) fails.push(`${name}${extra ? ' [' + String(extra).slice(0, 160) + ']' : ''}`);
};
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const ID = 'admin-khong-dang-nhap';
const CLERK_HOST = 'clerk.t188-gia.test';
const FAKE_CLERK_KEY = 'pk_' + 'test_' + Buffer.from(CLERK_HOST + '$').toString('base64');
const ROW = { n: 1, id: 'vd1', name: 'Alpha Hall', category: 'venue', catLabel: 'Tiệc & nhà hàng', group: 'full',
  marry: { address: 'Số 1 đường thử', price_min_vnd: null, price_max_vnd: null, price_unit: null, source_url: null },
  google: { matched: true, place_id: 'ChIJ1', name: 'Google Alpha', similarity: 1, address: 'Địa chỉ G', address_match: true, rating: 4, review_count: 1, photo_count: 1, maps_url: 'https://www.google.com/maps/place/?q=place_id:ChIJ1', reject_reason: null },
  approvable: false, override: null, review: null };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };

function build(env) {
  // env.VITE_ADMIN_OPEN === undefined nghĩa là biến KHÔNG có trong môi trường build (không phải chuỗi rỗng).
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 't188-dist-'));
  const e = { ...process.env, VITE_API_BASE: 'http://api.test', VITE_CLERK_PUBLISHABLE_KEY: '', VITE_ADMIN_DEV_TOKEN: '', ...env };
  // Biến cờ chỉ có mặt khi case tự đặt. Mặc định VẮNG HẲN khỏi môi trường build (giống Vercel), để Vite còn đọc file .env* của repo và để mặc định trong code lộ ra.
  if (env.VITE_ADMIN_OPEN === undefined) delete e.VITE_ADMIN_OPEN;
  try { execSync(`npx vite build --outDir ${JSON.stringify(dist)} --emptyOutDir`, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], env: e }); }
  catch (err) { console.log('FAIL build lỗi: ' + String(err.stderr || err.message).split('\n').filter(Boolean).slice(-2).join(' | ')); process.exit(1); }
  return dist;
}
function serve(dist) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let f = path.join(dist, p);
      if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html');
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
let browser;
async function open(server, { me = 'ok', url = '/?admin=' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(4000);
  const S = { page, calls: [], external: [], base: `http://127.0.0.1:${server.address().port}` };
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
    if (!u.pathname.startsWith('/api/admin')) return json({}, 200);
    if (me === 'denied') return json({ error: 'forbidden' }, 403);
    if (u.pathname === '/api/admin/me') return json({ admin: true, user_id: ID, counts: { connect_new: 0, upgrade_pending: 0, legacy_active: 0 } });
    if (u.pathname === '/api/admin/vendor-enrich') return json({ data_as_of: '2026-11-11T13:08:22', summary: { total: 1, groups: { full: 1 }, chips: { full: 1, no_google_photo: 0, name_similar: 0, addr_diff: 0 }, approvable: 0 }, total: 1, offset: 0, limit: 50, rows: [ROW] });
    if (u.pathname === '/api/admin/members-summary') return json({ accounts: { status: 'ok', total: 1, new_7d: 0, new_7d_capped: false }, couples: { total: 1, new_7d: 0, by_owner: { account: 1, guest: 0, unknown: 0 } }, computed_at: '2026-11-16T00:00:00Z' });
    if (u.pathname === '/api/admin/audit') return json({ entries: [], items: [], next_cursor: null });
    return json({ requests: [], subscriptions: [], items: [], entries: [], rows: [], vendors: [], total: 0 });
  });
  await page.goto(S.base + url);
  return S;
}
const NAV = (page) => page.getByRole('navigation', { name: 'Các mục admin' });
const settle = (page) => page.waitForTimeout(700);
const body = (page) => page.locator('body').innerText();
const loginBtn = (page) => page.getByRole('button', { name: 'Đăng nhập' });
const TAB_NAMES = ['Dữ liệu vendor', 'Thành viên', 'Hộp kết nối', 'Nâng cấp gói', 'Gói tự kích hoạt', 'Nhật ký'];

(async () => {
  browser = await chromium.launch();
  try {
    if (CASE === '5') {
      let dist = build({ VITE_ADMIN_OPEN: '1' });
      let server = await serve(dist);
      {
        const S = await open(server); const { page } = S;
        await NAV(page).waitFor().catch(() => {});
        await settle(page);
        const txt = await body(page);
        check('(a) cờ bật, không Clerk, không token dev: có thanh tab "Các mục admin"', (await NAV(page).count()) === 1, txt.slice(0, 120));
        const names = (await NAV(page).getByRole('button').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').replace(/\s*\d+$/, '').trim());
        check('(a) đủ sáu tab', TAB_NAMES.every((n) => names.includes(n)) && names.length === 6, names.join(' | '));
        check('(a) không có nút "Đăng nhập"', (await loginBtn(page).count()) === 0);
        check('(a) không có chữ "Chưa cấu hình đăng nhập" và không có "không có quyền"', !txt.includes('Chưa cấu hình đăng nhập') && !txt.includes('không có quyền'), txt.slice(0, 120));
        check('(a) trang gọi GET /api/admin/me', S.n(/^GET \/api\/admin\/me$/) >= 1, S.calls.join(', '));
        for (const n of ['Thành viên', 'Hộp kết nối', 'Nâng cấp gói', 'Gói tự kích hoạt', 'Nhật ký', 'Dữ liệu vendor']) {
          await NAV(page).getByRole('button', { name: new RegExp('^' + n) }).click(); await settle(page);
          const t = await body(page);
          check(`(a) bấm "${n}": vẫn không có nút "Đăng nhập" và không báo lỗi quyền`, (await loginBtn(page).count()) === 0 && !t.includes('không có quyền'), t.slice(0, 100));
        }
        check('(a) không request ra ngoài', S.external.length === 0, S.external.join(' '));
        await page.context().close();
      }
      {
        // (b) build có khoá Clerk (giả) + cờ bật
        server.close(); dist = build({ VITE_ADMIN_OPEN: '1', VITE_CLERK_PUBLISHABLE_KEY: FAKE_CLERK_KEY }); server = await serve(dist);
        const S = await open(server); const { page } = S;
        await NAV(page).waitFor().catch(() => {});
        await settle(page);
        check('(b) cờ bật + có khoá Clerk: có thanh tab, không nút "Đăng nhập"', (await NAV(page).count()) === 1 && (await loginBtn(page).count()) === 0, (await body(page)).slice(0, 120));
        check('(b) không request nào tới máy chủ Clerk', !S.external.some((u) => u.includes(CLERK_HOST)), S.external.join(' '));
        await page.context().close();
        // (c) API trả 403
        const D = await open(server, { me: 'denied' });
        await D.page.getByText('Bạn không có quyền xem trang này').waitFor().catch(() => {});
        await settle(D.page);
        check('(c) /me 403: chỉ thấy "Bạn không có quyền xem trang này", không thanh tab', (await body(D.page)).includes('Bạn không có quyền xem trang này') && (await NAV(D.page).count()) === 0);
        check('(c) /me 403: không gọi /api/admin/vendor-enrich* hay /api/admin/vendors*', D.n(/\/api\/admin\/vendor(-enrich|s)/) === 0, D.calls.join(', '));
        await D.page.context().close();
        // (d) trang thường
        const P = await open(server, { url: '/' });
        await settle(P.page);
        check('(d) trang không phải admin: không thanh tab admin, không gọi /api/admin/*', (await NAV(P.page).count()) === 0 && P.n(/\/api\/admin/) === 0, P.calls.join(', '));
        await P.page.context().close();
      }
      server.close();
    }
    if (CASE === '6') {
      {
        const hits = [];
        const flagOn = (txt) => /VITE_ADMIN_OPEN["']?\s*[=:]\s*["']?1(?![0-9A-Za-z])/.test(txt) || /["']VITE_ADMIN_OPEN["']\s*[:,]\s*["']?1(?![0-9A-Za-z])/.test(txt);
        for (const f of fs.readdirSync(REPO)) {
          const full = path.join(REPO, f);
          if (!fs.statSync(full).isFile()) continue;
          const isEnv = /^\.env(\..*)?$/.test(f), isVercel = f === 'vercel.json', isVite = /^vite\.config\./.test(f), isPkg = f === 'package.json';
          if (!(isEnv || isVercel || isVite || isPkg)) continue;
          const t = fs.readFileSync(full, 'utf8');
          if (isEnv) { for (const line of t.split('\n')) { const m = /^\s*(?:export\s+)?VITE_ADMIN_OPEN\s*=\s*(.*)$/.exec(line); if (m && m[1].replace(/#.*/, '').trim().replace(/^["']|["']$/g, '') === '1') hits.push(f + ': ' + line.trim()); } }
          else if (isVite) { if (t.includes('VITE_ADMIN_OPEN')) hits.push(f + ': nhắc tới VITE_ADMIN_OPEN'); }
          else if (flagOn(t)) hits.push(f + ': đặt VITE_ADMIN_OPEN=1');
        }
        check('(0) cấu hình repo front (.env*, vercel.json, vite.config.*, package.json) không bật VITE_ADMIN_OPEN', hits.length === 0, hits.join(' | '));
      }
      {
        const dist = build({}); const server = await serve(dist);
        const S = await open(server); await settle(S.page);
        const txt = await body(S.page);
        check('(a0) cờ VẮNG khỏi môi trường build, không Clerk, không token dev: "Chưa cấu hình đăng nhập", không thanh tab, không gọi /api/admin/*', txt.includes('Chưa cấu hình đăng nhập') && (await NAV(S.page).count()) === 0 && S.n(/\/api\/admin/) === 0, txt.slice(0, 120) + ' | ' + S.calls.join(', '));
        await S.page.context().close(); server.close();
      }
      for (const val of ['', '0', 'true', 'yes', ' 1']) {
        const dist = build({ VITE_ADMIN_OPEN: val }); const server = await serve(dist);
        const tag = `VITE_ADMIN_OPEN=${JSON.stringify(val)}`;
        const S = await open(server); await settle(S.page);
        const txt = await body(S.page);
        check(`${tag} (a): thấy "Chưa cấu hình đăng nhập", không thanh tab, không gọi /api/admin/*`, txt.includes('Chưa cấu hình đăng nhập') && (await NAV(S.page).count()) === 0 && S.n(/\/api\/admin/) === 0, txt.slice(0, 120) + ' | ' + S.calls.join(', '));
        await S.page.context().close(); server.close();
      }
      {
        const dist = build({ VITE_ADMIN_DEV_TOKEN: 'dev:admin' }); const server = await serve(dist);
        const S = await open(server); await NAV(S.page).waitFor().catch(() => {}); await settle(S.page);
        check('(b) cờ không đặt + token dev: thấy thanh tab và gọi /api/admin/me (hành vi cũ)', (await NAV(S.page).count()) === 1 && S.n(/^GET \/api\/admin\/me$/) >= 1, S.calls.join(', '));
        await S.page.context().close(); server.close();
      }
      {
        const dist = build({ VITE_CLERK_PUBLISHABLE_KEY: FAKE_CLERK_KEY }); const server = await serve(dist);
        const S = await open(server); await settle(S.page);
        check('(c0) cờ VẮNG khỏi môi trường build + có khoá Clerk (Clerk không tải được): không thanh tab, không gọi /api/admin/*', (await NAV(S.page).count()) === 0 && S.n(/\/api\/admin/) === 0, S.calls.join(', '));
        await S.page.context().close(); server.close();
      }
    }
  } finally { await browser.close(); }
  if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); process.exit(1); }
  console.log('PASS'); process.exit(0);
})().catch((e) => { console.log('FAIL không đạt hoặc ngoại lệ khi chạy: ' + String(e && e.message).split('\n')[0].slice(0, 200)); process.exit(1); });
