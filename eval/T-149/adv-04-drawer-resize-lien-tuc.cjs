#!/usr/bin/env node
/*
 * T-149 adv-04 (tầng 3, adversary, Code Gate v2): hồi quy của phần sửa adv-02 (drawer nghe resize) ở tohong-front.
 * Chạy: cd <tohong-front> && node /home/user/tohong-hq/eval/T-149/adv-04-drawer-resize-lien-tuc.cjs --repo .   (hoặc bash eval/T-149/adv-04-drawer-resize-lien-tuc.sh)
 * Khung chạy chép nguyên văn từ eval/T-147/check_6_ui_drawer.cjs.
 * Input: drawer đang mở ở 1280 (độ rộng đã chỉnh 680), đổi khung nhìn liên tục 40 bước 1280↔560 rồi ngược lại, mỗi bước đo ngay sau một khung hình.
 * Mong đợi (spec T-147 Hành vi 5): ở MỌI bước bố cục đúng luật khung hiện tại (ĐẨY ⇔ khung − bề rộng ≥ 640 và lề phải = bề rộng; PHỦ thì lề 0; bề rộng trong [min, max];
 * tay cầm ⇔ max > min; không cuộn ngang); drawer không bị gắn lại (cùng phần tử DOM), không quay lại "Đang tải…", không gọi lại API chi tiết;
 * về lại 1280 thì độ rộng đã chỉnh (680) còn nguyên (resize không ghi đè độ rộng đã nhớ).
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
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
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

/* ---------- dữ liệu giả ---------- */
const LABEL = { full: 'Enrich 100%', temp_closed: 'Tạm đóng cửa', name_similar: 'Tên hơi giống', not_found: 'Không thấy trên Maps', addr_diff_accepted: 'Địa chỉ khác marry' };
const mk = (i, name, group, extra = {}) => ({
  id: `vd${i}`, name, category: 'venue', catLabel: 'Tiệc & nhà hàng', group,
  marry: { address: `Số ${i} đường thử, Quận ${i}`, price_min_vnd: null, price_max_vnd: null, price_unit: null, source_url: null },
  google: group === 'temp_closed' || group === 'not_found' ? null : { matched: group === 'full', place_id: `ChIJthu${i}`, name: `Google ${name}`, similarity: group === 'full' ? 1 : 0.7, address: `Địa chỉ Google ${i}`, address_match: group === 'full', rating: 4.1, review_count: 12, photo_count: 1, maps_url: `https://www.google.com/maps/place/?q=place_id:ChIJthu${i}`, reject_reason: group === 'full' ? null : 'low_score' },
  approvable: group === 'name_similar', override: null, review: null, ...extra,
});
const ROWS = [
  mk(1, 'Alpha Hall', 'full'), mk(2, 'Beta Closed', 'temp_closed'), mk(3, 'Gamma Garden', 'name_similar'), mk(4, 'Delta Palace', 'name_similar'),
  mk(5, 'Epsilon Forbidden', 'not_found'), mk(6, 'Zeta Missing', 'not_found'), mk(7, 'Eta Slow', 'addr_diff_accepted'), mk(8, 'Theta Plain', 'full'),
].map((r, i) => ({ ...r, n: i + 1 }));
const SUMMARY = { total: ROWS.length, groups: Object.fromEntries(Object.keys(LABEL).map((g) => [g, ROWS.filter((r) => r.group === g).length])),
  chips: { full: 2, no_google_photo: 2, name_similar: 2, addr_diff: 0 }, approvable: 2 };
const CATALOG = [
  { file: 'vendors.json', key: 'name', label: 'Tên vendor', stages: ['style', 'gen'], pool: ['name'] },
  { file: 'vendors.json', key: 'description', label: 'Mô tả', stages: ['style', 'gen'], pool: ['description'], max_chars: 400 },
  { file: 'vendors.json', key: 'price_range.min_vnd', label: 'Giá thấp nhất (VND)', stages: ['gen'], pool: ['priceMin'] },
  { file: 'vendors.json', key: 'top_reviews[].text', label: 'Nội dung đánh giá', stages: ['style', 'gen'], pool: ['reviews'], max_chars: 400 },
  { file: 'vendors.json', key: 'zz_tuong_lai', label: 'Trường tương lai ZZ', stages: ['gen'], pool: [] }, // có trong danh mục nhưng record không có: phải hiện "—"
  { file: 'vendors.json', key: 'zz_them', label: 'Trường thêm ZZ', stages: ['gen'], pool: [] }, // trường mà giao diện không thể biết trước
  { file: 'enrichment-audit.json', key: 'closed_state', label: 'Audit: trạng thái đóng cửa', stages: ['build'], pool: [] },
];
const REC = { name: 'Alpha Hall', description: 'Mô tả đã cắt của Alpha', price_range: { min_vnd: 3999000 }, top_reviews: [{ text: 'Rất tốt T147' }, { text: 'Phục vụ nhiệt tình T147' }], zz_them: 'gia-tri-zz-them' };
const POOL_V = { id: 'vd1', name: 'Alpha Hall', category: 'venue', catLabel: 'Tiệc & nhà hàng', description: 'Mô tả pool', styles: ['luxury', 'modern'], priceMin: 3.9, priceMax: 4.7, city: 'HCMC', rating: 4.3, reviewCount: 2046, isVerified: true };
const EXTRA = [{ id: 'pool_base', label: 'Pool nền (--base) ZZ', note: 'Ghi chú pool nền ZZ' }, { id: 'image_manifest', label: 'Manifest ảnh ZZ', note: 'Ghi chú manifest ZZ' }];
const NOTES = [{ field: 'priceMin', code: 'kept_from_base', text: 'giữ từ pool nền (ADR-025, --styles-only): nguồn hiện cho 3.9' }, { field: 'priceMax', code: 'admin_override', text: 'admin sửa (R2): 22.5' }];
const detailOf = (id) => {
  const row = ROWS.find((r) => r.id === id);
  const base = { data_as_of: '2026-11-11T13:08:22.633793', id, name: row.name, catalog: CATALOG, extra_inputs: EXTRA };
  if (id === 'vd1') return { ...base, source: { available: true, record: REC, audit: { closed_state: 'none' }, truncated: { description: 1534 } }, pool: { in_pool: true, visible: true, vendor: POOL_V, reasons: [], field_notes: NOTES }, overlay: null };
  if (id === 'vd2') return { ...base, source: { available: true, record: { ...REC, name: 'Beta Closed' }, audit: { closed_state: 'temporarily_closed' }, truncated: {} }, pool: { in_pool: false, visible: false, vendor: null, reasons: [{ code: 'temp_closed', text: 'Tạm đóng cửa: không vào pool' }] }, overlay: null };
  if (id === 'vd3') return { ...base, source: { available: true, record: { ...REC, name: 'Gamma Garden' }, audit: null, truncated: {} }, pool: { in_pool: true, visible: false, vendor: { ...POOL_V, id: 'vd3', name: 'Gamma Garden' }, reasons: [{ code: 'overlay_hidden', text: 'Admin đã ẩn vendor (lớp R2): cặp đôi không thấy' }] },
    overlay: { hidden: true, hidden_reason: 'Ẩn thử T-147', priceMin: 11.5, priceMax: 22.5, price_verified: true } };
  if (id === 'vd4') return { ...base, source: { available: false, record: null, audit: null, truncated: {} }, pool: { in_pool: true, visible: true, vendor: { ...POOL_V, id: 'vd4', name: 'Delta Palace' }, reasons: [] }, overlay: null };
  if (id === 'vd7') return { ...base, source: { available: true, record: { ...REC, name: 'Eta Slow' }, audit: null, truncated: {} }, pool: { in_pool: true, visible: true, vendor: { ...POOL_V, id: 'vd7', name: 'Eta Slow' }, reasons: [] }, overlay: null };
  return { ...base, source: { available: true, record: { ...REC, name: row.name }, audit: null, truncated: {} }, pool: { in_pool: true, visible: true, vendor: { ...POOL_V, id: row.id, name: row.name }, reasons: [] }, overlay: null };
};
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

/* ---------- build + server ---------- */
let DIST = arg('--dist');
if (!DIST) {
  DIST = fs.mkdtempSync(path.join(os.tmpdir(), 't147-dist-'));
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
async function openTable(S) {
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
  const S = { page, ctx, details: [], writes: [], external: [], store: new Map(), slowMs: 400 };
  S.rows = () => S.table.locator('tbody tr');
  S.row = (name) => S.table.locator('tbody tr').filter({ hasText: name }).first();
  S.dlg = () => page.getByRole('dialog', { name: /^Chi tiết vendor/ });
  S.sep = () => page.getByRole('separator', { name: 'Kéo để đổi bề rộng ngăn kéo' });
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
    if (u.pathname === '/api/admin/vendor-enrich' && m === 'GET') {
      return json({ data_as_of: '2026-11-11T13:08:22.633793', summary: SUMMARY, total: ROWS.length, offset: 0, limit: 50, rows: ROWS.map((r) => ({ ...r, review: S.store.get(r.id) || null })) });
    }
    const md = u.pathname.match(/^\/api\/admin\/vendor-enrich\/([^/]+)\/detail$/);
    if (md && m === 'GET') {
      S.details.push(md[1]);
      if (md[1] === 'vd5') return json({ error: 'forbidden' }, 403);
      if (md[1] === 'vd6') return json({ error: 'not_found' }, 404);
      if (md[1] === 'vd7') await new Promise((r) => setTimeout(r, S.slowMs));
      return json(detailOf(md[1]));
    }
    const mm = u.pathname.match(/^\/api\/admin\/vendor-enrich\/([^/]+)\/review$/);
    if (mm && (m === 'PUT' || m === 'DELETE')) {
      let body = null; try { body = JSON.parse(req.postData() || 'null'); } catch { /* */ }
      S.writes.push({ method: m, id: mm[1], body });
      if (m === 'DELETE') { S.store.delete(mm[1]); return json({ review: null }); }
      const rv = { state: 'pending', decision: body.decision, action: 'accept_place', place_id: 'ChIJthu', reason: 'Admin duyệt', reviewed_by: 'user_admin', reviewed_at: new Date().toISOString(), by_capu: true };
      S.store.set(mm[1], rv); return json({ review: rv });
    }
    if (u.pathname === '/api/admin/me') return json({ admin: true, user_id: 'user_admin', counts: { connect_new: 0, upgrade_pending: 0, legacy_active: 0 } });
    if (u.pathname === '/api/admin/members-summary') return json({ accounts: { status: 'ok', total: 1, new_7d: 0, new_7d_capped: false }, couples: { total: 1, new_7d: 0, by_owner: { account: 1, guest: 0, unknown: 0 } }, computed_at: '2026-11-13T00:00:00Z' });
    if (u.pathname === '/api/admin/vendors') return json({ vendors: [], total: 0 });
    return json({});
  });
  S.base = `http://127.0.0.1:${server.address().port}`;
  await openTable(S);
  return S;
}
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const text = async (loc) => norm(await loc.innerText());
const has = (t, label, value) => new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':? ' + String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(t);
const geom = (S) => S.dlg().evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, vw: innerWidth, vh: innerHeight }; });
const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  browser = await chromium.launch();
  try {
    const S = await scenario();
    const { page } = S;
    await S.row('Alpha Hall').getByText('Số 1 đường thử', { exact: false }).click();
    await S.dlg().waitFor();
    await page.waitForFunction(() => !/Đang tải/.test(document.querySelector('[role=dialog][aria-label^="Chi tiết vendor"]')?.innerText || ''));
    await S.sep().focus(); await page.keyboard.press('Home');
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
    check('chuẩn bị: độ rộng 680', near((await geom(S)).w, 680, 2), (await geom(S)).w);
    await page.evaluate(() => { window.__dlg = document.querySelector('[role=dialog][aria-label^="Chi tiết vendor"]'); });
    const n0 = S.details.length;
    const widths = [];
    for (let i = 0; i <= 20; i++) widths.push(Math.round(1280 - (720 * i) / 20));
    for (let i = 19; i >= 0; i--) widths.push(widths[i]);
    const bad = [];
    for (const vw of widths) {
      await page.setViewportSize({ width: vw, height: 900 });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const m = await page.evaluate(() => {
        const d = document.querySelector('[role=dialog][aria-label^="Chi tiết vendor"]');
        const s = document.querySelector('table')?.closest('section');
        const sep = document.querySelector('[role=separator]');
        return { same: d === window.__dlg, loading: /Đang tải/.test(d?.innerText || ''), w: d ? d.getBoundingClientRect().width : -1, right: d ? d.getBoundingClientRect().right : -1,
          pad: s ? parseFloat(getComputedStyle(s).paddingRight) || 0 : -1, sep: !!sep && sep.getBoundingClientRect().width > 0, vw: innerWidth,
          hs: document.documentElement.scrollWidth > document.documentElement.clientWidth };
      });
      const min = Math.min(560, vw), max = Math.max(min, Math.round(vw * 0.9));
      const want = vw <= 480 ? vw : Math.max(min, Math.min(max, 680));
      const push = vw > 480 && vw - want >= 640;
      const errs = [];
      if (!m.same) errs.push('gắn lại');
      if (m.loading) errs.push('Đang tải');
      if (!near(m.w, want, 2)) errs.push(`w=${m.w}≠${want}`);
      if (!near(m.right, vw, 2)) errs.push('không dính phải');
      if (push ? !near(m.pad, want, 2) : m.pad > 1) errs.push(`lề=${m.pad} (${push ? 'ĐẨY' : 'PHỦ'})`);
      if (m.sep !== (vw > 480 && max > min)) errs.push(`tay cầm=${m.sep}`);
      if (m.hs) errs.push('cuộn ngang');
      if (errs.length) bad.push(`${vw}:${errs.join('/')}`);
    }
    check('resize liên tục 1280↔560: mọi bước đúng luật, không gắn lại, không Đang tải', bad.length === 0, bad.slice(0, 6).join(' | '));
    check('resize không gọi lại API chi tiết', S.details.length === n0, S.details.join(','));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(100);
    check('về 1280: độ rộng đã chỉnh 680 còn nguyên', near((await geom(S)).w, 680, 2), (await geom(S)).w);
    check('localStorage vẫn 680 sau resize', (await page.evaluate(() => localStorage.getItem('enrich-drawer-width'))) === '680', await page.evaluate(() => localStorage.getItem('enrich-drawer-width')));
    await S.ctx.close();
  } catch (e) {
    check('bước thao tác không thực hiện được', false, String(e.message).split('\n')[0]);
  }
  await browser.close(); server.close();
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
