#!/usr/bin/env node
/*
 * T-149 adv-02 (tầng 3, adversary): drawer khi khung nhìn ĐỔI trong lúc đang mở, localStorage hỏng/bị chặn, Esc khi đang gõ trong Sửa thủ công, đổi vendor liên tục.
 * Chạy: cd <tohong-front> && node /home/user/tohong-hq/eval/T-149/adv-02-drawer-doi-khung-nhin.cjs --repo .   (hoặc bash eval/T-149/adv-02-drawer-doi-khung-nhin.sh)
 * Khung chạy (build tạm, server tĩnh, API giả, chặn mạng ngoài) chép nguyên văn từ eval/T-147/check_6_ui_drawer.cjs.
 * Hợp đồng (spec products/T-147-drawer-vendor-enrich.md Hành vi 5): ĐẨY "chỉ khi" khung nhìn − bề rộng drawer ≥ 640px, hẹp hơn thì PHỦ (trang không bị đẩy, không cuộn ngang);
 * min = min(560, khung nhìn), max = max(min, 90% khung nhìn); tay cầm chỉ khi max > min; ≤ 480px rộng đúng khung nhìn. Các luật này là luật theo khung nhìn hiện tại,
 * không chỉ lúc mở: đổi khung nhìn (xoay máy tính bảng, thu cửa sổ, mở devtools) khi drawer đang mở phải cho cùng bố cục như mở ở khung nhìn đó.
 * Input và mong đợi:
 *  A. Mở ở 1280 (ĐẨY, 560), thu còn 900: còn 340 < 640 => PHỦ (section không còn lề phải 560), drawer dính phải, không cuộn ngang.
 *  B. Thu tiếp còn 600: drawer rộng 560 (min = max = 560) và không có tay cầm; không cuộn ngang.
 *  C. Thu còn 390: drawer rộng đúng 390, không tay cầm, không cuộn ngang. Nới lại 1280: ĐẨY lại (lề phải 560).
 *  D. localStorage chứa "abc", "-5", "99999", "" và localStorage ném lỗi: drawer vẫn mở, bề rộng nằm trong [min, max].
 *  E. Esc khi tiêu điểm đang ở ô nhập của hộp thoại Sửa thủ công: chỉ hộp thoại đóng, drawer còn.
 *  F. Bấm liên tục vd7 (chậm) → vd1 → vd8 → vd7 → vd8: cuối cùng drawer là Theta Plain, không bị phản hồi chậm của vd7 đè.
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
const padRight = (S) => S.page.evaluate(() => { const s = document.querySelector('table')?.closest('section'); return s ? parseFloat(getComputedStyle(s).paddingRight) || 0 : -1; });
const noHScroll = (S) => S.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const openAlpha = async (S) => { await S.row('Alpha Hall').getByText('Số 1 đường thử', { exact: false }).click(); await S.dlg().waitFor(); await S.page.waitForFunction(() => !/Đang tải/.test(document.querySelector('[role=dialog][aria-label^="Chi tiết vendor"]')?.innerText || '')); };

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  browser = await chromium.launch();
  try {
    /* A-C: đổi khung nhìn khi đang mở */
    const S = await scenario();
    await openAlpha(S);
    check('A0 1280 mở: ĐẨY, lề phải 560', near(await padRight(S), 560, 2), await padRight(S));
    await S.page.setViewportSize({ width: 900, height: 900 }); await S.page.waitForTimeout(300);
    let g = await geom(S); let pr = await padRight(S);
    check('A 1280→900 khi đang mở: còn < 640 nên PHỦ (không còn lề phải bằng bề rộng drawer)', pr < 1, JSON.stringify({ pr, w: g.w }));
    check('A 900: drawer dính mép phải, không cuộn ngang', near(g.right, g.vw) && await noHScroll(S), JSON.stringify(g));
    await S.page.setViewportSize({ width: 600, height: 900 }); await S.page.waitForTimeout(300);
    g = await geom(S);
    check('B 600 khi đang mở: drawer rộng 560 (min = max)', near(g.w, 560, 2), JSON.stringify(g));
    check('B 600 khi đang mở: không có tay cầm (max = min)', (await S.sep().filter({ visible: true }).count()) === 0);
    check('B 600: không cuộn ngang, không lề phải', await noHScroll(S) && (await padRight(S)) < 1, await padRight(S));
    await S.page.setViewportSize({ width: 390, height: 844 }); await S.page.waitForTimeout(300);
    g = await geom(S);
    check('C 390 khi đang mở: drawer rộng đúng khung nhìn, không tay cầm, không cuộn ngang', near(g.w, 390, 2) && near(g.left, 0, 2) && (await S.sep().filter({ visible: true }).count()) === 0 && await noHScroll(S), JSON.stringify(g));
    await S.page.setViewportSize({ width: 1280, height: 900 }); await S.page.waitForTimeout(300);
    check('C 390→1280: ĐẨY lại, lề phải 560', near(await padRight(S), 560, 2), await padRight(S));
    await S.ctx.close();

    /* D: localStorage hỏng / bị chặn */
    for (const bad of ['abc', '-5', '99999', '', 'THROW']) {
      const L = await scenario();
      await L.page.evaluate((v) => {
        if (v === 'THROW') {
          Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
        } else localStorage.setItem('enrich-drawer-width', v);
      }, bad);
      if (bad !== 'THROW') { await openTable(L); }
      await openAlpha(L).catch(() => {});
      const ok = (await L.dlg().count()) === 1;
      const gw = ok ? (await geom(L)).w : -1;
      check(`D localStorage=${JSON.stringify(bad)}: drawer mở, bề rộng trong [560, 1152]`, ok && gw >= 558 && gw <= 1154, gw);
      await L.ctx.close();
    }

    /* E: Esc khi đang gõ trong ô của Sửa thủ công */
    const E = await scenario();
    await openAlpha(E);
    await E.sep().focus(); await E.page.keyboard.press('Home');
    await E.row('Delta Palace').getByRole('button', { name: 'Sửa thủ công', exact: true }).click();
    const md = E.page.getByRole('dialog', { name: /^Sửa thủ công/ });
    await md.waitFor();
    const inp = md.locator('input[type=text], input:not([type]), textarea').first();
    if (await inp.count()) { await inp.click(); await E.page.keyboard.type('ghi chú thử'); }
    await E.page.keyboard.press('Escape');
    await md.waitFor({ state: 'detached' }).catch(() => {});
    check('E Esc khi đang gõ trong Sửa thủ công: hộp thoại đóng, drawer còn', (await md.count()) === 0 && (await E.dlg().count()) === 1);
    await E.ctx.close();

    /* F: đổi vendor liên tục, phản hồi chậm về sau */
    const F = await scenario();
    F.slowMs = 900;
    for (const n of ['Eta Slow', 'Alpha Hall', 'Theta Plain', 'Eta Slow', 'Theta Plain']) {
      await F.row(n).locator('td').nth(1).click({ position: { x: 2, y: 2 } });
      await F.page.waitForTimeout(40);
    }
    await F.page.waitForTimeout(1600);
    const lab = await F.dlg().getAttribute('aria-label');
    const ft = await text(F.dlg());
    check('F đổi liên tục: cuối cùng là Theta Plain, phản hồi chậm của Eta Slow không đè', F.dlg && lab === 'Chi tiết vendor · Theta Plain' && /Theta Plain/.test(ft) && !/Eta Slow/.test(ft) && (await F.page.getByRole('dialog', { name: /^Chi tiết vendor/ }).count()) === 1, JSON.stringify([lab, ft.slice(0, 120)]));
    await F.ctx.close();
  } catch (e) {
    check('bước thao tác không thực hiện được', false, String(e.message).split('\n')[0]);
  }
  await browser.close(); server.close();
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
