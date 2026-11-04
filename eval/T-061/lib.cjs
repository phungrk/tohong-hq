/*
 * Harness của eval T-061. Dùng lại harness T-054 (loadPlaywright, serve: listen(0) + nonce) và bản build riêng:
 * `node_modules/.bin/vite build` chạy trong NHÓM TIẾN TRÌNH, kill cả nhóm khi xong/quá hạn/thoát; thêm VITE_ADMIN_DEV_TOKEN để mở được /?admin không cần Clerk.
 * API giả (page.route) có độ trễ theo từng đường dẫn, có chế độ lỗi bật/tắt được, ghi lại mọi yêu cầu. Mạng ngoài bị chặn.
 */
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');
const T = require('../T-054/lib.cjs');

const groups = new Set();
const dists = [];
const killAll = () => { for (const d of dists.splice(0)) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* */ } }
  for (const pid of groups) { try { process.kill(-pid, 'SIGKILL'); } catch { /* đã chết */ } } groups.clear(); };
process.on('exit', killAll);
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => { killAll(); process.exit(130); });

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
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 't061-dist-')); dists.push(dist);
  const r = await runGroup(path.join(repo, 'node_modules/.bin/vite'), ['build', '--outDir', dist, '--emptyOutDir'],
    { cwd: repo, env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: '', VITE_API_BASE: 'http://api.test', VITE_ADMIN_DEV_TOKEN: 'dev:eval' } });
  if (r.code !== 0) { console.log('FAIL build lỗi: ' + r.out.split('\n').filter(Boolean).slice(-2).join(' | ')); process.exit(1); }
  return dist;
}

/* ---------- dữ liệu giả (bịa) ---------- */
const CID = 'c-test';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const BUDGET = { total_tr: 500, guests: 200, mung_tr: 0, total_estimated_tr: 3, total_variance_tr: 497, budget_used_pct: 1, categories: [
  { id: 'venue', name: 'Nhà hàng tiệc cưới', pct: 40, priority: 'high', allocated_tr: 200, estimated_tr: 3, variance_tr: 197, state: 'dang_theo_doi', items: [{ id: 'i1', name: 'Khoản số 1', amt: 3 }] },
  { id: 'photography', name: 'Chụp ảnh + quay phim', pct: 8, priority: 'high', allocated_tr: 40, estimated_tr: 0, variance_tr: 40, state: 'chua_phan_bo', items: [] },
] };
const GUESTS = [
  { id: 'g1', name: 'Khách số 1', side: 'trai', status: 'yes', count: 1, role: 'Bạn bè' }, { id: 'g2', name: 'Khách số 2', side: 'trai', status: 'pending', count: 1, role: 'Bạn bè' },
  { id: 'g3', name: 'Khách số 3', side: 'gai', status: 'no', count: 1, role: 'Họ hàng' }, { id: 'g4', name: 'Khách số 4', side: 'gai', status: 'yes', count: 1, role: 'Họ hàng' },
];
const VENDORS = [1, 2, 3].map((i) => ({ id: 'v' + i, name: 'Nhà hàng Hoa Sen ' + i, city: 'TP.HCM', priceMin: 5 + i, priceMax: 9, rating: 4.5, reviewCount: 10, tags: ['sang trọng'], capacity: { max: 300 }, photos: [], match: { totalScore: 90 - i, reasons: [], scoreBreakdown: {} } }));
const ADMIN_LIST = { items: [{ kind: 'account', email_status: 'ok', email: 'an@example.test', couples: [{ bride_name: 'An', groom_name: 'Bình', role: 'owner', created_at: '2026-10-01T00:00:00Z' }] }], total_pages: 1, counts: {} };
const ADMIN_SUM = { accounts: { status: 'ok', total: 12, new_7d: 2 }, couples: { total: 9, new_7d: 1, by_owner: { account: 7, guest: 2 } }, computed_at: '2026-11-04T08:00:00Z' };

// Mọi yêu cầu được phép (tiêu chí 12: không đổi API). Dạng "METHOD /đường-dẫn".
const ALLOWED = [/^GET \/api\/me$/, /^GET \/api\/couples\/c-test\/(summary|budget|timeline|timeline\/suggestions|guests|conversations|subscription|upgrade-request|connect-requests|briefing|budget\/proposal|shortlist|members)$/,
  /^PUT \/api\/couples\/c-test\/(timeline|budget)$/, /^POST \/api\/couples\/c-test\/chat$/, /^GET \/api\/couples\/c-test\/conversations\/[^/]+\/messages$/, /^POST \/api\/vendors\/status$/, /^GET \/api\/vendors\/(match|categories|[^/]+)$/,
  /^GET \/api\/admin\/(me|members-summary)$/, /^POST \/api\/admin\/members-list$/];

const DATA_PATHS = /\/api\/(me$|couples\/c-test\/(summary|budget|timeline|guests|conversations\/[^/]+\/messages)$|vendors\/match|admin\/)/;

/**
 * opts: delay (ms, mặc định 0) | delayFn(path)->ms; fail: {on:boolean, match:RegExp, status}; viewport; reduced; hash; admin
 * Trả S: {page, ctx, reqs:[{t,key}], t0 (lúc yêu cầu /api/me đầu tiên tới), fail, errors, external}
 */
async function scenario(browser, base, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  const S = { page, ctx, reqs: [], t0: null, errors: [], external: [], fail: { on: false, match: null, status: 500, ...(opts.fail || {}) }, delay: opts.delay ?? 0, noBudget: !!opts.noBudget, meDone: false };
  page.on('pageerror', (e) => S.errors.push(String(e)));
  await page.route('**/*', async (route) => {
    const req = route.request(), url = req.url();
    if (url.startsWith(base)) return route.continue();
    if (!url.startsWith('http://api.test')) { S.external.push(url); return route.abort(); }
    const u = new URL(url), p = u.pathname, m = req.method();
    const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(o) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const now = Date.now(); if (S.t0 === null && p === '/api/me') S.t0 = now;
    S.reqs.push({ t: now, key: `${m} ${p}` });
    if (DATA_PATHS.test(p)) { const d = typeof S.delay === 'function' ? S.delay(p) : S.delay; if (d) await new Promise((r) => setTimeout(r, d)); }
    if (S.fail.on && S.fail.match && S.fail.match.test(p)) return json({ error: 'boom' }, S.fail.status);
    if (p === '/api/me') S.meDone = true;
    if (p === '/api/me') return json({ couples: [{ couple_id: CID, role: 'owner' }] });
    const c = `/api/couples/${CID}`;
    if (p === c + '/summary') return json({ profile: { bride_name: 'An', groom_name: 'Bình', wedding_date: '2027-03-20', city: 'TP.HCM' }, days_left: 200, total_days: 300, done_days: 100,
      budget: { total_tr: 500, spent_tr: 100 }, guests: { capacity: 200, total: 4, yes: 2, pending: 1, no: 1 }, timeline: { total: 9, done: 2 }, vendors: { confirmed: 1, shortlisted: 1, empty: 3 } });
    if (p === c + '/budget' && m === 'GET') return S.noBudget ? json({ error: 'none' }, 404) : json(BUDGET);
    if (p === c + '/timeline' && m === 'GET') return json({ updated_at: null });
    if (p === c + '/timeline' && m === 'PUT') return json({ ok: true });
    if (p === c + '/guests') return json({ guests: GUESTS, capacity: 200 });
    if (p === c + '/conversations') return json({ conversations: [{ id: 'cv1', title: 'Chọn nhà hàng', updated_at: '2026-11-01T00:00:00Z' }] });
    if (p.startsWith(c + '/conversations/') && p.endsWith('/messages')) return json({ messages: [{ id: 'm1', role: 'user', content: 'Gợi ý nhà hàng giúp mình' }, { id: 'm2', role: 'assistant', content: 'Đây là gợi ý từ máy chủ giả' }] });
    if (p === '/api/vendors/match') return json({ vendors: VENDORS, total: 3, whyThoseVendors: '' });
    if (p === c + '/chat' && m === 'POST') return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/event-stream' }, body: `event: action\ndata: ${JSON.stringify({ type: S.chatAction || 'add_guest', success: true })}\n\nevent: chunk\ndata: {"text":"Mình đã thêm xong rồi nhé"}\n\nevent: done\ndata: {}\n\n` });
    if (p === '/api/vendors/status') return json({ vendors: {} });
    if (p === '/api/admin/me') return json({ counts: {} });
    if (p === '/api/admin/members-summary') return json(ADMIN_SUM);
    if (p === '/api/admin/members-list') return json(ADMIN_LIST);
    return json({});
  });
  await page.addInitScript(([cid]) => { try { localStorage.setItem('th_user', JSON.stringify({ bride: 'An', groom: 'Bình' })); } catch { /* */ } }, [CID]);
  if (opts.init) await page.addInitScript(...[].concat(opts.init));
  await page.goto(base + (opts.admin ? '/?admin' : '/') + (opts.hash ? '#/' + opts.hash : ''));
  return S;
}

module.exports = { loadPlaywright: T.loadPlaywright, serve: T.serve, buildDist, scenario, killAll, ALLOWED, CID };
