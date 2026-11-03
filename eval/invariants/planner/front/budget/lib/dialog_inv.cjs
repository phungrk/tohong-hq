#!/usr/bin/env node
// Bản chụp cố định cho bất biến planner/front/budget INV-004, nguồn T-048 (spec products/T-048-cach-hoat-dong-chi-tiet-hang-muc.md v2,
// harness eval/T-048/check_ui.cjs, qua Spec Gate 2026-11-03, spec-critic). Sửa file này = sửa bất biến: qua Chief of Staff, ghi decisions/.
/*
 * INV-004 · Lớp "Cách hoạt động" mở từ màn chi tiết hạng mục ngân sách là một hộp thoại đúng nghĩa:
 *   - nút "Chi tiết" mở đúng một role=dialog tên "Cách hoạt động", địa chỉ (hash) không đổi;
 *   - đóng được bằng Escape, Back của trình duyệt (chỉ đóng lớp, ở lại hạng mục), chạm vùng tối ngoài sheet (390px),
 *     chạm ngoài khung app (1280px); sau khi đóng không còn role=dialog;
 *   - đóng bằng giao diện (nút "Đóng", Escape, chạm vùng tối) không để lại bước lịch sử chết: Back MỘT lần sau đó rời hạng mục về #/ngan-sach;
 *   - mở / đóng lớp không gửi PUT/POST nào ra API (chỉ đếm trong lúc lớp mở/đóng; POST đọc trạng thái vendor có sẵn khi vào màn không tính).
 * Phạm vi: khi build chưa có khối "Cách hoạt động" ở chi tiết hạng mục (trước khi T-048 merge) bất biến in "PASS (chưa áp dụng ...)".
 *   Có chữ "Cách hoạt động" mà không có nút "Chi tiết" thì FAIL. Biến bất biến thành bắt buộc có khối là sửa bất biến (qua Chief of Staff).
 * Chạy: node lib/dialog_inv.cjs --repo <tohong-front>   (tự vite build ra thư mục tạm, dữ liệu giả, mạng ngoài bị chặn)
 * Tìm theo chữ và vai trò; không đọc mã nguồn, không bộ chọn theo style/class.
 * Dòng cuối PASS / FAIL <lý do>; mã thoát 0/1 (2 = không chạy được).
 */
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { execSync } = require('child_process');
const { createRequire } = require('module');
const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REPO = arg('--repo') && path.resolve(arg('--repo'));
if (!REPO || !fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo trỏ tới tohong-front'); process.exit(2); }

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', path.join(execSync('npm root -g').toString().trim(), 'playwright')].filter(Boolean);
  for (const t of tries) { try { return createRequire(path.join(REPO, 'x.js'))(t); } catch { /* thử tiếp */ } }
  console.log('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)'); process.exit(2);
}
const { chromium } = loadPlaywright();

const fails = [];
const check = (name, ok, extra) => {
  console.log(`${ok ? '  ok ' : '  XX '} ${name}${!ok && extra ? '  :: ' + String(extra).replace(/\s+/g, ' ').slice(0, 240) : ''}`);
  if (!ok) fails.push(`${name}${extra ? ' [' + String(extra).replace(/\s+/g, ' ').slice(0, 140) + ']' : ''}`);
};

/* ---------- build + server ---------- */
let DIST = arg('--dist');
if (!DIST) {
  DIST = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-inv4-dist-'));
  try {
    execSync(`npx vite build --outDir ${JSON.stringify(DIST)} --emptyOutDir`, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: '', VITE_API_BASE: 'http://api.test' } });
  } catch (e) { console.log('FAIL build lỗi: ' + String(e.stderr || e.message).split('\n').filter(Boolean).slice(-2).join(' | ')); process.exit(1); }
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

/* ---------- dữ liệu giả ---------- */
const CID = 'c-test';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const BUDGET = { total_tr: 500, guests: 205, mung_tr: 0, categories: [
  { id: 'venue', name: 'Nhà hàng tiệc cưới', pct: 40, priority: 'high', allocated_tr: 200, items: [{ id: 'i-keep-venue', name: 'Bánh cưới', amt: 3 }] },
  { id: 'photography', name: 'Chụp ảnh + quay phim', pct: 8, priority: 'high', allocated_tr: 40, items: [] },
  { id: 'reserve', name: 'Dự phòng phát sinh', pct: 10, priority: null, allocated_tr: 50, items: [] },
] };
const withStats = (b) => { const cats = b.categories.map((c) => { const est = (c.items || []).reduce((s, i) => s + (Number(i.amt) || 0), 0);
  return { ...c, estimated_tr: est, variance_tr: (c.allocated_tr || 0) - est, state: est === 0 ? 'chua_phan_bo' : 'dang_theo_doi' }; });
  const te = cats.reduce((s, c) => s + c.estimated_tr, 0); return { ...b, categories: cats, total_estimated_tr: te, total_variance_tr: b.total_tr - te, budget_used_pct: Math.round(te / b.total_tr * 100) }; };

let browser, BASE;
const allNonGet = []; let measuring = false;   // chỉ đếm PUT/POST phát ra trong lúc mở / đóng lớp (màn có sẵn yêu cầu POST đọc trạng thái vendor từ trước, không thuộc bất biến này)
async function scenario(viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 390, height: 844 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(5000);
  const S = { page, ctx, errors: [], store: JSON.parse(JSON.stringify(BUDGET)) };
  page.on('pageerror', (e) => S.errors.push(String(e)));
  await page.route('**/*', (route) => { const u = route.request().url(); if (u.startsWith(BASE) || u.startsWith('http://api.test')) return route.continue(); return route.abort(); });
  await page.route('http://api.test/**', async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method(), p = u.pathname;
    const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(o) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (m !== 'GET' && measuring) allNonGet.push(m + ' ' + p);
    if (p === '/api/me') return json({ couples: [{ couple_id: CID, role: 'owner' }] });
    if (p === `/api/couples/${CID}/budget`) return json(withStats(S.store));
    if (p === `/api/couples/${CID}/summary`) return json({ profile: {}, budget: { total_tr: S.store.total_tr }, guests: { capacity: S.store.guests, total: 0, yes: 0, pending: 0, no: 0 } });
    if (p === `/api/couples/${CID}/conversations`) return json({ conversations: [] });
    if (p === '/api/vendors/status') return json({ vendors: {} });
    return json({});
  });
  const saved = { venue: { shortlisted: [{ id: 'v-venue', name: 'Nhà hàng Hoa Sen', priceTotal: 6, spec: '10 người/bàn' }], confirmed: null }, photography: { shortlisted: [], confirmed: null } };
  await page.addInitScript(([cid, sv]) => { try { if (!sessionStorage.getItem('inv4-seeded')) { localStorage.setItem('th_vendors_' + cid, JSON.stringify(sv)); localStorage.setItem('th_user', JSON.stringify({ bride: 'An', groom: 'Bình' })); sessionStorage.setItem('inv4-seeded', '1'); } } catch { /* bỏ qua */ } }, [CID, saved]);
  await page.goto(BASE + '/#/ngan-sach'); await page.waitForTimeout(500);
  return S;
}
async function openCat(S, id) { await S.page.goto(BASE + '/#/ngan-sach/' + id); await S.page.waitForTimeout(600); }
const btnOf = (page) => page.getByRole('button', { name: 'Chi tiết', exact: true });
const dialogs = (page) => page.getByRole('dialog').count();
const hash = (page) => page.evaluate(() => location.hash);
async function openDlg(S) { await S.page.waitForTimeout(400); measuring = true; await btnOf(S.page).first().click(); await S.page.waitForTimeout(500); }
const stopMeasure = async (S) => { await S.page.waitForTimeout(300); measuring = false; };
// chạm vùng ngoài sheet: giữa khoảng trống phía trên hộp thoại
async function tapAbove(S) { const bb = await S.page.getByRole('dialog').first().boundingBox({ timeout: 1500 }).catch(() => null); if (!bb || bb.y < 12) return false; await S.page.mouse.click(bb.x + bb.width / 2, bb.y / 2); return true; }

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); BASE = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();

  // Phạm vi
  { const S = await scenario(); await openCat(S, 'venue');
    const hasText = /Cách hoạt động/.test(await S.page.evaluate(() => document.body.innerText));
    const nb = await btnOf(S.page).count(); await S.ctx.close();
    if (!hasText && nb === 0) { await browser.close(); server.close(); console.log('PASS (chưa áp dụng: chi tiết hạng mục chưa có khối "Cách hoạt động")'); process.exit(0); }
    check('chi tiết hạng mục có khối "Cách hoạt động" thì có nút "Chi tiết" (role=button) để mở lớp', nb >= 1, 'count=' + nb); }

  for (const cat of ['venue', 'photography']) {
    const want = '#/ngan-sach/' + cat;
    // mở: role dialog, tên, hash không đổi
    { const S = await scenario(); await openCat(S, cat); await openDlg(S);
      const n = await S.page.getByRole('dialog', { name: 'Cách hoạt động' }).count();
      check(`${cat}: "Chi tiết" mở đúng một role=dialog tên "Cách hoạt động"`, n === 1 && await dialogs(S.page) === 1, 'named=' + n);
      check(`${cat}: mở lớp không đổi địa chỉ`, await hash(S.page) === want, await hash(S.page));
      // Back chỉ đóng lớp
      await S.page.goBack(); await S.page.waitForTimeout(700);
      check(`${cat}: Back đóng lớp, vẫn ở hạng mục`, await dialogs(S.page) === 0 && await hash(S.page) === want, await hash(S.page));
      await stopMeasure(S); await S.ctx.close(); }
    // đóng bằng giao diện, rồi Back một lần rời hạng mục
    for (const how of ['Escape', 'chạm vùng tối', 'Đóng']) {
      const S = await scenario(); await openCat(S, cat); await openDlg(S);
      let did = true;
      if (how === 'Escape') await S.page.keyboard.press('Escape');
      else if (how === 'chạm vùng tối') did = await tapAbove(S);
      else await S.page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).click({ timeout: 1500 }).catch(() => { did = false; });
      await S.page.waitForTimeout(600);
      const closed = did && await dialogs(S.page) === 0 && await hash(S.page) === want;
      check(`${cat}: đóng bằng ${how}: lớp đóng, không còn role=dialog, vẫn ở hạng mục`, closed, 'did=' + did + ' hash=' + await hash(S.page));
      await stopMeasure(S);
      await S.page.goBack(); await S.page.waitForTimeout(700);
      const h = await hash(S.page);
      check(`${cat}: sau khi đóng bằng ${how}, Back MỘT lần rời hạng mục về #/ngan-sach (không có bước chết)`, h === '#/ngan-sach', 'hash=' + h);
      await S.ctx.close();
    }
  }
  // 1280px: chạm ngoài khung app đóng lớp
  { const S = await scenario({ width: 1280, height: 900 }); await openCat(S, 'venue'); await openDlg(S);
    const opened = await dialogs(S.page) === 1;
    await S.page.mouse.click(30, 450); await S.page.waitForTimeout(600);
    check('1280px: chạm ngoài khung app đóng lớp', opened && await dialogs(S.page) === 0 && await hash(S.page) === '#/ngan-sach/venue', 'opened=' + opened);
    await stopMeasure(S); await S.ctx.close(); }

  check('không có PUT/POST nào ra API trong lúc mở và đóng lớp (mọi cách đóng)', allNonGet.length === 0, JSON.stringify(allNonGet.slice(0, 5)));

  await browser.close(); server.close();
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
}
main().catch((e) => { console.log('FAIL bất biến không chạy được: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); process.exit(2); });
