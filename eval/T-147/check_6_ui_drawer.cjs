#!/usr/bin/env node
/*
 * Eval tầng 1 của T-147 (repo tohong-front): bấm một dòng của bảng enrich vendor mở drawer bên phải hiện thuộc tính nguồn dùng để tạo vendor pool.
 * Chạy:   cd /home/user/tohong-front && node /home/user/tohong-hq/eval/T-147/check_6_ui_drawer.cjs --repo . [--shots DIR] [--dist DIR]    (hoặc bash eval/T-147/check_6_ui_drawer.sh)
 * Tự `vite build` ra thư mục tạm (VITE_ADMIN_DEV_TOKEN=dev:admin, VITE_API_BASE=http://api.test, không Clerk), tự phục vụ bản build, giả API (tám dòng nhỏ + API chi tiết).
 * Mọi request ra ngoài khác bị chặn và ghi lại (không Google). Không đọc mã nguồn: đo theo NHÃN người dùng thấy, vai trò (role) trợ năng và hình học trên màn hình.
 * Hợp đồng (spec products/T-147-drawer-vendor-enrich.md, Hành vi 3 và 5):
 *  - Bấm vào dòng (chỗ không phải nút / liên kết) gọi đúng một lần GET /api/admin/vendor-enrich/<id>/detail rồi mở drawer: phần tử role=dialog tên "Chi tiết vendor · <tên>", dính mép phải
 *    khung nhìn, cao hết khung nhìn, rộng mặc định min(560px, khung nhìn). Trong lúc chờ có chữ "Đang tải…". Dòng (tr) nhận tiêu điểm bằng Tab (tabindex 0) và mở drawer bằng Enter. KHÔNG thêm nút nào
 *    vào dòng (T-124 đòi dòng đã duyệt tay không còn nút nào); dòng đang mở có aria-current="true".
 *  - Nội dung (từ phản hồi API, KHÔNG liệt kê cứng trong giao diện): mục "Thuộc tính nguồn dùng để tạo vendor pool" hiện MỖI mục của `catalog` đúng một dòng "<label> <giá trị>"; giá trị vắng ghi "—";
 *    mảng thì mỗi phần tử một dòng; trường bị cắt (truncated) ghi "(rút gọn, gốc N ký tự)". Mục "Kết quả trong pool": "Trong pool" | "Trong pool · đang ẩn" | "Ngoài pool", các lý do (reasons[].text),
 *    và mỗi trường của pool.vendor một dòng "<tên trường> <giá trị>". Mục "Lớp admin (R2)": "Không có ghi đè" hoặc các dòng "Ẩn: có|không", "Lý do ẩn: …", "Giá tối thiểu ghi đè: …",
 *    "Giá tối đa ghi đè: …", "Giá đã xác minh: có|không". source.available=false: "Báo cáo chưa có dữ liệu nguồn của vendor này".
 *  - Đóng: nút "Đóng" hoặc phím Esc (khi hộp thoại Sửa thủ công đang mở thì Esc chỉ đóng hộp thoại đó); đóng xong tiêu điểm về dòng đã mở.
 *  - Kéo giãn: tay cầm role=separator tên "Kéo để đổi bề rộng ngăn kéo" (aria-valuemin/max/now); min = min(560, khung nhìn), max = max(min, 90% khung nhìn); kéo chuột sang trái làm rộng ra;
 *    phím ←/→ đổi 24px, Home = min, End = max; nhớ độ rộng sau khi tải lại trang. Khung nhìn <= 480px: drawer rộng bằng khung nhìn, không có tay cầm, trang không cuộn ngang.
 *  - Drawer không che bảng và không làm hỏng bảng: khi drawer mở, bấm "Approve" / "Sửa thủ công" ở dòng khác vẫn hoạt động đúng như T-124 và KHÔNG mở drawer; bấm dòng khác thì drawer đổi sang vendor đó.
 *  - Chi tiết 403: drawer ghi "Chỉ Capu xem được chi tiết này"; 404: "Không có chi tiết cho vendor này"; không hiện mục nguồn/pool/lớp admin.
 *  - Trả lời chậm của vendor cũ không đè lên vendor mới bấm sau.
 * In dòng cuối PASS hoặc FAIL <lý do đầu tiên> (+n lỗi nữa); thoát 0/1 (2 = eval không chạy được).
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
const detailOf = (id) => {
  const row = ROWS.find((r) => r.id === id);
  const base = { data_as_of: '2026-11-11T13:08:22.633793', id, name: row.name, catalog: CATALOG };
  if (id === 'vd1') return { ...base, source: { available: true, record: REC, audit: { closed_state: 'none' }, truncated: { description: 1534 } }, pool: { in_pool: true, visible: true, vendor: POOL_V, reasons: [] }, overlay: null };
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
    check('chưa bấm gì: không có drawer, chưa gọi API chi tiết', (await S.dlg().count()) === 0 && S.details.length === 0);

    /* ----- mở bằng bấm dòng ----- */
    await S.row('Alpha Hall').getByText('Số 1 đường thử', { exact: false }).click();
    await S.dlg().waitFor();
    check('bấm dòng gọi đúng một lần API chi tiết của vendor đó', S.details.length === 1 && S.details[0] === 'vd1', S.details.join(','));
    await page.getByRole('dialog', { name: 'Chi tiết vendor · Alpha Hall' }).waitFor();
    await page.waitForFunction(() => !/Đang tải/.test(document.querySelector('[role=dialog][aria-label^="Chi tiết vendor"]')?.innerText || ''));
    let g = await geom(S);
    check('drawer dính mép phải, cao hết khung nhìn, rộng mặc định 560', near(g.right, g.vw) && near(g.top, 0) && near(g.bottom, g.vh) && near(g.w, 560), JSON.stringify(g));
    let t = await text(S.dlg());
    check('nút "Đóng" có trong drawer', (await S.dlg().getByRole('button', { name: 'Đóng', exact: true }).count()) === 1);
    check('có mục "Thuộc tính nguồn dùng để tạo vendor pool", "Kết quả trong pool", "Lớp admin (R2)"', ['Thuộc tính nguồn dùng để tạo vendor pool', 'Kết quả trong pool', 'Lớp admin (R2)'].every((h) => t.includes(h)), t.slice(0, 200));
    check('mỗi mục catalog hiện nhãn và giá trị: Tên vendor, Giá thấp nhất (VND) 3999000', has(t, 'Tên vendor', 'Alpha Hall') && has(t, 'Giá thấp nhất (VND)', '3999000'), t.slice(0, 400));
    check('mảng: mỗi phần tử có mặt (nội dung đánh giá)', t.includes('Nội dung đánh giá') && t.includes('Rất tốt T147') && t.includes('Phục vụ nhiệt tình T147'));
    check('trường catalog mà record không có hiện "—"', has(t, 'Trường tương lai ZZ', '—'), t);
    check('trường lạ do API gửi trong catalog vẫn hiện (không liệt kê cứng trong giao diện)', has(t, 'Trường thêm ZZ', 'gia-tri-zz-them'));
    check('trường của tệp audit hiện cùng danh sách', has(t, 'Audit: trạng thái đóng cửa', 'none'));
    check('trường bị cắt ghi "(rút gọn, gốc 1534 ký tự)"', /rút gọn, gốc 1534 ký tự/.test(t), t);
    check('pool: "Trong pool", mỗi trường vendor một dòng "<tên trường> <giá trị>"', t.includes('Trong pool') && !t.includes('Ngoài pool') && has(t, 'priceMin', '3.9') && has(t, 'priceMax', '4.7') && has(t, 'rating', '4.3') && has(t, 'reviewCount', '2046') && has(t, 'city', 'HCMC') && /styles:? luxury/.test(t) && t.includes('modern'), t.slice(-500));
    check('lớp admin: "Không có ghi đè" khi overlay null', t.includes('Không có ghi đè'));

    /* ----- đóng ----- */
    await page.keyboard.press('Escape');
    await S.dlg().waitFor({ state: 'detached' });
    check('Esc đóng drawer', (await S.dlg().count()) === 0);
    check('đóng xong tiêu điểm nằm trong dòng đã mở', await S.row('Alpha Hall').evaluate((tr) => tr.contains(document.activeElement)));
    await S.row('Alpha Hall').focus();
    await page.keyboard.press('Enter');
    await S.dlg().waitFor();
    check('mở được bằng bàn phím: dòng nhận tiêu điểm (tabindex 0) + Enter', (await S.dlg().count()) === 1);
    check('dòng đang mở có aria-current="true", dòng khác không', (await S.row('Alpha Hall').getAttribute('aria-current')) === 'true' && (await S.row('Beta Closed').getAttribute('aria-current')) !== 'true');
    check('dòng không có thêm nút nào ngoài Approve/Sửa thủ công/Rút lại (dòng Enrich 100%: chỉ Sửa thủ công)', (await S.row('Alpha Hall').getByRole('button').count()) === 1);
    await S.dlg().getByRole('button', { name: 'Đóng', exact: true }).click();
    await S.dlg().waitFor({ state: 'detached' });
    check('nút "Đóng" đóng drawer', (await S.dlg().count()) === 0);

    /* ----- kéo giãn ----- */
    await S.row('Alpha Hall').getByText('Số 1 đường thử', { exact: false }).click();
    await S.dlg().waitFor();
    const sep = S.sep();
    check('tay cầm kéo có aria-valuemin 560, aria-valuemax 1152, aria-valuenow 560', (await sep.getAttribute('aria-valuemin')) === '560' && (await sep.getAttribute('aria-valuemax')) === '1152' && (await sep.getAttribute('aria-valuenow')) === '560',
      [await sep.getAttribute('aria-valuemin'), await sep.getAttribute('aria-valuemax'), await sep.getAttribute('aria-valuenow')].join('/'));
    const bb = await sep.boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb.x + bb.width / 2 - 140, bb.y + bb.height / 2, { steps: 6 });
    await page.mouse.up();
    g = await geom(S);
    check('kéo chuột sang trái 140px: rộng 700 (±3), vẫn dính mép phải', near(g.w, 700, 3) && near(g.right, g.vw), JSON.stringify(g));
    check('aria-valuenow theo độ rộng mới', Math.abs(+(await sep.getAttribute('aria-valuenow')) - g.w) <= 3);
    const bb2 = await sep.boundingBox();
    await page.mouse.move(bb2.x + bb2.width / 2, bb2.y + bb2.height / 2);
    await page.mouse.down();
    await page.mouse.move(40, bb2.y + 10, { steps: 6 });
    await page.mouse.up();
    g = await geom(S);
    check('kéo quá xa: dừng ở max = 90% khung nhìn (1152)', near(g.w, 1152, 2), JSON.stringify(g));
    const bb3 = await sep.boundingBox();
    await page.mouse.move(bb3.x + bb3.width / 2, bb3.y + bb3.height / 2);
    await page.mouse.down();
    await page.mouse.move(1270, bb3.y + 10, { steps: 6 });
    await page.mouse.up();
    g = await geom(S);
    check('kéo quá về phải: dừng ở min 560', near(g.w, 560, 2), JSON.stringify(g));
    await sep.focus();
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
    g = await geom(S);
    check('phím ← hai lần: rộng thêm 48px (608)', near(g.w, 608, 2), g.w);
    await page.keyboard.press('ArrowRight');
    g = await geom(S);
    check('phím → một lần: hẹp bớt 24px (584)', near(g.w, 584, 2), g.w);
    await page.keyboard.press('End');
    check('phím End: max', near((await geom(S)).w, 1152, 2));
    await page.keyboard.press('Home');
    check('phím Home: min', near((await geom(S)).w, 560, 2));
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
    check('đặt 680 bằng phím', near((await geom(S)).w, 680, 2));
    await page.keyboard.press('Escape');
    await S.dlg().waitFor({ state: 'detached' });
    await openTable(S);
    await S.row('Alpha Hall').getByText('Số 1 đường thử', { exact: false }).click();
    await S.dlg().waitFor();
    check('tải lại trang, mở lại: độ rộng còn 680 (nhớ độ rộng)', near((await geom(S)).w, 680, 2), (await geom(S)).w);
    await page.keyboard.press('Escape');

    /* ----- bảng vẫn dùng được khi drawer mở ----- */
    await S.row('Alpha Hall').getByText('Số 1 đường thử', { exact: false }).click();
    await S.dlg().waitFor();
    const n0 = S.details.length;
    await S.row('Gamma Garden').getByRole('button', { name: 'Approve', exact: true }).click();
    await page.waitForFunction(() => /Chờ áp dụng/.test(document.body.innerText));
    check('drawer mở: Approve ở dòng khác vẫn gửi PUT {decision:"approve"}', S.writes.length === 1 && S.writes[0].method === 'PUT' && S.writes[0].id === 'vd3' && S.writes[0].body.decision === 'approve', JSON.stringify(S.writes));
    check('bấm Approve không mở drawer của dòng đó (không gọi API chi tiết mới), drawer cũ còn nguyên', S.details.length === n0 && /Chi tiết vendor · Alpha Hall/.test(await S.dlg().getAttribute('aria-label')), S.details.join(','));
    await S.row('Gamma Garden').getByRole('button', { name: 'Rút lại', exact: true }).click();
    await page.waitForFunction(() => !/Chờ áp dụng/.test(document.body.innerText));
    check('"Rút lại" gửi DELETE và không mở drawer', S.writes.length === 2 && S.writes[1].method === 'DELETE' && S.details.length === n0, JSON.stringify(S.writes[1]));
    await S.row('Delta Palace').getByRole('button', { name: 'Sửa thủ công', exact: true }).click();
    const md = page.getByRole('dialog', { name: /^Sửa thủ công/ });
    await md.waitFor();
    check('drawer mở: "Sửa thủ công" ở dòng khác vẫn mở hộp thoại, không mở drawer mới', (await md.count()) === 1 && S.details.length === n0);
    await page.keyboard.press('Escape');
    await md.waitFor({ state: 'detached' });
    check('Esc khi hộp thoại Sửa thủ công mở: chỉ đóng hộp thoại, drawer còn', (await S.dlg().count()) === 1);
    await page.keyboard.press('Escape');
    await S.dlg().waitFor({ state: 'detached' });
    const nW = S.writes.length;
    await S.row('Gamma Garden').getByRole('button', { name: 'Sửa thủ công', exact: true }).click();
    await page.getByRole('dialog', { name: /^Sửa thủ công/ }).waitFor();
    check('drawer đóng: "Sửa thủ công" mở hộp thoại, không mở drawer, không ghi gì', (await S.dlg().count()) === 0 && S.writes.length === nW && S.details.length === n0);
    await page.getByRole('dialog', { name: /^Sửa thủ công/ }).getByRole('button', { name: 'Huỷ', exact: true }).click();

    /* ----- đổi vendor, ngoài pool, ẩn, thiếu nguồn, lỗi ----- */
    await S.row('Alpha Hall').getByText('Số 1 đường thử', { exact: false }).click();
    await S.dlg().waitFor();
    await S.row('Beta Closed').getByText('Số 2 đường thử', { exact: false }).click();
    await page.getByRole('dialog', { name: 'Chi tiết vendor · Beta Closed' }).waitFor();
    await page.waitForFunction(() => /Ngoài pool/.test(document.body.innerText));
    t = await text(S.dlg());
    check('bấm dòng khác: drawer đổi sang vendor đó (vẫn một drawer)', (await page.getByRole('dialog', { name: /^Chi tiết vendor/ }).count()) === 1);
    check('vendor ngoài pool vẫn xem được, "Ngoài pool" + lý do bằng lời + dữ liệu nguồn', t.includes('Ngoài pool') && t.includes('Tạm đóng cửa: không vào pool') && has(t, 'Audit: trạng thái đóng cửa', 'temporarily_closed') && has(t, 'Tên vendor', 'Beta Closed'), t.slice(0, 500));
    check('ngoài pool: không có dòng trường pool (vendor null)', !has(t, 'priceMin', '3.9'));
    await S.row('Gamma Garden').getByText('Số 3 đường thử', { exact: false }).click();
    await page.getByRole('dialog', { name: 'Chi tiết vendor · Gamma Garden' }).waitFor();
    await page.waitForFunction(() => /Trong pool · đang ẩn/.test(document.body.innerText));
    t = await text(S.dlg());
    check('vendor bị admin ẩn: "Trong pool · đang ẩn" + lý do + lớp admin (ẩn, lý do ẩn, giá, xác minh)', t.includes('Admin đã ẩn vendor (lớp R2): cặp đôi không thấy') && has(t, 'Ẩn', 'có') && has(t, 'Lý do ẩn', 'Ẩn thử T-147') && has(t, 'Giá tối thiểu ghi đè', '11.5') && has(t, 'Giá tối đa ghi đè', '22.5') && has(t, 'Giá đã xác minh', 'có'), t.slice(-420));
    await S.row('Delta Palace').getByText('Số 4 đường thử', { exact: false }).click();
    await page.getByRole('dialog', { name: 'Chi tiết vendor · Delta Palace' }).waitFor();
    await page.waitForFunction(() => /Báo cáo chưa có dữ liệu nguồn/.test(document.body.innerText));
    check('báo cáo chưa có nguồn: ghi rõ, vẫn hiện phần pool', (await text(S.dlg())).includes('Trong pool'));
    await S.row('Epsilon Forbidden').getByText('Số 5 đường thử', { exact: false }).click();
    await page.getByRole('dialog', { name: 'Chi tiết vendor · Epsilon Forbidden' }).waitFor();
    await page.waitForFunction(() => /Chỉ Capu xem được chi tiết này/.test(document.body.innerText));
    t = await text(S.dlg());
    check('403: "Chỉ Capu xem được chi tiết này", không có mục nguồn/pool/lớp admin', !t.includes('Thuộc tính nguồn') && !t.includes('Kết quả trong pool') && !t.includes('Lớp admin'), t.slice(0, 300));
    await S.row('Zeta Missing').getByText('Số 6 đường thử', { exact: false }).click();
    await page.waitForFunction(() => /Không có chi tiết cho vendor này/.test(document.body.innerText));
    check('404: "Không có chi tiết cho vendor này"', true);
    check('bảng còn nguyên sau lỗi chi tiết', (await S.rows().count()) === ROWS.length);

    /* ----- đang tải và trả lời chậm ----- */
    await S.row('Eta Slow').getByText('Số 7 đường thử', { exact: false }).click();
    await page.getByRole('dialog', { name: 'Chi tiết vendor · Eta Slow' }).waitFor();
    check('đang chờ API: hiện "Đang tải…"', /Đang tải/.test(await text(S.dlg())));
    await S.row('Alpha Hall').getByText('Số 1 đường thử', { exact: false }).click();
    await page.getByRole('dialog', { name: 'Chi tiết vendor · Alpha Hall' }).waitFor();
    await page.waitForTimeout(S.slowMs + 400);
    t = await text(S.dlg());
    check('trả lời chậm của vendor cũ không đè lên vendor mới (còn Alpha Hall, không có Eta Slow)', has(t, 'Tên vendor', 'Alpha Hall') && !t.includes('Eta Slow'), t.slice(0, 200));
    check('không request nào ra ngoài (Google) trong cả phiên', S.external.length === 0, S.external.join(' '));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'drawer-1280.png') });
    await S.ctx.close();

    /* ----- khung hẹp ----- */
    const M = await scenario({ viewport: { width: 390, height: 844 } });
    await M.row('Alpha Hall').getByText('Số 1 đường thử', { exact: false }).click();
    await M.dlg().waitFor();
    await M.page.waitForFunction(() => !/Đang tải/.test(document.body.innerText));
    g = await geom(M);
    check('390px: drawer rộng bằng khung nhìn, phủ kín chiều cao', near(g.w, g.vw) && near(g.left, 0) && near(g.top, 0) && near(g.bottom, g.vh), JSON.stringify(g));
    check('390px: không có tay cầm kéo giãn', (await M.sep().filter({ visible: true }).count()) === 0);
    const mm = await M.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    check('390px: trang không cuộn ngang', mm.sw <= mm.cw, JSON.stringify(mm));
    check('390px: nút "Đóng" cao >= 40px (bấm được bằng ngón tay)', (await M.dlg().getByRole('button', { name: 'Đóng', exact: true }).boundingBox()).height >= 40);
    await M.dlg().getByRole('button', { name: 'Đóng', exact: true }).click();
    await M.dlg().waitFor({ state: 'detached' });
    check('390px: đóng được', (await M.dlg().count()) === 0);
    if (SHOTS) await M.page.screenshot({ path: path.join(SHOTS, 'drawer-390.png') });
    await M.ctx.close();
  } catch (e) {
    check('bước thao tác không thực hiện được (thiếu phần tử mà spec yêu cầu?)', false, String(e.message).split('\n')[0]);
  }
  await browser.close(); server.close();
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
