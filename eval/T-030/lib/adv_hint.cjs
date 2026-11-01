#!/usr/bin/env node
/* Eval đối kháng T-030 v2 (adversary, ADR-011). Phần khung (build, server, giả API, snap, expectState) chép nguyên từ eval/T-027/check_t027.cjs dòng 2-262 (bản chụp 2026-11-01). Kịch bản riêng ở cuối. */
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
  const H = Number(arg('--h') || 640);
  const FIRE = `window.__fireInstall = () => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); };`;
  const hintOn = (page) => page.evaluate(() => !!document.querySelector('[role=region][aria-label="Thêm Tơ Hồng vào màn hình chính"]'));
  const waitHint = async (page, want, ms = 1500) => { const t0 = Date.now(); for (;;) { const v = await hintOn(page); if (v === want || Date.now() - t0 > ms) return v; await page.waitForTimeout(100); } };
  const shownCount = (page) => page.__net.posthog.flatMap((b) => (b.batch || [b])).filter((e) => e.event === 'install_hint_shown').length;
  // nút đóng và nút chính của lớp nằm trong viewport
  const inView = (page, texts) => page.evaluate((ts) => ts.map((t) => { const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || x.textContent.trim()) === t && x.getBoundingClientRect().width > 0); if (!b) return `${t}:không có`; const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight ? '' : `${t}:top ${r.top}`; }).filter(Boolean), texts);
  const mk = async () => { const ctx = await newCtx(browser, W, { mobile: true, ua: ANDROID_UA, H, init: FIRE }); const page = await openPage(ctx); await page.evaluate(() => window.__fireInstall()); await waitHint(page, true); return { ctx, page }; };

  /* J. Mỗi lớp: mở thì gợi ý ẩn; đóng bằng Back và bằng giao diện thì hiện lại */
  if (on('J')) { CRIT = 'J';
    const LAYERS = [
      { name: 'ngăn kéo', setup: null, open: (p) => openDrawer(p), ui: (p) => clickShown(p, /^Đóng menu$/) },
      { name: 'chat AI', setup: null, open: (p) => openChat(p), ui: null },
      { name: 'màn Mời', setup: null, open: (p) => openInvite(p), ui: (p) => clickShown(p, /^Thôi$/) },
      { name: 'sửa ngày cưới', setup: null, open: (p) => clickShown(p, /^Chỉnh sửa ngày cưới$/), ui: (p) => clickShown(p, /^Huỷ$/) },
      { name: 'sheet Thêm việc', setup: async (p) => { await tabBtn(p, 'Kế hoạch').click(); await p.waitForTimeout(400); }, open: (p) => p.getByRole('button', { name: 'Thêm việc', exact: true }).click(),
        ui: (p) => p.evaluate(() => { const t = [...document.querySelectorAll('div')].find((e) => e.children.length === 0 && e.textContent.trim() === 'Thêm việc'); t.parentElement.querySelector('button').click(); }) },
      { name: 'sheet vendor', setup: async (p) => { await tabBtn(p, 'Ngân sách').click(); await p.waitForTimeout(300); await openSubPage(p); await p.waitForTimeout(500); }, open: (p) => p.getByText('Studio X').first().click(), ui: null },
    ];
    for (const L of LAYERS) {
      await scn(async () => {
        const { ctx, page } = await mk();
        if (L.setup) await L.setup(page);
        check(`J ${L.name}: trước khi mở, gợi ý hiện`, await waitHint(page, true));
        await L.open(page); await page.waitForTimeout(500);
        check(`J ${L.name}: lớp mở → gợi ý ẩn`, (await waitHint(page, false)) === false);
        await page.goBack();
        check(`J ${L.name}: Back đóng lớp → gợi ý hiện lại`, await waitHint(page, true, 2000));
        if (L.ui) {
          await page.waitForTimeout(500);
          await L.open(page); await page.waitForTimeout(600);
          check(`J ${L.name}: mở lại → ẩn`, (await waitHint(page, false)) === false);
          await L.ui(page);
          check(`J ${L.name}: đóng bằng giao diện → gợi ý hiện lại`, await waitHint(page, true, 2500));
        }
        check(`J ${L.name}: install_hint_shown đúng 1 lần dù ẩn/hiện nhiều lần`, shownCount(page) === 1, `số lần ${shownCount(page)}`);
        check(`J ${L.name}: không lỗi trang`, page.__net.errs.length === 0, page.__net.errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
    }
  }

  /* K. Hai lớp chồng, Back nhanh; paywall trễ; chọn đích từ ngăn kéo: gợi ý về đúng trạng thái */
  if (on('K')) { CRIT = 'K';
    await scn(async () => {
      const { ctx, page } = await mk();
      await tabBtn(page, 'Ngân sách').click(); await page.waitForTimeout(300); await openSubPage(page); await page.waitForTimeout(500);
      await page.getByText('Studio X').first().click(); await page.waitForTimeout(500);
      await page.locator('[data-testid=connect-btn]').first().click(); await page.waitForTimeout(500);
      check('K: 2 lớp → ẩn', (await waitHint(page, false)) === false);
      await page.goBack(); await page.waitForTimeout(400);
      check('K: còn 1 lớp → vẫn ẩn', (await waitHint(page, false, 600)) === false);
      await page.evaluate(() => { for (let i = 0; i < 3; i++) setTimeout(() => history.back(), i * 50); });
      await page.waitForTimeout(1800);
      check('K: Back nhanh hết lớp → gợi ý hiện', await waitHint(page, true, 2000));
      await ctx.close();
    });
    await scn(async () => {
      const { ctx, page } = await mk();
      await openDrawer(page); await page.waitForTimeout(500);
      await page.locator('aside').getByRole('button', { name: 'Ngân sách', exact: true }).click();
      await page.waitForTimeout(1200);
      check('K: chọn tab từ ngăn kéo → gợi ý hiện lại', await waitHint(page, true, 2000));
      await ctx.close();
    });
    await scn(async () => {
      const ctx = await newCtx(browser, W, { mobile: true, ua: ANDROID_UA, H, init: FIRE }); const page = await openPage(ctx, '', { chat402: true });
      await page.evaluate(() => window.__fireInstall()); await waitHint(page, true);
      await openChat(page); await page.waitForTimeout(600);
      const i = page.getByLabel('Nhắn cho Tơ Hồng'); await i.fill('x');
      await Promise.all([i.press('Enter'), page.evaluate(() => setTimeout(() => history.back(), 0))]);
      await page.waitForTimeout(2000);
      let n = 0; while (openLayers(await snap(page)) !== '-' && n < 3) { await page.goBack(); await page.waitForTimeout(700); n++; }
      check(`K: race paywall + đóng chat → hết lớp, gợi ý hiện (thêm ${n} Back)`, await waitHint(page, true, 2000), desc(await snap(page)));
      await ctx.close();
    });
  }

  /* L. "Không nhắc lại" rồi mở/đóng lớp, tải lại: không hiện lại */
  if (on('L')) { CRIT = 'L';
    await scn(async () => {
      const { ctx, page } = await mk();
      await clickShown(page, /^Không nhắc lại$/);
      check('L: bấm Không nhắc lại → ẩn', (await waitHint(page, false)) === false);
      await openDrawer(page); await page.waitForTimeout(500); await page.goBack(); await page.waitForTimeout(800);
      check('L: mở/đóng lớp sau khi tắt → không hiện lại', (await waitHint(page, false, 800)) === false);
      await page.reload(); await appReady(page); await page.evaluate(() => window.__fireInstall()); await page.waitForTimeout(800);
      check('L: tải lại + sự kiện mới → không hiện', !(await hintOn(page)));
      await ctx.close();
    });
    // tắt khi lớp đang mở không bấm được (gợi ý đã ẩn): xác nhận không có nút "Không nhắc lại" nào bấm được dưới lớp
    await scn(async () => {
      const { ctx, page } = await mk();
      await tabBtn(page, 'Kế hoạch').click(); await page.waitForTimeout(400);
      await page.getByRole('button', { name: 'Thêm việc', exact: true }).click(); await page.waitForTimeout(500);
      const n = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Không nhắc lại').length);
      check('L: lớp mở → không còn nút "Không nhắc lại" trong DOM', n === 0, `còn ${n}`);
      await ctx.close();
    });
  }

  /* M. Màn thấp: có gợi ý (đã cài điều kiện), mở lớp → nút đóng + nút chính trong viewport (ADR-011: 390x640) */
  if (on('M')) { CRIT = 'M';
    await scn(async () => {
      const { ctx, page } = await mk();
      await tabBtn(page, 'Kế hoạch').click(); await page.waitForTimeout(400);
      await page.getByRole('button', { name: 'Thêm việc', exact: true }).click(); await page.waitForTimeout(600);
      const bad = await page.evaluate(() => { const t = [...document.querySelectorAll('div')].find((e) => e.children.length === 0 && e.textContent.trim() === 'Thêm việc'); const c = t.parentElement.querySelector('button').getBoundingClientRect(); const a = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Thêm vào kế hoạch').getBoundingClientRect(); return { close: c.top, add: a.bottom, ih: innerHeight }; });
      check(`M: ${W}x${H} sheet Thêm việc: nút đóng và nút Thêm trong màn`, bad.close >= 0 && bad.add <= bad.ih, JSON.stringify(bad));
      await page.goBack(); await page.waitForTimeout(500);
      await openChat(page); await page.waitForTimeout(600);
      const inp = await page.evaluate(() => { const e = document.querySelector('[aria-label="Nhắn cho Tơ Hồng"]'); const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, ih: innerHeight }; });
      check(`M: ${W}x${H} chat: ô nhắn trong màn`, inp.top >= 0 && inp.bottom <= inp.ih, JSON.stringify(inp));
      await ctx.close();
    });
  }

  await browser.close(); server.close();
  if (tmpDist) fs.rmSync(tmpDist, { recursive: true, force: true });
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
})().catch((e) => { console.log('FAIL eval không chạy được: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); process.exit(2); });
