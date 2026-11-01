#!/usr/bin/env node
/* Eval đối kháng T-030 (adversary). Phần khung (build, server, giả API, snap, expectState) chép nguyên từ eval/T-027/check_t027.cjs dòng 2-262 (bản chụp 2026-11-01). Kịch bản riêng ở cuối. */
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
  const SEL = arg('--sel') ? arg('--sel').split(',') : null;
  const on = (k) => !SEL || SEL.includes(k);
  const stable = async (page, ms = 1800) => { await page.waitForTimeout(ms); };

  /* A. Back nhanh 5 lần trong ~300ms: phải về đúng 5 bước trước, không kẹt, không lỗi */
  if (on('A')) { CRIT = 'A';
    await scn(async () => {
      const ctx = await newCtx(browser, W); const page = await openPage(ctx);
      await tabBtn(page, 'Ngân sách').click(); await page.waitForTimeout(300);
      await openSubPage(page); await page.waitForTimeout(300);
      await tabBtn(page, 'Khách mời').click(); await page.waitForTimeout(300);
      await tabBtn(page, 'Kế hoạch').click(); await page.waitForTimeout(300);
      await tabBtn(page, 'Ngân sách').click(); await page.waitForTimeout(300);
      await expectState(page, 'A: đi 5 bước tới #/ngan-sach', { hash: '#/ngan-sach', tab: 'Ngân sách' });
      await page.evaluate(() => { for (let i = 0; i < 5; i++) setTimeout(() => history.back(), i * 60); });
      await stable(page);
      await expectState(page, 'A: Back x5 trong 300ms về Trang chủ', { hash: '#/trang-chu', tab: 'Trang chủ', home: true, layers: '-', sub: false });
      await page.goForward();
      await expectState(page, 'A: Forward sau đó lại Ngân sách', { hash: '#/ngan-sach', tab: 'Ngân sách' });
      check('A: không lỗi trang', page.__net.errs.length === 0, page.__net.errs.slice(0, 2).join(' | '));
      await ctx.close();
    });
    // A2. có lớp: Ngân sách -> Ảnh -> sheet vendor -> sheet Kết nối, Back x3 nhanh: đóng 2 lớp rồi rời trang con
    await scn(async () => {
      const ctx = await newCtx(browser, W); const page = await openPage(ctx);
      await tabBtn(page, 'Ngân sách').click(); await page.waitForTimeout(300); await openSubPage(page); await page.waitForTimeout(500);
      await page.locator('[data-testid=connect-btn]').first().waitFor({ state: 'attached' }).catch(() => {});
      await page.getByText('Studio X').first().click(); await page.waitForTimeout(500);
      await expectState(page, 'A2: sheet vendor mở', { layers: 'vendor' });
      await page.locator('[data-testid=connect-btn]').first().click();
      await expectState(page, 'A2: sheet Kết nối mở', { layers: 'connect+vendor' });
      await page.evaluate(() => { for (let i = 0; i < 3; i++) setTimeout(() => history.back(), i * 60); });
      await stable(page);
      await expectState(page, 'A2: Back x3 nhanh: 2 lớp đóng, về #/ngan-sach', { layers: '-', hash: '#/ngan-sach', sub: false });
      await page.goBack();
      await expectState(page, 'A2: Back tiếp về Trang chủ', { hash: '#/trang-chu', tab: 'Trang chủ' });
      await ctx.close();
    });
  }

  /* B. Lớp đang mở, chạm thanh tab (nếu thanh tab còn chạm được) */
  if (on('B')) { CRIT = 'B';
    await scn(async () => {
      const ctx = await newCtx(browser, W); const page = await openPage(ctx);
      await tabBtn(page, 'Kế hoạch').click(); await page.waitForTimeout(400);
      await page.getByRole('button', { name: 'Thêm việc', exact: true }).click();
      await expectState(page, 'B: sheet Thêm việc mở', { layers: 'task', hash: '#/ke-hoach' });
      const len0 = (await snap(page)).len;
      // bấm nút tab Ngân sách thẳng bằng DOM (giả lập trường hợp thanh tab lộ ra dưới sheet)
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Ngân sách').sort((a, c) => c.getBoundingClientRect().top - a.getBoundingClientRect().top)[0]; b.click(); });
      await stable(page, 1200);
      await expectState(page, 'B: đổi tab khi lớp mở: lớp đóng, sang Ngân sách', { layers: '-', hash: '#/ngan-sach', tab: 'Ngân sách' });
      check('B: tổng số bước = trước khi mở lớp + 1', (await snap(page)).len === len0, `len ${(await snap(page)).len}, lúc lớp mở ${len0}`);
      await page.goBack();
      await expectState(page, 'B: Back về Kế hoạch (không bước chết, lớp không mở lại)', { hash: '#/ke-hoach', tab: 'Kế hoạch', layers: '-' });
      await page.goBack();
      await expectState(page, 'B: Back tiếp về Trang chủ', { hash: '#/trang-chu', tab: 'Trang chủ' });
      await ctx.close();
    });
  }

  /* C. Hash kiểu Clerk (routing="hash") khi app đang chạy: không lặp, không đè, Back về lại */
  if (on('C')) { CRIT = 'C';
    await scn(async () => {
      const ctx = await newCtx(browser, W); const page = await openPage(ctx);
      await tabBtn(page, 'Ngân sách').click(); await page.waitForTimeout(400);
      const l0 = (await snap(page)).len;
      await page.evaluate(() => { location.hash = '#/sign-in'; });
      await page.waitForTimeout(300);
      await page.evaluate(() => { location.hash = '#/sign-in/factor-one'; });
      await stable(page, 1500);
      const s = await snap(page);
      check('C: hash Clerk không bị app đè', s.hash === '#/sign-in/factor-one', s.hash);
      check('C: không lặp lịch sử (đúng 2 bước thêm)', s.len === l0 + 2, `len ${s.len}, mong ${l0 + 2}`);
      check('C: vẫn ở tab Ngân sách', s.tab === 'Ngân sách', desc(s));
      await page.goBack(); await page.goBack();
      await expectState(page, 'C: Back x2 về #/ngan-sach', { hash: '#/ngan-sach', tab: 'Ngân sách' });
      await page.goBack();
      await expectState(page, 'C: Back tiếp về Trang chủ', { hash: '#/trang-chu', tab: 'Trang chủ' });
      check('C: không lỗi trang', page.__net.errs.length === 0, page.__net.errs.slice(0, 2).join(' | '));
      await ctx.close();
    });
  }

  /* D. Paywall xếp trễ 0ms: đóng chat ngay khi 402 về */
  if (on('D')) { CRIT = 'D';
    await scn(async () => {
      const ctx = await newCtx(browser, W); const page = await openPage(ctx, '', { chat402: true });
      await tabBtn(page, 'Ngân sách').click(); await page.waitForTimeout(400);
      await openChat(page); await page.waitForTimeout(600);
      const i = page.getByLabel('Nhắn cho Tơ Hồng'); await i.fill('Ngân sách thế nào');
      await page.waitForResponse((r) => r.url().endsWith('/chat') && r.status() === 402, { timeout: 4000 }).catch(() => {});
      await Promise.all([i.press('Enter'), page.evaluate(() => setTimeout(() => history.back(), 0))]);
      await stable(page, 2000);
      const s = await snap(page);
      // chấp nhận: chat đóng hẳn (không lớp) và không có bước chết; hoặc paywall/chat còn mở thì Back phải đóng được hết
      let back = 0;
      while (openLayers(await snap(page)) !== '-' && back < 3) { await page.goBack(); await page.waitForTimeout(700); back++; }
      await expectState(page, `D: sau race, mọi lớp đóng (cần thêm ${back} Back)`, { layers: '-', hash: '#/ngan-sach', tab: 'Ngân sách' });
      await page.goBack();
      await expectState(page, 'D: Back tiếp về Trang chủ (không bước chết)', { hash: '#/trang-chu', tab: 'Trang chủ', layers: '-' });
      check('D: trạng thái ngay sau race', true, desc(s));
      await ctx.close();
    });
    // D2. paywall hiện, rồi bấm nút đóng chat bằng giao diện (không qua paywall): Back sau đó về trang trước
    await scn(async () => {
      const ctx = await newCtx(browser, W); const page = await openPage(ctx, '', { chat402: true });
      await tabBtn(page, 'Ngân sách').click(); await page.waitForTimeout(400);
      await openChat(page); await page.waitForTimeout(600);
      const i = page.getByLabel('Nhắn cho Tơ Hồng'); await i.fill('x'); await i.press('Enter');
      await expectState(page, 'D2: paywall hiện trên chat', { layers: 'chat+paywall' });
      await page.keyboard.press('Escape').catch(() => {});
      const closeBtn = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /đóng/i.test(x.getAttribute('aria-label') || '') && x.closest('[role=dialog]')); if (b) { b.click(); return true; } return false; });
      await stable(page, 1500);
      const s = await snap(page);
      if (closeBtn || openLayers(s) === '-') {
        await expectState(page, 'D2: đóng chat bằng giao diện: hết lớp', { layers: '-', hash: '#/ngan-sach' });
        await page.goBack();
        await expectState(page, 'D2: Back về Trang chủ (không bước chết của paywall)', { hash: '#/trang-chu', tab: 'Trang chủ', layers: '-' });
      } else check('D2: (bỏ qua: không có nút đóng chat)', true, desc(s));
      await ctx.close();
    });
  }

  /* E. Back khi đang Onboarding (người mới): không kẹt, không lỗi, địa chỉ giữ */
  if (on('E')) { CRIT = 'E';
    await scn(async () => {
      const ctx = await newCtx(browser, W, { profile: false }); const page = await openPage(ctx, '#/ngan-sach', { waitApp: false });
      await page.waitForTimeout(2000);
      const s = await snap(page);
      check('E: Onboarding: địa chỉ #/ngan-sach giữ', s.hash === '#/ngan-sach', s.hash);
      check('E: mở app không thêm bước', s.len === page.__h0, `len ${s.len}, h0 ${page.__h0}`);
      await page.evaluate(() => history.back()).catch(() => {});
      check('E: Back ở Onboarding (gốc) rời app', await left(page), page.url());
      check('E: không lỗi trang', page.__net.errs.length === 0, page.__net.errs.slice(0, 2).join(' | '));
      await ctx.close();
    });
  }

  /* F. "Quay lại" trong UI rồi Forward; Forward rồi Back */
  if (on('F')) { CRIT = 'F';
    await scn(async () => {
      const ctx = await newCtx(browser, W); const page = await openPage(ctx);
      await tabBtn(page, 'Ngân sách').click(); await page.waitForTimeout(300); await openSubPage(page);
      await expectState(page, 'F: ở trang con', { hash: '#/ngan-sach/photography', sub: true });
      await page.getByRole('button', { name: 'Quay lại' }).click();
      await expectState(page, 'F: Quay lại về danh sách', { hash: '#/ngan-sach', sub: false });
      await page.goForward();
      await expectState(page, 'F: Forward mở lại trang con Ảnh', { hash: '#/ngan-sach/photography', sub: true });
      await page.getByRole('button', { name: 'Quay lại' }).click();
      await page.getByRole('button', { name: 'Quay lại' }).click({ timeout: 300 }).catch(() => {});   // bấm đúp
      await stable(page, 1200);
      await expectState(page, 'F: bấm đúp Quay lại chỉ lùi một bước', { hash: '#/ngan-sach', sub: false, tab: 'Ngân sách' });
      await page.goBack();
      await expectState(page, 'F: Back tiếp về Trang chủ', { hash: '#/trang-chu', tab: 'Trang chủ' });
      await ctx.close();
    });
  }

  /* G. Chạm ngoài khung đóng sheet (1280): không lệch bước */
  if (on('G')) { CRIT = 'G';
    await scn(async () => {
      const ctx = await newCtx(browser, 1280); const page = await openPage(ctx);
      await tabBtn(page, 'Ngân sách').click(); await page.waitForTimeout(300); await openSubPage(page); await page.waitForTimeout(500);
      await page.getByText('Studio X').first().click();
      await expectState(page, 'G: sheet vendor mở', { layers: 'vendor', sub: true });
      await page.mouse.click(40, 400);
      await expectState(page, 'G: chạm ngoài khung: sheet đóng, vẫn ở trang con', { layers: '-', sub: true, hash: '#/ngan-sach/photography' });
      await page.goBack();
      await expectState(page, 'G: Back về danh sách (không bước chết)', { hash: '#/ngan-sach', sub: false });
      await page.goBack();
      await expectState(page, 'G: Back về Trang chủ', { hash: '#/trang-chu', tab: 'Trang chủ' });
      await ctx.close();
    });
  }

  /* H. Link sâu biến thể: id mã hoá lỗi, id có ký tự mã hoá, id không có rồi Forward */
  if (on('H')) { CRIT = 'H';
    for (const [h, exp] of [['#/ngan-sach/%E0%A4%A', '#/trang-chu'], ['#/ngan-sach/khong%20co', '#/ngan-sach'], ['#/ngan-sach/', '#/trang-chu'], ['#/NGAN-SACH', '#/trang-chu']]) {
      await scn(async () => {
        const ctx = await newCtx(browser, W); const page = await openPage(ctx, h);
        await stable(page, 800);
        const s = await snap(page);
        check(`H: ${h} → ${exp}`, s.hash === exp, desc(s));
        check(`H: ${h} không thêm bước`, s.len === page.__h0, `len ${s.len}, h0 ${page.__h0}`);
        check(`H: ${h} không lỗi trang`, page.__net.errs.length === 0, page.__net.errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
    }
  }

  /* I. Gợi ý cài ở 390px: không đè thanh tab, không chồng sheet; sự kiện install_* không có dữ liệu cá nhân */
  if (on('I')) { CRIT = 'I';
    await scn(async () => {
      const ctx = await newCtx(browser, W, { mobile: true, ua: ANDROID_UA, H: Number(arg("--h") || 640), init: `window.__fireInstall = () => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); };` });
      const page = await openPage(ctx); if (!arg('--nohint')) await page.evaluate(() => window.__fireInstall()); await page.waitForTimeout(600);
      const geo = await page.evaluate(() => {
        const r = (el) => el && el.getBoundingClientRect();
        const hint = r(document.querySelector('[role=region][aria-label="Thêm Tơ Hồng vào màn hình chính"]'));
        const tab = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Ngân sách').map(r).sort((a, b) => b.top - a.top)[0];
        return { hint: hint && { top: hint.top, bottom: hint.bottom }, tabTop: tab && tab.top, sw: document.documentElement.scrollWidth, iw: innerWidth };
      });
      check('I: gợi ý hiện', !!geo.hint, JSON.stringify(geo));
      check('I: gợi ý nằm trên thanh tab, không đè', geo.hint && geo.hint.bottom <= geo.tabTop + 1, JSON.stringify(geo));
      check('I: không cuộn ngang', geo.sw <= geo.iw, JSON.stringify(geo));
      // mở sheet Thêm việc: sheet phải nằm trên gợi ý (gợi ý không chồng lên sheet)
      await tabBtn(page, 'Kế hoạch').click(); await page.waitForTimeout(400);
      await page.getByRole('button', { name: 'Thêm việc', exact: true }).click(); await page.waitForTimeout(600);
      if (arg('--probe')) await page.screenshot({ path: arg('--probe') });
      const sheetGeo = async () => page.evaluate(() => {
        const lab = [...document.querySelectorAll('label')].find((e) => e.textContent.trim() === 'Tên việc');
        const btns = [...document.querySelectorAll('button')];
        const add = btns.find((b) => b.textContent.trim() === 'Thêm vào kế hoạch');
        const title = [...document.querySelectorAll('div')].find((e) => e.children.length === 0 && e.textContent.trim() === 'Thêm việc');
        const close = title && title.parentElement.querySelector('button');
        const r = (e) => e && e.getBoundingClientRect();
        let sc = null; for (let e = lab; e; e = e.parentElement) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight) { sc = e; break; } }
        return { close: r(close) && { top: r(close).top, bottom: r(close).bottom }, add: r(add) && { top: r(add).top, bottom: r(add).bottom }, scrollable: !!sc, ih: innerHeight };
      });
      const g1 = await sheetGeo();
      const reach = (g) => g.close && g.add && ((g.close.top >= 0 && g.add.bottom <= g.ih) || g.scrollable);
      check('I: có gợi ý, sheet Thêm việc vẫn thấy được nút đóng và nút Thêm (hoặc cuộn được)', reach(g1), JSON.stringify(g1));
      await page.goBack(); await page.waitForTimeout(500);
      await clickShown(page, /^Cài ứng dụng$/); await page.waitForTimeout(600);
      const evs = page.__net.posthog.flatMap((b) => (b.batch || [b])).filter((e) => String(e.event || '').startsWith('install_'));
      const common = new Set(Object.keys((page.__net.posthog.flatMap((b) => (b.batch || [b])).find((e) => !String(e.event || '').startsWith('install_') && !String(e.event || '').startsWith('$')) || {}).properties || {}));
      const bad = evs.filter((e) => Object.entries(e.properties || {}).some(([k, v]) => !common.has(k) && !['platform', 'outcome'].includes(k)) || JSON.stringify(e.properties || {}).match(/@|Hà Nội|0\d{9}/));
      check('I: có sự kiện install_*', evs.length >= 2, evs.map((e) => e.event).join(','));
      check('I: install_* chỉ thêm platform/outcome ngoài thuộc tính chung, không email/tên/sđt', bad.length === 0, JSON.stringify(bad.map((e) => e.properties)).slice(0, 200));
      await ctx.close();
    });
  }

  await browser.close(); server.close();
  if (tmpDist) fs.rmSync(tmpDist, { recursive: true, force: true });
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
})().catch((e) => { console.log('FAIL eval không chạy được: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); process.exit(2); });
