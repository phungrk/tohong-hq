#!/usr/bin/env node
/*
 * Eval tầng 1 của T-124 (repo tohong-front): bảng enrich vendor trong trang admin. Đo theo NHÃN người dùng thấy và vai trò (role) trợ năng, không bám class/id.
 * Chạy:   cd /home/user/tohong-front && node /home/user/tohong-hq/eval/T-124/check_8_ui_bang.cjs --repo . [--shots DIR] [--dist DIR]
 * Tự `vite build` ra thư mục tạm (VITE_ADMIN_DEV_TOKEN=dev:admin, VITE_API_BASE=http://api.test, không Clerk), tự phục vụ bản build, giả API
 * (dữ liệu = 876 vendor trong eval/T-124/snapshot.json, nhóm theo hàm chuẩn). Mọi request ra ngoài khác bị chặn và ghi lại (không Google). Không đọc mã nguồn.
 * Hợp đồng giao diện (spec products/T-124-bang-enrich-vendor.md, Hành vi 7; dữ liệu API Hành vi 3, 4):
 *  - Admin > tab "Dữ liệu vendor" > nút "Enrich Google Maps" mở bảng (table) tên "Bảng enrich vendor"; nút "Danh sách vendor" trở về danh sách cũ.
 *  - Cột (columnheader): "#", "Vendor", "Thông tin trên marry.vn", "Sau enrich Google Maps", "Status", "Action".
 *  - 5 chip (button, aria-pressed): "Tất cả · 876", "Enrich 100% · 98", "Chưa có ảnh Google · 680", "Tên hơi giống · 244", "Địa chỉ khác marry · 107" (số lấy từ summary của API, không đổi khi lọc).
 *  - Ô "Tìm vendor", chọn "Hạng mục", chia trang 50 dòng: chữ "Hiển thị 1–50 / 876", nút "Trang sau"/"Trang trước".
 *  - Đầu bảng: "enrich lần cuối" + data_as_of (ở GỐC phản hồi API, dạng ISO hoặc dd/mm/yyyy).
 *  - Dòng ứng viên bị từ chối ghi "Chưa nhận: <lý do bằng lời>" (out_of_province = "nơi này ngoài TP.HCM"; ứng viên đó không có nút Approve). Dòng ĐÃ có override (đã áp):
 *    Status = nhãn nhóm + "Đã duyệt tay", Action = chữ "Đã duyệt tay", không còn nút Approve hay Sửa thủ công.
 *  - Mỗi dòng: STT (n của API); tên vendor + hạng mục; "Địa chỉ: …" của marry; cột Google có "Tên: …", "giống NN%", "Địa chỉ: …", thẻ "khớp marry"/"khác marry", liên kết "Mở Maps" (href = maps_url);
 *    Status = nhãn nhóm; Action: nút "Approve" chỉ ở dòng approvable (dòng full ghi "Đã khớp"), nút "Sửa thủ công" ở mọi dòng.
 *  - Approve: gửi PUT /api/admin/vendor-enrich/<id>/review {decision:"approve"}; dòng hiện "Chờ áp dụng", không còn nút Approve (có "Rút lại" -> DELETE).
 *  - Sửa thủ công: hộp thoại (dialog) "Sửa thủ công · …" có lựa chọn "Quyết định" (4 nhãn như bản phác), ô "Link Google Maps hoặc place_id", ô "Ghi chú", nút "Lưu", "Huỷ".
 *    KHÔNG có ô địa chỉ tự do. "Gỡ vendor" thiếu ghi chú: báo lỗi "Cần ghi chú", không gửi gì.
 *  - Lỗi 403 từ API: hiện thông báo lỗi, không hiện bảng. 390px: trang không cuộn ngang (bảng tự cuộn trong khung của nó).
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

/* ---------- dữ liệu giả từ ảnh chụp thật ---------- */
const SNAP = JSON.parse(fs.readFileSync(path.join(__dirname, 'snapshot.json'), 'utf8')).facts;
const HI = 0.95, MID = 0.6;
const classify = (f) => {
  const a = f.audit, g = f.g;
  if (!g && a && (a.closed_state === 'temporarily_closed' || a.status === 'temporarily_closed')) return 'temp_closed';
  if (g) return !g.has_flag ? 'unverified' : g.address_match === true ? (f.photos >= 1 ? 'full' : 'matched_no_photo') : 'addr_diff_accepted';
  if (a) { const c = a.conf || 0; return a.status === 'low_confidence' ? (c >= HI ? 'name_same_addr_diff' : c >= MID ? 'name_similar' : 'not_found') : 'not_found'; }
  return 'not_enriched';
};
const LOI = { low_score: 'tên chưa đủ giống', address_conflict: 'địa chỉ Google khác địa chỉ marry', address_unconfirmed: 'không so được địa chỉ', out_of_province: 'nơi này ngoài TP.HCM' };
const APPROVABLE = new Set(['addr_diff_accepted', 'unverified', 'name_same_addr_diff', 'name_similar']);
const LABEL = { full: 'Enrich 100%', matched_no_photo: 'Khớp, chưa có ảnh Google', addr_diff_accepted: 'Địa chỉ khác marry', unverified: 'Có ảnh Google, chưa kiểm khớp',
  name_same_addr_diff: 'Tên trùng, địa chỉ lệch', name_similar: 'Tên hơi giống', not_found: 'Không thấy trên Maps', temp_closed: 'Tạm đóng cửa', not_enriched: 'Chưa enrich' };
const CAT = { venue: 'Tiệc & nhà hàng', ceremony: 'Ăn hỏi & sính lễ', photography: 'Chụp ảnh / quay', jewelry: 'Nhẫn cưới & trang sức', attire: 'Trang phục', decor: 'Trang trí & hoa', makeup: 'Trang điểm & làm tóc', transport: 'Xe hoa & đưa đón', stationery: 'Thiệp & quà tặng', honeymoon: 'Tuần trăng mật' };
const ROWS = SNAP.map((f) => {
  const group = classify(f); const cand = f.g ? f.g.place_id : (f.audit && f.audit.candidate) || '';
  const nm = f.g ? f.g.name : f.audit && f.audit.name; const sim = f.g ? f.g.conf : f.audit && f.audit.conf;
  return { id: f.id, name: f.name, category: f.category, catLabel: CAT[f.category], group,
    marry: { address: f.marry_address, price_min_vnd: null, price_max_vnd: null, price_unit: null, source_url: null },
    google: cand ? { matched: !!f.g, place_id: cand, name: nm, similarity: sim, address: (f.g && f.g.address) || 'Địa chỉ Google mẫu', address_match: f.g ? f.g.address_match : null,
      rating: null, review_count: null, photo_count: f.photos, maps_url: 'https://www.google.com/maps/place/?q=place_id:' + cand, reject_reason: f.g ? null : (f.audit && f.audit.reject_reason) || null } : null,
    approvable: APPROVABLE.has(group) && !!cand && !(!f.g && f.audit && f.audit.reject_reason === 'out_of_province'), override: null, review: null };
});
ROWS.sort((a, b) => ((a.group === 'name_similar' && !a.approvable) ? 1 : 0) - ((b.group === 'name_similar' && !b.approvable) ? 1 : 0)); // ổn định: đẩy ứng viên không Approve được xuống cuối để các ca bên dưới dùng dòng đầu
const OVR = ROWS.filter((r) => r.group === 'name_similar')[6]; OVR.override = { action: 'remove', approved_on: '2026-11-12' }; OVR.approvable = false;
const OOP = ROWS.find((r) => r.google && r.google.reject_reason === 'out_of_province');
const sum = (p) => ROWS.filter(p).length;
const DATA_AS_OF = '2026-11-09T14:31:43.880637';
const SUMMARY = { total: ROWS.length,
  groups: Object.fromEntries(Object.keys(LABEL).map((g) => [g, sum((r) => r.group === g)])),
  chips: { full: sum((r) => r.group === 'full'), no_google_photo: sum((r) => !r.google || r.google.photo_count === 0), name_similar: sum((r) => r.group === 'name_similar'),
    addr_diff: sum((r) => r.group === 'addr_diff_accepted' || r.group === 'name_same_addr_diff') },
  approvable: sum((r) => r.approvable) };
const PRED = { all: () => true, full: (r) => r.group === 'full', name_similar: (r) => r.group === 'name_similar', addr_diff: (r) => r.group === 'addr_diff_accepted' || r.group === 'name_same_addr_diff',
  no_google_photo: (r) => !r.google || r.google.photo_count === 0 };
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

/* ---------- build + server ---------- */
let DIST = arg('--dist');
if (!DIST) {
  DIST = fs.mkdtempSync(path.join(os.tmpdir(), 't124-dist-'));
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
async function scenario(opts = {}) {
  const { viewport = { width: 1280, height: 900 }, forbidden = false } = opts;
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(4000);
  const S = { page, ctx, lists: [], writes: [], other: [], external: [], store: new Map() };
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(S.base)) return route.continue();
    if (!/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)) S.external.push(u); // phông chữ của chính trang không tính; mọi thứ khác ra ngoài (nhất là Google Maps/Places) là lỗi
    return route.abort();
  });
  await page.route('http://api.test/**', async (route) => {
    const req = route.request(); const u = new URL(req.url()); const m = req.method();
    const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(o) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (u.pathname === '/api/admin/vendor-enrich' && m === 'GET') {
      S.lists.push(u.search);
      if (forbidden) return json({ error: 'forbidden' }, 403);
      const q = u.searchParams; const pred = PRED[q.get('filter') || 'all'] || PRED.all;
      let rows = ROWS.filter(pred);
      if (q.get('category')) rows = rows.filter((r) => r.category === q.get('category'));
      if (q.get('q')) rows = rows.filter((r) => fold(r.name).includes(fold(q.get('q'))));
      const limit = Math.min(100, parseInt(q.get('limit')) || 50); const offset = parseInt(q.get('offset')) || 0;
      return json({ data_as_of: DATA_AS_OF, summary: SUMMARY, total: rows.length, offset, limit, rows: rows.slice(offset, offset + limit).map((r, i) => ({ n: offset + i + 1, ...r, review: r.override ? null : (S.store.get(r.id) || null) })) });
    }
    const mm = u.pathname.match(/^\/api\/admin\/vendor-enrich\/([^/]+)\/review$/);
    if (mm && (m === 'PUT' || m === 'DELETE')) {
      let body = null; try { body = JSON.parse(req.postData() || 'null'); } catch { /* */ }
      S.writes.push({ method: m, id: mm[1], body });
      if (m === 'DELETE') { S.store.delete(mm[1]); return json({ review: null }); }
      const row = ROWS.find((r) => r.id === mm[1]);
      const rv = { state: 'pending', decision: body.decision, action: body.decision === 'approve' ? 'accept_place' : body.action, place_id: body.place_id || (row.google && row.google.place_id) || null,
        maps_link: body.maps_link || null, reason: body.note || 'Admin duyệt', reviewed_by: 'user_admin', reviewed_at: new Date().toISOString() };
      S.store.set(mm[1], rv); return json({ review: rv });
    }
    S.other.push(m + ' ' + u.pathname);
    if (u.pathname === '/api/admin/me') return json({ admin: true, user_id: 'user_admin', counts: { connect_new: 0, upgrade_pending: 0, legacy_active: 0 } });
    if (u.pathname === '/api/admin/members-summary') return json({ accounts: { status: 'ok', total: 1, new_7d: 0, new_7d_capped: false }, couples: { total: 1, new_7d: 0, by_owner: { account: 1, guest: 0, unknown: 0 } }, computed_at: new Date().toISOString(), cached: false });
    if (u.pathname === '/api/admin/vendors') return json({ vendors: [], total: 0 });
    return json({});
  });
  S.base = `http://127.0.0.1:${server.address().port}`;
  await page.goto(`${S.base}/?admin`);
  await page.getByRole('button', { name: 'Dữ liệu vendor' }).first().click();
  await page.getByRole('button', { name: 'Enrich Google Maps' }).click();
  S.table = page.getByRole('table', { name: 'Bảng enrich vendor' });
  S.rows = () => S.table.locator('tbody tr');
  return S;
}
const rowText = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim();

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  browser = await chromium.launch();
  try {
    const S = await scenario();
    const { page } = S;
    await S.table.waitFor();
    // cột
    for (const h of ['#', 'Vendor', 'Thông tin trên marry.vn', 'Sau enrich Google Maps', 'Status', 'Action']) {
      check(`cột "${h}"`, (await page.getByRole('columnheader', { name: h, exact: true }).count()) === 1);
    }
    // chip + số đếm
    const chipNames = [`Tất cả · ${SUMMARY.total}`, `Enrich 100% · ${SUMMARY.chips.full}`, `Chưa có ảnh Google · ${SUMMARY.chips.no_google_photo}`, `Tên hơi giống · ${SUMMARY.chips.name_similar}`, `Địa chỉ khác marry · ${SUMMARY.chips.addr_diff}`];
    check('số trong chip đúng dữ liệu thật đã chụp (876/98/680/244/107)', chipNames.join('|') === 'Tất cả · 876|Enrich 100% · 98|Chưa có ảnh Google · 680|Tên hơi giống · 244|Địa chỉ khác marry · 107', chipNames.join('|'));
    for (const c of chipNames) check(`chip "${c}"`, (await page.getByRole('button', { name: c, exact: true }).count()) === 1);
    check('mặc định chip "Tất cả" đang chọn (aria-pressed=true)', (await page.getByRole('button', { name: chipNames[0], exact: true }).getAttribute('aria-pressed')) === 'true');
    // trang đầu
    check('50 dòng ở trang đầu', (await S.rows().count()) === 50, await S.rows().count());
    check('chữ "Hiển thị 1–50 / 876"', /Hiển thị 1–50 \/ 876/.test(await page.locator('body').innerText()));
    const r0 = await rowText(S.rows().nth(0));
    const f0 = ROWS[0];
    check('dòng 1: STT 1, tên vendor, hạng mục, "Địa chỉ:" của marry', r0.startsWith('1 ') && r0.includes(f0.name) && r0.includes(f0.catLabel) && r0.includes('Địa chỉ:'), r0.slice(0, 160));
    // dòng full: đủ tên + giống % + địa chỉ + thẻ + link Maps + Đã khớp
    const iFull = ROWS.findIndex((r) => r.group === 'full');
    const full = ROWS[iFull]; const fullRow = S.rows().filter({ hasText: full.name }).first();
    const ft = await rowText(fullRow);
    check('dòng Enrich 100%: "Tên:" Google, "giống NN%", thẻ "khớp marry", status "Enrich 100%", "Đã khớp", không có nút Approve', ft.includes('Tên: ' + full.google.name) && /giống \d+%/.test(ft) && ft.includes('khớp marry') && ft.includes('Enrich 100%') && ft.includes('Đã khớp') && (await fullRow.getByRole('button', { name: 'Approve', exact: true }).count()) === 0, ft.slice(0, 200));
    const link = fullRow.getByRole('link', { name: /Mở Maps/ });
    check('liên kết "Mở Maps" trỏ maps_url', (await link.count()) === 1 && (await link.getAttribute('href')) === full.google.maps_url, await link.count());
    check('dòng nào cũng có nút "Sửa thủ công"', (await page.getByRole('button', { name: 'Sửa thủ công', exact: true }).count()) >= 50);
    // lọc bằng chip
    await page.getByRole('button', { name: chipNames[3], exact: true }).click();
    await page.waitForFunction(() => /Hiển thị 1–50 \/ 244/.test(document.body.innerText));
    check('bấm chip "Tên hơi giống": gọi API filter=name_similar', S.lists.some((s) => /filter=name_similar/.test(s)), S.lists.join(' '));
    check('sau lọc: chữ "Hiển thị 1–50 / 244", chip vẫn ghi 244 và đang chọn', /Hiển thị 1–50 \/ 244/.test(await page.locator('body').innerText()) && (await page.getByRole('button', { name: chipNames[3], exact: true }).getAttribute('aria-pressed')) === 'true');
    const sims = await S.rows().evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));
    check('mọi dòng sau lọc có status "Tên hơi giống" và "giống NN%" trong [60%, 95%] (làm tròn)', sims.every((t) => t.includes('Tên hơi giống') && (() => { const m = t.match(/giống (\d+)%/); return m && +m[1] >= 60 && +m[1] <= 95; })()), sims[0]);
    check('dòng "Tên hơi giống" có nút "Approve"', (await S.rows().nth(0).getByRole('button', { name: 'Approve', exact: true }).count()) === 1);
    // chia trang
    await page.getByRole('button', { name: 'Trang sau' }).click();
    await page.waitForFunction(() => /Hiển thị 51–100 \/ 244/.test(document.body.innerText));
    check('"Trang sau" gọi offset=50 và STT dòng đầu là 51', S.lists.some((s) => /offset=50/.test(s)) && (await rowText(S.rows().nth(0))).startsWith('51 '));
    // tìm
    await page.getByRole('button', { name: chipNames[0], exact: true }).click();
    await page.getByRole('searchbox', { name: 'Tìm vendor' }).fill('Asiana');
    await page.getByRole('searchbox', { name: 'Tìm vendor' }).press('Enter');
    await page.waitForFunction(() => document.querySelector('table tbody') && /asiana/i.test(document.querySelector('table tbody').innerText));
    check('tìm "Asiana": gọi q=Asiana và dòng nào cũng chứa Asiana', S.lists.some((s) => /q=Asiana/.test(s)) && (await S.rows().evaluateAll((els) => els.every((e) => /asiana/i.test(e.innerText)))));
    await page.getByRole('searchbox', { name: 'Tìm vendor' }).fill('');
    await page.getByRole('searchbox', { name: 'Tìm vendor' }).press('Enter');
    await page.waitForFunction(() => /Hiển thị 1–50 \/ 876/.test(document.body.innerText));

    // ứng viên bị từ chối, dòng đã áp, ngày dữ liệu
    check('đầu bảng ghi "enrich lần cuối" cùng ngày dữ liệu (2026-11-09 hoặc 09/11/2026)', /enrich lần cuối/.test(await page.locator('body').innerText()) && /2026-11-09|09\/11\/2026/.test(await page.locator('body').innerText()) && !/undefined|Invalid/.test(await page.locator('body').innerText()));
    const find = async (r) => { const sb = page.getByRole('searchbox', { name: 'Tìm vendor' }); const n0 = S.lists.length; await sb.fill(r.name); await sb.press('Enter'); for (let i = 0; i < 40 && S.lists.length === n0; i++) await page.waitForTimeout(50); await page.waitForTimeout(250); const row = S.rows().filter({ hasText: r.name }).first(); await row.waitFor(); return row; };
    const oopRow = await find(OOP); const ot = await rowText(oopRow);
    check('ứng viên ngoài TP.HCM: ghi "Chưa nhận: nơi này ngoài TP.HCM", KHÔNG có nút Approve, vẫn có Sửa thủ công', ot.includes('Chưa nhận: nơi này ngoài TP.HCM') && (await oopRow.getByRole('button', { name: 'Approve', exact: true }).count()) === 0 && (await oopRow.getByRole('button', { name: 'Sửa thủ công', exact: true }).count()) === 1, ot.slice(0, 220));
    const other = ROWS.find((r) => r.google && !r.google.matched && r.google.reject_reason && r.google.reject_reason !== 'out_of_province');
    const otherRow = await find(other);
    check('ứng viên bị từ chối vì lý do khác cũng ghi "Chưa nhận: " + lý do bằng lời', (await rowText(otherRow)).includes('Chưa nhận: ' + LOI[other.google.reject_reason]), (await rowText(otherRow)).slice(0, 220));
    const ovRow = await find(OVR); const vt = await rowText(ovRow);
    check('dòng đã có override: Status có "Đã duyệt tay", không còn nút Approve, Sửa thủ công, Rút lại', vt.includes('Đã duyệt tay') && (await ovRow.getByRole('button').count()) === 0, vt.slice(0, 220));
    await page.getByRole('searchbox', { name: 'Tìm vendor' }).fill(''); await page.getByRole('searchbox', { name: 'Tìm vendor' }).press('Enter');
    await page.waitForFunction(() => /Hiển thị 1–50 \/ 876/.test(document.body.innerText));

    // Approve
    await page.getByRole('button', { name: chipNames[3], exact: true }).click();
    await page.waitForFunction(() => /\/ 244/.test(document.body.innerText));
    const target = S.rows().nth(0); const tid = ROWS.filter(PRED.name_similar)[0].id;
    await target.getByRole('button', { name: 'Approve', exact: true }).click();
    await page.waitForFunction(() => /Chờ áp dụng/.test(document.querySelector('table tbody tr').innerText));
    const w = S.writes.filter((x) => x.method === 'PUT');
    check('Approve gửi PUT …/<id>/review {decision:"approve"}', w.length === 1 && w[0].id === tid && w[0].body && w[0].body.decision === 'approve', JSON.stringify(w));
    const tt = await rowText(S.rows().nth(0));
    check('dòng hiện "Chờ áp dụng", hết nút Approve, có "Rút lại"', tt.includes('Chờ áp dụng') && (await S.rows().nth(0).getByRole('button', { name: 'Approve', exact: true }).count()) === 0 && (await S.rows().nth(0).getByRole('button', { name: 'Rút lại' }).count()) === 1, tt.slice(0, 160));
    await S.rows().nth(0).getByRole('button', { name: 'Rút lại' }).click();
    await page.waitForFunction(() => !/Chờ áp dụng/.test(document.querySelector('table tbody tr').innerText));
    check('"Rút lại" gửi DELETE …/<id>/review', S.writes.some((x) => x.method === 'DELETE' && x.id === tid));

    // Sửa thủ công
    const second = S.rows().nth(1); const sid = ROWS.filter(PRED.name_similar)[1].id; const sname = ROWS.filter(PRED.name_similar)[1].name;
    await second.getByRole('button', { name: 'Sửa thủ công', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: /^Sửa thủ công/ });
    await dlg.waitFor();
    check('hộp thoại có tên vendor trong tiêu đề', (await dlg.getAttribute('aria-label') || await dlg.locator('h2,h3,[role=heading]').first().innerText()).includes(sname.slice(0, 12)));
    const opts = ['Gắn đúng nơi trên Google Maps', 'Không có trên Maps → gỡ vendor', 'Tạm đóng cửa → ẩn, kiểm lại sau', 'Giữ nguyên, không dùng Google'];
    const dtxt = (await dlg.textContent()).replace(/\s+/g, ' ');
    check('hộp thoại có đủ 4 lựa chọn "Quyết định", ô link/place_id, ô Ghi chú, nút Lưu, Huỷ', opts.every((o) => dtxt.includes(o)) && (await dlg.getByLabel('Ghi chú').count()) === 1 && (await dlg.getByRole('button', { name: 'Lưu', exact: true }).count()) === 1 && (await dlg.getByRole('button', { name: 'Huỷ', exact: true }).count()) === 1, dtxt.slice(0, 200));
    check('KHÔNG có ô địa chỉ tự do', (await dlg.getByLabel(/Địa chỉ/).count()) === 0);
    await dlg.getByText('Không có trên Maps → gỡ vendor').click();
    const before = S.writes.length;
    await dlg.getByRole('button', { name: 'Lưu', exact: true }).click();
    check('"Gỡ vendor" thiếu ghi chú: báo "Cần ghi chú" và không gửi gì', /Cần ghi chú/.test(await dlg.textContent()) && S.writes.length === before, S.writes.length - before);
    await dlg.getByLabel('Ghi chú').fill('Không thấy trên Maps');
    await dlg.getByRole('button', { name: 'Lưu', exact: true }).click();
    await dlg.waitFor({ state: 'detached' });
    const pw = S.writes.filter((x) => x.method === 'PUT').pop();
    check('Lưu gửi PUT manual action=remove kèm note, không kèm place_id/maps_link', pw.id === sid && pw.body.decision === 'manual' && pw.body.action === 'remove' && pw.body.note === 'Không thấy trên Maps' && !pw.body.place_id && !pw.body.maps_link, JSON.stringify(pw));
    check('dòng vừa sửa hiện "Chờ áp dụng"', (await rowText(S.rows().nth(1))).includes('Chờ áp dụng'));
    // link vs place_id
    await S.rows().nth(2).getByRole('button', { name: 'Sửa thủ công', exact: true }).click();
    const d2 = page.getByRole('dialog', { name: /^Sửa thủ công/ }); await d2.waitFor();
    await d2.getByText('Gắn đúng nơi trên Google Maps').click();
    await d2.getByLabel('Link Google Maps hoặc place_id').fill('https://share.google/abc123');
    await d2.getByRole('button', { name: 'Lưu', exact: true }).click(); await d2.waitFor({ state: 'detached' });
    let p2 = S.writes.filter((x) => x.method === 'PUT').pop();
    check('dán link -> gửi maps_link (không gửi place_id)', p2.body.action === 'accept_place' && p2.body.maps_link === 'https://share.google/abc123' && !p2.body.place_id, JSON.stringify(p2.body));
    await S.rows().nth(3).getByRole('button', { name: 'Sửa thủ công', exact: true }).click();
    const d3 = page.getByRole('dialog', { name: /^Sửa thủ công/ }); await d3.waitFor();
    await d3.getByText('Gắn đúng nơi trên Google Maps').click();
    await d3.getByLabel('Link Google Maps hoặc place_id').fill('ChIJ_Q8PLiQvdTERNk66UVRKf8U');
    await d3.getByRole('button', { name: 'Lưu', exact: true }).click(); await d3.waitFor({ state: 'detached' });
    p2 = S.writes.filter((x) => x.method === 'PUT').pop();
    check('dán place_id -> gửi place_id (không gửi maps_link)', p2.body.action === 'accept_place' && p2.body.place_id === 'ChIJ_Q8PLiQvdTERNk66UVRKf8U' && !p2.body.maps_link, JSON.stringify(p2.body));
    await S.rows().nth(4).getByRole('button', { name: 'Sửa thủ công', exact: true }).click();
    const d4 = page.getByRole('dialog', { name: /^Sửa thủ công/ }); await d4.waitFor();
    const n0 = S.writes.length; await d4.getByRole('button', { name: 'Huỷ', exact: true }).click(); await d4.waitFor({ state: 'detached' });
    check('Huỷ đóng hộp thoại và không gửi gì', S.writes.length === n0);
    // quay lại danh sách cũ
    await page.getByRole('button', { name: 'Danh sách vendor' }).click();
    check('nút "Danh sách vendor" trở về danh sách cũ (bảng enrich biến mất)', (await page.getByRole('table', { name: 'Bảng enrich vendor' }).count()) === 0);
    check('không request nào ra ngoài (Google) trong cả phiên', S.external.length === 0, S.external.join(' '));
    if (SHOTS) { await page.getByRole('button', { name: 'Enrich Google Maps' }).click(); await page.screenshot({ path: path.join(SHOTS, 'enrich-1280.png'), fullPage: false }); }
    await S.ctx.close();

    const F = await scenario({ forbidden: true }).catch(() => null);
    if (F) {
      await F.page.waitForTimeout(500);
      check('API trả 403: không hiện bảng, có thông báo lỗi', (await F.page.getByRole('table', { name: 'Bảng enrich vendor' }).count()) === 0 && /không|lỗi|quyền/i.test(await F.page.locator('main').innerText()), (await F.page.locator('main').innerText()).slice(0, 120));
      await F.ctx.close();
    } else check('API trả 403: giao diện vẫn mở được mục Enrich để hiện lỗi', false);

    const M = await scenario({ viewport: { width: 390, height: 844 } });
    await M.table.waitFor();
    const mm = await M.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    check('390px: trang không cuộn ngang (bảng tự cuộn trong khung)', mm.sw <= mm.cw, JSON.stringify(mm));
    if (SHOTS) await M.page.screenshot({ path: path.join(SHOTS, 'enrich-390.png') });
    await M.ctx.close();
  } catch (e) {
    check('bước thao tác không thực hiện được (thiếu phần tử mà spec yêu cầu?)', false, String(e.message).split('\n')[0]);
  }
  await browser.close(); server.close();
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
