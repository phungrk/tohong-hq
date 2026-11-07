#!/usr/bin/env node
// Thư viện đo bất biến rút từ T-090 (spec products/T-090-nhan-vat-nho-mot-nua.md v1, qua Spec Gate 2026-11-07, spec-critic), vùng hq/dashboard/model.
//   node chu_khoi_inv.cjs --repo <repo-dashboard> --check <font-floor|text-in-block>
// font-floor (T-090 mục 2 "chữ không được thu", nhắc lại sàn T-035 1.4): ở mọi tình huống, cỡ chữ hiệu dụng (font-size tính toán × tỉ lệ biến đổi
//   của chữ so với svg) của chữ khối g.node .t ≥ 11,5u, .cap ≥ 10,5u, .n ≥ 22u.
// text-in-block (T-090 mục 2.4; lỗi gốc: chú thích nd_capu rộng 268u trong khối 190u, tràn ra ngoài viewBox trên main fa46026): mọi chữ hiển thị
//   của khối (g.node, g.res: trọn trong hình chính rect, dung sai 0,5u; g.gate: không đè vòng) nằm trọn trong viewBox.
// Tình huống: 1280, 844, 390 (thường) và 1280, 390 (phóng to, nếu có button#model-zoom) × dữ liệu rảnh và dữ liệu bận (số đếm cỡ thực tế).
// Chỉ đọc hợp đồng quan sát: #model svg (viewBox), g.node|g.gate|g.res có id, hình chính :scope > rect|circle, text hiển thị, lớp .t/.cap/.n, button#model-zoom.
// Dữ liệu dashboard.json, kênh live (WebSocket) và d3 đều giả/cục bộ. Mã thoát 0 = đạt.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), INDEX = path.join(REPO, 'index.html'), CHECK = arg('--check');
if (!['font-floor', 'text-in-block'].includes(CHECK)) { console.log('FAIL --check phải là font-floor hoặc text-in-block'); process.exit(1); }
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3.min.js'].find(p => p && fs.existsSync(p));
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO + ' (đặt TOHONG_DASHBOARD_REPO)'); process.exit(1); }
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js'); process.exit(1); }

const T = (id, state, owner, extra) => ({ id, title: 'Việc ' + id, state, holder: owner, owner, reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-11-07T09:00', updated: '2026-11-07T09:00', hours_since_update: 2, tier: 'B', area: 'hq/dashboard/model', evals: 1, spec_returns: 0, evals_added: 0, ...(extra || {}) });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const dash = (tasks, model, queue) => ({ generated_at: '2026-11-07T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster, model, ...(queue ? { capu_queue: queue } : {}) });
const IDLE = dash([T('T-1', 'done', 'engineering', { tier: 'A' }), T('T-2', 'done', 'product', { tier: 'A' })],
  { invariants: { 'hq/dashboard/model': 1 }, invariants_total: 1, adversarial_evals: 0, regression_evals: 0, insight_reports: 1, last_insight: '', specs: 1 });
// Bận: số đếm cỡ thực tế (bể ~150 bất biến, hàng chờ Capu một chữ số mỗi loại, vài việc mỗi khối).
const busyTasks = [];
let k = 100; const add = (n, st, own, ex) => { for (let i = 0; i < n; i++) busyTasks.push(T('T-' + (k++), st, own, ex)); };
add(3, 'escalated', 'engineering'); add(2, 'blocked', 'engineering'); add(4, 'done', 'engineering', { tier: 'B' }); add(5, 'doing', 'product'); add(4, 'review', 'product');
add(3, 'spec', 'product', { spec_returns: 2 }); add(6, 'new', 'engineering'); add(5, 'doing', 'engineering'); add(3, 'rework', 'engineering', { evals_added: 7 }); add(4, 'review', 'engineering'); add(9, 'done', 'insight');
const queue = busyTasks.filter(t => t.state === 'blocked').map(t => ({ task: t.id, kind: 'blocked', decide_by: '', links: [] }))
  .concat(busyTasks.filter(t => t.state === 'done' && t.owner === 'engineering').map(t => ({ task: t.id, kind: 'diff-b', decide_by: '', links: [] })));
const BUSY = dash(busyTasks, { invariants: { _shared: 2, 'planner/vendor/matching': 40, 'hq/dashboard/model': 33, 'hq/dashboard': 14, 'hq/ledger': 60 }, invariants_total: 149,
  adversarial_evals: 48, regression_evals: 12, insight_reports: 9, last_insight: '', specs: 90 }, queue);

const VIEWS = [['1280', { width: 1280, height: 900 }, 0], ['844', { width: 844, height: 900 }, 0], ['390', { width: 390, height: 844 }, 0],
  ['1280-phong-to', { width: 1280, height: 900 }, 1], ['390-phong-to', { width: 390, height: 844 }, 1]];

const FONT = () => {
  const svg = document.querySelector('#model svg'), base = svg.getScreenCTM(), MIN = { t: 11.5, cap: 10.5, n: 22 }, bad = [];
  svg.querySelectorAll('g.node').forEach(g => { if (!g.id) return; for (const [c, min] of Object.entries(MIN)) g.querySelectorAll('text.' + c).forEach(t => {
    const m = t.getScreenCTM(), sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) / Math.sqrt(Math.abs(base.a * base.d - base.b * base.c)), fs = parseFloat(getComputedStyle(t).fontSize) * sc;
    if (fs < min - 0.05) bad.push(`${g.id} .${c} "${t.textContent.trim().slice(0, 24)}" cỡ ${fs.toFixed(2)}u < ${min}u`); }); });
  if (!svg.querySelector('g.node text.t')) bad.push('không thấy chữ .t nào trong g.node');
  return bad;
};
const MEASURE = () => {
  const svg = document.querySelector('#model svg'), sr = svg.getBoundingClientRect(), k = sr.width / svg.viewBox.baseVal.width;
  const vis = e => { let o = 1, x = e; while (x && x.nodeType === 1) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden') return 0; o *= parseFloat(s.opacity); if (x === svg) break; x = x.parentNode; } return o; };
  const vb = svg.viewBox.baseVal, bad = [];
  svg.querySelectorAll('g.node, g.gate, g.res').forEach(g => { if (!g.id) return; const sh = g.querySelector(':scope > rect, :scope > circle'); if (!sh) return;
    const s = sh.getBoundingClientRect(), S = { l: (s.left - sr.left) / k + vb.x, t: (s.top - sr.top) / k + vb.y, r: (s.right - sr.left) / k + vb.x, b: (s.bottom - sr.top) / k + vb.y };
    g.querySelectorAll('text').forEach(t => { const str = t.textContent.trim(); if (!str || vis(t) <= 0.05) return; const q = t.getBoundingClientRect(); if (!q.width) return;
      const u = { l: (q.left - sr.left) / k + vb.x, t: (q.top - sr.top) / k + vb.y, r: (q.right - sr.left) / k + vb.x, b: (q.bottom - sr.top) / k + vb.y };
      const f = x => x.toFixed(1), box = `[${f(u.l)},${f(u.t)},${f(u.r)},${f(u.b)}]`;
      if (u.l < vb.x - 0.5 || u.t < vb.y - 0.5 || u.r > vb.x + vb.width + 0.5 || u.b > vb.y + vb.height + 0.5) bad.push(`${g.id} chữ "${str.slice(0, 30)}" ${box} ra ngoài viewBox`);
      if (sh.tagName === 'circle') { if (Math.min(u.r, S.r) - Math.max(u.l, S.l) > 0.5 && Math.min(u.b, S.b) - Math.max(u.t, S.t) > 0.5) bad.push(`${g.id} chữ "${str.slice(0, 30)}" đè vòng cổng`); }
      else if (u.l < S.l - 0.5 || u.t < S.t - 0.5 || u.r > S.r + 0.5 || u.b > S.b + 0.5) bad.push(`${g.id} chữ "${str.slice(0, 30)}" ${box} ra ngoài khối [${f(S.l)},${f(S.t)},${f(S.r)},${f(S.b)}]`); }); });
  return bad;
};

(async () => {
  const browser = await chromium.launch(); let fails = 0;
  try {
    for (const [dn, data] of [['ranh', IDLE], ['ban', BUSY]]) for (const [tag, vp, zoom] of VIEWS) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'light' }); const page = await ctx.newPage();
      await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
      await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
      await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
      await page.routeWebSocket(/\/ws$/, ws => { ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
      await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1200);
      if (zoom) { const b = await page.$('button#model-zoom'); if (b) { await b.click(); await page.waitForTimeout(500); } }
      const bad = await page.evaluate(CHECK === 'font-floor' ? FONT : MEASURE); await ctx.close();
      if (bad.length) { fails++; console.log(`FAIL ${dn} ${tag}: ${bad.slice(0, 3).join(' | ')}${bad.length > 3 ? ` (+${bad.length - 3})` : ''}`); }
      else console.log(`  ${dn} ${tag}: đạt`);
    }
  } finally { await browser.close(); }
  const MSG = { 'font-floor': ['cỡ chữ khối nhỏ hơn sàn (.t 11,5u, .cap 10,5u, .n 22u)', 'cỡ chữ khối không dưới sàn'], 'text-in-block': ['có chữ khối ra ngoài khối hoặc viewBox', 'mọi chữ khối nằm trọn trong khối và viewBox'] }[CHECK];
  console.log(fails ? `FAIL ${CHECK}: ${fails}/10 tình huống ${MSG[0]}` : `PASS ${CHECK}: 10/10 tình huống, ${MSG[1]}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL lỗi chạy: ' + (e && e.stack || e)); process.exit(1); });
