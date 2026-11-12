#!/usr/bin/env node
/*
 * Eval tầng 1 của T-129 (repo tohong-front): bảng enrich KHÔNG đổi gì ngoài nhãn trạng thái của dòng đang chờ. Đo theo nhãn người dùng thấy và vai trò trợ năng.
 * Chạy:   cd /home/user/tohong-front && node /home/user/tohong-hq/eval/T-129/check_6_ui_nhan_trang_thai.cjs --repo . [--dist DIR]
 * Hợp đồng (spec products/T-129-capu-bam-la-quyet.md, Hành vi 4): review trả về từ API có `by_capu` (boolean, hiệu lực).
 *  - by_capu === true: Status của dòng ghi "Chờ áp dụng" (như T-124), có nút "Rút lại", không có "Approve".
 *  - by_capu !== true (false hoặc thiếu): Status ghi "Chờ Capu" (KHÔNG ghi "Chờ áp dụng"), cũng có "Rút lại", không có "Approve".
 *  - Bấm "Approve" trên dòng chưa review: gửi đúng PUT {decision:"approve"} (thân yêu cầu KHÔNG mang by_capu, reviewed_by, capu), dòng chuyển nhãn theo by_capu trong phản hồi.
 *  - Lưu "Sửa thủ công": thân yêu cầu KHÔNG mang by_capu, reviewed_by, capu; dòng chuyển nhãn theo by_capu trong phản hồi.
 *  - API trả 409 {"error":"decided_by_capu"} khi rút lại: hiện câu có chữ "Capu" (lời, không hiện mã lỗi thô "decided_by_capu"), dòng giữ nguyên.
 *  - Không đổi: 6 cột, 5 chip và số (876/98/680/244/107), 50 dòng/trang, mọi nút khác.
 * Tự `vite build`, giả API với dữ liệu 876 vendor trong eval/T-124/snapshot.json (cùng harness check_8 của T-124). Không request ra ngoài. In PASS hoặc FAIL <lý do> (+n lỗi nữa); thoát 0/1 (2 = eval không chạy được).
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
const SNAP = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'T-124', 'snapshot.json'), 'utf8')).facts;
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
    approvable: APPROVABLE.has(group) && !!cand && !f.override && !(!f.g && f.audit && f.audit.reject_reason === 'out_of_province'), override: null, review: null };
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
  const { viewport = { width: 1280, height: 900 }, forbidden = false, byCapu = true, seed = [] } = opts;
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(4000);
  const S = { page, ctx, lists: [], writes: [], other: [], external: [], store: new Map() };
  for (const [id, by] of seed) S.store.set(id, { state: 'pending', decision: 'approve', action: 'accept_place', place_id: 'ChIJseedXXXXXXXXXXXXXXXX', reason: 'Admin duyệt', reviewed_by: by ? 'user_capu' : 'user_admin', reviewed_at: '2026-11-12T03:04:05.678Z', by_capu: by });
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
      if (m === 'DELETE') { if (S.lock && S.lock.has(mm[1])) return json({ error: 'decided_by_capu' }, 409); S.store.delete(mm[1]); return json({ review: null }); }
      const row = ROWS.find((r) => r.id === mm[1]);
      const rv = { state: 'pending', decision: body.decision, action: body.decision === 'approve' ? 'accept_place' : body.action, place_id: body.place_id || (row.google && row.google.place_id) || null,
        maps_link: body.maps_link || null, reason: body.note || 'Admin duyệt', reviewed_by: byCapu ? 'user_capu' : 'user_admin', reviewed_at: new Date().toISOString(), by_capu: byCapu };
      if (S.lock && S.lock.has(mm[1])) return json({ error: 'decided_by_capu' }, 409);
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
    const nameSim = ROWS.filter(PRED.name_similar).filter((r) => r.approvable);
    const [R1, R2, R3, R4] = nameSim;
    const waitRows = async (S) => { await S.table.waitFor(); await S.page.getByRole('button', { name: /^Tên hơi giống/ }).click(); await S.page.waitForFunction(() => /\/ 244/.test(document.body.innerText)); };
    const idx = (id) => ROWS.filter(PRED.name_similar).findIndex((r) => r.id === id);

    // 1) dòng có sẵn review: nhãn theo by_capu
    const S = await scenario({ seed: [[R1.id, true], [R2.id, false]] });
    await waitRows(S);
    const t1 = await rowText(S.rows().nth(idx(R1.id))), t2 = await rowText(S.rows().nth(idx(R2.id)));
    check('review của Capu (by_capu true): Status "Chờ áp dụng", không "Chờ Capu"', t1.includes('Chờ áp dụng') && !t1.includes('Chờ Capu'), t1.slice(0, 200));
    check('review của admin khác (by_capu false): Status "Chờ Capu", không "Chờ áp dụng"', t2.includes('Chờ Capu') && !t2.includes('Chờ áp dụng'), t2.slice(0, 200));
    for (const [n, i] of [['Capu', idx(R1.id)], ['admin khác', idx(R2.id)]]) {
      const row = S.rows().nth(i);
      check(`dòng chờ (${n}): có "Rút lại", không có "Approve"`, (await row.getByRole('button', { name: 'Rút lại' }).count()) === 1 && (await row.getByRole('button', { name: 'Approve', exact: true }).count()) === 0);
    }
    const chips = await S.page.getByRole('button', { name: /^(Tất cả|Enrich 100%|Chưa có ảnh Google|Tên hơi giống|Địa chỉ khác marry) · \d+$/ }).evaluateAll((els) => els.map((e) => e.innerText.trim()));
    check('5 chip và số không đổi (876/98/680/244/107)', chips.join('|') === 'Tất cả · 876|Enrich 100% · 98|Chưa có ảnh Google · 680|Tên hơi giống · 244|Địa chỉ khác marry · 107', chips.join('|'));
    check('6 cột đúng nhãn', (await Promise.all(['#', 'Vendor', 'Thông tin trên marry.vn', 'Sau enrich Google Maps', 'Status', 'Action'].map((h) => S.page.getByRole('columnheader', { name: h, exact: true }).count()))).every((n) => n === 1));
    // rút lại khi bị khoá
    S.lock = new Set([R1.id]);
    await S.rows().nth(idx(R1.id)).getByRole('button', { name: 'Rút lại' }).click();
    await S.page.waitForTimeout(500);
    const body = await S.page.locator('body').innerText();
    check('409 decided_by_capu: hiện lời có chữ "Capu", không hiện mã thô', /Capu/.test(body.replace(/Chờ Capu/g, '')) && !/decided_by_capu/.test(body), body.slice(0, 160));
    check('sau 409 dòng giữ nguyên "Chờ áp dụng"', (await rowText(S.rows().nth(idx(R1.id)))).includes('Chờ áp dụng'));
    await S.ctx.close();

    // 2) bấm Approve: nhãn theo phản hồi, thân yêu cầu sạch
    for (const [cap, want, other] of [[true, 'Chờ áp dụng', 'Chờ Capu'], [false, 'Chờ Capu', 'Chờ áp dụng']]) {
      const T = await scenario({ byCapu: cap });
      await waitRows(T);
      const tid = ROWS.filter(PRED.name_similar)[0].id;
      await T.rows().nth(0).getByRole('button', { name: 'Approve', exact: true }).click();
      await T.page.waitForFunction((w) => document.querySelector('table tbody tr').innerText.includes(w), want);
      const w = T.writes.filter((x) => x.method === 'PUT');
      const tt = await rowText(T.rows().nth(0));
      check(`Approve khi API trả by_capu=${cap}: PUT {decision:"approve"} sạch, Status "${want}" (không "${other}")`, w.length === 1 && w[0].id === tid && JSON.stringify(w[0].body) === '{"decision":"approve"}' && tt.includes(want) && !tt.includes(other), JSON.stringify(w) + ' ' + tt.slice(0, 160));
      await T.rows().nth(0).getByRole('button', { name: 'Rút lại' }).click();
      await T.page.waitForFunction(() => !/Chờ (áp dụng|Capu)/.test(document.querySelector('table tbody tr').innerText));
      check(`Rút lại (by_capu=${cap}) gửi DELETE và dòng hết nhãn chờ`, T.writes.some((x) => x.method === 'DELETE' && x.id === tid));
      // Sửa thủ công
      await T.rows().nth(1).getByRole('button', { name: 'Sửa thủ công', exact: true }).click();
      const dlg = T.page.getByRole('dialog', { name: /^Sửa thủ công/ });
      await dlg.waitFor();
      await dlg.getByText('Không có trên Maps → gỡ vendor').click();
      await dlg.getByLabel('Ghi chú').fill('Không có trên Maps');
      await dlg.getByRole('button', { name: 'Lưu', exact: true }).click();
      await T.page.waitForFunction((w) => document.querySelectorAll('table tbody tr')[1].innerText.includes(w), want);
      const m = T.writes.filter((x) => x.method === 'PUT').pop();
      check(`Sửa thủ công khi API trả by_capu=${cap}: thân không mang by_capu/reviewed_by/capu, Status "${want}"`, m && !/by_capu|reviewed_by|"capu"/.test(JSON.stringify(m.body)) && (await rowText(T.rows().nth(1))).includes(want), JSON.stringify(m));
      check('không request ra ngoài', T.external.length === 0, T.external.join(' '));
      await T.ctx.close();
    }
  } catch (e) { check('chạy không lỗi', false, e.message); }
  await browser.close(); server.close();
  if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
