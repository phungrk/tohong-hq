#!/usr/bin/env node
// Eval T-162 (tầng 1, hành vi) cho trang dashboard. Dùng: node check_page.cjs <1|2|3|5>. In PASS hoặc FAIL <lý do>, thoát 0/1.
// Repo trang: ${TOHONG_DASHBOARD_REPO:-/home/user/tohong-hq-dashboard}. Cần Playwright (NODE_PATH=$(npm root -g)) và D3 (biến D3).
const fs = require('fs'), path = require('path');
const REPO = process.env.TOHONG_DASHBOARD_REPO || '/home/user/tohong-hq-dashboard';
const INDEX = path.join(REPO, 'index.html');
const D3 = process.env.D3 || '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3.min.js';
const EXPECT = 'https://raw.githubusercontent.com/phungrk/tohong-hq-dashboard/dashboard-data/dashboard.json';
const which = process.argv[2];
const fail = m => { console.log('FAIL ' + m); process.exit(1); };
if (!fs.existsSync(INDEX)) fail('không thấy index.html trong ' + REPO);
if (!fs.existsSync(D3)) fail('thiếu d3.min.js: đặt D3=/đường/dẫn/d3.min.js');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { fail('thiếu playwright (NODE_PATH=$(npm root -g))'); }

const AGENTS = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'];
const EXTRA = 'qa-bot'; // bộ phận giả định thêm vào roster: node phải sinh theo roster, không viết cứng
const OLD = ['vendor-ops', 'growth', 'finance', 'reviewer'];
const ids = [...AGENTS, EXTRA];
const roster = ids.map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const stamp = new Date(Date.now() + 7 * 3600e3 - 3600e3).toISOString().slice(0, 16);
const T = (id, state, holder, owner, reviewer) => ({ id, title: 'Việc ' + id, state, holder, owner, reviewer, rounds: 0, version: 1, deadline: '', budget: '', cost: 0, created: '2026-10-30T09:00', updated: stamp, hours_since_update: 1, tier: 'A', area: 'hq/dashboard', product: 'hq', evals: 1, spec_returns: 0, evals_added: 0 });
const tasks = [
  T('T-1', 'doing', 'insight', 'insight', 'spec-critic'),
  T('T-2', 'review', 'spec-critic', 'product', 'spec-critic'),
  T('T-3', 'spec', 'product', 'product', 'spec-critic'),
  T('T-4', 'rework', 'engineering', 'engineering', 'adversary'),
  T('T-5', 'review', 'adversary', 'engineering', 'adversary'),
  T('T-6', 'new', 'chief-of-staff', 'engineering', 'adversary'),
  T('T-7', 'escalated', 'capu', 'product', 'spec-critic'),
  T('T-8', 'done', 'vendor-ops', 'vendor-ops', 'reviewer'),   // việc cũ của agent đã bỏ
  T('T-9', 'done', 'chief-of-staff', 'insight', 'spec-critic'),
];
let k = 0;
const E = (task, event, from, to) => ({ seq: 'S-' + String(++k).padStart(5, '0'), ledger_id: 'e' + k, t: stamp, task, title: '', event, from, to, round: 0, severity: '', cost: 0, state: '', holder: '' });
const events = [
  E('T-1', 'assigned', 'chief-of-staff', 'insight'),
  E('T-9', 'handoff', 'insight', 'chief-of-staff'),
  E('T-2', 'handoff', 'product', 'spec-critic'),
  E('T-3', 'rejected', 'spec-critic', 'product'),
  E('T-5', 'handoff', 'engineering', 'adversary'),
  E('T-4', 'rejected', 'adversary', 'engineering'),
  E('T-9', 'accepted', 'adversary', 'chief-of-staff'),
  E('T-8', 'assigned', 'chief-of-staff', 'vendor-ops'),
  E('T-8', 'handoff', 'vendor-ops', 'reviewer'),
];
const data = { generated_at: stamp, timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events, roster, capu_queue: [],
  model: { invariants: { 'hq/dashboard': 2 }, invariants_total: 2, adversarial_evals: 1, regression_evals: 0, insight_reports: 1, last_insight: '2026-10-25-weekly.md', specs: 2 } };

async function open(browser, { width, activity = [], query = '', status = 200 }) {
  const page = await browser.newPage({ viewport: { width, height: 1400 } });
  const o = { page, hits: [], ws: [], errors: [] };
  page.on('pageerror', e => o.errors.push(e.message));
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/raw.githubusercontent.com/**', r => { const u = r.request().url(); o.hits.push(u);
    if (status === 200) r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }); else r.fulfill({ status, body: 'x' }); });
  await page.routeWebSocket(/\/ws$/, ws => { o.ws.push(ws.url()); ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: activity.map(a => ({ ...a, at: Date.now() - a.ago })) })); });
  await page.goto('file://' + INDEX + query); await page.waitForTimeout(1500);
  return o;
}
// đọc node và đường của sơ đồ luồng
const readFlow = page => page.evaluate(() => {
  const svg = document.querySelector('#flow svg'); if (!svg) return null;
  const sr = svg.getBoundingClientRect();
  const nodes = [...svg.querySelectorAll('.chr[data-agent]')].map(c => { const g = c.parentNode, r = g.getBoundingClientRect(), cr = c.getBoundingClientRect();
    const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(g.getAttribute('transform') || '');
    return { id: c.getAttribute('data-agent'), text: g.textContent, cx: cr.x + cr.width / 2, cy: cr.y + cr.height / 2, x: m ? +m[1] : NaN, y: m ? +m[2] : NaN,
      inside: r.left >= sr.left - 1 && r.right <= sr.right + 1 && r.top >= sr.top - 1 && r.bottom <= sr.bottom + 1 }; });
  const near = (x, y) => nodes.reduce((b, n) => { const d = Math.hypot(n.x - x, n.y - y); return !b || d < b.d ? { id: n.id, d } : b }, null).id;
  const statics = [...svg.querySelectorAll('path[marker-end]')].filter(p => !p.classList.contains('run-edge')).map(p => {
    const a = p.getPointAtLength(0), b = p.getPointAtLength(p.getTotalLength()); return near(a.x, a.y) + '>' + near(b.x, b.y); });
  const running = [...svg.querySelectorAll('.run-edge')].map(p => p.getAttribute('data-from') + '>' + p.getAttribute('data-to'));
  return { nodes, statics, running, hscroll: document.documentElement.scrollWidth > innerWidth };
});

(async () => {
  const browser = await chromium.launch(); const why = [];
  const widths = [['rộng 1200px', 1200], ['hẹp 390px', 390]];
  if (which === '1' || which === '2') {
    for (const [nm, w] of widths) {
      const o = await open(browser, { width: w }); const f = await readFlow(o.page);
      if (o.errors.length) why.push(nm + ': lỗi trang ' + o.errors[0]);
      if (!f) { why.push(nm + ': không có sơ đồ luồng'); continue; }
      if (which === '1') {
        const have = f.nodes.map(n => n.id);
        for (const id of ids) if (!have.includes(id)) why.push(nm + ': roster có ' + id + ' nhưng sơ đồ không có node');
        for (const id of have) if (!ids.includes(id) && id !== 'done') why.push(nm + ': node ' + id + ' không thuộc roster');
        for (const id of OLD) if (have.includes(id)) why.push(nm + ': còn node agent cũ ' + id);
        if (new Set(have).size !== have.length) why.push(nm + ': node trùng');
        for (const n of f.nodes) if (!n.inside) why.push(nm + ': node ' + n.id + ' vượt khung sơ đồ');
        for (let i = 0; i < f.nodes.length; i++) for (let j = i + 1; j < f.nodes.length; j++) { const a = f.nodes[i], b = f.nodes[j]; if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < 40) why.push(nm + ': node ' + a.id + ' và ' + b.id + ' chồng nhau'); }
        if (f.hscroll) why.push(nm + ': trang cuộn ngang');
      } else {
        const need = { running: ['chief-of-staff>insight', 'product>spec-critic', 'spec-critic>product', 'adversary>engineering', 'engineering>adversary'],
          statics: ['chief-of-staff>insight', 'insight>chief-of-staff', 'product>spec-critic', 'spec-critic>product', 'engineering>adversary', 'adversary>engineering', 'adversary>chief-of-staff'] };
        for (const p of need.running) if (!f.running.includes(p)) why.push(nm + ': thiếu đường đang chạy ' + p + ' (thấy ' + JSON.stringify(f.running) + ')');
        for (const p of need.statics) if (!f.statics.includes(p)) why.push(nm + ': thiếu luồng lịch sử ' + p + ' (thấy ' + JSON.stringify(f.statics) + ')');
        const bad = [...f.running, ...f.statics].filter(p => /vendor-ops|reviewer|growth|finance/.test(p));
        if (bad.length) why.push(nm + ': còn luồng của agent cũ ' + bad[0]);
      }
      await o.page.close();
    }
  } else if (which === '3') {
    const HELD = ['insight', 'spec-critic', 'product', 'engineering', 'adversary'], NOT = ['chief-of-staff', 'capu', EXTRA];
    for (const [nm, w] of widths) {
      // a) không có nhịp: agent giữ việc doing/review/spec/rework hiện "đang làm"; giữ new/escalated hoặc không giữ thì không
      let o = await open(browser, { width: w, activity: [] }); let f = await readFlow(o.page); await o.page.close();
      const t = id => (f.nodes.find(n => n.id === id) || { text: '' }).text;
      for (const id of HELD) if (!/đang làm/i.test(t(id))) why.push(nm + ': ' + id + ' giữ việc nhưng node không hiện "đang làm" khi không có nhịp');
      for (const id of NOT) if (/đang làm/i.test(t(id))) why.push(nm + ': ' + id + ' không giữ việc doing/review/spec/rework mà node hiện "đang làm"');
      // b) có nhịp: hiện hành động mới nhất (theo thời điểm, không theo thứ tự trong danh sách); nhịp quá hạn không hiện thay "đang làm"
      o = await open(browser, { width: w, activity: [
        { agent: 'engineering', action: 'Chạy eval', task: 'T-4', ago: 5000 }, { agent: 'engineering', action: 'Đọc spec', task: 'T-4', ago: 40000 },
        { agent: 'adversary', action: 'Nhịp cũ quá hạn', task: 'T-5', ago: 600000 }, { agent: EXTRA, action: 'Soát bản dựng', task: 'T-1', ago: 3000 }] });
      f = await readFlow(o.page); await o.page.close();
      if (!t('engineering').includes('Chạy eval')) why.push(nm + ': engineering có nhịp mới nhất "Chạy eval" nhưng node không hiện (thấy "' + t('engineering') + '")');
      if (t('engineering').includes('Đọc spec')) why.push(nm + ': engineering hiện nhịp cũ "Đọc spec" thay vì nhịp mới nhất');
      if (!t(EXTRA).includes('Soát bản dựng')) why.push(nm + ': ' + EXTRA + ' có nhịp nhưng node không hiện hành động');
      if (t('adversary').includes('Nhịp cũ quá hạn') || !/đang làm/i.test(t('adversary'))) why.push(nm + ': adversary giữ việc review, nhịp quá hạn: phải hiện "đang làm", không hiện hành động cũ (thấy "' + t('adversary') + '")');
    }
  } else if (which === '5') {
    const o = await open(browser, { width: 1200 });
    const html = fs.readFileSync(INDEX, 'utf8'), m = html.match(/const\s+DATA_URL\s*=\s*(['"`])([^'"`]+)\1/);
    if (!m || m[2] !== EXPECT) why.push('DATA_URL không phải ' + EXPECT);
    if (!o.hits.length) why.push('trang không tải dữ liệu từ raw.githubusercontent.com');
    const wrong = o.hits.filter(u => u.split('?')[0] !== EXPECT); if (wrong.length) why.push('trang gọi URL khác: ' + wrong[0]);
    if (await o.page.$eval('#banner', e => getComputedStyle(e).display !== 'none').catch(() => true)) why.push('banner lỗi tải dữ liệu đang hiện');
    if (!o.ws.includes('wss://tohong-live.phungnc.workers.dev/ws')) why.push('không nối WebSocket tohong-live mặc định (thấy ' + JSON.stringify(o.ws) + ')');
    if (!(await o.page.$eval('#live', e => e.classList.contains('on') && e.textContent === 'Trực tiếp').catch(() => false))) why.push('#live không sang "Trực tiếp"');
    if (o.errors.length) why.push('lỗi trang ' + o.errors[0]);
    const b = await open(browser, { width: 1200, query: '?live=https://live-thu.example' });
    if (!b.ws.includes('wss://live-thu.example/ws')) why.push('?live= không còn đổi host WebSocket');
  } else fail('đối số phải là 1, 2, 3 hoặc 5');
  await browser.close();
  console.log(why.length ? 'FAIL ' + why.join(' | ') : 'PASS'); process.exit(why.length ? 1 : 0);
})();
