// Bản chụp cố định của eval/T-054/lib.cjs (harness dùng chung) cho layout inv-010 (nguồn T-056). Không sửa cho khớp code.
/*
 * Harness dùng chung của eval T-054. Học từ T-053: không để lại tiến trình mồ côi, không trùng cổng, không nhận nhầm máy chủ lạ.
 *  - Build bằng `node_modules/.bin/vite build` (chạy xong rồi thoát, không có máy chủ dev nào sống lâu); lệnh con chạy trong NHÓM TIẾN TRÌNH riêng và bị kill cả nhóm khi quá hạn hay khi harness thoát.
 *  - Máy chủ tĩnh nằm TRONG tiến trình harness, lấy cổng bằng listen(0), thăm dò bằng nonce: GET /__nonce phải trả đúng chuỗi ngẫu nhiên harness vừa sinh, nếu không thì FAIL rõ ràng (không dùng nhầm máy chủ khác).
 *  - Chờ theo điều kiện (waitForFunction), không waitForTimeout cố định, trừ khi đo "không có gì xảy ra".
 */
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), crypto = require('crypto');
const { spawn } = require('child_process');
const { createRequire } = require('module');

function loadPlaywright(repo) {
  const { execSync } = require('child_process');
  const tries = [process.env.PLAYWRIGHT_PATH, path.join(repo, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright'];
  try { tries.push(path.join(execSync('npm root -g').toString().trim(), 'playwright')); } catch { /* bỏ qua */ }
  for (const t of tries.filter(Boolean)) { try { return createRequire(path.join(repo, 'x.js'))(t); } catch { /* thử tiếp */ } }
  console.log('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)'); process.exit(2);
}

const groups = new Set();
function killAll() { for (const pid of groups) { try { process.kill(-pid, 'SIGKILL'); } catch { /* đã chết */ } } groups.clear(); }
process.on('exit', killAll);
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => { killAll(); process.exit(130); });

/** Chạy lệnh trong nhóm tiến trình riêng, kill cả nhóm khi xong/quá hạn. Trả {code, out}. */
function runGroup(cmd, argv, opts, timeoutMs = 240000) {
  return new Promise((resolve) => {
    const p = spawn(cmd, argv, { ...opts, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    groups.add(p.pid);
    let out = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
    const t = setTimeout(() => { try { process.kill(-p.pid, 'SIGKILL'); } catch { /* */ } }, timeoutMs);
    p.on('close', (code) => { clearTimeout(t); try { process.kill(-p.pid, 'SIGKILL'); } catch { /* */ } groups.delete(p.pid); resolve({ code, out }); });
  });
}

async function buildDist(repo) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 't054-dist-'));
  const bin = path.join(repo, 'node_modules/.bin/vite');
  const r = await runGroup(bin, ['build', '--outDir', dist, '--emptyOutDir'], { cwd: repo, env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: '', VITE_API_BASE: 'http://api.test' } });
  if (r.code !== 0) { console.log('FAIL build lỗi: ' + r.out.split('\n').filter(Boolean).slice(-2).join(' | ')); process.exit(1); }
  return dist;
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
async function serve(dist) {
  const nonce = crypto.randomBytes(12).toString('hex');
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/__nonce') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(nonce); }
    let f = path.join(dist, p);
    if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html');
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  const got = await (await fetch(base + '/__nonce')).text();
  if (got !== nonce) { console.log('FAIL máy chủ trả nonce lạ: không phải máy chủ của harness'); process.exit(2); }
  return { base, close: () => new Promise((ok) => server.close(ok)) };
}

/* ---------- dữ liệu giả (bịa) ---------- */
const CID = 'c-test';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const BUDGET = { total_tr: 500, guests: 205, mung_tr: 0, categories: [
  { id: 'venue', name: 'Nhà hàng tiệc cưới', pct: 40, priority: 'high', allocated_tr: 200, items: Array.from({ length: 14 }, (_, i) => ({ id: 'i-v' + i, name: 'Khoản số ' + (i + 1), amt: 3 })) },
  { id: 'photography', name: 'Chụp ảnh + quay phim', pct: 8, priority: 'high', allocated_tr: 40, items: [{ id: 'i-album', name: 'Album', amt: 5 }] },
  { id: 'decor', name: 'Trang trí tiệc + hoa', pct: 6, priority: 'mid', allocated_tr: 30, items: [] },
  { id: 'attire', name: 'Trang phục + trang điểm', pct: 8, priority: 'mid', allocated_tr: 40, items: [] },
  { id: 'music', name: 'MC + âm nhạc', pct: 4, priority: 'low', allocated_tr: 20, items: [] },
  { id: 'invite', name: 'Thiệp + quà tặng', pct: 3, priority: 'low', allocated_tr: 15, items: [] },
  { id: 'ceremony', name: 'Lễ + sính lễ', pct: 8, priority: 'mid', allocated_tr: 40, items: [] },
  { id: 'reserve', name: 'Dự phòng phát sinh', pct: 10, priority: null, allocated_tr: 50, items: [] },
] };
const withStats = (b) => { const cats = b.categories.map((c) => { const est = (c.items || []).reduce((s, i) => s + (Number(i.amt) || 0), 0);
  return { ...c, estimated_tr: est, variance_tr: (c.allocated_tr || 0) - est, state: est === 0 ? 'chua_phan_bo' : 'dang_theo_doi' }; });
  const te = cats.reduce((s, c) => s + c.estimated_tr, 0); return { ...b, categories: cats, total_estimated_tr: te, total_variance_tr: b.total_tr - te, budget_used_pct: Math.round(te / b.total_tr * 100) }; };
const GUESTS = Array.from({ length: 60 }, (_, i) => ({ id: 'g' + i, name: 'Khách số ' + (i + 1), side: i % 2 ? 'gai' : 'trai', status: ['yes', 'pending', 'no'][i % 3], count: 1, role: 'Bạn bè' }));

async function scenario(browser, base, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 640 }, hasTouch: !!opts.touch, isMobile: !!opts.touch, userAgent: opts.ua });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  const S = { page, ctx, errors: [], external: [], store: JSON.parse(JSON.stringify(BUDGET)) };
  page.on('pageerror', (e) => S.errors.push(String(e)));
  await page.route('**/*', (route) => { const u = route.request().url(); if (u.startsWith(base) || u.startsWith('http://api.test')) return route.continue(); S.external.push(u); return route.abort(); });
  await page.route('http://api.test/**', async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method(), p = u.pathname;
    const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(o) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (p === '/api/me') return json({ couples: [{ couple_id: CID, role: 'owner' }] });
    if (p === `/api/couples/${CID}/budget` && m === 'GET') return json(withStats(S.store));
    if (p === `/api/couples/${CID}/budget` && m === 'PUT') { S.store = { ...S.store, ...JSON.parse(req.postData() || '{}') }; return json(withStats(S.store)); }
    if (p === `/api/couples/${CID}/summary`) return json({ profile: { bride_name: 'An', groom_name: 'Bình', wedding_date: '2027-03-20', city: 'TP.HCM' }, days_left: 200, total_days: 300, done_days: 100, budget: { total_tr: S.store.total_tr }, guests: { capacity: 205, total: GUESTS.length, yes: 20, pending: 20, no: 20 } });
    if (p === `/api/couples/${CID}/guests`) return json(opts.emptyGuests ? { guests: [], capacity: 0 } : { guests: GUESTS, capacity: 205 });
    if (p === `/api/couples/${CID}/conversations`) return json({ conversations: [] });
    if (p === '/api/vendors/status') return json({ vendors: {} });
    return json({});
  });
  await page.addInitScript(([cid]) => { try { if (!sessionStorage.getItem('t054-seeded')) { localStorage.setItem('th_user', JSON.stringify({ bride: 'An', groom: 'Bình' })); localStorage.setItem('th_vendors_' + cid, JSON.stringify({ venue: { shortlisted: [{ id: 'v-venue', name: 'Nhà hàng Hoa Sen', priceTotal: 6, spec: '10 người/bàn' }], confirmed: null } })); sessionStorage.setItem('t054-seeded', '1'); } } catch { /* */ } }, [CID]);
  await page.goto(base + '/#/' + (opts.hash || 'trang-chu'));
  await page.getByRole('button', { name: 'Khách mời', exact: true }).first().waitFor();
  return S;
}

module.exports = { loadPlaywright, buildDist, serve, scenario, CID };
