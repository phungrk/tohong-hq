#!/usr/bin/env node
/*
 * Eval tầng 1 cho T-025 (app responsive width, tối đa 768px). Phủ tiêu chí 1, 2, 3, 4 và phần hành vi của 5.
 *
 * Chạy:   node eval/T-025/check_width.cjs --repo /đường/dẫn/tohong-front [--shots DIR] [--dist DIR]
 *   --repo   repo tohong-front (bắt buộc). Script tự `vite build` ra thư mục tạm (không ghi vào repo), rồi tự phục vụ bản build.
 *   --dist   dùng sẵn một thư mục build, bỏ qua bước build.
 *   --only   1,2,3,4,5 chỉ chạy và tính các tiêu chí đó (1 khung, 2 sheet/thanh cố định, 3 cuộn ngang, 4 viền/bóng, 5 BotMarkdown render).
 *   --shots  ghi ảnh chụp từng màn vào DIR (để người xem; tiêu chí 6 do check_6_shots.py kiểm).
 * In dòng cuối `PASS` hoặc `FAIL <lý do đầu tiên> (+n lỗi nữa)`; mã thoát 0 / 1 (2 = eval không chạy được).
 *
 * Không cần backend: mọi request tới localhost:8787 được giả, mọi request ra ngoài (Clerk, font, analytics) bị chặn.
 * Màn eval tới được (dữ liệu giả, vai owner, hồ sơ đủ): Trang chủ + thanh tab, màn Mời (InviteSheet), Ngân sách -> sheet vendor
 * -> sheet Kết nối (ConnectSheet), chat AI (AIChatModal, kèm kiểm BotMarkdown render bảng), ngăn kéo (Drawer).
 * Không tới được (ghi ở checklist.md): Paywall, sheet Timeline, VendorFlowSheet, Onboarding, đăng nhập Clerk, thông báo SaveFlash.
 *
 * Eval chỉ đo hành vi nhìn thấy (hình học phần tử trên màn, pixel); không đọc mã nguồn.
 * Định nghĩa dùng chung với spec products/T-025-responsive-width.md:
 *   khung  = phần tử `.app-frame` (tên lớp đã có sẵn, giữ nguyên); biến = `--app-max` trên :root.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const { execSync } = require('child_process');
const { createRequire } = require('module');

const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REPO = arg('--repo');
if (!REPO || !fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo trỏ tới tohong-front'); process.exit(2); }
const SHOTS = arg('--shots');
const ONLY = arg('--only') ? arg('--only').split(',').map(Number) : null;   // 1,2,3,4,5: chỉ tính tiêu chí đó (mặc định: tất cả)
const want = (...cs) => !ONLY || cs.some((c) => ONLY.includes(c));
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean);
  for (const t of tries) { try { return createRequire(path.join(REPO, 'x.js'))(t); } catch { /* thử tiếp */ } }
  try { return require('/opt/node-tools/node_modules/playwright'); } catch { /* hết */ }
  console.log('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)'); process.exit(2);
}

const fails = [];
const critOf = (n) => (/mở được chat AI|bảng markdown/.test(n) ? 5 : /không cuộn ngang/.test(n) ? 3 : /viền|bóng/.test(n) ? 4
  : /thanh tab|phần tử cố định|hiện ra|mở được/.test(n) ? 2 : 1);
const check = (name, ok, extra) => {
  if (ONLY && !ONLY.includes(critOf(name))) return;
  console.log(`${ok ? '  ok ' : '  XX '} ${name}${extra ? '  :: ' + extra : ''}`);
  if (!ok) fails.push(`${name}${extra ? ' [' + extra + ']' : ''}`);
};

/* ---------- build + server ---------- */
let DIST = arg('--dist');
let tmpDist = null;
if (!DIST) {
  tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), 't025-dist-'));
  try {
    execSync(`npx vite build --outDir ${JSON.stringify(tmpDist)} --emptyOutDir`, {
      cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: '', VITE_API_BASE: 'http://localhost:8787' },
    });
  } catch (e) { console.log('FAIL build lỗi: ' + String(e.stderr || e.message).split('\n').filter(Boolean).slice(-2).join(' | ')); process.exit(1); }
  DIST = tmpDist;
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

/* ---------- dữ liệu giả ---------- */
const summary = () => ({ profile: { wedding_date: '2027-03-14', city: 'Hà Nội', bride_name: 'A', groom_name: 'B' }, days_left: 135, total_days: 365, done_days: 230,
  budget: { total_tr: 300, spent_tr: 0, over: false }, timeline: { done: 0, total: 0 }, vendors: { confirmed: 0, shortlisted: 0, empty: 0 }, guests: { yes: 0, pending: 0, no: 0, total: 0, capacity: 200 } });
const sse = (ev, data) => `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`;
async function mockApi(route) {
  const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const m = req.method();
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
  if (p.endsWith('/chat') && m === 'POST') {
    return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', ...cors },
      body: sse('conversation', { id: 'conv1' }) + sse('chunk', { text: 'Bảng ngân sách:\n\n| Hạng mục | Tiền |\n|---|---|\n| Tiệc | 150tr |\n' }) + sse('done', {}) });
  }
  if (p.endsWith('/subscription')) return json({ status: 'trial', trial: { total: 6, remaining: 6 } });
  if (p.endsWith('/connect-requests')) return json({ requests: [] });
  if (p.endsWith('/timeline') || p.endsWith('/guests')) return json({ phases: [], guests: [], summary: {} });
  return json({});
}

/* ---------- đo trên trang ---------- */
const measureFrame = () => {
  const f = document.querySelector('.app-frame');
  if (!f) return null;
  const r = f.getBoundingClientRect(); const cs = getComputedStyle(f);
  const de = document.documentElement;
  return {
    left: r.left, right: r.right, width: r.width, vw: de.clientWidth,
    bl: parseFloat(cs.borderLeftWidth) || 0, br: parseFloat(cs.borderRightWidth) || 0,
    bls: cs.borderLeftStyle, shadow: cs.boxShadow,
    appMax: getComputedStyle(de).getPropertyValue('--app-max').trim(),
    sw: de.scrollWidth, bsw: document.body.scrollWidth, fsw: f.scrollWidth,
  };
};
const collectOverlays = () => {
  const frame = document.querySelector('.app-frame'); const fr = frame.getBoundingClientRect();
  const vw = document.documentElement.clientWidth; const vh = innerHeight; const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el); const z = parseInt(cs.zIndex, 10);
    const isOverlay = cs.position === 'fixed' || (cs.position === 'absolute' && z >= 50) || el.getAttribute('role') === 'dialog';
    if (!isOverlay || cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.right <= 0 || r.left >= vw || r.bottom <= 0 || r.top >= vh) continue;           // ngoài màn hình: không thấy
    if (frame.contains(el) && (r.right <= fr.left + 4 || r.left >= fr.right - 4)) continue;  // nằm trong khung và bị khung cắt gần hết (vd ngăn kéo đóng)
    const name = el.getAttribute('aria-label') || el.getAttribute('role') || (typeof el.className === 'string' && el.className.split(' ')[0]) || el.tagName.toLowerCase();
    out.push({ role: el.getAttribute('role') || '', name: `${el.tagName.toLowerCase()}[${name}] z${isNaN(z) ? 'auto' : z}`, left: r.left, right: r.right, width: r.width });
  }
  return { fl: fr.left, fr: fr.right, fw: fr.width, items: out };
};
const tabBarBox = () => {
  const names = ['Trang chủ', 'Kế hoạch', 'Ngân sách', 'Khách mời'];
  const bs = names.map((n) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === n));
  if (bs.some((b) => !b)) return null;
  const rs = bs.map((b) => b.getBoundingClientRect());
  const f = document.querySelector('.app-frame').getBoundingClientRect();
  return { l: Math.min(...rs.map((r) => r.left)), r: Math.max(...rs.map((r) => r.right)), fl: f.left, fr: f.right, bottom: Math.max(...rs.map((r) => r.bottom)), vh: innerHeight };
};

/* pixel 1x1 từ ảnh chụp: giải PNG tối thiểu */
async function lum(page, x, y) {
  const buf = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  const colorType = buf[25]; const bpp = colorType === 6 ? 4 : 3;
  let off = 8; const idat = [];
  while (off < buf.length) { const len = buf.readUInt32BE(off); const type = buf.toString('ascii', off + 4, off + 8); if (type === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len)); off += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)); const px = raw.subarray(1, 1 + bpp);
  return 0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2];
}

const near = (a, b, t = 2) => Math.abs(a - b) <= t;
const expectedWidth = (vw, max) => Math.min(vw, max);

async function checkFrame(page, W, max, tag) {
  const m = await page.evaluate(measureFrame);
  if (!m) { check(`${tag} có khung .app-frame`, false); return null; }
  const ew = expectedWidth(m.vw, max);
  check(`${tag} khung rộng ${ew}px (đo ${m.width.toFixed(1)})`, near(m.width, ew, 0.6));
  check(`${tag} khung căn giữa (lề trái ${m.left.toFixed(1)}, lề phải ${(m.vw - m.right).toFixed(1)})`, near(m.left, (m.vw - ew) / 2, 1) && near(m.vw - m.right, (m.vw - ew) / 2, 1));
  check(`${tag} không cuộn ngang`, m.sw <= m.vw && m.bsw <= m.vw && m.fsw <= m.width + 0.5, `scrollWidth html=${m.sw} body=${m.bsw} khung=${m.fsw} vw=${m.vw}`);
  const wide = m.vw > max;
  if (wide) {
    const y = 500; const near1 = await lum(page, Math.max(0, m.left - 1), y); const far = await lum(page, Math.max(0, m.left - Math.min(40, m.left - 2)), y);
    const hasEdge = (m.bl > 0 && m.br > 0 && m.bls !== 'none') || m.shadow !== 'none';
    const visible = Math.abs(near1 - far) >= 2 || (m.bl > 0 && m.br > 0);
    check(`${tag} viewport ${m.vw} > khung ${max}: thấy viền/bóng quanh khung`, hasEdge && visible, `border ${m.bl}/${m.br}, shadow ${m.shadow === 'none' ? 'none' : 'có'}, độ sáng sát khung ${near1.toFixed(1)} vs xa ${far.toFixed(1)}`);
  } else {
    check(`${tag} viewport ${m.vw} <= khung ${max}: không viền`, m.bl === 0 && m.br === 0, `border ${m.bl}/${m.br}`);
  }
  return m;
}

async function checkOverlays(page, tag) {
  const o = await page.evaluate(collectOverlays);
  if (o.items.length === 0) return o;
  const bad = [];
  for (const it of o.items) {
    if (it.left < o.fl - 2 || it.right > o.fr + 2) bad.push(`${it.name} tràn ngoài khung [${it.left.toFixed(0)}..${it.right.toFixed(0)}] khung [${o.fl.toFixed(0)}..${o.fr.toFixed(0)}]`);
    else if (it.width >= 300 && !near(it.width, o.fw, 2)) bad.push(`${it.name} rộng ${it.width.toFixed(0)} khác khung ${o.fw.toFixed(0)}`);
  }
  check(`${tag} ${o.items.length} phần tử cố định/phủ nằm trong khung và vừa bề ngang khung`, bad.length === 0, bad.join('; '));
  return o;
}

async function shot(page, state, W) {
  if (SHOTS && [390, 768, 1024, 1280].includes(W)) await page.screenshot({ path: path.join(SHOTS, `${state}-${W}.png`) });
}

async function freshPage(ctx) {
  const page = await ctx.newPage();
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(BASE_URL)) return route.continue();
    if (u.startsWith('http://localhost:8787/')) return mockApi(route);
    if (u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    return route.abort();                       // Clerk, font, analytics: chặn
  });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE_URL);
  await page.getByRole('button', { name: 'Ngân sách', exact: true }).first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(700);
  page.__errs = errs;
  return page;
}

let BASE_URL = '';
async function newCtx(browser, W, H = 844) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('th_user', '{"n":1}');
      localStorage.setItem('th_vendors_cpl_test1', JSON.stringify({ photography: { shortlisted: [{ id: 'pv1', name: 'Studio X', priceTotal: 25, priceMax: null, priceSource: 'verified', spec: 'Ảnh', gallery: [], grad: '#ccc', reviews: [], includes: [], reasons: [] }], confirmed: null } }));
    } catch { /* bỏ qua */ }
  });
  return ctx;
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  BASE_URL = `http://127.0.0.1:${server.address().port}/`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const APP_MAX = 768;

  /* 1) Biến CSS duy nhất giữ 768 */
  if (want(1)) {
    const ctx = await newCtx(browser, 1280); const page = await freshPage(ctx);
    const m = await page.evaluate(measureFrame);
    check('[biến] --app-max trên :root bằng 768px', m.appMax === '768px', `đọc được "${m.appMax}"`);
    await ctx.close();
  }

  /* 2) Từng viewport: khung, cuộn ngang, viền/bóng, thanh tab */
  if (want(1, 2, 3, 4)) for (const W of [320, 390, 767, 768, 769, 1024, 1280, 1440]) {
    const tag = `[${W}]`;
    const ctx = await newCtx(browser, W); const page = await freshPage(ctx);
    await checkFrame(page, W, APP_MAX, tag);
    const tb = await page.evaluate(tabBarBox);
    check(`${tag} thanh tab đủ 4 nút, phủ đúng bề ngang khung, nằm trong màn hình`, !!tb && near(tb.l, tb.fl, 2) && near(tb.r, tb.fr, 2) && tb.bottom <= tb.vh + 1, tb ? `nút ${tb.l.toFixed(0)}..${tb.r.toFixed(0)} khung ${tb.fl.toFixed(0)}..${tb.fr.toFixed(0)}` : 'không thấy thanh tab');
    await checkOverlays(page, `${tag} màn chính:`);
    await shot(page, 'home', W);
    await ctx.close();
  }

  /* 3) Sheet/modal ở 390, 768, 1024, 1280 */
  if (want(2, 5)) for (const W of [390, 768, 1024, 1280]) {
    const tag = `[${W}]`;
    const ctx = await newCtx(browser, W);

    // 3a. Mời (InviteSheet)
    if (want(2)) { const page = await freshPage(ctx);
      const btn = page.getByRole('button', { name: 'Mời người ấy / gia đình cùng xem' }).first();
      if (!(await btn.count())) check(`${tag} mở được sheet Mời`, false, 'không thấy nút Mời ở Trang chủ');
      else {
        await btn.click(); await page.waitForTimeout(600);
        const o = await checkOverlays(page, `${tag} sheet Mời:`);
        check(`${tag} sheet Mời hiện ra`, o.items.some((i) => i.role === 'dialog'), o.items.map((i) => i.name).join(','));
        await shot(page, 'invite', W);
      }
      await page.close(); }

    // 3b. Ngân sách -> sheet vendor -> sheet Kết nối
    if (want(2)) { const page = await freshPage(ctx);
      await page.getByRole('button', { name: 'Ngân sách', exact: true }).first().click(); await page.waitForTimeout(500);
      try {
        await page.getByText('Ảnh', { exact: true }).first().click(); await page.waitForTimeout(500);
        await page.getByText('Studio X').first().click(); await page.waitForTimeout(700);
        await shot(page, 'budget-vendor-sheet', W);
        const o = await checkOverlays(page, `${tag} sheet vendor ở Ngân sách:`);
        check(`${tag} sheet vendor ở Ngân sách hiện ra`, o.items.length > 0 && !!(await page.getByTestId('connect-btn').count()));
        await page.getByTestId('connect-btn').click(); await page.waitForTimeout(700);
        const o2 = await checkOverlays(page, `${tag} sheet Kết nối:`);
        check(`${tag} sheet Kết nối hiện ra`, o2.items.some((i) => i.role === 'dialog'));
        await shot(page, 'connect', W);
      } catch (e) { check(`${tag} mở được sheet vendor + sheet Kết nối ở Ngân sách`, false, e.message.split('\n')[0]); }
      await page.close(); }

    // 3c. Chat AI + BotMarkdown
    { const page = await freshPage(ctx);
      try {
        await page.getByRole('button', { name: /AI|Hỏi|Tơ Hồng/ }).first().click(); await page.waitForTimeout(600);
        const input = page.getByLabel('Nhắn cho Tơ Hồng');
        await input.waitFor({ timeout: 4000 });
        await checkOverlays(page, `${tag} chat AI:`);
        await input.fill('Ngân sách thế nào'); await input.press('Enter'); await page.waitForTimeout(1200);
        check(`${tag} bảng markdown trong chat vẫn render (BotMarkdown)`, (await page.locator('.md table').count()) > 0);
        await checkOverlays(page, `${tag} chat AI sau khi trả lời:`);
        await shot(page, 'ai-chat', W);
      } catch (e) { check(`${tag} mở được chat AI`, false, e.message.split('\n')[0]); }
      await page.close(); }

    // 3d. Ngăn kéo
    if (want(2)) { const page = await freshPage(ctx);
      try {
        await page.getByRole('button', { name: 'Mở menu' }).first().click(); await page.waitForTimeout(500);
        const o = await checkOverlays(page, `${tag} ngăn kéo:`);
        check(`${tag} ngăn kéo hiện ra`, o.items.length > 0);
        await shot(page, 'drawer', W);
      } catch (e) { check(`${tag} mở được ngăn kéo`, false, e.message.split('\n')[0]); }
      await page.close(); }

    await ctx.close();
  }

  /* 4) Một biến duy nhất: đổi --app-max thì khung, viền/bóng, sheet đều đổi theo */
  if (want(1, 2, 4)) {
    const override = async (W, max, fn) => {
      const ctx = await newCtx(browser, W); const page = await freshPage(ctx);
      await page.evaluate((v) => document.documentElement.style.setProperty('--app-max', v), `${max}px`);
      await page.waitForTimeout(250);
      await fn(page); await ctx.close();
    };
    await override(1024, 600, async (page) => {
      await checkFrame(page, 1024, 600, '[biến=600, vw 1024]');
      if (want(2)) await page.getByRole('button', { name: 'Mời người ấy / gia đình cùng xem' }).first().click(); await page.waitForTimeout(600);
      if (want(2)) await checkOverlays(page, '[biến=600, vw 1024] sheet Mời:');
    });
    await override(700, 600, (page) => checkFrame(page, 700, 600, '[biến=600, vw 700]'));
    await override(600, 600, (page) => checkFrame(page, 600, 600, '[biến=600, vw 600]'));
  }

  await browser.close(); server.close();
  if (tmpDist) fs.rmSync(tmpDist, { recursive: true, force: true });
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
})().catch((e) => { console.log('FAIL eval không chạy được: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); process.exit(2); });
