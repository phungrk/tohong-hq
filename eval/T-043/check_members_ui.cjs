#!/usr/bin/env node
/*
 * Eval tầng 1 của T-043 (front): danh sách thành viên trong tab Thành viên của admin.
 * Phủ phần giao diện của tiêu chí 1, 2, 3, 4, 5 (hợp đồng và chữ hiển thị ở products/T-043-danh-sach-thanh-vien.md).
 *
 * Chạy:   cd /home/user/tohong-front && node /home/user/tohong-hq/eval/T-043/check_members_ui.cjs --repo . [--only 1,2,3,4,5] [--shots DIR] [--dist DIR]
 *   --repo   repo tohong-front (bắt buộc). Script tự `vite build` ra thư mục tạm (không ghi vào repo) với
 *            VITE_ADMIN_DEV_TOKEN=dev:admin, VITE_API_BASE=http://api.test, không Clerk; rồi tự phục vụ bản build.
 *   --only   chỉ tính các tiêu chí đó (1 nội dung dòng và vị trí, 2 tìm và chia trang, 3 quyền và chỉ đọc, 4 riêng tư,
 *            5 đang tải, lỗi, Clerk lỗi, 390px).
 *   --shots  ghi ảnh (390 và 1024, dữ liệu giả) vào DIR: dùng cho ảnh trong PR (tiêu chí 6).
 * In dòng cuối `PASS` hoặc `FAIL <lý do đầu tiên> (+n lỗi nữa)`; mã thoát 0 / 1 (2 = eval không chạy được).
 *
 * Không cần backend: mọi request tới http://api.test được giả (máy chủ giả tự chia trang và lọc để UI có gì mà hiển thị);
 * mọi request ra ngoài khác bị chặn và ghi lại. Dữ liệu là bịa. Chỉ đo hành vi nhìn thấy; không đọc mã nguồn.
 * Playwright tìm ở PLAYWRIGHT_PATH, <repo>/node_modules/playwright, /opt/node-tools/node_modules/playwright.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');
const { createRequire } = require('module');

const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REPO = arg('--repo') && path.resolve(arg('--repo'));
if (!REPO || !fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo trỏ tới tohong-front'); process.exit(2); }
const SHOTS = arg('--shots');
const ONLY = arg('--only') ? arg('--only').split(',').map(Number) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean);
  for (const t of tries) { try { return createRequire(path.join(REPO, 'x.js'))(t); } catch { /* thử tiếp */ } }
  console.log('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)'); process.exit(2);
}
const { chromium } = loadPlaywright();

const fails = [];
let crit = 1;
const check = (name, ok, extra) => {
  if (ONLY && !ONLY.includes(crit)) return;
  console.log(`${ok ? '  ok ' : '  XX '} [TC${crit}] ${name}${!ok && extra ? '  :: ' + String(extra).slice(0, 220) : ''}`);
  if (!ok) fails.push(`[TC${crit}] ${name}${extra ? ' [' + String(extra).slice(0, 160) + ']' : ''}`);
};
const wants = (c) => !ONLY || ONLY.includes(c);
const stepFail = (e) => check('bước thao tác không thực hiện được (thiếu phần tử mà spec yêu cầu?)', false, String(e.message).split('\n')[0]);

/* ---------- build + server ---------- */
let DIST = arg('--dist');
if (!DIST) {
  DIST = fs.mkdtempSync(path.join(os.tmpdir(), 't043-dist-'));
  try {
    execSync(`npx vite build --outDir ${JSON.stringify(DIST)} --emptyOutDir`, {
      cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: '', VITE_ADMIN_DEV_TOKEN: 'dev:admin', VITE_API_BASE: 'http://api.test' },
    });
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

/* ---------- dữ liệu giả ---------- */
const PHONE = '0987654321';
const cp = (bride, groom, role, date) => ({ bride_name: bride, groom_name: groom, role, created_at: date, phone: PHONE });
const acct = (email, couples) => ({ kind: 'account', email, email_status: email ? 'ok' : 'unavailable', couples, phone: PHONE });
const guest = (couples) => ({ kind: 'guest', email: null, email_status: 'guest', couples });
const HAND = [
  acct('zung.do@example.com', [cp('Trương Mỹ Linh', 'Đinh Công Sơn', 'owner', '2026-11-01')]),
  acct('an.pham@example.com', [cp('Trương Mỹ Linh', 'Đinh Công Sơn', 'member', '2026-11-01')]),
  guest([cp('Võ Ngọc Ánh', 'Bùi Văn Đông', 'owner', '2026-10-31')]),
  acct('lan.nguyen@example.com', [cp('Nguyễn Thị Lan', 'Trần Đức Minh', 'owner', '2026-10-30')]),
  guest([cp('Cao Bảo Châu', 'Lý Hải Nam', 'owner', '2026-10-25')]),
  guest([cp('Âu Dương Mai', 'Quách Tuấn Kiệt', 'owner', '2026-10-25')]),
  acct('hoa.le@example.com', [
    cp('Lê Thị Hoa', 'Phạm Quốc Đạt', 'owner', '2026-10-20'),
    cp('Mai Phương', 'Hồ Trung Kiên', 'viewer', '2026-10-10'),
    cp('Đặng Thu Hằng', null, 'owner', '2026-09-15'),
  ]),
  acct('binh.vo@example.com', [cp('Mai Phương', 'Hồ Trung Kiên', 'owner', '2026-10-10'), cp(null, null, 'owner', '2026-08-01')]),
  { kind: 'unknown', email: null, email_status: 'none', couples: [cp('Hoàng Yến', 'Ngô Quang Vinh', null, '2026-08-02')], phone: PHONE },
];
const LONG_EMAIL = 'nguoi.dung.co.dia.chi.email.rat.dai.de.thu.tran.man.hinh.dien.thoai@example-wedding-domain.com';
const FILLER = Array.from({ length: 36 }, (_, i) => guest([cp(`Cô Dâu Mẫu ${i + 1}`, `Chú Rể Mẫu ${i + 1}`, 'owner', '2026-07-01')]));
FILLER[0] = acct(LONG_EMAIL, [cp('Cô Dâu Mẫu 1', 'Chú Rể Mẫu 1', 'owner', '2026-07-01')]);
const ALL = [...HAND, ...FILLER]; // 45 dòng -> 3 trang cỡ 20
const NAMES = ['Trương Mỹ Linh', 'Đinh Công Sơn', 'Nguyễn Thị Lan', 'Trần Đức Minh', 'Bùi Văn Đông', 'Đặng Thu Hằng', 'Hoàng Yến', 'lan.nguyen', 'zung.do', 'binh.vo'];

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
const hay = (r) => norm([r.email, ...r.couples.flatMap((c) => [c.bride_name, c.groom_name])].filter(Boolean).join(' | '));

const SUMMARY = { accounts: { status: 'ok', total: 12, new_7d: 3, new_7d_capped: false }, couples: { total: 45, new_7d: 4, by_owner: { account: 9, guest: 35, unknown: 1 } }, computed_at: new Date().toISOString(), cached: false };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

/* ---------- một kịch bản = một trang mới với máy chủ giả riêng ---------- */
let browser;
async function scenario(opts = {}) {
  const { viewport = { width: 1024, height: 900 }, delay = 0, failTimes = 0, failStatus = 500, data = ALL, emailsDown = false } = opts;
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(4000);
  const S = { page, ctx, listReqs: [], other: [], external: [], consoleMsgs: [], urls: [], failLeft: failTimes };
  page.on('console', (m) => S.consoleMsgs.push(m.text()));
  page.on('pageerror', (e) => S.consoleMsgs.push('pageerror ' + e.message));
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) S.urls.push(f.url()); });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(S.base)) return route.continue();
    S.external.push({ url: u, post: route.request().postData() || '' });
    return route.abort();
  });
  await page.route('http://api.test/**', async (route) => {
    const req = route.request(); const u = new URL(req.url()); const m = req.method();
    const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(o) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (u.pathname === '/api/admin/members-list') {
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch { /* để trống */ }
      S.listReqs.push({ method: m, path: u.pathname, search: u.search, body, auth: req.headers().authorization || '' });
      if (delay) await new Promise((r) => setTimeout(r, delay));
      if (opts.forbidden) return json({ error: 'forbidden' }, 403);
      if (S.failLeft > 0) { S.failLeft--; return json({ error: 'members_list_failed' }, failStatus); }
      const q = norm(body.q);
      const size = body.size || 20; const pg = body.page || 1;
      const rows = (q ? data.filter((r) => hay(r).includes(q)) : data)
        .map((r) => (emailsDown && r.kind === 'account' ? { ...r, email: null, email_status: 'unavailable' } : r));
      return json({ page: pg, size, total: rows.length, total_pages: Math.ceil(rows.length / size), email_complete: !emailsDown,
        computed_at: new Date().toISOString(), cached: false, items: rows.slice((pg - 1) * size, pg * size) });
    }
    S.other.push({ method: m, path: u.pathname + u.search });
    if (u.pathname === '/api/admin/me') return json({ admin: true, counts: { connect_new: 0, upgrade_pending: 0, legacy_active: 0 } });
    if (u.pathname === '/api/admin/members-summary') return json(SUMMARY);
    return json({});
  });
  S.base = `http://127.0.0.1:${server.address().port}`;
  await page.goto(`${S.base}/?admin`);
  S.region = page.getByRole('region', { name: 'Danh sách thành viên' });
  S.rows = () => S.region.getByRole('listitem');
  S.search = page.getByRole('searchbox', { name: 'Tìm theo email hoặc tên' });
  return S;
}
const texts = async (S) => S.rows().evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
const waitRows = async (S, n) => { await S.rows().first().waitFor({ timeout: 8000 }); if (n != null) await S.page.waitForFunction(([sel, k]) => document.querySelectorAll(sel).length === k, ['[aria-label="Danh sách thành viên"] li', n], { timeout: 8000 }); };
const pageText = (S) => S.page.evaluate(() => document.body.innerText + '\n' + document.body.textContent);
const settle = (S, ms = 700) => S.page.waitForTimeout(ms);

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  browser = await chromium.launch();
  try {
    /* ===== TC1: nội dung dòng, vị trí ===== */
    crit = 1;
    if (wants(1)) try {
      const S = await scenario();
      let ok = true;
      try { await waitRows(S, 20); } catch { ok = false; }
      check('có danh sách (region "Danh sách thành viên") với 20 dòng ở trang đầu', ok, ok ? '' : `không thấy dòng nào; ${S.listReqs.length} request danh sách`);
      if (ok) {
        const t = await texts(S);
        const has = (i, ...parts) => parts.every((p) => (t[i] || '').includes(p));
        check('dòng 1: email Clerk, tên cô dâu và chú rể có dấu, vai trò "Chủ cặp đôi", ngày dd/MM/yyyy', has(0, 'zung.do@example.com', 'Cô dâu: Trương Mỹ Linh', 'Chú rể: Đinh Công Sơn', 'Chủ cặp đôi', '01/11/2026'), t[0]);
        check('dòng 2: vai trò "Thành viên"', has(1, 'an.pham@example.com', 'Thành viên'), t[1]);
        check('dòng khách: ghi "khách", không có email', has(2, 'khách', 'Võ Ngọc Ánh', 'Bùi Văn Đông', '31/10/2026') && !/@/.test(t[2] || ''), t[2]);
        const r7 = t[6] || '';
        const order = ['Lê Thị Hoa', 'Mai Phương', 'Đặng Thu Hằng'].map((s) => r7.indexOf(s));
        check('một tài khoản nhiều cặp đôi: liệt kê đủ 3 cặp, theo thứ tự máy chủ trả về', order.every((x) => x >= 0) && order[0] < order[1] && order[1] < order[2], r7);
        check('nhiều cặp đôi: mỗi cặp có vai trò và ngày của nó (Chỉ xem 10/10/2026; 15/09/2026)', has(6, 'Chỉ xem', '10/10/2026', '15/09/2026', '20/10/2026'), r7);
        check('thiếu tên chú rể -> "Chú rể: chưa điền" (cô dâu vẫn hiện)', has(6, 'Đặng Thu Hằng', 'Chú rể: chưa điền'), r7);
        check('thiếu cả hai tên -> hai chỗ "chưa điền"', (t[7] || '').includes('Cô dâu: chưa điền') && (t[7] || '').includes('Chú rể: chưa điền') && (t[7] || '').includes('01/08/2026'), t[7]);
        check('dòng chủ sở hữu không rõ: "không rõ chủ sở hữu", vai trò "Không rõ vai trò", vẫn có tên', has(8, 'không rõ chủ sở hữu', 'Không rõ vai trò', 'Hoàng Yến', 'Ngô Quang Vinh'), t[8]);
        check('thứ tự dòng đúng thứ tự máy chủ trả về (không tự sắp xếp lại)', (t[3] || '').includes('lan.nguyen@example.com') && (t[0] || '').includes('zung.do'), `${(t[0] || '').slice(0, 30)} | ${(t[3] || '').slice(0, 30)}`);
        const box = await S.page.evaluate(() => {
          const by = (re) => [...document.querySelectorAll('h1,h2,h3,h4,button,div,span')].filter((e) => e.children.length === 0 && re.test(e.textContent.trim()));
          const heading = by(/^Cặp đôi$/)[0]; const refresh = by(/^Làm mới$/)[0];
          const region = document.querySelector('[aria-label="Danh sách thành viên"]');
          const r = (e) => e && e.getBoundingClientRect();
          return { heading: r(heading)?.bottom, refresh: r(refresh)?.bottom, region: r(region)?.top };
        });
        check('vị trí: danh sách nằm dưới các con số (dưới thẻ "Cặp đôi" và nút "Làm mới")', box.region != null && box.heading != null && box.region >= box.heading && box.region >= (box.refresh ?? 0), JSON.stringify(box));
        check('con số tổng quan vẫn còn (Tài khoản đã đăng nhập, Cập nhật lúc, Làm mới)', /Tài khoản đã đăng nhập/.test(await pageText(S)) && /Làm mới/.test(await pageText(S)));
      }
      if (SHOTS) { await S.page.screenshot({ path: path.join(SHOTS, 'members-list-1024.png') }); }
      await S.ctx.close();
    } catch (e) { stepFail(e); }

    /* ===== TC2: tìm và chia trang ===== */
    crit = 2;
    if (wants(2)) try {
      const S = await scenario();
      try { await waitRows(S, 20); } catch { /* check dưới sẽ đỏ */ }
      const first = S.listReqs[0];
      check('lần tải đầu: một request POST /api/admin/members-list với page 1, size 20, q rỗng', !!first && first.method === 'POST' && first.body.page === 1 && first.body.size === 20 && (first.body.q || '') === '', JSON.stringify(first && first.body));
      const body = await pageText(S);
      check('hiện "Trang 1/3" và "45 thành viên"', /Trang 1\/3/.test(body) && /45 thành viên/.test(body));
      const prev = S.page.getByRole('button', { name: 'Trang trước' }); const next = S.page.getByRole('button', { name: 'Trang sau' });
      check('trang đầu: "Trang trước" bị khoá, "Trang sau" bấm được', (await prev.count()) === 1 && (await prev.isDisabled()) && (await next.isEnabled().catch(() => false)));
      const n0 = S.listReqs.length;
      if (await next.count()) { await next.click(); await S.page.waitForFunction(() => /Trang 2\/3/.test(document.body.textContent), null, { timeout: 5000 }).catch(() => {}); }
      const r2 = S.listReqs[n0];
      check('bấm "Trang sau" -> request page 2 và hiện "Trang 2/3" với 20 dòng khác', !!r2 && r2.body.page === 2 && /Trang 2\/3/.test(await pageText(S)) && (await S.rows().count()) === 20);
      if (await next.count()) { await next.click(); await S.page.waitForFunction(() => /Trang 3\/3/.test(document.body.textContent), null, { timeout: 5000 }).catch(() => {}); }
      check('trang cuối: 5 dòng, "Trang sau" bị khoá', (await S.rows().count()) === 5 && (await next.isDisabled().catch(() => false)));
      // gõ khi đang ở trang 3: về trang 1; debounce
      const n1 = S.listReqs.length;
      await S.search.click();
      await S.page.keyboard.type('nguyen thi lan', { delay: 25 });
      await S.page.waitForFunction(() => document.querySelectorAll('[aria-label="Danh sách thành viên"] li').length === 1, null, { timeout: 5000 }).catch(() => {});
      const sent = S.listReqs.slice(n1);
      check('gõ 14 ký tự liên tục chỉ gửi vài request (debounce), request cuối có q đúng như gõ và page 1', sent.length >= 1 && sent.length <= 4 && sent[sent.length - 1].body.q === 'nguyen thi lan' && sent[sent.length - 1].body.page === 1, JSON.stringify(sent.map((s) => s.body)));
      const t = await texts(S);
      check('kết quả tìm: 1 dòng của Nguyễn Thị Lan, "1 thành viên", không còn phân trang thừa', t.length === 1 && t[0].includes('lan.nguyen@example.com') && /1 thành viên/.test(await pageText(S)), t.join(' | '));
      // có dấu, hoa: gửi nguyên văn (máy chủ lo chuẩn hoá)
      const n2 = S.listReqs.length;
      await S.search.fill('  NGUYỄN  ');
      await S.page.waitForFunction((k) => k, S.listReqs.length > n2, { timeout: 100 }).catch(() => {});
      await settle(S, 900);
      const lastQ = S.listReqs[S.listReqs.length - 1];
      check('q gửi đi đã cắt khoảng trắng hai đầu và giữ nguyên dấu, hoa thường ("NGUYỄN")', lastQ.body.q === 'NGUYỄN', JSON.stringify(lastQ.body));
      await S.search.fill('zzzzzz'); await settle(S, 900);
      check('không có kết quả: hiện "Không tìm thấy thành viên nào khớp", không có dòng nào', /Không tìm thấy thành viên nào khớp/.test(await pageText(S)) && (await S.rows().count()) === 0);
      await S.search.fill(''); await settle(S, 900);
      check('xoá ô tìm -> trở lại danh sách đầy đủ, trang 1', (await S.rows().count()) === 20 && /Trang 1\/3/.test(await pageText(S)));
      await S.ctx.close();
      const E = await scenario({ data: [] });
      await settle(E, 900);
      check('chưa có thành viên nào: hiện "Chưa có thành viên nào"', /Chưa có thành viên nào/.test(await pageText(E)));
      await E.ctx.close();
    } catch (e) { stepFail(e); }

    /* ===== TC3: quyền, chỉ đọc (phía giao diện) ===== */
    crit = 3;
    if (wants(3)) try {
      const S = await scenario();
      try { await waitRows(S, 20); } catch { /* */ }
      await S.search.fill('hoa').catch(() => {}); await settle(S, 900);
      const reqs = S.listReqs;
      check('mọi lời gọi danh sách là POST tới đúng /api/admin/members-list, không query string, có Authorization', reqs.length > 0 && reqs.every((r) => r.method === 'POST' && r.path === '/api/admin/members-list' && r.search === '' && /^Bearer /.test(r.auth)), JSON.stringify(reqs.map((r) => [r.method, r.path, r.search])));
      check('giao diện chỉ gọi các route đọc: không PUT/PATCH/DELETE, không POST nào ngoài members-list', S.other.every((r) => r.method === 'GET' || r.method === 'OPTIONS'), JSON.stringify(S.other.filter((r) => r.method !== 'GET')));
      await S.ctx.close();
      const F = await scenario({ forbidden: true });
      await settle(F, 1200);
      const alert = F.region.getByRole('alert');
      check('danh sách bị 403: hiện thông báo lỗi trong vùng danh sách, không có dòng nào', (await alert.count()) >= 1 && (await F.rows().count()) === 0, await alert.allTextContents().catch(() => ''));
      await F.ctx.close();
    } catch (e) { stepFail(e); }

    /* ===== TC4: riêng tư ===== */
    crit = 4;
    if (wants(4)) try {
      const S = await scenario({ emailsDown: false });
      try { await waitRows(S, 20); } catch { /* */ }
      await S.search.fill('Nguyễn Thị Lan').catch(() => {}); await settle(S, 900);
      await S.page.getByRole('button', { name: 'Trang sau' }).click({ timeout: 500 }).catch(() => {});
      await S.search.fill('Hằng').catch(() => {}); await settle(S, 900);
      const text = await pageText(S);
      check('không hiện số điện thoại dù máy chủ giả có nhét thêm trường phone', !text.includes(PHONE) && !/\b0\d{9}\b/.test(text));
      check('không hiện mã người dùng hay mã cặp đôi', !/user_[a-z0-9]|guest_[a-z0-9]|couple_\d/i.test(text));
      check('địa chỉ trang không đổi khi tìm và chuyển trang (vẫn /?admin, không chứa từ khoá)', S.urls.every((u) => /\/\?admin$/.test(u)) && !/Han|Lan|%/.test(S.page.url()), S.urls.join(' | '));
      check('request danh sách không mang từ khoá trên URL (từ khoá chỉ ở thân POST)', S.listReqs.every((r) => r.search === '') && S.listReqs.some((r) => r.body.q === 'Hằng'));
      const leak = S.consoleMsgs.filter((m) => NAMES.some((n) => m.includes(n)) || /Hằng|Nguyễn Thị Lan/.test(m));
      check('console của trình duyệt không chứa tên hay email', leak.length === 0, leak[0]);
      const ext = S.external.filter((r) => NAMES.some((n) => (r.url + r.post).includes(n) || decodeURIComponent(r.url + r.post).includes(n)));
      check('không request nào ra ngoài (analytics, bên thứ ba) mang tên hay email', ext.length === 0, ext[0] && ext[0].url);
      check('trang admin không gọi host lạ nào ngoài máy chủ API (không analytics)', S.external.filter((r) => !/fonts\.(googleapis|gstatic)\.com/.test(r.url)).length === 0, S.external.map((r) => r.url).join(' '));
      const stored = await S.page.evaluate(() => JSON.stringify([localStorage, sessionStorage]) + document.title);
      check('không lưu tên, email hay từ khoá vào localStorage/sessionStorage, tiêu đề trang không đổi', !/Hằng|Nguyễn|@example/.test(stored), stored.slice(0, 120));
      await S.ctx.close();
    } catch (e) { stepFail(e); }

    /* ===== TC5: đang tải, lỗi + Thử lại, Clerk lỗi, 390px ===== */
    crit = 5;
    if (wants(5)) try {
      const L = await scenario({ delay: 1500 });
      await L.page.waitForTimeout(500);
      const loading = L.page.getByText('Đang tải danh sách…');
      const busy = await L.region.getAttribute('aria-busy').catch(() => null);
      check('khi đang tải: hiện "Đang tải danh sách…" và region có aria-busy=true', (await loading.count()) >= 1 && busy === 'true', `busy=${busy}`);
      check('đang tải danh sách vẫn thấy các con số tổng quan và các tab khác dùng được', /Tài khoản đã đăng nhập/.test(await pageText(L)) && (await L.page.getByRole('button', { name: 'Hộp kết nối' }).isEnabled().catch(() => true)));
      await L.page.waitForTimeout(1800);
      check('tải xong: hết chữ "Đang tải danh sách…", aria-busy=false hoặc không có', (await loading.count()) === 0 && (await L.region.getAttribute('aria-busy')) !== 'true');
      await L.ctx.close();

      const E = await scenario({ failTimes: 1 });
      await E.page.waitForTimeout(1200);
      const alert = E.region.getByRole('alert');
      check('lỗi: hiện thông báo role=alert trong vùng danh sách kèm nút "Thử lại"; con số tổng quan vẫn còn', (await alert.count()) >= 1 && (await E.region.getByRole('button', { name: 'Thử lại' }).count()) === 1 && /Tài khoản đã đăng nhập/.test(await pageText(E)));
      await E.region.getByRole('button', { name: 'Thử lại' }).click().catch(() => {});
      await waitRows(E, 20).catch(() => {});
      check('bấm "Thử lại" -> gửi lại cùng page, q và hiện danh sách', E.listReqs.length === 2 && JSON.stringify(E.listReqs[1].body) === JSON.stringify(E.listReqs[0].body) && (await E.rows().count()) === 20, JSON.stringify(E.listReqs.map((r) => r.body)));
      await E.ctx.close();

      const E2 = await scenario();
      try { await waitRows(E2, 20); } catch { /* */ }
      E2.failLeft = 1;
      await E2.search.fill('hoa.le'); await E2.page.waitForTimeout(1200);
      await E2.region.getByRole('button', { name: 'Thử lại' }).click().catch(() => {});
      await E2.page.waitForTimeout(900);
      const lastTwo = E2.listReqs.slice(-2).map((r) => r.body);
      check('lỗi khi đang tìm "hoa.le": Thử lại gửi lại đúng q "hoa.le" trang 1 rồi hiện kết quả', lastTwo.length === 2 && lastTwo.every((b) => b.q === 'hoa.le' && b.page === 1) && (await E2.rows().count()) === 1, JSON.stringify(lastTwo));
      await E2.ctx.close();

      const C = await scenario({ emailsDown: true });
      try { await waitRows(C, 20); } catch { /* */ }
      const t = await texts(C);
      check('Clerk lỗi: dòng tài khoản ghi "chưa lấy được email" và vẫn đủ tên cô dâu, chú rể', (t[0] || '').includes('chưa lấy được email') && (t[0] || '').includes('Trương Mỹ Linh') && (t[0] || '').includes('Đinh Công Sơn') && !/@/.test(t[0] || ''), t[0]);
      check('Clerk lỗi: dòng khách vẫn ghi "khách"', (t[2] || '').includes('khách'));
      check('Clerk lỗi, chưa tìm: không có ghi chú về tìm theo email', !/tìm theo email có thể thiếu/.test(await pageText(C)));
      await C.search.fill('hoa'); await settle(C, 900);
      check('Clerk lỗi và đang tìm: có ghi chú "Một số email chưa lấy được nên tìm theo email có thể thiếu kết quả."', /Một số email chưa lấy được nên tìm theo email có thể thiếu kết quả\./.test(await pageText(C)));
      await C.ctx.close();

      const M = await scenario({ viewport: { width: 390, height: 844 } });
      try { await waitRows(M, 20); } catch { /* */ }
      const m = await M.page.evaluate(() => {
        const de = document.documentElement; const region = document.querySelector('[aria-label="Danh sách thành viên"]');
        const lis = [...(region ? region.querySelectorAll('li') : [])]; const rects = lis.map((e) => e.getBoundingClientRect());
        const s = document.querySelector('input[type=search]'); const btns = [...document.querySelectorAll('button')].filter((b) => /^Trang (trước|sau)$/.test(b.textContent.trim()) || /^Trang (trước|sau)$/.test(b.getAttribute('aria-label') || ''));
        return { sw: de.scrollWidth, cw: de.clientWidth, maxRight: Math.max(0, ...rects.map((r) => r.right)), minLeft: Math.min(1e9, ...rects.map((r) => r.left)), n: lis.length,
          searchH: s && s.getBoundingClientRect().height, searchW: s && s.getBoundingClientRect().width, btnH: btns.map((b) => b.getBoundingClientRect().height), nb: btns.length };
      });
      check('390px: không cuộn ngang (kể cả dòng có email dài 90 ký tự)', m.n > 0 && m.sw <= m.cw, JSON.stringify(m));
      check('390px: mọi dòng nằm trong bề ngang màn hình', m.n > 0 && m.maxRight <= m.cw + 0.5 && m.minLeft >= -0.5, JSON.stringify(m));
      check('390px: ô tìm cao >= 40px và rộng >= 200px; hai nút chia trang cao >= 40px', m.searchH >= 40 && m.searchW >= 200 && m.nb === 2 && m.btnH.every((h) => h >= 40), JSON.stringify(m));
      const longRow = (await texts(M)).find((x) => x.includes('nguoi.dung.co.dia.chi'));
      check('390px: email dài vẫn hiện đủ (xuống dòng, không cắt)', !!longRow && longRow.includes(LONG_EMAIL), longRow && longRow.slice(0, 80));
      if (SHOTS) {
        await M.page.screenshot({ path: path.join(SHOTS, 'members-list-390.png'), fullPage: true });
      }
      await M.ctx.close();
    } catch (e) { stepFail(e); }
  } catch (e) {
    console.log('FAIL eval lỗi ngoài dự kiến: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | '));
    await browser.close(); server.close(); process.exit(2);
  }
  await browser.close(); server.close();
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
