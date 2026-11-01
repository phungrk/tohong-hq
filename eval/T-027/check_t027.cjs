#!/usr/bin/env node
/*
 * Eval tầng 1 cho T-027 (nút Back trình duyệt + cài app ra màn hình chính). Spec: products/T-027-back-va-cai-app.md
 *
 * Chạy:   node eval/T-027/check_t027.cjs --repo /đường/dẫn/tohong-front [--only 1,2,...] [--shots DIR] [--dist DIR] [--base origin/main]
 *   --only  1 bước lịch sử và thứ tự Back · 2 Back đóng lớp trước · 3 gốc Tổng quan không bẫy · 4 hash, tải lại, link sâu
 *           5 manifest + icon + apple-touch-icon + đủ điều kiện cài · 6 gợi ý cài app · 7 BotMarkdown còn render (phần hành vi)
 *   (tiêu chí 7 còn có check_7_guard.py và check_7_inv.sh; tiêu chí 8 có check_8_shots.py)
 *   --shots ghi ảnh chụp vào DIR (devicePixelRatio 1).
 * In dòng cuối `PASS` hoặc `FAIL <lý do đầu tiên> (+n lỗi nữa)`; mã thoát 0 / 1 (2 = eval không chạy được).
 *
 * Không cần backend/Clerk: mọi request tới localhost:8787 được giả, mọi request ra ngoài bị chặn, riêng
 * POST https://us.i.posthog.com/capture/ được ghi lại (build có VITE_POSTHOG_KEY giả) để kiểm analytics của gợi ý cài.
 * Eval chỉ đo hành vi nhìn thấy (URL, history, phần tử trên màn); không đọc mã nguồn.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');
const { createRequire } = require('module');

const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REPO = arg('--repo');
if (!REPO || !fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo trỏ tới tohong-front'); process.exit(2); }
const SHOTS = arg('--shots');
const BASE = arg('--base') || 'origin/main';
const ONLY = arg('--only') ? arg('--only').split(',').map(Number) : null;
const want = (n) => !ONLY || ONLY.includes(n);
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean);
  for (const t of tries) { try { return createRequire(path.join(REPO, 'x.js'))(t); } catch { /* thử tiếp */ } }
  try { return require('/opt/node-tools/node_modules/playwright'); } catch { /* hết */ }
  console.log('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)'); process.exit(2);
}

const fails = [];
let CRIT = 0;
const check = (name, ok, extra) => {
  console.log(`${ok ? '  ok ' : '  XX '} [${CRIT}] ${name}${extra ? '  :: ' + extra : ''}`);
  if (!ok) fails.push(`[tiêu chí ${CRIT}] ${name}${extra ? ' (' + extra + ')' : ''}`);
};

/* ---------- build + server ---------- */
let DIST = arg('--dist');
let tmpDist = null;
if (!DIST) {
  tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), 't027-dist-'));
  try {
    execSync(`npx vite build --outDir ${JSON.stringify(tmpDist)} --emptyOutDir`, {
      cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: '', VITE_API_BASE: 'http://localhost:8787', VITE_POSTHOG_KEY: 'phc_eval_fake' },
    });
  } catch (e) { console.log('FAIL build lỗi: ' + String(e.stderr || e.message).split('\n').filter(Boolean).slice(-2).join(' | ')); process.exit(1); }
  DIST = tmpDist;
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(DIST, p);
  const exists = f.startsWith(DIST) && fs.existsSync(f) && !fs.statSync(f).isDirectory();
  if (!exists) {
    if (path.extname(p)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }   // file tĩnh thiếu = 404 thật
    f = path.join(DIST, 'index.html');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

/* ---------- dữ liệu giả (cùng khuôn eval/T-025) ---------- */
const summary = () => ({ profile: { wedding_date: '2027-03-14', city: 'Hà Nội', bride_name: 'A', groom_name: 'B' }, days_left: 135, total_days: 365, done_days: 230,
  budget: { total_tr: 300, spent_tr: 0, over: false }, timeline: { done: 0, total: 0 }, vendors: { confirmed: 0, shortlisted: 0, empty: 0 }, guests: { yes: 0, pending: 0, no: 0, total: 0, capacity: 200 } });
const sse = (ev, data) => `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`;
async function mockApi(route, log, flags = {}) {
  const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const m = req.method();
  if (log) log.push({ url: req.url(), method: m, body: req.postData() || '' });
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const json = (o) => route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(o) });
  if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  if (p === '/api/me') return json({ couples: [{ couple_id: 'cpl_test1', role: 'owner' }] });
  if (p.endsWith('/summary')) return json(summary());
  if (p.endsWith('/conversations')) return json({ conversations: [] });
  if (p.endsWith('/budget') && m === 'GET') return json({ total_tr: 300, guests: 200, mung_tr: 0, categories: [
    { id: 'venue', name: 'Tiệc', allocated_tr: 150, items: [] }, { id: 'photography', name: 'Ảnh', allocated_tr: 20, items: [] }] });
  if (p === '/api/vendors/status') return json({ vendors: {} });
  if (p.startsWith('/api/vendors/')) return json({ vendor: {}, match: {} });
  if (p.endsWith('/members')) return json({ members: [], invites: [] });
  if (p.endsWith('/chat') && m === 'POST' && flags.chat402) {
    return route.fulfill({ status: 402, contentType: 'application/json', headers: cors, body: JSON.stringify({ error: 'trial_exhausted' }) });
  }
  if (p.endsWith('/chat') && m === 'POST') {
    return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', ...cors },
      body: sse('conversation', { id: 'conv1' }) + sse('chunk', { text: 'Bảng ngân sách:\n\n| Hạng mục | Tiền |\n|---|---|\n| Tiệc | 150tr |\n' }) + sse('done', {}) });
  }
  if (p.endsWith('/subscription/trial')) return json({});
  if (p.endsWith('/subscription') && flags.chat402) return json({ subscription: { plan: null, status: 'trial', trial_messages_total: 6, trial_messages_used: 1, trial_extended: false } });
  if (p.endsWith('/subscription')) return json({ status: 'trial', trial: { total: 6, remaining: 6 } });
  if (p.endsWith('/connect-requests')) return json({ requests: [] });
  if (p.endsWith('/timeline') || p.endsWith('/guests')) return json({ phases: [], guests: [], summary: {} });
  return json({});
}

/* ---------- đo trên trang ---------- */
const TAB_NAMES = ['Trang chủ', 'Kế hoạch', 'Ngân sách', 'Khách mời'];
const HASH = { 'Trang chủ': '#/trang-chu', 'Kế hoạch': '#/ke-hoach', 'Ngân sách': '#/ngan-sach', 'Khách mời': '#/khach-moi' };
// Chạy trong trang. Trả về trạng thái người dùng thấy: hash, tab đang chọn (aria-current), trang con, lớp đang mở.
const SNAP = () => {
  const frame = document.querySelector('.app-frame'); const fr = frame ? frame.getBoundingClientRect() : { left: 0, right: innerWidth, top: 0, bottom: innerHeight };
  const shown = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < fr.left || cx > fr.right || cy < 0 || cy > innerHeight) return false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.5) return false;
    }
    return true;
  };
  const q = (s) => [...document.querySelectorAll(s)];
  const btn = (t) => q('button').find((b) => b.textContent.trim() === t);
  const cur = TAB_NAMES_IN.filter((n) => { const b = btn(n); return b && b.getAttribute('aria-current') === 'page'; });
  const label = (a) => q('[role=dialog]').find((d) => (d.getAttribute('aria-label') || '').includes(a));
  const budgetRows = q('span').filter((e) => e.children.length === 0 && ['Tiệc', 'Ảnh'].includes(e.textContent.trim()));
  return {
    hash: location.hash, len: history.length, url: location.href,
    tab: cur.length === 1 ? cur[0] : (cur.length ? 'nhiều:' + cur.join(',') : null),
    homeShown: q('button[aria-label^="Mời người ấy"]').some(shown),
    budgetShown: budgetRows.some(shown),
    sub: shown(q('button[aria-label="Quay lại"]')[0]),
    layers: {
      drawer: shown(q('aside')[0]),
      chat: shown(document.querySelector('[aria-label="Nhắn cho Tơ Hồng"]')),
      invite: shown(label('Mời người ấy')),
      connect: shown(label('kết nối vendor')),
      vendor: q('[data-testid=connect-btn]').some(shown),
      timeline: q('label').some((e) => e.textContent.trim() === 'Tên mốc' && shown(e)),
      task: q('label').some((e) => e.textContent.trim() === 'Tên việc' && shown(e)),
      edit: q('button').some((e) => e.textContent.trim() === 'Huỷ' && shown(e)),
      paywall: q('div').some((e) => e.children.length > 0 === false && e.textContent.trim().startsWith('Thử thêm 3 lượt') && shown(e)),
    },
  };
};
const SNAP_SRC = `(() => { const TAB_NAMES_IN = ${JSON.stringify(TAB_NAMES)}; return (${SNAP.toString()})(); })()`;
const snap = (page) => page.evaluate(SNAP_SRC);
const openLayers = (s) => Object.entries(s.layers).filter(([, v]) => v).map(([k]) => k).join('+') || '-';
const desc = (s) => `hash=${s.hash || '(rỗng)'} tab=${s.tab} sub=${s.sub} lớp=${openLayers(s)}`;

/* Chờ tới khi trạng thái khớp (tối đa ~2s) rồi ghi kết quả. exp: { hash, tab, sub, layers: 'drawer'|'-'|..., len } */
async function expectState(page, name, exp) {
  let s; const t0 = Date.now(); let bad = [];
  for (;;) {
    s = await snap(page); bad = [];
    if (exp.hash !== undefined && s.hash !== exp.hash) bad.push(`hash ${s.hash || '(rỗng)'} ≠ ${exp.hash}`);
    if (exp.tab !== undefined && s.tab !== exp.tab) bad.push(`tab ${s.tab} ≠ ${exp.tab}`);
    if (exp.sub !== undefined && s.sub !== exp.sub) bad.push(`trang con ${s.sub ? 'mở' : 'đóng'} ≠ ${exp.sub ? 'mở' : 'đóng'}`);
    if (exp.layers !== undefined && openLayers(s) !== exp.layers) bad.push(`lớp ${openLayers(s)} ≠ ${exp.layers}`);
    if (exp.home !== undefined && s.homeShown !== exp.home) bad.push(`màn Trang chủ ${s.homeShown ? 'hiện' : 'không hiện'}`);
    if (exp.budget !== undefined && s.budgetShown !== exp.budget) bad.push(`màn Ngân sách ${s.budgetShown ? 'hiện' : 'không hiện'}`);
    if (!bad.length || Date.now() - t0 > 2200) break;
    await page.waitForTimeout(120);
  }
  check(name, !bad.length, bad.length ? bad.join('; ') : desc(s));
  if (!bad.length && exp.layers && exp.layers !== '-') await page.waitForTimeout(450);   // chờ hiệu ứng trượt của lớp xong rồi mới thao tác tiếp
  return s;
}
const left = async (page) => { await page.waitForTimeout(350); return !(page.url().startsWith(BASE_URL)); };   // đã rời app?
// Nút thanh tab = nút có đúng chữ n nằm thấp nhất trên màn hình (ngăn kéo cũng có nút cùng tên nhưng nằm ngoài màn khi đóng).
const tabBtn = (page, n) => ({ click: async () => {
  const pt = await page.evaluate((name) => {
    const c = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === name).map((b) => b.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.left >= 0 && r.left < innerWidth && r.top < innerHeight).sort((a, b) => b.top - a.top)[0];
    return c ? { x: c.left + c.width / 2, y: c.top + c.height / 2 } : null;
  }, n);
  if (!pt) throw new Error('không thấy nút tab ' + n);
  await page.mouse.click(pt.x, pt.y);
} });
const appReady = (page) => page.getByRole('button', { name: 'Ngân sách', exact: true }).first().waitFor({ timeout: 8000 });

/* ---------- tạo trang ---------- */
let BASE_URL = '';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
async function newCtx(browser, W, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: opts.H || 844 }, userAgent: opts.ua, isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  await ctx.addInitScript(({ profile, extra }) => {
    window.__h0 = history.length;
    try {
      if (profile) {
        localStorage.setItem('th_user', '{"n":1}');
        localStorage.setItem('th_vendors_cpl_test1', JSON.stringify({ photography: { shortlisted: [{ id: 'pv1', name: 'Studio X', priceTotal: 25, priceMax: null, priceSource: 'verified', spec: 'Ảnh', gallery: [], grad: '#ccc', reviews: [], includes: [], reasons: [] }], confirmed: null } }));
      }
    } catch { /* bỏ qua */ }
    if (extra) { try { (new Function(extra))(); } catch (e) { console.error('init extra', e); } }
  }, { profile: opts.profile !== false, extra: opts.init || '' });
  return ctx;
}
async function openPage(ctx, hash = '', opts = {}) {
  const page = await ctx.newPage(); page.setDefaultTimeout(5000);
  const net = { posthog: [], api: [], errs: [], flags: { chat402: !!opts.chat402 } };
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(BASE_URL)) return route.continue();
    if (u.startsWith('http://localhost:8787/')) return mockApi(route, net.api, net.flags);
    if (u.startsWith('https://us.i.posthog.com/capture')) {
      try { net.posthog.push(JSON.parse(route.request().postData() || '{}')); } catch { /* bỏ qua */ }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
    }
    if (u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    return route.abort();
  });
  page.on('pageerror', (e) => net.errs.push(e.message));
  page.on('dialog', (d) => { net.errs.push('hộp thoại: ' + d.message()); d.dismiss().catch(() => {}); });
  await page.goto(BASE_URL + hash);
  if (opts.waitApp !== false) {
    await appReady(page);
    await page.waitForTimeout(800);
  }
  page.__net = net;
  page.__h0 = await page.evaluate(() => window.__h0);
  return page;
}
const shot = async (page, name, W) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}-${W}.png`) }); };

// Bấm nút đang thấy được trên màn (mỗi tab có bản sao nút "Mở menu"/"AI" riêng, bản ở tab khác bị ẩn).
async function clickShown(page, match) {
  const pt = await page.evaluate((m) => {
    const fr = document.querySelector('.app-frame').getBoundingClientRect();
    const ok = (b) => {
      const r = b.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (cx < fr.left || cx > fr.right || cy < 0 || cy > innerHeight) return false;
      for (let e = b; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.5 || cs.pointerEvents === 'none') return false; }
      return true;
    };
    const re = new RegExp(m);
    const b = [...document.querySelectorAll('button')].filter((x) => re.test(x.getAttribute('aria-label') || x.title || x.textContent.trim())).filter(ok)[0];
    if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, match.source);
  if (!pt) throw new Error('không thấy nút đang hiện khớp ' + match);
  await page.mouse.click(pt.x, pt.y);
}
const openDrawer = (page) => clickShown(page, /^Mở menu$/);
const openChat = (page) => clickShown(page, /^AI$/);
const openInvite = (page) => clickShown(page, /^Mời người ấy/);
async function openSubPage(page) {          // đang ở tab Ngân sách
  await page.getByText('Ảnh', { exact: true }).first().click();
}

// Một kịch bản lỗi giữa chừng (nút không có, hết giờ chờ) là một FAIL của tiêu chí, không phải lỗi của eval.
async function scn(fn) {
  const crit = CRIT;
  try { await fn(); } catch (e) { CRIT = crit; check('kịch bản dừng giữa chừng vì không thao tác được', false, String(e.message || e).split('\n')[0].slice(0, 160)); }
}
/* ========================================================= */
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  BASE_URL = `http://127.0.0.1:${server.address().port}/`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const W = 390;

  /* ---------- 1) Chuyển tab / trang con = một bước lịch sử, Back đi đúng thứ tự ---------- */
  if (want(1)) { CRIT = 1;
    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx);
      await expectState(page, 'tải app ở "/": canonical về #/trang-chu, tab Trang chủ', { hash: '#/trang-chu', tab: 'Trang chủ', home: true, sub: false, layers: '-' });
      // đi: Home -> Ngân sách -> trang con Ảnh -> Khách mời -> Kế hoạch
      await tabBtn(page, 'Ngân sách').click();
      await expectState(page, 'chọn tab Ngân sách: hash #/ngan-sach, hiện màn Ngân sách', { hash: '#/ngan-sach', tab: 'Ngân sách', budget: true, home: false });
      await tabBtn(page, 'Ngân sách').click(); await page.waitForTimeout(300);
      check('chọn lại tab đang chọn không thêm bước', (await snap(page)).len === page.__h0 + 1, `history.length ${(await snap(page)).len}, mong ${page.__h0 + 1}`);
      await openSubPage(page);
      await expectState(page, 'mở danh mục Ảnh: hash #/ngan-sach/photography, trang con hiện', { hash: '#/ngan-sach/photography', tab: 'Ngân sách', sub: true });
      await tabBtn(page, 'Khách mời').click();
      await expectState(page, 'chọn tab Khách mời: hash #/khach-moi, trang con không còn', { hash: '#/khach-moi', tab: 'Khách mời', sub: false });
      await tabBtn(page, 'Kế hoạch').click();
      await expectState(page, 'chọn tab Kế hoạch: hash #/ke-hoach', { hash: '#/ke-hoach', tab: 'Kế hoạch' });
      check('mỗi lần đổi là đúng một bước (4 bước đẩy thêm)', (await snap(page)).len === page.__h0 + 4, `history.length ${(await snap(page)).len}, mong ${page.__h0 + 4}`);
      await page.goBack();
      await expectState(page, 'Back 1: về Khách mời', { hash: '#/khach-moi', tab: 'Khách mời', sub: false });
      await page.goBack();
      await expectState(page, 'Back 2: về trang con Ảnh của Ngân sách', { hash: '#/ngan-sach/photography', tab: 'Ngân sách', sub: true });
      await page.goBack();
      await expectState(page, 'Back 3: về Ngân sách (trang con đóng)', { hash: '#/ngan-sach', tab: 'Ngân sách', sub: false, budget: true });
      await page.goBack();
      await expectState(page, 'Back 4: về Trang chủ', { hash: '#/trang-chu', tab: 'Trang chủ', home: true, budget: false });
      await page.goForward();
      await expectState(page, 'Forward 1: lại Ngân sách', { hash: '#/ngan-sach', tab: 'Ngân sách' });
      await page.goForward();
      await expectState(page, 'Forward 2: lại trang con Ảnh', { hash: '#/ngan-sach/photography', sub: true });
      check('không lỗi trang khi đi qua các bước', page.__net.errs.length === 0, page.__net.errs.slice(0, 2).join(' | '));
      await ctx.close();
    });

    await scn(async () => {
      const c3 = await newCtx(browser, W); const p3 = await openPage(c3);
      await tabBtn(p3, 'Ngân sách').click(); await p3.waitForTimeout(300); await openSubPage(p3);
      await expectState(p3, 'đang ở danh mục Ảnh', { hash: '#/ngan-sach/photography', sub: true });
      const before = (await snap(p3)).len;
      await tabBtn(p3, 'Ngân sách').click();
      await expectState(p3, 'chạm tab Ngân sách khi đang ở trang con: sang #/ngan-sach, trang con đóng', { hash: '#/ngan-sach', tab: 'Ngân sách', sub: false, budget: true });
      check('chạm tab Ngân sách ở trang con: thêm đúng một bước', (await snap(p3)).len === before + 1, `history.length ${(await snap(p3)).len}, mong ${before + 1}`);
      await p3.goBack();
      await expectState(p3, 'rồi Back: về lại danh mục Ảnh', { hash: '#/ngan-sach/photography', sub: true });
      await c3.close();
    });

    // Nút "Quay lại" của trang con = Back; chọn tab từ ngăn kéo = thay lớp, tổng một bước.
    await scn(async () => {
      let c2, p2;
      c2 = await newCtx(browser, W); p2 = await openPage(c2);
      await tabBtn(p2, 'Ngân sách').click(); await openSubPage(p2);
      await p2.getByRole('button', { name: 'Quay lại' }).click();
      await expectState(p2, 'nút "Quay lại" của trang con: về #/ngan-sach', { hash: '#/ngan-sach', sub: false, budget: true });
      await p2.goBack();
      await expectState(p2, 'rồi Back: về Trang chủ (không có bước thừa)', { hash: '#/trang-chu', tab: 'Trang chủ' });
      await c2.close();
    });
  }

  /* ---------- 2) Back đóng lớp trên cùng trước, không đổi trang ---------- */
  if (want(2)) { CRIT = 2;
    // 2a. Ngăn kéo ở Ngân sách
    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx);
      await tabBtn(page, 'Ngân sách').click(); await page.waitForTimeout(300);
      await openDrawer(page);
      await expectState(page, 'mở ngăn kéo', { layers: 'drawer', hash: '#/ngan-sach' });
      check('mở ngăn kéo thêm đúng một bước', (await snap(page)).len === page.__h0 + 2, `history.length ${(await snap(page)).len}, mong ${page.__h0 + 2}`);
      await page.goBack();
      await expectState(page, 'Back đóng ngăn kéo, vẫn ở Ngân sách', { layers: '-', hash: '#/ngan-sach', tab: 'Ngân sách' });
      await page.goForward(); await page.waitForTimeout(600);
      await expectState(page, 'Forward không mở lại ngăn kéo, vẫn ở Ngân sách', { layers: '-', hash: '#/ngan-sach', tab: 'Ngân sách' });
      await page.goBack();
      await expectState(page, 'Back tiếp: về Trang chủ', { hash: '#/trang-chu', tab: 'Trang chủ' });
      await ctx.close();
    });

    // 2b. Đóng lớp bằng giao diện rồi Back: không có bước chết
    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx);
      await tabBtn(page, 'Ngân sách').click(); await page.waitForTimeout(300);
      await openDrawer(page); await page.waitForTimeout(400);
      await page.locator('aside').getByRole('button', { name: 'Đóng menu' }).click();
      await expectState(page, 'đóng ngăn kéo bằng nút Đóng menu', { layers: '-', hash: '#/ngan-sach' });
      await page.goBack();
      await expectState(page, 'rồi Back: về Trang chủ ngay (không bước chết)', { hash: '#/trang-chu', tab: 'Trang chủ' });
      await ctx.close();
    });

    // 2c. Chọn tab từ ngăn kéo: lớp đóng, tổng một bước
    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx);
      await openDrawer(page); await page.waitForTimeout(400);
      await page.locator('aside').getByRole('button', { name: /Ngân sách/ }).first().click();
      await expectState(page, 'chọn "Ngân sách" trong ngăn kéo: lớp đóng, sang Ngân sách', { layers: '-', hash: '#/ngan-sach', tab: 'Ngân sách', budget: true });
      check('từ ngăn kéo sang tab mới: tổng đúng một bước', (await snap(page)).len === page.__h0 + 1, `history.length ${(await snap(page)).len}, mong ${page.__h0 + 1}`);
      await page.goBack();
      await expectState(page, 'Back: về Trang chủ', { hash: '#/trang-chu', tab: 'Trang chủ', layers: '-' });
      await ctx.close();
    });

    // 2d. Chọn chính tab đang ở từ ngăn kéo: không còn bước nào thừa, Back rời app
    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx);
      await openDrawer(page); await page.waitForTimeout(400);
      await page.locator('aside').getByRole('button', { name: /Trang chủ/ }).first().click();
      await expectState(page, 'chọn "Trang chủ" trong ngăn kéo khi đang ở Trang chủ: lớp đóng', { layers: '-', hash: '#/trang-chu', tab: 'Trang chủ' });
      await page.goBack();
      check('rồi Back: rời app (không bước chết)', await left(page), `url ${page.url()}`);
      await ctx.close();
    });

    // 2e. Hai lớp chồng nhau: Ngân sách -> Ảnh -> sheet vendor -> sheet Kết nối
    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx);
      await tabBtn(page, 'Ngân sách').click(); await page.waitForTimeout(300); await openSubPage(page); await page.waitForTimeout(400);
      await page.getByText('Studio X').first().click();
      await expectState(page, 'mở sheet vendor', { layers: 'vendor', hash: '#/ngan-sach/photography', sub: true });
      await page.getByTestId('connect-btn').click();
      await expectState(page, 'mở sheet Kết nối trên sheet vendor', { layers: 'connect+vendor', hash: '#/ngan-sach/photography' });
      await page.goBack();
      await expectState(page, 'Back 1: chỉ sheet Kết nối đóng, sheet vendor còn', { layers: 'vendor', hash: '#/ngan-sach/photography', sub: true });
      await page.goBack();
      await expectState(page, 'Back 2: sheet vendor đóng, vẫn ở trang con Ảnh', { layers: '-', hash: '#/ngan-sach/photography', sub: true });
      await page.goBack();
      await expectState(page, 'Back 3: rời trang con về Ngân sách', { layers: '-', hash: '#/ngan-sach', sub: false });
      await ctx.close();
    });

    // 2f. Chat AI, màn Mời ở Trang chủ
    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx);
      await openChat(page);
      await expectState(page, 'mở chat AI', { layers: 'chat', hash: '#/trang-chu' });
      await page.goBack();
      await expectState(page, 'Back đóng chat AI, vẫn ở Trang chủ', { layers: '-', hash: '#/trang-chu', tab: 'Trang chủ' });
      await openInvite(page);
      await expectState(page, 'mở màn Mời', { layers: 'invite', hash: '#/trang-chu' });
      await page.goBack();
      await expectState(page, 'Back đóng màn Mời', { layers: '-', hash: '#/trang-chu' });
      await openInvite(page);
      await expectState(page, 'mở lại màn Mời', { layers: 'invite' });
      await page.getByRole('dialog').getByRole('button', { name: 'Thôi' }).click();
      await expectState(page, 'đóng màn Mời bằng nút Thôi', { layers: '-', hash: '#/trang-chu' });
      await page.goBack();
      check('rồi Back: rời app (không bước chết)', await left(page), `url ${page.url()}`);
      await ctx.close();
    });

    // 2h. Bộ kiểm chung cho mọi lớp eval mở được (ngoài 5 lớp đã kiểm riêng ở trên):
    //     mở thêm đúng 1 bước + địa chỉ giữ nguyên; Back chỉ đóng lớp đó; đóng bằng giao diện rồi Back về trang trước (không bước chết).
    const baseOf = async (page, cfg) => { if (cfg.setup) await cfg.setup(page); await page.waitForTimeout(400); };
    const LAYER_CFG = [
      { key: 'timeline', name: 'sheet Timeline "Thêm mốc"', setup: async (pg) => { await tabBtn(pg, 'Kế hoạch').click(); await pg.waitForTimeout(400); await clickShown(pg, /^Ngày cưới/); await pg.waitForTimeout(300); },
        open: (pg) => pg.getByRole('button', { name: 'Thêm mốc', exact: true }).click(), uiClose: async (pg) => { await pg.evaluate(() => { const t = [...document.querySelectorAll('div')].find((e) => e.children.length === 0 && e.textContent.trim() === 'Thêm mốc'); t.parentElement.querySelector('button').click(); }); }, base: '-', backHash: '#/trang-chu', tab: 'Kế hoạch', hash: '#/ke-hoach' },
      { key: 'task', name: 'sheet Timeline "Thêm việc"', setup: async (pg) => { await tabBtn(pg, 'Kế hoạch').click(); await pg.waitForTimeout(400); },
        open: (pg) => pg.getByRole('button', { name: 'Thêm việc', exact: true }).click(), uiClose: async (pg) => { await pg.evaluate(() => { const t = [...document.querySelectorAll('div')].find((e) => e.children.length === 0 && e.textContent.trim() === 'Thêm việc'); t.parentElement.querySelector('button').click(); }); }, base: '-', backHash: '#/trang-chu', tab: 'Kế hoạch', hash: '#/ke-hoach' },
      { key: 'edit', name: 'sửa ngày cưới (Trang chủ)', setup: null,
        open: (pg) => clickShown(pg, /^Chỉnh sửa ngày cưới$/), uiClose: (pg) => clickShown(pg, /^Huỷ$/), base: '-', backHash: null, tab: 'Trang chủ', hash: '#/trang-chu' },
      { key: 'paywall', name: 'Paywall (chat trả 402)', setup: async (pg) => { await openChat(pg); await pg.waitForTimeout(600); },
        open: async (pg) => { const i = pg.getByLabel('Nhắn cho Tơ Hồng'); await i.fill('Ngân sách thế nào'); await i.press('Enter'); },
        uiClose: async (pg) => { await pg.getByText('Thử thêm 3 lượt', { exact: false }).first().click(); }, base: 'chat', backHash: null, tab: 'Trang chủ', hash: '#/trang-chu', chat402: true },
    ];
    for (const cfg of LAYER_CFG) {
      const withBase = (k) => (cfg.base === '-' ? k : `${cfg.base}+${k}`);
      // (i) mở -> +1 bước, địa chỉ giữ; Back đóng đúng lớp đó
      await scn(async () => {
        const ctx = await newCtx(browser, W); const page = await openPage(ctx, '', { chat402: cfg.chat402 });
        await baseOf(page, cfg);
        const pre = await snap(page);
        await cfg.open(page);
        await expectState(page, `${cfg.name}: mở ra, địa chỉ giữ ${cfg.hash}`, { layers: withBase(cfg.key), hash: cfg.hash, tab: cfg.tab });
        const post = await snap(page);
        check(`${cfg.name}: mở thêm đúng một bước`, post.len === pre.len + 1, `history.length ${post.len}, mong ${pre.len + 1}`);
        await page.goBack();
        await expectState(page, `${cfg.name}: Back chỉ đóng lớp này, tab và địa chỉ không đổi`, { layers: cfg.base, hash: cfg.hash, tab: cfg.tab });
        await ctx.close();
      });
      // (ii) mở -> đóng bằng giao diện -> Back về trang trước, không bước chết
      await scn(async () => {
        const ctx = await newCtx(browser, W); const page = await openPage(ctx, '', { chat402: cfg.chat402 });
        await baseOf(page, cfg);
        await cfg.open(page);
        await expectState(page, `${cfg.name}: mở lại (kịch bản đóng bằng giao diện)`, { layers: withBase(cfg.key) });
        await cfg.uiClose(page);
        await expectState(page, `${cfg.name}: đóng bằng giao diện`, { layers: cfg.base, hash: cfg.hash });
        await page.goBack();
        if (cfg.base !== '-') await expectState(page, `${cfg.name}: Back sau khi đóng: đóng lớp bên dưới (chat), không bước chết`, { layers: '-', hash: cfg.hash });
        else if (cfg.backHash) await expectState(page, `${cfg.name}: Back sau khi đóng: về trang trước ${cfg.backHash}`, { hash: cfg.backHash, tab: 'Trang chủ', layers: '-' });
        else check(`${cfg.name}: Back sau khi đóng: rời app (không bước chết)`, await left(page), `url ${page.url()}`);
        await ctx.close();
      });
    }

    // 2g. Tải lại khi đang mở lớp
    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx);
      await tabBtn(page, 'Ngân sách').click(); await page.waitForTimeout(300);
      await openDrawer(page); await page.waitForTimeout(400);
      await page.reload(); await appReady(page); await page.waitForTimeout(900);
      await expectState(page, 'tải lại khi mở ngăn kéo: ngăn kéo đóng, vẫn ở Ngân sách', { layers: '-', hash: '#/ngan-sach', tab: 'Ngân sách' });
      await page.goBack();
      await expectState(page, 'rồi Back: về Trang chủ ngay (không bước chết)', { hash: '#/trang-chu', tab: 'Trang chủ' });
      check('không lỗi trang', page.__net.errs.length === 0, page.__net.errs.slice(0, 2).join(' | '));
      await ctx.close();
    });
  }

  /* ---------- 3) Gốc Tổng quan: không bẫy ---------- */
  if (want(3)) { CRIT = 3;
    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx);
      await page.waitForTimeout(1500);
      let s = await snap(page);
      check('mở app: không đẩy bước giả (history.length bằng lúc nạp trang)', s.len === page.__h0, `history.length ${s.len}, lúc nạp ${page.__h0}`);
      await page.goBack();
      check('ở Trang chủ không còn bước: Back rời app, không ở lại', await left(page), `url sau Back: ${page.url()}`);
      check('không hộp thoại "rời trang?"', page.__net.errs.filter((e) => e.startsWith('hộp thoại')).length === 0, page.__net.errs.join(' | '));
      await ctx.close();
    });

    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx);
      await tabBtn(page, 'Ngân sách').click(); await page.waitForTimeout(300);
      await page.goBack();
      await expectState(page, 'Trang chủ -> Ngân sách -> Back: về Trang chủ', { hash: '#/trang-chu', tab: 'Trang chủ' });
      await page.goBack();
      check('Back tiếp từ Trang chủ: rời app', await left(page), `url ${page.url()}`);
      await ctx.close();
    });

    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx);
      await openDrawer(page); await page.waitForTimeout(400);
      await page.goBack();
      await expectState(page, 'ở gốc, mở ngăn kéo rồi Back: chỉ đóng ngăn kéo', { layers: '-', hash: '#/trang-chu', tab: 'Trang chủ' });
      await page.goBack();
      check('Back tiếp: rời app', await left(page), `url ${page.url()}`);
      await ctx.close();
    });

    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx, '#/ngan-sach');
      await page.waitForTimeout(1200);
      const s = await snap(page);
      check('link sâu vào #/ngan-sach: không chèn bước Trang chủ phía trước', s.len === page.__h0, `history.length ${s.len}, lúc nạp ${page.__h0}`);
      await page.goBack();
      check('link sâu: Back rời app', await left(page), `url ${page.url()}`);
      await ctx.close();
    });
  }

  /* ---------- 4) Hash từng tab, tải lại, link sâu ---------- */
  if (want(4)) { CRIT = 4;
    for (const [name, h] of Object.entries(HASH)) {
      await scn(async () => {
        let ctx, page;
        ctx = await newCtx(browser, W); page = await openPage(ctx);
        if (name !== 'Trang chủ') await tabBtn(page, name).click();
        await expectState(page, `tab ${name}: địa chỉ ${h}`, { hash: h, tab: name });
        await page.reload(); await appReady(page); await page.waitForTimeout(900);
        await expectState(page, `tải lại tại ${h}: giữ tab ${name}`, { hash: h, tab: name });
        await ctx.close();
      });
      await scn(async () => {
        let c2, p2;
        c2 = await newCtx(browser, W); p2 = await openPage(c2, h);
        await p2.waitForTimeout(500);
        await expectState(p2, `mở link ${h} trong tab mới: vào thẳng ${name}`, { hash: h, tab: name });
        check(`link ${h}: không thêm bước`, (await snap(p2)).len === p2.__h0, `history.length ${(await snap(p2)).len}, lúc nạp ${p2.__h0}`);
        await c2.close();
      });
    }
    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx, '#/ngan-sach/photography');
      await expectState(page, 'link sâu vào danh mục: mở thẳng trang con Ảnh', { hash: '#/ngan-sach/photography', tab: 'Ngân sách', sub: true });
      await page.reload(); await appReady(page); await page.waitForTimeout(1200);
      await expectState(page, 'tải lại tại trang con: vẫn ở trang con Ảnh', { hash: '#/ngan-sach/photography', tab: 'Ngân sách', sub: true });
      await page.getByRole('button', { name: 'Quay lại' }).click();
      await expectState(page, 'link sâu rồi "Quay lại": sang #/ngan-sach', { hash: '#/ngan-sach', sub: false });
      check('"Quay lại" sau link sâu không thêm bước và không rời app', (await snap(page)).len === page.__h0 && !(await left(page)), `history.length ${(await snap(page)).len}, lúc nạp ${page.__h0}`);
      await ctx.close();
    });

    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx, '#/ngan-sach/khong-co-id-nay');
      await expectState(page, 'link danh mục không tồn tại: về #/ngan-sach', { hash: '#/ngan-sach', tab: 'Ngân sách', sub: false });
      check('thay địa chỉ không thêm bước', (await snap(page)).len === page.__h0, `history.length ${(await snap(page)).len}, lúc nạp ${page.__h0}`);
      await ctx.close();
    });

    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx, '#/rac-ruoi');
      await expectState(page, 'hash lạ: về #/trang-chu, tab Trang chủ', { hash: '#/trang-chu', tab: 'Trang chủ' });
      check('thay địa chỉ không thêm bước', (await snap(page)).len === page.__h0, `history.length ${(await snap(page)).len}, lúc nạp ${page.__h0}`);
      await ctx.close();
    });

    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx);
      await page.evaluate(() => { location.hash = '#/khach-moi'; });
      await expectState(page, 'gõ tay #/khach-moi vào thanh địa chỉ: chuyển tab Khách mời', { hash: '#/khach-moi', tab: 'Khách mời' });
      await page.goBack();
      await expectState(page, 'rồi Back: về Trang chủ', { hash: '#/trang-chu', tab: 'Trang chủ' });
      await ctx.close();
    });

    // Địa chỉ không chứa dữ liệu cá nhân: chỉ khớp mẫu
    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx);
      const seen = [];
      for (const n of ['Ngân sách', 'Khách mời', 'Kế hoạch']) { await tabBtn(page, n).click(); await page.waitForTimeout(200); seen.push(await page.evaluate(() => location.hash)); }
      await tabBtn(page, 'Ngân sách').click(); await openSubPage(page); await page.waitForTimeout(300); seen.push(await page.evaluate(() => location.hash));
      const okRe = /^#\/(trang-chu|ke-hoach|ngan-sach(\/[A-Za-z0-9_.~%-]+)?|khach-moi)$/;
      check('mọi địa chỉ hash khớp mẫu cho phép (không email, tên, mã cặp đôi)', seen.every((h) => okRe.test(h) && !h.includes('cpl_test1')), seen.join(' '));
      await ctx.close();
    });
  }

  /* ---------- 5) Manifest, icon, apple-touch-icon, đủ điều kiện cài ---------- */
  if (want(5)) { CRIT = 5;
    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W); page = await openPage(ctx);
      const mHref = await page.evaluate(() => document.querySelector('link[rel="manifest"]')?.href || null);
      check('trang có <link rel="manifest">', !!mHref, String(mHref));
      let man = null;
      try { const r = await page.request.get(mHref || BASE_URL + 'manifest.json'); man = await r.json(); } catch { /* man=null */ }
      check('manifest đọc được, display=standalone, có name/short_name/start_url', !!man && man.display === 'standalone' && !!man.name && !!man.short_name && !!man.start_url, man ? `display=${man.display}` : 'không đọc được');
      const icons = (man && man.icons) || [];
      const base = mHref || BASE_URL;
      const info = async (src) => page.evaluate(async (u) => {
        try {
          const r = await fetch(u); if (!r.ok) return { err: 'HTTP ' + r.status };
          const blob = await r.blob(); if (blob.type !== 'image/png') return { err: 'không phải image/png (' + blob.type + ')' };
          const bm = await createImageBitmap(blob); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height;
          const g = c.getContext('2d'); g.drawImage(bm, 0, 0); const w = bm.width, h = bm.height;
          const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data);
          const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
          const bg = [0xFC, 0xF8, 0xF3]; let outsideBad = 0, outsideN = 0, violet = 0, inner = 0;
          for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 48))) for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 48))) {
            const d = Math.hypot(x - w / 2, y - h / 2) / w; const p = px(x, y);
            if (d > 0.40) { outsideN++; if (p[3] < 250 || Math.abs(p[0] - bg[0]) > 8 || Math.abs(p[1] - bg[1]) > 8 || Math.abs(p[2] - bg[2]) > 8) outsideBad++; }
            else { inner++; if (p[3] > 200 && p[2] > 180 && p[1] < 140 && p[0] < 190) violet++; }
          }
          return { w, h, corners, outsideBad, outsideN, violetPct: violet / Math.max(1, inner) };
        } catch (e) { return { err: String(e) }; }
      }, src);
      for (const sz of [192, 512]) {
        const want_ = `${sz}x${sz}`;
        const ofSize = icons.filter((i) => (i.sizes || '').split(/\s+/).includes(want_) && /png/.test(i.type || ''));
        const mk = ofSize.find((i) => (i.purpose || '').split(/\s+/).includes('maskable') && !(i.purpose || '').split(/\s+/).includes('any'));
        const any = ofSize.find((i) => !i.purpose || (i.purpose || '').split(/\s+/).includes('any'));
        check(`manifest có icon PNG ${want_} purpose "maskable" (riêng) và một icon PNG ${want_} purpose "any"`, !!mk && !!any, `thấy ${ofSize.map((i) => i.src + ':' + (i.purpose || 'any')).join(', ') || 'không icon PNG ' + want_}`);
        for (const [label, ic] of [['maskable', mk], ['any', any]]) {
          if (!ic) continue;
          const r = await info(new URL(ic.src, base).href);
          check(`icon ${label} ${want_} (${ic.src}) tải được, là PNG đúng ${sz}x${sz}`, !r.err && r.w === sz && r.h === sz, r.err || `${r.w}x${r.h}`);
          if (r.err) continue;
          check(`icon ${label} ${want_} có hình logo tím (violet) ở giữa`, r.violetPct > 0.03, `tỉ lệ điểm tím ở vùng giữa ${(r.violetPct * 100).toFixed(1)}%`);
          if (label === 'maskable') {
            check(`icon maskable ${want_}: tràn nền #FCF8F3 đặc đến sát cạnh, logo nằm trong vòng an toàn (bán kính 40%)`,
              r.corners.every((p) => p[3] === 255) && r.outsideBad === 0, `${r.outsideBad}/${r.outsideN} điểm ngoài vòng an toàn không phải nền; góc ${JSON.stringify(r.corners[0])}`);
          }
        }
      }
      const touch = await page.evaluate(() => { const l = document.querySelector('link[rel="apple-touch-icon"]'); return l ? { href: l.href, sizes: l.getAttribute('sizes') } : null; });
      check('có <link rel="apple-touch-icon" sizes="180x180">', !!touch && touch.sizes === '180x180', JSON.stringify(touch));
      if (touch) {
        const r = await info(touch.href);
        check('apple-touch-icon là PNG đúng 180x180, đặc (không trong suốt), có logo tím', !r.err && r.w === 180 && r.h === 180 && r.corners.every((p) => p[3] === 255) && r.violetPct > 0.03, r.err || `${r.w}x${r.h} góc alpha ${r.corners.map((p) => p[3]).join('/')} tím ${(r.violetPct * 100).toFixed(1)}%`);
      }
      // logo gốc không bị đổi
      let same = false, why = '';
      try {
        const orig = execSync(`git show ${BASE}:public/favicon.svg`, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 24 }).toString();
        const now = fs.readFileSync(path.join(DIST, 'favicon.svg'), 'utf8'); same = orig === now; why = same ? '' : 'favicon.svg khác bản ở ' + BASE;
      } catch (e) { why = `không đọc được ${BASE}:public/favicon.svg`; }
      check('favicon.svg (logo gốc) giữ nguyên, không có hình mới thay thế', same, why);
      // đủ điều kiện cài
      const cdp = await ctx.newCDPSession(page);
      let errs = null;
      try { await cdp.send('Page.enable'); const r = await cdp.send('Page.getInstallabilityErrors'); errs = r.installabilityErrors || []; } catch (e) { errs = [{ errorId: 'cdp-lỗi: ' + e.message }]; }
      check('Chrome báo đủ điều kiện cài (Page.getInstallabilityErrors rỗng)', errs.length === 0, errs.map((e) => e.errorId).join(', '));
      let mErr = null;
      try { const r = await cdp.send('Page.getAppManifest'); mErr = (r.errors || []).filter((e) => e.critical); } catch (e) { mErr = [{ message: e.message }]; }
      check('manifest không có lỗi nghiêm trọng khi Chrome phân tích', mErr.length === 0, mErr.map((e) => e.message).join(' | '));
      await ctx.close();
    });
  }

  /* ---------- 6) Gợi ý cài app ---------- */
  if (want(6)) { CRIT = 6;
    const FIRE = `window.__prompted = 0; window.__fireInstall = (outcome) => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => { window.__prompted++; return Promise.resolve(); }; e.userChoice = Promise.resolve({ outcome: outcome || 'accepted', platform: 'web' }); window.dispatchEvent(e); window.__lastInstallEvent = e; return e; };`;
    const banner = (page) => page.getByRole('region', { name: 'Thêm Tơ Hồng vào màn hình chính' });
    const bannerOn = async (page, ms = 2000) => { const t0 = Date.now(); for (;;) { const ok = await banner(page).isVisible().catch(() => false); if (ok || Date.now() - t0 > ms) return ok; await page.waitForTimeout(100); } };
    const installEvents = (page) => page.__net.posthog.filter((p) => /^install_/.test(p.event || ''));
    // Sự kiện install_* chỉ được thêm đúng platform (android|ios|other) và outcome (accepted|dismissed) so với thuộc tính chung mọi sự kiện đã có (so với app_loaded).
    const analyticsOk = (page) => {
      const base = page.__net.posthog.find((p) => p.event === 'app_loaded'); const baseKeys = new Set(Object.keys((base && base.properties) || {}));
      const bad = [];
      for (const p of installEvents(page)) for (const [k, v] of Object.entries(p.properties || {})) {
        if (baseKeys.has(k)) continue;
        if (k === 'platform' && ['android', 'ios', 'other'].includes(v)) continue;
        if (k === 'outcome' && ['accepted', 'dismissed'].includes(v)) continue;
        bad.push(`${p.event}.${k}=${JSON.stringify(v)}`);
      }
      return { ok: !!base && bad.length === 0, why: !base ? 'không thấy sự kiện app_loaded để so' : bad.join(', ') };
    };

    // 6a. Android (Chromium): sự kiện beforeinstallprompt -> lời mời cài
    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W, { ua: ANDROID_UA, mobile: true, init: FIRE }); page = await openPage(ctx);
      check('Android, chưa có beforeinstallprompt: không hiện gợi ý', !(await bannerOn(page, 1200)));
      const prevented = await page.evaluate(() => window.__fireInstall('accepted').defaultPrevented);
      check('Android, có beforeinstallprompt: hiện gợi ý "Thêm Tơ Hồng vào màn hình chính"', await bannerOn(page));
      check('đã chặn thanh gợi ý mặc định của Chrome (preventDefault)', prevented === true);
      check('Android: có nút "Cài ứng dụng", không có hướng dẫn Chia sẻ', (await banner(page).getByRole('button', { name: 'Cài ứng dụng' }).count()) === 1 && !(await banner(page).innerText()).includes('Chia sẻ'));
      const geo = await page.evaluate(() => {
        const b = [...document.querySelectorAll('[role=region]')].find((e) => (e.getAttribute('aria-label') || '').startsWith('Thêm Tơ Hồng')); if (!b) return null;
        const r = b.getBoundingClientRect(); const f = document.querySelector('.app-frame').getBoundingClientRect();
        const tab = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Trang chủ').getBoundingClientRect();
        const pos = getComputedStyle(b).position;
        return { l: r.left - f.left, r: f.right - r.right, bottom: r.bottom, tabTop: tab.top, pos, sw: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      check('gợi ý nằm trong khung, nằm trong luồng bố cục (không fixed/absolute), không đè thanh tab, không cuộn ngang', !!geo && geo.l >= -1 && geo.r >= -1 && !['fixed', 'absolute'].includes(geo.pos) && geo.bottom <= geo.tabTop + 1 && geo.sw <= 0, JSON.stringify(geo));
      await shot(page, 'install-android', W);
      await banner(page).getByRole('button', { name: 'Cài ứng dụng' }).click();
      await page.waitForTimeout(500);
      check('bấm "Cài ứng dụng": gọi hộp thoại cài của trình duyệt đúng 1 lần', (await page.evaluate(() => window.__prompted)) === 1);
      check('cài xong (accepted): gợi ý biến mất, không ghi "tắt mãi"', !(await banner(page).isVisible()) && (await page.evaluate(() => localStorage.getItem('th_install_hint_off'))) === null);
      { const an = analyticsOk(page); check('analytics gợi ý cài: có sự kiện install_* và chỉ thêm platform/outcome', installEvents(page).length >= 2 && an.ok, an.ok ? installEvents(page).map((p) => p.event).join(',') : an.why); }
      await ctx.close();
    });

    // 6b. Android: tắt, nhớ lựa chọn sau tải lại; không gửi gì lên backend
    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W, { ua: ANDROID_UA, mobile: true, init: FIRE }); page = await openPage(ctx);
      await page.evaluate(() => window.__fireInstall('accepted')); await bannerOn(page);
      await banner(page).getByRole('button', { name: 'Không nhắc lại' }).click();
      await page.waitForTimeout(400);
      check('bấm "Không nhắc lại": gợi ý biến mất', !(await banner(page).isVisible()));
      check('lựa chọn lưu ở localStorage (khóa th_install_hint_off = "1")', (await page.evaluate(() => localStorage.getItem('th_install_hint_off'))) === '1');
      check('lựa chọn không gửi lên backend (không request nào chứa "install")', !page.__net.api.some((r) => /install/i.test(r.url + r.body)));
      { const an = analyticsOk(page); check('analytics của việc tắt: có install_hint_dismissed, chỉ thêm platform/outcome', installEvents(page).some((p) => p.event === 'install_hint_dismissed') && an.ok, an.ok ? installEvents(page).map((p) => p.event).join(',') : an.why); }
      await page.reload(); await appReady(page); await page.waitForTimeout(600);
      await page.evaluate(() => window.__fireInstall('accepted'));
      check('tải lại + trình duyệt bắn lại beforeinstallprompt: gợi ý KHÔNG hiện lại', !(await bannerOn(page, 1500)));
      await ctx.close();
    });

    // 6c. iOS: hướng dẫn Chia sẻ -> Thêm vào MH chính
    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W, { ua: IOS_UA, mobile: true, init: FIRE }); page = await openPage(ctx);
      const iosOn = await bannerOn(page);
      check('iOS (không có beforeinstallprompt): hiện gợi ý "Thêm Tơ Hồng vào màn hình chính"', iosOn);
      if (iosOn) {
        const txt = await banner(page).innerText();
        check('iOS: hướng dẫn có "Chia sẻ" và "Thêm vào MH chính"; không có nút "Cài ứng dụng"', txt.includes('Chia sẻ') && txt.includes('Thêm vào MH chính') && (await banner(page).getByRole('button', { name: 'Cài ứng dụng' }).count()) === 0, txt.replace(/\s+/g, ' ').slice(0, 140));
        await shot(page, 'install-ios', W);
        await banner(page).getByRole('button', { name: 'Không nhắc lại' }).click(); await page.waitForTimeout(300);
        await page.reload(); await appReady(page); await page.waitForTimeout(600);
        check('iOS: tắt rồi tải lại: không hiện lại', !(await bannerOn(page, 1500)));
      }
      await ctx.close();
    });

    // 6d. Đang chạy standalone: không hiện (Android, iOS, display-mode, navigator.standalone)
    const STAND = { 'Android + display-mode: standalone': { ua: ANDROID_UA, init: FIRE + `const _mm = window.matchMedia.bind(window); window.matchMedia = (q) => /display-mode:\\s*standalone/.test(q) ? { matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } } : _mm(q);` },
      'iOS + navigator.standalone': { ua: IOS_UA, init: FIRE + `Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });` },
      'iOS + display-mode: standalone': { ua: IOS_UA, init: FIRE + `const _mm = window.matchMedia.bind(window); window.matchMedia = (q) => /display-mode:\\s*standalone/.test(q) ? { matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } } : _mm(q);` } };
    for (const [label, o] of Object.entries(STAND)) {
      await scn(async () => {
        let ctx, page;
        ctx = await newCtx(browser, W, { ua: o.ua, mobile: true, init: o.init }); page = await openPage(ctx);
        await page.evaluate(() => window.__fireInstall && window.__fireInstall('accepted'));
        check(`chạy standalone (${label}): không hiện gợi ý`, !(await bannerOn(page, 1500)));
        await ctx.close();
      });
    }

    // 6e. Máy tính (không iOS, không sự kiện): không hiện; Onboarding đang mở: không hiện; appinstalled: ẩn
    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, 1280, { init: FIRE }); page = await openPage(ctx);
      check('trình duyệt thường không có beforeinstallprompt và không phải iOS: không hiện gợi ý', !(await bannerOn(page, 1200)));
      await page.evaluate(() => window.__fireInstall('accepted'));
      check('trình duyệt nào bắn beforeinstallprompt cũng hiện gợi ý (kể cả máy tính)', await bannerOn(page));
      await page.evaluate(() => window.dispatchEvent(new Event('appinstalled'))); await page.waitForTimeout(400);
      check('sự kiện appinstalled: gợi ý ẩn', !(await banner(page).isVisible()));
      await ctx.close();
    });
    await scn(async () => {
      let ctx, page;
      ctx = await newCtx(browser, W, { ua: ANDROID_UA, mobile: true, init: FIRE, profile: false }); page = await openPage(ctx, '', { waitApp: false });
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.__fireInstall('accepted'));
      check('Onboarding đang mở (người mới): chưa hiện gợi ý', !(await bannerOn(page, 1500)));
      // đi hết Onboarding: Bắt đầu -> điền tên -> Tiếp theo (tới khi hết) -> Bỏ qua
      await page.getByRole('button', { name: /^Bắt đầu/ }).click(); await page.waitForTimeout(500);
      for (const inp of await page.locator('input[type=text], input:not([type])').all()) { if (await inp.isVisible()) await inp.fill('An'); }
      for (let i = 0; i < 4; i++) { const nx = page.getByRole('button', { name: /^Tiếp theo/ }); if (!(await nx.count())) break; await nx.first().click(); await page.waitForTimeout(500); }
      await page.getByRole('button', { name: 'Bỏ qua' }).click(); await page.waitForTimeout(1200);
      check('xong Onboarding: gợi ý (sự kiện đã đến từ trước) hiện ra', await bannerOn(page, 3000));
      await ctx.close();
    });
  }

  /* ---------- 7) BotMarkdown vẫn render (phần hành vi; build/lint/bất biến ở check_7_*) ---------- */
  if (want(7)) { CRIT = 7;
    for (const Wd of [390, 1280]) {
      await scn(async () => {
        let ctx, page;
        ctx = await newCtx(browser, Wd); page = await openPage(ctx);
        try {
          await openChat(page);
          const input = page.getByLabel('Nhắn cho Tơ Hồng'); await input.waitFor({ timeout: 4000 });
          await input.fill('Ngân sách thế nào'); await input.press('Enter'); await page.waitForTimeout(1200);
          check(`[${Wd}] bảng markdown trong chat vẫn render (BotMarkdown)`, (await page.locator('.md table').count()) > 0);
        } catch (e) { check(`[${Wd}] mở được chat AI`, false, e.message.split('\n')[0]); }
        await ctx.close();
      });
    }
  }

  /* ---------- ảnh chụp cho PR (tiêu chí 8) ---------- */
  if (SHOTS) {
    for (const Wd of [390, 1280]) {
      const ctx = await newCtx(browser, Wd); const page = await openPage(ctx);
      await shot(page, 'home', Wd);
      await tabBtn(page, 'Ngân sách').click(); await page.waitForTimeout(400); await shot(page, 'budget', Wd);
      await openSubPage(page); await page.waitForTimeout(500); await shot(page, 'budget-subpage', Wd);
      await ctx.close();
    }
    for (const Wd of [1280]) {
      const ctx = await newCtx(browser, Wd, { init: `window.__fireInstall = () => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); };` });
      const page = await openPage(ctx); await page.evaluate(() => window.__fireInstall()); await page.waitForTimeout(600); await shot(page, 'install-hint', Wd); await ctx.close();
    }
  }

  await browser.close(); server.close();
  if (tmpDist) fs.rmSync(tmpDist, { recursive: true, force: true });
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
})().catch((e) => { console.log('FAIL eval không chạy được: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); process.exit(2); });
