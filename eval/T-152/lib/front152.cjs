'use strict';
/* T-152: khung chạy chung cho eval front (repo tohong-front): vite build ra thư mục tạm, phục vụ bản build, giả API admin, mọi request ngoài bị chặn và ghi lại.
 * Không Google (ảnh giả do khung trả về, host ảnh chỉ là nhãn). Không đọc mã nguồn: đo theo nhãn, role và hình học. */
const fs = require('fs'); const os = require('os'); const path = require('path'); const http = require('http');
const { execSync } = require('child_process'); const { createRequire } = require('module');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const PHOTO_HOST = /^https:\/\/(www\.marry\.vn|lh3\.googleusercontent\.com)\//;

function setup(argv, tag) {
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const REPO = arg('--repo') && path.resolve(arg('--repo'));
  if (!REPO || !fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo trỏ tới tohong-front'); process.exit(2); }
  let chromium;
  for (const t of [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean)) {
    try { ({ chromium } = createRequire(path.join(REPO, 'x.js'))(t)); break; } catch { /* thử tiếp */ }
  }
  if (!chromium) { console.log('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)'); process.exit(2); }
  const fails = [];
  const check = (name, ok, extra) => {
    console.log(`${ok ? '  ok ' : '  XX '} ${name}${!ok && extra ? '  :: ' + String(extra).slice(0, 220) : ''}`);
    if (!ok) fails.push(`${name}${extra ? ' [' + String(extra).slice(0, 160) + ']' : ''}`);
  };
  let DIST = arg('--dist');
  if (!DIST) {
    DIST = fs.mkdtempSync(path.join(os.tmpdir(), `${tag}-dist-`));
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

  /* ---- dữ liệu giả ---- */
  const mkRow = (i, name, category = 'venue') => ({ n: i, id: `vd${i}`, name, category, catLabel: category === 'venue' ? 'Tiệc & nhà hàng' : 'Chụp ảnh', group: 'full',
    marry: { address: `Số ${i} đường thử`, price_min_vnd: null, price_max_vnd: null, price_unit: null, source_url: null },
    google: { matched: true, place_id: `ChIJthu${i}`, name: `Google ${name}`, similarity: 1, address: `Địa chỉ Google ${i}`, address_match: true, rating: 4.1, review_count: 12, photo_count: 1, maps_url: `https://www.google.com/maps/place/?q=place_id:ChIJthu${i}`, reject_reason: null },
    approvable: false, override: null, review: null });
  const ROWS = [mkRow(1, 'Alpha Hall'), mkRow(2, 'Beta Studio', 'photography'), mkRow(3, 'Gamma Garden')];
  const CATALOG = [
    { file: 'vendors.json', key: 'name', label: 'Tên vendor', stages: ['gen'], pool: ['name'] },
    { file: 'vendors.json', key: 'description', label: 'Mô tả', stages: ['gen'], pool: ['description'] },
  ];
  const GOOGLE_URL = 'https://lh3.googleusercontent.com/grass-cs/AAAAthu=s4800-w800';
  const MARRY_URL = 'https://www.marry.vn/images/detailed/1/thu-1.jpg';
  const BROKEN_URL = 'https://www.marry.vn/images/detailed/1/hong.jpg';
  const POOL_V = (id, name) => ({ id, name, category: id === 'vd2' ? 'photography' : 'venue', catLabel: 'x', description: 'Mô tả pool ' + name, styles: ['luxury'], tags: ['luxury'], priceMin: 3.9, priceMax: 4.7, city: 'HCMC', rating: 4.3, reviewCount: 20, isVerified: true,
    photos: [{ url: MARRY_URL, source: 'marry' }, { url: GOOGLE_URL, source: 'google', attribution: 'Tác giả Thử' }, { url: BROKEN_URL, source: 'marry' }], ...(id === 'vd2' ? {} : { capacity: { min: 100, max: 300 } }) });
  const detailOf = (id) => { const r = ROWS.find((x) => x.id === id);
    return { data_as_of: '2026-11-11T13:08:22', id, name: r.name, catalog: CATALOG, extra_inputs: [{ id: 'pool_base', label: 'Pool nền', note: 'ghi chú' }],
      source: { available: true, record: { name: r.name, description: 'Nguồn ' + r.name }, audit: null, truncated: {} },
      pool: { in_pool: true, visible: true, vendor: POOL_V(id, r.name), reasons: [], field_notes: [] }, overlay: null }; };
  const EDITABLE = { fields: ['name', 'description', 'styles', 'photos', 'capacity'], styles: ['luxury', 'rustic', 'natural', 'modern', 'traditional', 'minimalist', 'soft', 'simple', 'editorial', 'korean'],
    limits: { name: 120, description: 300, photos: 4, capacity: { min: 1, max: 5000 } } };
  const vendorInfo = (id) => { const v = POOL_V(id, ROWS.find((x) => x.id === id).name); return { vendor: v, effective: v, override: null, version: 0, orphan: false, edited_fields: [], source_changed: [], history: [], editable: EDITABLE }; };

  let browser;
  async function open(S) {
    await S.page.goto(`${S.base}/?admin`);
    await S.page.getByRole('button', { name: 'Dữ liệu vendor' }).first().click();
    await S.page.getByRole('button', { name: 'Enrich Google Maps' }).click();
    S.table = S.page.getByRole('table', { name: 'Bảng enrich vendor' });
    await S.table.waitFor();
  }
  async function scenario(opts = {}) {
    const { viewport = { width: 1280, height: 900 } } = opts;
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    page.setDefaultTimeout(4000);
    const S = { page, ctx, details: [], infos: [], puts: [], writes: [], external: [], photoReqs: [], info: vendorInfo, onPut: null, infoStatus: 200 };
    S.row = (name) => S.table.locator('tbody tr').filter({ hasText: name }).first();
    S.dlg = () => page.getByRole('dialog', { name: /^Chi tiết vendor/ });
    S.sep = () => page.getByRole('separator', { name: 'Kéo để đổi bề rộng ngăn kéo' });
    S.openRow = async (name, addr) => { await S.row(name).getByText(addr, { exact: false }).click(); await S.dlg().waitFor(); await page.waitForFunction(() => !/Đang tải/.test(document.querySelector('[role=dialog][aria-label^="Chi tiết vendor"]')?.innerText || '')); };
    await page.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith(S.base)) return route.continue();
      if (PHOTO_HOST.test(u)) { S.photoReqs.push(u); return u === BROKEN_URL ? route.abort() : route.fulfill({ status: 200, contentType: 'image/png', body: PNG }); }
      if (!/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)) S.external.push(u);
      return route.abort();
    });
    await page.route('http://api.test/**', async (route) => {
      const req = route.request(); const u = new URL(req.url()); const m = req.method();
      const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(o) });
      if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      if (u.pathname === '/api/admin/vendor-enrich' && m === 'GET') return json({ data_as_of: '2026-11-11T13:08:22', summary: { total: 3, groups: { full: 3 }, chips: { full: 3, no_google_photo: 0, name_similar: 0, addr_diff: 0 }, approvable: 0 }, total: 3, offset: 0, limit: 50, rows: ROWS });
      let x = u.pathname.match(/^\/api\/admin\/vendor-enrich\/([^/]+)\/detail$/);
      if (x && m === 'GET') { S.details.push(x[1]); return json(detailOf(x[1])); }
      x = u.pathname.match(/^\/api\/admin\/vendors\/([^/]+)$/);
      if (x && m === 'GET') { S.infos.push(x[1]); return S.infoStatus === 200 ? json(S.info(x[1])) : json({ error: 'x' }, S.infoStatus); }
      x = u.pathname.match(/^\/api\/admin\/vendors\/([^/]+)\/override$/);
      if (x && (m === 'PUT' || m === 'DELETE')) {
        let body = null; try { body = JSON.parse(req.postData() || 'null'); } catch { /* */ }
        S.puts.push({ method: m, id: x[1], body });
        if (S.onPut) { const r = S.onPut(body, x[1], m); if (r) return json(r.body, r.status); }
        return json({ override: { ...body, version: (body.expected_version || 0) + 1 }, version: (body.expected_version || 0) + 1 });
      }
      if (/\/review$/.test(u.pathname)) { S.writes.push({ method: m, path: u.pathname }); return json({ review: null }); }
      if (u.pathname === '/api/admin/me') return json({ admin: true, user_id: 'user_admin', counts: { connect_new: 0, upgrade_pending: 0, legacy_active: 0 } });
      if (u.pathname === '/api/admin/members-summary') return json({ accounts: { status: 'ok', total: 1, new_7d: 0, new_7d_capped: false }, couples: { total: 1, new_7d: 0, by_owner: { account: 1, guest: 0, unknown: 0 } }, computed_at: '2026-11-13T00:00:00Z' });
      if (u.pathname === '/api/admin/vendors') return json({ vendors: [], total: 0 });
      return json({});
    });
    S.base = `http://127.0.0.1:${server.address().port}`;
    await open(S);
    return S;
  }
  const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
  const H = {
    norm, text: async (loc) => norm(await loc.innerText()),
    near: (a, b, tol = 2) => Math.abs(a - b) <= tol,
    geom: (S) => S.dlg().evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, vw: innerWidth, vh: innerHeight }; }),
    wrapBox: (S) => S.table.locator('xpath=ancestor::div[contains(@class,"adm-enrich-wrap")][1]').boundingBox(),
    pageBox: (S) => S.page.evaluate(() => { const r = document.querySelector('main, #root')?.getBoundingClientRect(); return { x: r.x, w: r.width, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; }),
  };
  return { REPO, check, fails, server, scenario, H, urls: { GOOGLE_URL, MARRY_URL, BROKEN_URL }, ROWS, vendorInfo, POOL_V, EDITABLE,
    async run(body) {
      await new Promise((r) => server.listen(0, '127.0.0.1', r));
      browser = await chromium.launch();
      try { await body(); } catch (e) { check('bước thao tác không thực hiện được (thiếu phần tử mà spec yêu cầu?)', false, String(e.message).split('\n')[0]); }
      await browser.close(); server.close();
      if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
      console.log('PASS'); process.exit(0);
    } };
}
module.exports = { setup };
