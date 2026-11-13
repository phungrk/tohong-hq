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

const WSDEF = 'wss://tohong-live.phungnc.workers.dev/ws';
async function open(browser, { query = '', status = 200 }) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1500 } });
  const o = { page, hits: [], errors: [], ws: [] };
  page.on('pageerror', e => o.errors.push(e.message));
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/raw.githubusercontent.com/**', r => { const u = r.request().url(); o.hits.push(u);
    if (status === 200 && u.split('?')[0] === EXPECT) r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }); else r.fulfill({ status: status === 200 ? 404 : status, body: 'not found' }); });
  await page.routeWebSocket(/\/ws$/, ws => { o.ws.push(ws.url()); ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + INDEX + query); await page.waitForTimeout(1500);
  return o;
}
(async () => {
  const browser = await chromium.launch();
  const why = [];
  // 1) có dữ liệu: hiển thị đúng, chỉ gọi URL mới, #live kết nối tohong-live
  const a = await open(browser, {});
  const n = async s => a.page.$eval(s, e => e.textContent).catch(() => null);
  if (!a.hits.length) why.push('trang không tải dữ liệu từ raw.githubusercontent.com');
  const wrong = a.hits.filter(u => u.split('?')[0] !== EXPECT);
  if (wrong.length) why.push('trang gọi URL khác: ' + wrong[0]);
  if (await a.page.$eval('#banner', e => getComputedStyle(e).display !== 'none').catch(() => true)) why.push('banner lỗi tải dữ liệu đang hiện');
  if ((await n('#nd_exec .n')) !== '1') why.push('#nd_exec .n phải = 1 (việc doing)');
  if ((await n('#nd_respec .n')) !== '1') why.push('#nd_respec .n phải = 1 (việc spec)');
  if (a.errors.length) why.push('lỗi console: ' + a.errors[0]);
  if (!a.ws.includes(WSDEF)) why.push('trang không nối WebSocket mặc định ' + WSDEF + ' (thấy ' + JSON.stringify(a.ws) + ')');
  if (!(await a.page.$eval('#live', e => e.classList.contains('on') && e.textContent === 'Trực tiếp').catch(() => false))) why.push('#live không sang trạng thái "Trực tiếp" khi kênh live mở');
  // chân trang nêu nguồn mới (kiểm dương)
  const foot = await a.page.$$eval('footer a', as => as.map(x => x.href)).catch(() => []);
  if (!foot.includes('https://github.com/phungrk/tohong-hq-dashboard')) why.push('chân trang không có link tới github.com/phungrk/tohong-hq-dashboard làm nguồn dữ liệu (thấy ' + JSON.stringify(foot) + ')');
  if (!(await a.page.$eval('footer', e => /dashboard-data/.test(e.textContent) && /tohong-hq-dashboard/.test(e.textContent)).catch(() => false))) why.push('chân trang phải nhắc nhánh dashboard-data và tên repo tohong-hq-dashboard');
  await a.page.close();
  // 2) ?live= vẫn đổi host WebSocket
  const b = await open(browser, { query: '?live=https://live-thu.example' });
  if (!b.ws.includes('wss://live-thu.example/ws')) why.push('?live= không còn đổi host WebSocket (thấy ' + JSON.stringify(b.ws) + ')');
  await b.page.close();
  // 3) tải dữ liệu lỗi: thông báo nhắc đúng repo nguồn mới
  const c = await open(browser, { status: 404 });
  const msg = await c.page.$eval('#banner', e => getComputedStyle(e).display !== 'none' ? e.textContent : '').catch(() => '');
  if (!/tohong-hq-dashboard/.test(msg)) why.push('thông báo lỗi tải dữ liệu không nhắc tohong-hq-dashboard (thấy "' + msg + '")');
  if (/repo tohong-hq(?![-\w])/.test(msg)) why.push('thông báo lỗi còn chỉ về repo tohong-hq');
  await c.page.close();
  await browser.close();
  console.log(why.length ? 'FAIL ' + why.join(' | ') : 'PASS'); process.exit(why.length ? 1 : 0);
})();
