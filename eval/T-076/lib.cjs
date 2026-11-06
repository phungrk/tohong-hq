// Thư viện dùng chung cho eval T-076 (modal việc chờ Capu duyệt). Dữ liệu dashboard.json, kênh live và d3 đều giả/cục bộ.
// Chỉ kiểm hành vi nhìn thấy (DOM/chữ/href), không đụng tên hàm hay biến trong index.html.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const REPO = path.resolve(process.env.TOHONG_DASHBOARD_REPO || (fs.existsSync(path.join(process.cwd(), 'index.html')) && process.cwd()) || '/home/user/tohong-hq-dashboard');
const INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO + ' (đặt TOHONG_DASHBOARD_REPO)'); process.exit(1); }
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js'); process.exit(1); }

const GH = 'https://github.com/phungrk/';
const DR = n => `${GH}tohong-hq/blob/main/inbox/capu/${n}`;
const DR_DIR = `${GH}tohong-hq/tree/main/inbox/capu`;
const pr = (repo, n) => `${GH}${repo}/pull/${n}`;
const stamp = h => new Date(Date.now() + 7 * 3600e3 - h * 3600e3).toISOString().slice(0, 16);
const T = (id, o = {}) => ({ id, title: o.title || 'Việc ' + id, state: o.state || 'done', holder: o.holder || '-', owner: o.owner || 'engineering', reviewer: 'adversary', rounds: 0, version: 1,
  deadline: '', budget: '', cost: 0, created: '2026-10-30T09:00', updated: stamp(o.h === undefined ? 30 : o.h), hours_since_update: o.h === undefined ? 30 : o.h,
  tier: o.tier || 'B', area: 'hq/dashboard', product: 'hq', evals: 1, spec_returns: 0, evals_added: 0 });
const link = (label, url, st) => ({ label, url, pr_state: st || '' });
const Q = (task, kind, links) => ({ task, kind, links });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const dash = (tasks, queue) => { const d = { generated_at: stamp(0), timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster,
  model: { invariants: { _shared: 1, 'hq/dashboard': 1 }, invariants_total: 2, adversarial_evals: 0, regression_evals: 0, insight_reports: 1, last_insight: '', specs: 1 } };
  if (queue !== undefined) d.capu_queue = queue; return d; };

let browser;
async function start() { browser = await chromium.launch(); return browser; }
async function open(data, vp, extra = {}) {
  const ctx = await browser.newContext({ viewport: vp || { width: 1280, height: 900 }, hasTouch: !!extra.touch, isMobile: !!extra.touch, reducedMotion: 'no-preference', colorScheme: 'light' });
  const page = await ctx.newPage(); const o = { ctx, page, errors: [] };
  page.on('pageerror', e => o.errors.push(String(e)));
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  await page.routeWebSocket(/\/ws$/, ws => ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })));
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1500);
  return o;
}
const nodeCount = o => o.page.$eval('#nd_capu .n', e => e.textContent.trim());
const modalOpen = o => o.page.locator('#capu-modal').isVisible().catch(() => false);
// Mở modal bằng cách bấm vào chữ số của khối Capu (không phải nhân vật)
const clickNode = async o => { const b = await o.page.locator('#nd_capu .n').boundingBox(); await o.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await o.page.waitForTimeout(300); };
const rows = o => o.page.$$eval('#capu-modal [data-capu-row]', rs => rs.map(r => ({ task: r.getAttribute('data-task'), kind: r.getAttribute('data-kind'), text: r.textContent.replace(/\s+/g, ' ').trim(),
  links: [...r.querySelectorAll('a[data-capu-link]')].map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim(), target: a.getAttribute('target'), rel: a.getAttribute('rel') || '', pr: a.getAttribute('data-pr-state') || '' })) })));
const reporter = () => { let fails = 0; return { ok: (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; }, done: () => { console.log(fails ? 'FAIL ' + fails + ' ý không đạt' : 'PASS'); return fails ? 1 : 0; } }; };
module.exports = { REPO, INDEX, GH, DR, DR_DIR, pr, stamp, T, Q, link, dash, start, open, nodeCount, modalOpen, clickNode, rows, reporter, close: () => browser && browser.close() };
