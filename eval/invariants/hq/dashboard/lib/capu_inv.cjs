#!/usr/bin/env node
// Thư viện đo bất biến khối Capu và modal việc chờ Capu (nguồn: T-076, spec products/T-076-modal-viec-cho-capu.md v4, qua Spec Gate 2026-11-06, spec-critic; INV-P1 của Product).
// Bản cố định, không phụ thuộc eval của việc (eval/T-076/*.cjs có thể đổi; file này thì không).
//   node capu_inv.cjs --repo <repo-dashboard>
// Áp dụng từ khi trang có modal #capu-modal (T-076 vào); trước đó in PASS "chưa áp dụng".
// Dữ liệu dashboard.json, kênh live (WebSocket) và d3 đều giả/cục bộ. Mã thoát 0 = đạt.
const fs = require('fs'), path = require('path');
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), INDEX = path.join(REPO, 'index.html');
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO + ' (đặt TOHONG_DASHBOARD_REPO)'); process.exit(1); }
if (!/capu-modal/.test(fs.readFileSync(INDEX, 'utf8'))) { console.log('PASS chưa áp dụng: trang chưa có modal #capu-modal (T-076)'); process.exit(0); }
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js'); process.exit(1); }
const { chromium } = require('playwright');

const GH = 'https://github.com/phungrk/';
const DR = n => GH + 'tohong-hq/blob/main/inbox/capu/' + n, DIR = GH + 'tohong-hq/tree/main/inbox/capu', PR = (r, n) => GH + r + '/pull/' + n;
const stamp = h => new Date(Date.now() + 7 * 3600e3 - h * 3600e3).toISOString().slice(0, 16);
const T = (id, state, o = {}) => ({ id, title: o.title || 'Việc ' + id, state, holder: state === 'done' ? '-' : 'chief-of-staff', owner: o.owner || 'engineering', reviewer: 'adversary', rounds: 0, version: 1,
  deadline: '', budget: '', cost: 0, created: '2026-10-30T09:00', updated: stamp(o.h === undefined ? 30 : o.h), hours_since_update: o.h === undefined ? 30 : o.h,
  tier: o.tier || 'B', area: 'hq/dashboard', product: 'hq', evals: 1, spec_returns: 0, evals_added: 0 });
const L = (label, url, st) => ({ label, url, pr_state: st || '' });
const Q = (task, kind, links, by) => ({ task, kind, decide_by: by || '', links });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const dash = (tasks, queue) => { const d = { generated_at: stamp(0), timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster,
  model: { invariants: { _shared: 1, 'hq/dashboard': 1 }, invariants_total: 2, adversarial_evals: 0, regression_evals: 0, insight_reports: 1, last_insight: '', specs: 1 } };
  if (queue !== undefined) d.capu_queue = queue; return d; };

const CASES = [
  // đủ loại; T-1 vừa escalated trên board vừa có trong capu_queue (một dòng); T-2 escalated chưa có trong queue; T-6 queue cũ nói diff-b nhưng việc đã về doing; T-7 bậc A không vào
  ['đủ loại', [T('T-1', 'escalated', { owner: 'product' }), T('T-2', 'escalated', { owner: 'chief-of-staff' }), T('T-3', 'done'), T('T-4', 'blocked'), T('T-5', 'done', { tier: 'C' }),
    T('T-6', 'doing'), T('T-7', 'done', { tier: 'A', h: 2 }), T('T-8', 'done', { tier: 'B', title: 'Tên rất dài '.repeat(12) })],
   [Q('T-1', 'escalated', [L('Decision Request', DR('T-1-a.md'))], '2026-11-10'), Q('T-3', 'diff-b', [L('PR tohong-front#1', PR('tohong-front', 1), 'open')]), Q('T-4', 'blocked', [L('Decision Request', DIR)]),
    Q('T-5', 'decision', [L('Decision Request', DR('T-5-b.md')), L('PR tohong-back#2', PR('tohong-back', 2), 'open')], '2026-11-09'), Q('T-6', 'diff-b', [L('PR tohong-back#3', PR('tohong-back', 3), 'open')]),
    Q('T-8', 'merge-c', [])]],
  // dữ liệu cũ không có capu_queue
  ['không capu_queue', [T('T-1', 'escalated', { owner: 'product' }), T('T-3', 'done', { h: 3 }), T('T-9', 'done', { h: 60 }), T('T-7', 'done', { tier: 'A', h: 2 })], undefined],
  // rỗng
  ['rỗng', [T('T-3', 'doing'), T('T-7', 'done', { tier: 'A', h: 2 })], []],
];

(async () => {
  const browser = await chromium.launch(); let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  for (const [name, tasks, queue] of CASES) for (const [vn, vp, touch] of [['1280', { width: 1280, height: 900 }, false], ['390', { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, colorScheme: 'light' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
    await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
    await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(dash(tasks, queue)) }));
    await page.routeWebSocket(/\/ws$/, ws => ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })));
    const tag = name + ' @' + vn + ': ';
    try {
      await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1500);
      const n = (await page.$eval('#nd_capu .n', e => e.textContent.trim()));
      await page.locator('#nd_capu .n').scrollIntoViewIfNeeded(); const b = await page.locator('#nd_capu .n').boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(300);
      ok(await page.locator('#capu-modal').isVisible(), tag + 'bấm số trên khối Capu mở #capu-modal');
      const ids = await page.$$eval('#capu-modal [data-capu-row]', rs => rs.map(r => r.getAttribute('data-task')));
      ok(/^\d+$/.test(n) && Number(n) === ids.length, tag + 'số trên khối (' + n + ') = số dòng modal (' + ids.length + ')');
      ok(new Set(ids).size === ids.length, tag + 'mỗi mã việc tối đa một dòng: ' + ids.join());
      ok(!errs.length, tag + 'không lỗi trang ' + errs.slice(0, 1).join());
    } catch (e) { ok(false, tag + 'ngoại lệ ' + e.message); }
    await ctx.close();
  }
  await browser.close(); console.log(fails ? 'FAIL ' + fails + ' ý không đạt' : 'PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL ngoại lệ ' + e.message); process.exit(1); });
