#!/usr/bin/env node
// Eval T-145 tiêu chí 2: trang đọc DATA_URL mới (nhánh dashboard-data của repo tohong-hq-dashboard) và vẫn hiển thị với fixture dashboard.json.
// In PASS hoặc FAIL <lý do>. Repo trang: ${TOHONG_DASHBOARD_REPO:-/home/user/tohong-hq-dashboard}. Cần Playwright (NODE_PATH=$(npm root -g)) và d3 cục bộ (biến D3).
const fs = require('fs'), path = require('path');
const REPO = process.env.TOHONG_DASHBOARD_REPO || '/home/user/tohong-hq-dashboard';
const INDEX = path.join(REPO, 'index.html');
const EXPECT = 'https://raw.githubusercontent.com/phungrk/tohong-hq-dashboard/dashboard-data/dashboard.json';
const fail = m => { console.log('FAIL ' + m); process.exit(1); };
if (!fs.existsSync(INDEX)) fail('không thấy index.html trong ' + REPO);
const html = fs.readFileSync(INDEX, 'utf8');
const m = html.match(/const\s+DATA_URL\s*=\s*(['"`])([^'"`]+)\1/);
if (!m) fail('không thấy khai báo const DATA_URL');
if (m[2] !== EXPECT) fail('DATA_URL=' + m[2] + ' (phải là ' + EXPECT + ')');
if (/raw\.githubusercontent\.com\/phungrk\/tohong-hq(?![-\w])/.test(html)) fail('index.html còn đọc dữ liệu từ raw của repo phungrk/tohong-hq (đã private)');
if (/dashboard-data<\/code>[^<]*<a[^>]*>phungrk\/tohong-hq(?![-\w])/.test(html)) fail('chân trang còn ghi nguồn dữ liệu là repo phungrk/tohong-hq');
if (/repo tohong-hq(?![-\w])/.test(html)) fail('thông báo lỗi còn chỉ về repo tohong-hq');
if (/\.get\(\s*['"]data['"]\s*\)/.test(html)) fail('trang đọc tham số ?data= (không làm: cho trang công khai nạp dữ liệu từ URL tùy ý)');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!D3) fail('thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { fail('thiếu playwright (NODE_PATH=$(npm root -g))'); }
const base = { title: 'Việc thử', state: 'doing', holder: 'engineering', owner: 'engineering', reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0, created: '2026-10-30T09:00', updated: '2026-10-31T09:00', hours_since_update: 2, tier: 'A', area: 'hq/dashboard', product: 'hq', evals: 2, spec_returns: 0, evals_added: 0 };
const tasks = [{ ...base, id: 'T-001' }, { ...base, id: 'T-002', owner: 'product', holder: 'spec-critic', reviewer: 'spec-critic', state: 'review' }, { ...base, id: 'T-003', state: 'spec', holder: 'product', spec_returns: 1 }];
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const data = { generated_at: '2026-10-31T10:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster, capu_queue: [],
  model: { invariants: { 'hq/dashboard': 2 }, invariants_total: 2, adversarial_evals: 1, regression_evals: 0, insight_reports: 1, last_insight: '2026-10-25-weekly.md', specs: 2 } };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1500 } });
  const hits = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/raw.githubusercontent.com/**', r => { const u = r.request().url(); hits.push(u);
    if (u.split('?')[0] === EXPECT) r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }); else r.fulfill({ status: 404, body: 'not found' }); });
  await page.routeWebSocket(/\/ws$/, ws => ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })));
  await page.goto('file://' + INDEX); await page.waitForTimeout(1500);
  const n = async s => page.$eval(s, e => e.textContent).catch(() => null);
  const why = [];
  if (!hits.length) why.push('trang không tải dữ liệu từ raw.githubusercontent.com');
  const wrong = hits.filter(u => u.split('?')[0] !== EXPECT);
  if (wrong.length) why.push('trang gọi URL khác: ' + wrong[0]);
  if (await page.$eval('#banner', e => getComputedStyle(e).display !== 'none').catch(() => true)) why.push('banner lỗi tải dữ liệu đang hiện');
  if ((await n('#nd_exec .n')) !== '1') why.push('#nd_exec .n phải = 1 (việc doing)');
  if ((await n('#nd_respec .n')) !== '1') why.push('#nd_respec .n phải = 1 (việc spec)');
  if (errors.length) why.push('lỗi console: ' + errors[0]);
  await browser.close();
  console.log(why.length ? 'FAIL ' + why.join(' | ') : 'PASS'); process.exit(why.length ? 1 : 0);
})();
