#!/usr/bin/env node
// Eval đối kháng T-163 (adversary): sơ đồ luồng T-162 với dữ liệu biên. In PASS hoặc FAIL <lý do>.
// Ca: roster 1 người; roster 15 người; id dài 19 ký tự và id có dấu (name = id như phần tử tối thiểu Hành vi 4b); nhịp của agent ngoài roster; việc có holder ngoài roster;
// đổi bộ lọc sản phẩm 30 lần liên tiếp. Đo như check_page.cjs của T-162 (hộp bao vòng tròn, trong khung, không cuộn ngang).
// Chạy: NODE_PATH=$(npm root -g) D3=... TOHONG_DASHBOARD_REPO=... node eval/T-163/adv-02-so-do-bien.cjs
const fs = require('fs'), path = require('path');
const REPO = process.env.TOHONG_DASHBOARD_REPO || '/home/user/tohong-hq-dashboard';
const INDEX = path.join(REPO, 'index.html');
const D3 = process.env.D3 || '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3.min.js';
const fail = m => { console.log('FAIL ' + m); process.exit(1); };
if (!fs.existsSync(D3)) fail('thiếu d3.min.js (biến D3)');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { fail('thiếu playwright'); }
const stamp = new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 16);
const R = id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' });
const T = (id, state, holder, product = 'hq') => ({ id, title: id, state, holder, owner: holder, reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0, created: stamp, updated: stamp, hours_since_update: 1, tier: 'A', area: product + '/x', product, evals: 1, spec_returns: 0, evals_added: 0 });
let k = 0; const E = (task, event, from, to) => ({ seq: 'S-' + String(++k).padStart(5, '0'), ledger_id: 'e' + k, t: stamp, task, title: '', event, from, to, round: 0, severity: '', cost: 0, state: '', holder: '' });
const mk = (ids, tasks = [], events = []) => ({ generated_at: stamp, timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events, roster: ids.map(R), capu_queue: [],
  model: { invariants: {}, invariants_total: 0, adversarial_evals: 0, regression_evals: 0, insight_reports: 0, last_insight: '', specs: 0 } });
async function open(browser, data, width, activity = []) {
  const page = await browser.newPage({ viewport: { width, height: 1400 } }); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  await page.routeWebSocket(/\/ws$/, ws => ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: activity.map(a => ({ ...a, at: Date.now() - (a.ago || 1000) })) })));
  await page.goto('file://' + INDEX); await page.waitForTimeout(1500);
  return { page, errors };
}
const read = page => page.evaluate(() => {
  const svgs = document.querySelectorAll('#flow svg'), svg = svgs[0]; if (!svg) return null; const sr = svg.getBoundingClientRect();
  const nodes = [...svg.querySelectorAll('.chr[data-agent]')].map(c => { const g = c.parentNode, r = g.getBoundingClientRect();
    const cr = (g.querySelector(':scope > circle:not([class])') || g.querySelector('circle')).getBoundingClientRect();
    return { id: c.getAttribute('data-agent'), text: g.textContent, sprite: c.getAttribute('data-state'), box: [cr.left, cr.right, cr.top, cr.bottom],
      inside: r.left >= sr.left - 1 && r.right <= sr.right + 1 && r.top >= sr.top - 1 && r.bottom <= sr.bottom + 1 }; });
  const nan = [...svg.querySelectorAll('path')].filter(p => /NaN|undefined/.test(p.getAttribute('d') || '')).length;
  return { svgCount: svgs.length, nodes, nan, hscroll: document.documentElement.scrollWidth > innerWidth };
});
function geom(nm, f, want, why) {
  if (!f) return why.push(nm + ': không có sơ đồ');
  const have = f.nodes.map(n => n.id).sort(), w = [...want, 'done'].sort();
  if (JSON.stringify(have) !== JSON.stringify(w)) why.push(nm + ': node ' + JSON.stringify(have) + ' phải là ' + JSON.stringify(w));
  for (const n of f.nodes) if (!n.inside) why.push(nm + ': node ' + n.id + ' vượt khung');
  for (let i = 0; i < f.nodes.length; i++) for (let j = i + 1; j < f.nodes.length; j++) { const a = f.nodes[i].box, b = f.nodes[j].box, G = 4;
    if (a[0] - G < b[1] + G && b[0] - G < a[1] + G && a[2] - G < b[3] + G && b[2] - G < a[3] + G) why.push(nm + ': ' + f.nodes[i].id + ' chồng ' + f.nodes[j].id); }
  if (f.hscroll) why.push(nm + ': cuộn ngang'); if (f.nan) why.push(nm + ': ' + f.nan + ' đường có toạ độ NaN');
}
(async () => {
  const browser = await chromium.launch(); const why = [];
  const BASE = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'];
  const big = [...BASE, ...Array.from({ length: 8 }, (_, i) => 'bo-phan-' + (i + 1))];   // 15 người
  const odd = [...BASE, 'qa-kiem-thu-tu-dong', 'đội-ngũ-kiểm-thử'];
  for (const w of [1200, 390]) {   // khung spec hứa; 320px ghi riêng trong note
    for (const [nm, ids] of [['1 người', ['capu']], ['15 người', big], ['id dài/có dấu', odd]]) {
      const tasks = ids.slice(1).map((id, i) => T('T-' + (i + 1), 'doing', id));
      const events = ids.slice(1).map((id, i) => E('T-' + (i + 1), 'assigned', 'chief-of-staff', id));
      const o = await open(browser, mk(ids, tasks, events), w); const f = await read(o.page);
      if (o.errors.length) why.push(`${w}px ${nm}: lỗi trang ${o.errors[0]}`);
      geom(`${w}px ${nm}`, f, ids, why);
      if (f && ids.length > 1) for (const id of ids.slice(2)) { const n = f.nodes.find(x => x.id === id); if (n && !/đang làm/i.test(n.text)) why.push(`${w}px ${nm}: ${id} giữ việc doing mà không có "Đang làm"`); }
      await o.page.close();
    }
  }
  // nhịp của agent ngoài roster + việc có holder ngoài roster + luồng tới id ngoài roster
  const tasks = [T('T-1', 'doing', 'ma-agent'), T('T-2', 'review', 'engineering'), T('T-3', 'doing', 'insight', 'planner')];
  const events = [E('T-1', 'assigned', 'chief-of-staff', 'ma-agent'), E('T-2', 'handoff', 'ma-agent', 'engineering'), E('T-3', 'assigned', 'chief-of-staff', 'insight')];
  const act = [{ agent: 'ma-agent', action: 'Làm bí mật', task: 'T-1' }, { agent: 'khach-la', action: 'X', task: '' }];
  for (const w of [1200, 390]) {
    const o = await open(browser, mk(BASE, tasks, events), w, act); let f = await read(o.page);
    if (o.errors.length) why.push(`${w}px ngoài roster: lỗi trang ${o.errors[0]}`);
    geom(`${w}px ngoài roster`, f, BASE, why);
    if (f && /Làm bí mật/.test(f.nodes.map(n => n.text).join('|'))) why.push(`${w}px: nhịp của agent ngoài roster hiện trên node khác`);
    // đổi bộ lọc liên tục
    const seq = ['hq', 'planner', 'all']; let last = null;
    for (let i = 0; i < 30; i++) { await o.page.selectOption('#product-filter', seq[i % 3]); if (i % 7 === 0) await o.page.waitForTimeout(30); }
    await o.page.selectOption('#product-filter', 'hq'); await o.page.waitForTimeout(600); f = await read(o.page);
    if (o.errors.length) why.push(`${w}px đổi lọc: lỗi trang ${o.errors[0]}`);
    if (f && f.svgCount !== 1) why.push(`${w}px đổi lọc: ${f.svgCount} svg trong #flow`);
    geom(`${w}px sau 30 lần đổi lọc (hq)`, f, BASE, why);
    const ins = f && f.nodes.find(n => n.id === 'insight'), eng = f && f.nodes.find(n => n.id === 'engineering');
    if (ins && /đang làm/i.test(ins.text)) why.push(`${w}px lọc hq: insight chỉ giữ việc planner mà hiện "Đang làm"`);
    if (eng && !/đang làm/i.test(eng.text)) why.push(`${w}px lọc hq: engineering giữ việc review mà không hiện "Đang làm"`);
    await o.page.selectOption('#product-filter', 'planner'); await o.page.waitForTimeout(600); f = await read(o.page);
    const ins2 = f && f.nodes.find(n => n.id === 'insight'); if (ins2 && !/đang làm/i.test(ins2.text)) why.push(`${w}px lọc planner: insight không hiện "Đang làm"`);
    await o.page.close();
  }
  await browser.close();
  console.log(why.length ? 'FAIL ' + [...new Set(why)].join(' | ') : 'PASS'); process.exit(why.length ? 1 : 0);
})();
