#!/usr/bin/env node
// Eval T-020: Bản đồ luồng theo ADR-009 + bảng Đài phun nước (repo phungrk/tohong-hq-dashboard).
//
//   NODE_PATH=$(npm root -g) D3=/đường/dẫn/d3.min.js \
//     node eval/T-020/flow-fountain.js <thư-mục-repo-dashboard> [--criterion N] [--task T-0xx]
//   ... --shots <thư-mục-ảnh> : chỉ chụp ảnh từng trạng thái của cả hai bảng (bước của tiêu chí 10)
//   ... --write-baseline      : ghi lại eval/T-020/baseline-positions.json từ repo đang trỏ (chỉ dùng trên main trước T-020)
//
// In từng dòng `PASS Cn …` / `FAIL Cn <lý do>`, dòng cuối `PASS` hoặc `FAIL <lý do>`; mã thoát 0/1.
// Dữ liệu và kênh live đều giả (không gọi mạng thật). d3 nạp từ file cục bộ vì cdnjs có thể bị chặn.
// Hợp đồng phần tử mà eval dựa vào nằm ở mục "Hợp đồng quan sát" của products/T-020-dai-phun-nuoc.md.
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); return i < 0 ? null : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const REPO = path.resolve(args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--criterion' && args[args.indexOf(a) - 1] !== '--task' && args[args.indexOf(a) - 1] !== '--shots') || '.');
const ONLY = flag('--criterion') && String(flag('--criterion')).replace(/^C/i, '');
const TASK = flag('--task');
const SHOTS = flag('--shots');
const D3 = process.env.D3;
const HERE = __dirname;
const ROSTER_FILE = process.env.ROSTER || path.join(HERE, '..', '..', 'org', 'roster.json');
const BASELINE_FILE = path.join(HERE, 'baseline-positions.json');
if (!D3 || !fs.existsSync(D3)) { console.log('FAIL thiếu biến môi trường D3 trỏ tới d3.min.js'); process.exit(1); }
if (!fs.existsSync(path.join(REPO, 'index.html'))) { console.log('FAIL không thấy index.html trong ' + REPO); process.exit(1); }

const WIDE = { width: 1280, height: 900 }, NARROW = { width: 390, height: 844 };
const ALLOWED_HOSTS = ['127.0.0.1', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'raw.githubusercontent.com'];

// ---------- dữ liệu giả ----------
const iso = d => new Date(d.getTime() + 7 * 36e5).toISOString().slice(0, 16);
const ago = h => iso(new Date(Date.now() - h * 36e5));
const realRoster = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8')).roles;
const HIRING = ['vendor-ops', 'growth', 'finance'];
const roster = (over = {}) => realRoster.map(r => ({ id: r.id, name: r.name, role: over[r.id] || r.role, kind: r.kind,
  reports_to: r.reports_to, mission: r.mission, status: HIRING.includes(r.id) ? 'Need Hiring' : 'Hired' }));
// T(id, trạng thái, owner, holder, số giờ kể từ lần cập nhật, bậc)
const T = (id, state, owner, holder, h, tier) => ({ id, title: 'Việc ' + id, state, holder, owner, reviewer: 'reviewer', rounds: 0, version: 1,
  deadline: '', budget: '', cost: 0, created: '2026-10-29T08:00', updated: ago(h), tier: tier === undefined ? '' : tier });
const EV = (id, task, event, from, to, t) => ({ id, t, task, title: '', event, from, to, round: 0, severity: '', detail: '', link: '', cost: 0 });
const CAP = 'capu', COS = 'chief-of-staff', PRO = 'product', ENG = 'engineering', INS = 'insight';

function eventsFor(tasks) {
  const ev = []; let n = 0;
  for (const t of tasks) {
    const own = t.owner;
    if (['new', 'doing', 'review', 'rework'].includes(t.state) && own !== COS) ev.push(EV('E' + (++n), t.id, 'assigned', COS, own, '2026-10-29T08:0' + (n % 10)));
    if (t.state === 'review') ev.push(EV('E' + (++n), t.id, 'handoff', own, 'reviewer', '2026-10-29T09:0' + (n % 10)));
    if (t.state === 'rework') ev.push(EV('E' + (++n), t.id, 'rejected', 'reviewer', own, '2026-10-29T10:0' + (n % 10)));
  }
  return ev;
}
const bundle = (tasks, extra = {}, events) => ({ generated_at: iso(new Date()), roster: roster(), tasks, events: events || eventsFor(tasks), ...extra });

// Bộ dữ liệu chính: đủ 8 trạng thái, 3 bậc, insight, việc đứng yên > 24 giờ, việc spec. Kỳ vọng của từng tầng nằm ở MAIN_EXPECT.
function mainTasks() {
  return [
    T('T-201', 'new', PRO, PRO, 2), T('T-202', 'doing', PRO, PRO, 30), T('T-203', 'rework', PRO, PRO, 3),
    T('T-204', 'spec', ENG, PRO, 5, 'B'), T('T-205', 'spec', PRO, PRO, 26),
    T('T-211', 'new', ENG, ENG, 1), T('T-212', 'doing', ENG, ENG, 4), T('T-213', 'rework', ENG, ENG, 6),
    T('T-221', 'review', ENG, 'reviewer', 2, 'A'), T('T-222', 'review', PRO, 'reviewer', 3, 'B'), T('T-223', 'review', ENG, 'reviewer', 27, 'C'),
    T('T-224', 'review', PRO, 'reviewer', 1, ''), T('T-225', 'review', ENG, 'reviewer', 2, 'A'),
    T('T-231', 'doing', INS, INS, 2), T('T-232', 'new', INS, INS, 2),
    T('T-233', 'done', INS, '-', 100, 'A'), T('T-234', 'done', ENG, '-', 10, 'A'), T('T-235', 'done', PRO, '-', 167, 'B'),
    T('T-236', 'done', PRO, '-', 169, 'B'), T('T-237', 'done', ENG, '-', 300, 'A'),
    T('T-241', 'blocked', ENG, COS, 50), T('T-242', 'escalated', PRO, CAP, 2), T('T-243', 'escalated', ENG, CAP, 40),
    T('T-251', 'doing', COS, COS, 2), T('T-252', 'rework', COS, COS, 30),
  ];
}
const mainEvents = () => [
  EV('M1', 'T-211', 'assigned', COS, ENG, '2026-10-29T08:00'), EV('M2', 'T-201', 'assigned', COS, PRO, '2026-10-29T08:01'),
  EV('M3', 'T-212', 'assigned', COS, ENG, '2026-10-29T08:02'), EV('M4', 'T-221', 'handoff', ENG, 'reviewer', '2026-10-29T09:00'),
  EV('M5', 'T-222', 'handoff', PRO, 'reviewer', '2026-10-29T09:01'), EV('M6', 'T-213', 'rejected', 'reviewer', ENG, '2026-10-29T10:00'),
  EV('M7', 'T-203', 'rejected', 'reviewer', PRO, '2026-10-29T10:01'),
];
const mainData = (extra = { regression_evals: 12 }) => bundle(mainTasks(), extra, mainEvents());
const Z = { pump: 0, column: 0, jet: 0, filter: 0, pool: 0, return: 0, capu: 0, other: 0, spec: 0, stuck: {}, tiers: [0, 0, 0, 0], blocked: 0, escalated: 0 };
const X = o => ({ ...Z, ...o });
const MAIN_EXPECT = X({ pump: 2, column: 5, jet: 3, filter: 5, pool: 3, return: 1, capu: 3, other: 2, spec: 2, stuck: { column: 2, filter: 1 }, tiers: [2, 1, 1, 1], blocked: 1, escalated: 2 });

// Mỗi trạng thái một bộ dữ liệu riêng (kiểm "áp cho cả 8 trạng thái" và dùng để chụp ảnh).
const STATE_SETS = {
  new: { tasks: () => [T('T-301', 'new', PRO, PRO, 2), T('T-302', 'new', ENG, ENG, 2), T('T-303', 'new', INS, INS, 2), T('T-304', 'new', COS, COS, 2)], exp: X({ pump: 1, column: 1, jet: 1, other: 1 }) },
  doing: { tasks: () => [T('T-311', 'doing', PRO, PRO, 24.5), T('T-312', 'doing', ENG, ENG, 24), T('T-313', 'doing', INS, INS, 2), T('T-314', 'doing', COS, COS, 2)], exp: X({ pump: 1, column: 1, jet: 1, other: 1, stuck: { column: 1 } }) },
  review: { tasks: () => [T('T-321', 'review', ENG, 'reviewer', 2, 'A'), T('T-322', 'review', PRO, 'reviewer', 2, 'B'), T('T-323', 'review', INS, 'reviewer', 2, 'C'), T('T-324', 'review', COS, 'reviewer', 2, '')], exp: X({ filter: 4, tiers: [1, 1, 1, 1] }) },
  rework: { tasks: () => [T('T-331', 'rework', PRO, PRO, 2), T('T-332', 'rework', ENG, ENG, 2), T('T-333', 'rework', INS, INS, 2), T('T-334', 'rework', COS, COS, 2)], exp: X({ pump: 1, column: 1, jet: 1, other: 1 }) },
  spec: { tasks: () => [T('T-341', 'spec', ENG, PRO, 2), T('T-342', 'spec', PRO, PRO, 2), T('T-343', 'spec', INS, PRO, 2)], exp: X({ column: 3, spec: 3 }) },
  blocked: { tasks: () => [T('T-351', 'blocked', PRO, COS, 50), T('T-352', 'blocked', ENG, COS, 50)], exp: X({ capu: 2, blocked: 2 }) },
  escalated: { tasks: () => [T('T-361', 'escalated', PRO, CAP, 2), T('T-362', 'escalated', ENG, CAP, 2)], exp: X({ capu: 2, escalated: 2 }) },
  done: { tasks: () => [T('T-371', 'done', PRO, '-', 10, 'A'), T('T-372', 'done', ENG, '-', 167, 'A'), T('T-373', 'done', INS, '-', 100, 'A'), T('T-374', 'done', PRO, '-', 169, 'A'), T('T-375', 'done', ENG, '-', 500, 'A')], exp: X({ pool: 3, return: 1 }) },
};

// ---------- trình duyệt ----------
const fixtureServer = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(fs.readFileSync(path.join(REPO, 'index.html'))); });
let browser;
async function open(viewport, data, opt = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: opt.dark ? 'dark' : 'light', reducedMotion: opt.reduce ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); page.setDefaultTimeout(4000);
  const o = { ctx, page, errors: [], reqs: [], sockets: 0, sock: null };
  page.on('console', m => { if (m.type() === 'error') o.errors.push(m.text()); }); page.on('pageerror', e => o.errors.push(String(e)));
  page.on('request', r => o.reqs.push(r.url()));
  await page.addInitScript(() => { window.__audio = 0; for (const k of ['Audio', 'AudioContext', 'webkitAudioContext']) { const C = window[k]; if (C) window[k] = function () { window.__audio++; return new C(...arguments); }; } });
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  await page.routeWebSocket(/\/ws$/, ws => { o.sockets++; o.sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto(`http://127.0.0.1:${fixtureServer.address().port}/index.html`);
  await page.waitForSelector('#flow svg'); await page.waitForTimeout(450);
  o.send = async m => { o.sock.send(JSON.stringify(m)); await page.waitForTimeout(250); };
  return o;
}
const liveEv = (id, task, event, from, to, extra = {}) => ({ type: 'event', id, t: iso(new Date()), task, event, from, to, round: 0, cost: 0, ...extra });

// ---------- đọc DOM ----------
const readFountain = page => page.evaluate(() => {
  const sec = document.querySelector('#dai-phun-nuoc'); if (!sec) return null;
  const f = (el, n) => { const x = el.querySelector(`[data-field="${n}"]`); return x ? x.textContent.trim() : null; };
  const paint = el => { if (!el) return null; const cs = getComputedStyle(el); return el instanceof SVGElement ? (cs.stroke !== 'none' ? cs.stroke : cs.fill) : cs.borderTopColor; };
  const fill = el => { if (!el) return null; const cs = getComputedStyle(el); return el instanceof SVGElement ? cs.fill : cs.color; };
  const box = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  const stages = [...sec.querySelectorAll('[data-stage]')].map(el => ({ id: el.dataset.stage, name: f(el, 'name'), count: f(el, 'count'),
    spec: f(el, 'spec'), stuck: f(el, 'stuck'), a: f(el, 'tier-a'), b: f(el, 'tier-b'), c: f(el, 'tier-c'), none: f(el, 'tier-none'),
    regression: f(el, 'regression'), warn: el.getAttribute('data-warn'), frame: paint(el.querySelector('[data-field="frame"]')),
    stuckColor: fill(el.querySelector('[data-field="stuck"]')), specColor: fill(el.querySelector('[data-field="spec"]')), box: box(el) }));
  const lane = sec.querySelector('[data-lane="capu"]');
  const root = getComputedStyle(document.documentElement);
  return { stages, secBox: box(sec), other: f(sec, 'other'), vars: { warn: root.getPropertyValue('--warn').trim(), bad: root.getPropertyValue('--bad').trim(), spec: root.getPropertyValue('--spec').trim(), accent: root.getPropertyValue('--accent').trim(), ok: root.getPropertyValue('--ok').trim() },
    lane: lane ? { name: f(lane, 'name'), count: f(lane, 'count'), blocked: f(lane, 'blocked'), escalated: f(lane, 'escalated'), warn: lane.getAttribute('data-warn'), frame: paint(lane.querySelector('[data-field="frame"]')), box: box(lane) } : null };
});
const readChars = page => page.evaluate(() => {
  const fl = document.querySelector('#flow').getBoundingClientRect();
  const out = {};
  document.querySelectorAll('.chr[data-agent]').forEach(c => { const r = c.getBoundingClientRect(); const a = c.querySelector('.chr-anim');
    const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(c.parentNode.getAttribute('transform') || '');
    out[c.dataset.agent] = { state: c.dataset.state, x: r.x - fl.x, y: r.y - fl.y, w: r.width, h: r.height, cx: m ? +m[1] : NaN, cy: m ? +m[2] : NaN, sprite: a ? a.innerHTML : '' }; });
  return { chars: out, flow: { w: fl.width, h: fl.height } };
});
const readLabels = page => page.evaluate(() => [...document.querySelectorAll('#flow [data-label]')].map(el => { const r = el.getBoundingClientRect();
  return { label: el.dataset.label, agent: el.dataset.agent || '', from: el.dataset.from || '', to: el.dataset.to || '', text: el.textContent.trim(), x: r.x, y: r.y, w: r.width, h: r.height }; }));
const readEdges = page => page.evaluate(() => [...document.querySelectorAll('#flow .run-edge')].map((p, i) => ({ i, kind: p.dataset.kind || '', from: p.dataset.from, to: p.dataset.to, stroke: getComputedStyle(p).stroke, d: p.getAttribute('d') })));
async function hoverEdge(page, i) { // gửi mousemove thẳng vào đường (tránh bị đường/nút khác che trên màn hình)
  await page.evaluate(i => { const p = document.querySelectorAll('#flow .run-edge')[i]; const q = p.getPointAtLength(p.getTotalLength() / 2); const m = p.getScreenCTM();
    p.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: m.a * q.x + m.c * q.y + m.e, clientY: m.b * q.x + m.d * q.y + m.f })); }, i);
  await page.waitForTimeout(120);
  return page.evaluate(() => { const t = document.querySelector('#flow .tip'); return t ? t.textContent : ''; });
}
const num = s => { const m = /(\d+)\s*$/.exec(s || ''); return m ? +m[1] : NaN; };
const hexRgb = h => { const m = /^#([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const STAGES = [['pump', 'Máy bơm'], ['column', 'Thân cột'], ['jet', 'Tia'], ['filter', 'Lưới lọc'], ['pool', 'Bể'], ['return', 'Ống hồi']];

function compareFountain(F, exp, label, bad) {
  if (!F) { bad.push(`${label}: không có #dai-phun-nuoc`); return; }
  const by = Object.fromEntries(F.stages.map(s => [s.id, s]));
  for (const [id] of STAGES) {
    const s = by[id]; if (!s) { bad.push(`${label}: thiếu tầng ${id}`); continue; }
    if (num(s.count) !== exp[id]) bad.push(`${label}: tầng ${id} hiện "${s.count}", phải là ${exp[id]}`);
  }
  if (!F.lane) bad.push(`${label}: thiếu [data-lane="capu"]`);
  else {
    if (num(F.lane.count) !== exp.capu) bad.push(`${label}: phía Capu hiện "${F.lane.count}", phải là ${exp.capu}`);
    if (exp.blocked && num(F.lane.blocked) !== exp.blocked) bad.push(`${label}: bị chặn hiện "${F.lane.blocked}", phải là ${exp.blocked}`);
    if (exp.escalated && num(F.lane.escalated) !== exp.escalated) bad.push(`${label}: leo thang hiện "${F.lane.escalated}", phải là ${exp.escalated}`);
  }
  if (num(F.other) !== exp.other) bad.push(`${label}: ngoài đài hiện "${F.other}", phải là ${exp.other}`);
  if (by.column && exp.spec !== (by.column.spec ? num(by.column.spec) : 0)) bad.push(`${label}: nhãn về spec hiện "${by.column.spec}", phải là ${exp.spec}`);
  if (by.filter) exp.tiers.forEach((n, i) => { const k = ['a', 'b', 'c', 'none'][i]; if (num(by.filter[k]) !== n) bad.push(`${label}: bậc ${'ABC?'[i]} hiện "${by.filter[k]}", phải là ${n}`); });
}

// ---------- các tiêu chí ----------
const checks = {};

checks[1] = async () => { // Insight có nhân vật riêng; ba vị trí chưa tuyển vẫn bóng mờ; chín vị trí cũ không đổi chỗ
  const bad = [];
  const base = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) : null;
  if (!base) bad.push('thiếu eval/T-020/baseline-positions.json');
  for (const [vn, vp] of [['wide', WIDE], ['narrow', NARROW]]) {
    const o = await open(vp, mainData()); const { chars, flow } = await readChars(o.page);
    const ins = chars[INS];
    if (!ins) bad.push(`${vn}: không có nhân vật .chr[data-agent="insight"]`);
    else {
      if (ins.state !== 'working') bad.push(`${vn}: insight có việc đang làm phải ở trạng thái working, thấy "${ins.state}"`);
      for (const [id, c] of Object.entries(chars)) {
        if (id === INS) continue;
        if (c.sprite === ins.sprite) bad.push(`${vn}: sprite insight trùng sprite của ${id}`);
        if (overlap(c, ins) > 1) bad.push(`${vn}: insight đè lên ${id}`);
      }
      if (ins.x < 0 || ins.x + ins.w > flow.w || ins.y < 0 || ins.y + ins.h > flow.h) bad.push(`${vn}: insight nằm ngoài khung bản đồ`);
      const cos = chars[COS];
      if (cos && (Math.abs(ins.cy - cos.cy) > 1 || ins.cx > cos.cx - 40)) bad.push(`${vn}: insight phải cùng hàng và nằm bên trái Chief of Staff`);
      if (Math.abs(ins.cx / flow.w - 0.2) > 0.01) bad.push(`${vn}: tâm insight phải ở 20% bề ngang bản đồ, thấy ${(ins.cx / flow.w * 100).toFixed(1)}%`);
    }
    const ghosts = HIRING.map(id => chars[id]).filter(Boolean);
    if (ghosts.length !== 3 || ghosts.some(g => g.state !== 'hiring')) bad.push(`${vn}: Vendor Ops, Growth, Finance phải còn là bóng mờ (hiring)`);
    if (ghosts.length === 3 && new Set(ghosts.map(g => g.sprite)).size !== 1) bad.push(`${vn}: ba bóng mờ phải dùng cùng một sprite`);
    if (ins && ghosts[0] && ins.sprite === ghosts[0].sprite) bad.push(`${vn}: sprite insight giống bóng mờ`);
    if (base) for (const [id, b] of Object.entries(base[vn] || {})) {
      const c = chars[id]; if (!c) { bad.push(`${vn}: mất nhân vật ${id}`); continue; }
      if (Math.abs(c.cx - b.cx) > 1 || Math.abs(c.cy - b.cy) > 1) bad.push(`${vn}: ${id} đã dời chỗ (${c.cx.toFixed(1)},${c.cy.toFixed(1)}) so với (${b.cx},${b.cy})`);
    }
    // insight chưa tuyển thì cũng là bóng mờ
    const d3 = mainData(); d3.roster = d3.roster.filter(r => r.id !== INS);
    const p3 = await open(vp, d3); const c3 = (await readChars(p3.page)).chars;
    if (c3[INS]) bad.push(`${vn}: roster không có insight thì không được vẽ nút insight (tests/characters.js của T-019 đếm 9 nhân vật)`);
    await p3.ctx.close();
    const d2 = mainData(); d2.roster.find(r => r.id === INS).status = 'Need Hiring';
    const p2 = await open(vp, d2); const c2 = (await readChars(p2.page)).chars;
    if (!c2[INS] || c2[INS].state !== 'hiring') bad.push(`${vn}: insight Need Hiring phải là bóng mờ`);
    await p2.ctx.close(); await o.ctx.close();
  }
  if (bad.length) throw new Error(bad.slice(0, 6).join(' ; '));
};

checks[2] = async () => { // nhãn vai lấy từ roster, không hardcode; xếp đúng chỗ, không đè nhau
  const bad = [];
  for (const [vn, vp] of [['wide', WIDE], ['narrow', NARROW]]) {
    const o = await open(vp, mainData());
    await o.send({ type: 'activity', agent: ENG, action: 'Viết code', at: Date.now() });
    const L = await readLabels(o.page);
    for (const r of realRoster) {
      const role = L.find(l => l.label === 'role' && l.agent === r.id);
      if (!role) { bad.push(`${vn}: thiếu nhãn vai của ${r.id}`); continue; }
      if (role.text !== r.role) bad.push(`${vn}: nhãn vai ${r.id} là "${role.text}", roster ghi "${r.role}"`);
      const name = L.find(l => l.label === 'name' && l.agent === r.id);
      if (!name) bad.push(`${vn}: thiếu nhãn tên ${r.id}`);
      else {
        if (role.y < name.y + name.h - 1.5) bad.push(`${vn}: nhãn vai ${r.id} phải nằm ngay dưới tên`);
        if (Math.abs((role.x + role.w / 2) - (name.x + name.w / 2)) > 3) bad.push(`${vn}: nhãn vai ${r.id} lệch tâm so với tên`);
      }
    }
    if (L.some(l => l.label === 'role' && l.agent === 'done')) bad.push(`${vn}: nút Hoàn thành không có nhãn vai`);
    const hire = L.find(l => l.label === 'hiring' && l.agent === 'vendor-ops'), role = L.find(l => l.label === 'role' && l.agent === 'vendor-ops');
    if (!hire) bad.push(`${vn}: thiếu nhãn "Need Hiring" (data-label="hiring") của vendor-ops`);
    else if (role && hire.y < role.y + role.h - 1.5) bad.push(`${vn}: "Need Hiring" phải nằm dưới nhãn vai`);
    const act = L.find(l => l.label === 'action' && l.agent === ENG), erole = L.find(l => l.label === 'role' && l.agent === ENG);
    if (!act) bad.push(`${vn}: thiếu nhãn hành động (data-label="action") của engineering`);
    else if (erole && act.y < erole.y + erole.h - 1.5) bad.push(`${vn}: nhãn hành động phải nằm dưới nhãn vai`);
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++)
      if (!['tier', 'await-merge', 'spec-edge'].includes(L[i].label) && !['tier', 'await-merge', 'spec-edge'].includes(L[j].label) && overlap(L[i], L[j]) > 1)
        bad.push(`${vn}: nhãn "${L[i].text}" đè nhãn "${L[j].text}"`);
    await o.ctx.close();
  }
  const o = await open(WIDE, { ...mainData(), roster: roster({ [PRO]: 'Vai thử nghiệm đổi' }) });
  const r = (await readLabels(o.page)).find(l => l.label === 'role' && l.agent === PRO);
  if (!r || r.text !== 'Vai thử nghiệm đổi') bad.push('đổi role của product trong dữ liệu mà nhãn không đổi theo (đang hardcode)');
  await o.ctx.close();
  if (bad.length) throw new Error(bad.slice(0, 6).join(' ; '));
};

checks[3] = async () => { // trạng thái spec: đường Reviewer → Product màu riêng; Product có cử động riêng
  const bad = [];
  const o = await open(WIDE, mainData());
  const edges = await readEdges(o.page);
  const spec = edges.filter(e => e.kind === 'spec'), rew = edges.filter(e => e.kind === 'rework'), run = edges.filter(e => e.kind === 'run' || e.kind === 'review');
  if (spec.length !== 1) bad.push(`phải có đúng 1 đường data-kind="spec", thấy ${spec.length}`);
  else {
    const s = spec[0];
    if (s.from !== 'reviewer' || s.to !== PRO) bad.push(`đường spec phải đi reviewer → product, thấy ${s.from} → ${s.to}`);
    const rv = hexRgb((await readFountain(o.page) || { vars: {} }).vars.spec);
    if (!rv) bad.push('thiếu biến màu --spec (#7a4fc4 ở nền sáng)');
    else if (s.stroke !== rv) bad.push(`đường spec tô ${s.stroke}, phải là --spec ${rv}`);
    if (rv !== hexRgb('#7a4fc4')) bad.push(`--spec ở nền sáng phải là #7a4fc4, thấy ${(await readFountain(o.page) || { vars: {} }).vars.spec}`);
    if (rew.length && rew.some(r => r.stroke === s.stroke)) bad.push('màu đường spec trùng màu đường rework');
    if (run.some(r => r.stroke === s.stroke)) bad.push('màu đường spec trùng màu đường chạy/review');
    const rp = rew.find(r => r.from === 'reviewer' && r.to === PRO);
    if (!rp) bad.push('fixture có rework của product nhưng không thấy đường rework reviewer → product');
    else if (rp.d === s.d) bad.push('đường rework và đường spec cùng hai đầu phải là hai đường tách nhau (khác hình)');
    const lab = (await readLabels(o.page)).find(l => l.label === 'spec-edge');
    if (!lab || lab.text !== 'Về spec ×2') bad.push(`nhãn đường spec (data-label="spec-edge") phải là "Về spec ×2", thấy "${lab && lab.text}"`);
    const tip = await hoverEdge(o.page, s.i);
    if (!/T-204/.test(tip) || !/T-205/.test(tip) || !/Về spec/.test(tip)) bad.push(`tooltip đường spec phải liệt kê T-204, T-205 và "Về spec", thấy "${tip}"`);
  }
  const anims = async (page, id) => page.evaluate(id => { const c = document.querySelector(`.chr[data-agent="${id}"]`); const s = new Set();
    [c, ...c.querySelectorAll('*')].forEach(e => { const n = getComputedStyle(e).animationName; if (n && n !== 'none') s.add(n); }); return { state: c.dataset.state, names: [...s].sort() }; }, id);
  const rev = await anims(o.page, PRO);
  if (rev.state !== 'revising') bad.push(`Product có việc spec phải ở data-state="revising", thấy "${rev.state}"`);
  if (!rev.names.length) bad.push('trạng thái revising của Product không có chuyển động nào');
  await o.page.hover('.chr[data-agent="product"]', { force: true }); await o.page.waitForTimeout(150);
  const tip = await o.page.$eval('#flow .tip', e => e.textContent);
  if (!/Đang sửa spec/.test(tip)) bad.push(`tooltip Product phải có "Đang sửa spec", thấy "${tip}"`);
  // priority: việc nhất thời thắng revising
  await o.send(liveEv('LV1', 'T-201', 'assigned', COS, PRO, { state: 'new', holder: PRO }));
  const rc = await o.page.$eval('.chr[data-agent="product"]', e => e.dataset.state);
  if (rc !== 'receiving') bad.push(`Product vừa nhận việc phải ở receiving (thắng revising), thấy "${rc}"`);
  await o.ctx.close();
  // không có việc spec: Product working, không có đường spec, chuyển động khác revising
  const d = bundle(STATE_SETS.doing.tasks()); const w = await open(WIDE, d);
  const wk = await anims(w.page, PRO); const sp = (await readEdges(w.page)).filter(e => e.kind === 'spec');
  if (wk.state !== 'working') bad.push(`Product không có việc spec, có việc đang làm phải là working, thấy "${wk.state}"`);
  if (sp.length) bad.push('không có việc spec mà vẫn vẽ đường spec');
  if (JSON.stringify(wk.names) === JSON.stringify(rev.names)) bad.push(`chuyển động revising (${rev.names}) trùng working (${wk.names})`);
  await w.ctx.close();
  if (bad.length) throw new Error(bad.slice(0, 6).join(' ; '));
};

checks[4] = async () => { // bậc A/B/C trên đường tới Reviewer và tooltip; bậc C có nhãn "chờ anh merge"
  const bad = [];
  for (const [vn, vp] of [['wide', WIDE], ['narrow', NARROW]]) {
    const o = await open(vp, mainData());
    const edges = await readEdges(o.page), L = await readLabels(o.page);
    const eng = edges.find(e => e.kind === 'review' && e.from === ENG && e.to === 'reviewer');
    const pro = edges.find(e => e.kind === 'review' && e.from === PRO && e.to === 'reviewer');
    if (!eng || !pro) { bad.push(`${vn}: thiếu đường review (data-kind="review") engineering→reviewer hoặc product→reviewer`); await o.ctx.close(); continue; }
    const tier = (a, b) => L.find(l => l.label === 'tier' && l.from === a && l.to === b);
    const wm = (a, b) => L.find(l => l.label === 'await-merge' && l.from === a && l.to === b);
    const te = tier(ENG, 'reviewer'), tp = tier(PRO, 'reviewer');
    if (!te || te.text !== 'A·C') bad.push(`${vn}: nhãn bậc đường engineering→reviewer phải là "A·C", thấy "${te && te.text}"`);
    if (!tp || tp.text !== 'B·?') bad.push(`${vn}: nhãn bậc đường product→reviewer phải là "B·?", thấy "${tp && tp.text}"`);
    const we = wm(ENG, 'reviewer');
    if (!we || we.text !== 'chờ anh merge') bad.push(`${vn}: đường có việc bậc C phải có nhãn "chờ anh merge", thấy "${we && we.text}"`);
    if (wm(PRO, 'reviewer')) bad.push(`${vn}: đường không có việc bậc C không được có nhãn "chờ anh merge"`);
    if (vn === 'wide') {
      const t1 = await hoverEdge(o.page, eng.i);
      for (const [id, s] of [['T-221', 'Bậc A'], ['T-223', 'Bậc C'], ['T-225', 'Bậc A']]) if (!new RegExp(id + '[^]*' + s).test(t1)) bad.push(`tooltip đường engineering→reviewer thiếu "${id} … ${s}"`);
      if (!/chờ anh merge/.test(t1)) bad.push('tooltip việc bậc C thiếu "chờ anh merge"');
      const t2 = await hoverEdge(o.page, pro.i);
      if (!/T-222[^]*Bậc B/.test(t2) || !/T-224[^]*Bậc \?/.test(t2)) bad.push(`tooltip đường product→reviewer phải có "T-222 … Bậc B" và "T-224 … Bậc ?", thấy "${t2}"`);
      if (/chờ anh merge/.test(t2)) bad.push('tooltip không có việc C mà vẫn ghi "chờ anh merge"');
    }
    await o.ctx.close();
  }
  if (bad.length) throw new Error(bad.slice(0, 6).join(' ; '));
};

checks[5] = async () => { // giữ mọi thứ của T-019
  const bad = [];
  for (const [vn, vp] of [['wide', WIDE], ['narrow', NARROW]]) {
    const o = await open(vp, mainData());
    const s = await o.page.evaluate(() => ({ ah: document.querySelectorAll('#flow path[marker-end="url(#ah)"]').length, ar: document.querySelectorAll('#flow path[marker-end="url(#ar)"]').length,
      glow: document.querySelectorAll('#flow .run-glow').length, flowp: document.querySelectorAll('#flow .run-flow').length, over: document.documentElement.scrollWidth - innerWidth,
      badges: [...document.querySelectorAll('.chr[data-agent]')].map(c => ({ id: c.dataset.agent, t: (c.parentNode.querySelector('.wip-badge text') || {}).textContent })),
      hasLive: !!document.querySelector('#flow-live') }));
    if (s.ah !== 4) bad.push(`${vn}: đường bàn giao (mũi tên xám) phải là 4, thấy ${s.ah}`);
    if (s.ar !== 2) bad.push(`${vn}: đường trả về (nét đứt đỏ) phải là 2, thấy ${s.ar}`);
    if (s.glow < 1 || s.flowp < 1) bad.push(`${vn}: mất run-glow hoặc run-flow`);
    for (const b of s.badges) {
      if (b.id === 'done') continue;
      const m = realRoster.find(r => r.id === b.id); if (!m) continue;
      const want = HIRING.includes(b.id) ? '?' : String(mainTasks().filter(t => t.state !== 'done' && t.holder === b.id).length);
      if (b.t !== want) bad.push(`${vn}: huy hiệu số việc của ${b.id} là "${b.t}", phải là "${want}"`);
    }
    if (vn === 'narrow' && s.over > 1) bad.push(`narrow: trang tràn ngang ${s.over}px ở 390px`);
    await o.page.hover('.chr[data-agent="reviewer"]', { force: true }); await o.page.waitForTimeout(150);
    const tip = await o.page.$eval('#flow .tip', e => e.textContent);
    if (!/Trạng thái/.test(tip) || !/Đang giữ/.test(tip)) bad.push(`${vn}: tooltip nhân vật phải có "Đang giữ" và "Trạng thái", thấy "${tip}"`);
    await o.send({ type: 'activity', agent: ENG, action: 'Viết code', at: Date.now() });
    if (!(await o.page.$('#flow .act-ring'))) bad.push(`${vn}: mất vòng act-ring khi agent đang hoạt động`);
    // nhân vật phản ứng với kênh live
    await o.send(liveEv('LV2', 'T-213', 'rejected', 'reviewer', ENG, { state: 'rework', holder: ENG }));
    const st = await o.page.$eval('.chr[data-agent="engineering"]', e => e.dataset.state);
    if (st !== 'upset') bad.push(`${vn}: engineering bị trả về phải upset, thấy "${st}"`);
    if (o.errors.length) bad.push(`${vn}: lỗi console: ${o.errors[0]}`);
    await o.ctx.close();
    const r = await open(vp, mainData(), { reduce: true });
    const n = await r.page.$$eval('#ban-do-luong *', els => els.filter(e => getComputedStyle(e).animationName !== 'none').length);
    if (n) bad.push(`${vn}: reduced-motion còn ${n} phần tử đang có animation trong Bản đồ luồng`);
    if (r.errors.length) bad.push(`${vn}: lỗi console (reduced-motion): ${r.errors[0]}`);
    await r.ctx.close();
  }
  const ch = path.join(REPO, 'tests', 'characters.js');
  if (fs.existsSync(ch)) {
    const r = cp.spawnSync('node', [ch], { cwd: REPO, env: { ...process.env, D3, OUT: fs.mkdtempSync('/tmp/t020-chr-') }, encoding: 'utf8', timeout: 120000 });
    if (r.status !== 0) bad.push('tests/characters.js (T-019) không còn qua: ' + ((r.stdout || '').split('\n').find(l => l.startsWith('FAIL')) || r.stderr.slice(0, 120)));
  } else bad.push('thiếu tests/characters.js của T-019');
  if (bad.length) throw new Error(bad.slice(0, 6).join(' ; '));
};

checks[6] = async () => { // sáu tầng, đếm đúng theo từng trạng thái và từng owner
  const bad = [];
  const o = await open(WIDE, mainData()); const F = await readFountain(o.page);
  if (F) {
    if (F.stages.map(s => s.id).join() !== STAGES.map(s => s[0]).join()) bad.push('sáu tầng phải theo đúng thứ tự pump, column, jet, filter, pool, return trong DOM');
    F.stages.forEach((s, i) => { if (STAGES[i] && s.name !== STAGES[i][1]) bad.push(`tên tầng ${i + 1} phải là "${STAGES[i][1]}", thấy "${s.name}"`); });
    for (let i = 1; i < F.stages.length; i++) { const a = F.stages[i - 1].box, b = F.stages[i].box;
      if (!(b.y >= a.y + a.h - 2 || b.x >= a.x + a.w - 2)) bad.push(`tầng ${i + 1} phải nằm sau tầng ${i} (bên phải hoặc bên dưới)`); }
    if (F.stages.some(s => s.box.w < 8 || s.box.h < 8)) bad.push('có tầng không hiển thị');
    if (F.lane && F.lane.name !== 'Phía Capu') bad.push(`khối phía Capu phải đề "Phía Capu", thấy "${F.lane.name}"`);
  }
  compareFountain(F, MAIN_EXPECT, 'dữ liệu chính', bad);
  await o.ctx.close();
  for (const [name, set] of Object.entries(STATE_SETS)) {
    const p = await open(WIDE, bundle(set.tasks(), { regression_evals: 1 }));
    compareFountain(await readFountain(p.page), set.exp, 'trạng thái ' + name, bad);
    await p.ctx.close();
  }
  if (bad.length) throw new Error(bad.slice(0, 6).join(' ; '));
};

checks[7] = async () => { // tô màu cảnh báo: đứng yên > 24 giờ và việc spec
  const bad = [];
  const o = await open(WIDE, mainData()); const F = await readFountain(o.page);
  if (!F) throw new Error('không có #dai-phun-nuoc');
  const by = Object.fromEntries(F.stages.map(s => [s.id, s]));
  const warn = hexRgb(F.vars.warn), spec = hexRgb(F.vars.spec), badc = hexRgb(F.vars.bad);
  if (!spec) bad.push('thiếu biến --spec');
  const want = { pump: '', column: 'stuck spec', jet: '', filter: 'stuck', pool: '', return: '' };
  for (const [id, w] of Object.entries(want)) { const got = ((by[id] || {}).warn || '').split(/\s+/).filter(Boolean).sort().join(' ');
    if (got !== w.split(' ').filter(Boolean).sort().join(' ')) bad.push(`tầng ${id}: data-warn phải là "${w}", thấy "${(by[id] || {}).warn}"`); }
  if (by.column) {
    if (by.column.stuck !== 'đứng yên 2') bad.push(`tầng Thân cột: nhãn đứng yên phải là "đứng yên 2", thấy "${by.column.stuck}"`);
    if (by.column.spec !== 'về spec 2') bad.push(`tầng Thân cột: nhãn về spec phải là "về spec 2", thấy "${by.column.spec}"`);
    if (by.column.frame !== spec) bad.push(`khung Thân cột (có spec) phải tô --spec ${spec}, thấy ${by.column.frame}`);
    if (by.column.specColor !== spec) bad.push('chữ "về spec" phải tô --spec');
    if (by.column.stuckColor !== warn) bad.push('chữ "đứng yên" phải tô --warn');
  }
  if (by.filter) {
    if (by.filter.stuck !== 'đứng yên 1') bad.push(`tầng Lưới lọc: nhãn phải là "đứng yên 1", thấy "${by.filter.stuck}"`);
    if (by.filter.frame !== warn) bad.push(`khung Lưới lọc (đứng yên) phải tô --warn ${warn}, thấy ${by.filter.frame}`);
    if (by.filter.spec) bad.push('Lưới lọc không có việc spec mà có nhãn về spec');
  }
  for (const id of ['pump', 'jet', 'pool', 'return']) if (by[id]) {
    if (by[id].stuck || by[id].spec) bad.push(`tầng ${id}: không được có nhãn cảnh báo`);
    if ([warn, spec, badc].includes(by[id].frame)) bad.push(`tầng ${id} không cảnh báo mà khung tô màu cảnh báo (${by[id].frame})`);
  }
  if (F.lane) {
    if (F.lane.warn !== 'capu') bad.push(`phía Capu có việc phải data-warn="capu", thấy "${F.lane.warn}"`);
    if (F.lane.frame !== badc) bad.push(`khung phía Capu phải tô --bad ${badc}, thấy ${F.lane.frame}`);
  }
  if (new Set([warn, spec, badc, hexRgb(F.vars.accent), hexRgb(F.vars.ok)]).size !== 5) bad.push('--spec phải khác --warn, --bad, --accent, --ok');
  await o.ctx.close();
  // ranh giới 24 giờ: 24,0 không đứng yên, 24,5 đứng yên (bộ "doing")
  const d = await open(WIDE, bundle(STATE_SETS.doing.tasks())); const D = await readFountain(d.page);
  const dby = Object.fromEntries(((D || { stages: [] }).stages).map(s => [s.id, s]));
  if (!dby.column || dby.column.stuck !== 'đứng yên 1') bad.push(`ranh giới: Thân cột (24,5 giờ) phải "đứng yên 1", thấy "${dby.column && dby.column.stuck}"`);
  if (dby.jet && dby.jet.stuck) bad.push('ranh giới: Tia (đúng 24 giờ) không được đứng yên');
  await d.ctx.close();
  // việc đã xong và việc blocked/escalated không bao giờ làm tầng đứng yên
  for (const name of ['done', 'blocked']) { const p = await open(WIDE, bundle(STATE_SETS[name].tasks(), { regression_evals: 1 })); const G = await readFountain(p.page);
    if (G && G.stages.some(s => s.warn || s.stuck || s.spec)) bad.push(`bộ "${name}": không tầng nào được cảnh báo`);
    if (name === 'blocked' && G && G.lane && G.lane.warn !== 'capu') bad.push('bộ "blocked": phía Capu phải cảnh báo');
    await p.ctx.close(); }
  if (bad.length) throw new Error(bad.slice(0, 6).join(' ; '));
};

checks[8] = async () => { // số eval hồi quy ở Bể; thiếu thì "—", không lỗi
  const bad = [];
  const cases = [[12, '12'], [0, '0'], [undefined, '—'], [null, '—'], ['12', '—'], [-1, '—'], [1.5, '—'], [true, '—']];
  for (const [v, want] of cases) {
    const extra = v === undefined ? {} : { regression_evals: v };
    const o = await open(WIDE, mainData(extra)); const F = await readFountain(o.page);
    const pool = F && F.stages.find(s => s.id === 'pool');
    if (!pool) bad.push('không có tầng pool');
    else if (pool.regression !== want) bad.push(`regression_evals=${JSON.stringify(v)} phải hiện "${want}", thấy "${pool.regression}"`);
    if (o.errors.length) bad.push(`regression_evals=${JSON.stringify(v)}: lỗi console ${o.errors[0]}`);
    await o.ctx.close();
  }
  const legacy = mainData({}); legacy.tasks.forEach(t => delete t.tier);
  const o = await open(WIDE, legacy); const F = await readFountain(o.page);
  if (!F) bad.push('dữ liệu cũ (không tier, không regression_evals): không có #dai-phun-nuoc');
  else { const f = F.stages.find(s => s.id === 'filter');
    if (!f || num(f.count) !== 5 || num(f.none) !== 5 || num(f.a) !== 0) bad.push(`dữ liệu cũ: Lưới lọc phải đếm 5 việc, cả 5 ở "?", thấy count=${f && f.count} none=${f && f.none}`); }
  if (o.errors.length) bad.push('dữ liệu cũ: lỗi console ' + o.errors[0]);
  await o.ctx.close();
  if (bad.length) throw new Error(bad.slice(0, 6).join(' ; '));
};

checks[9] = async () => { // cùng nguồn + realtime; 390px; reduced-motion; không thư viện ngoài; không âm thanh
  const bad = [];
  const o = await open(WIDE, mainData());
  const before = await readFountain(o.page);
  if (!before) throw new Error('không có #dai-phun-nuoc');
  // realtime: T-201 (product, new) chuyển sang review qua kênh live
  await o.send(liveEv('LV9', 'T-201', 'handoff', PRO, 'reviewer', { state: 'review', holder: 'reviewer' }));
  const after = await readFountain(o.page);
  const g = (F, id) => F.stages.find(s => s.id === id);
  if (num(g(after, 'column').count) !== 4 || num(g(after, 'filter').count) !== 6) bad.push(`realtime: sau sự kiện live Thân cột phải 4 và Lưới lọc 6, thấy ${g(after, 'column').count}/${g(after, 'filter').count}`);
  if (num(g(after, 'filter').none) !== 2) bad.push(`realtime: T-201 không có bậc nên "?" phải tăng từ 1 lên 2, thấy ${g(after, 'filter').none}`);
  await o.send(liveEv('LV10', 'T-241', 'unblocked', COS, ENG, { state: 'doing', holder: ENG }));
  const a2 = await readFountain(o.page);
  if (num(a2.lane.count) !== 2 || num(g(a2, 'jet').count) !== 4) bad.push(`realtime: gỡ chặn T-241 phải còn 2 ở phía Capu và Tia 4, thấy ${a2.lane.count}/${g(a2, 'jet').count}`);
  if (o.sockets !== 1) bad.push(`phải dùng chung một kết nối live, thấy ${o.sockets}`);
  const urls = o.reqs.filter(u => /^https?:/.test(u));
  const hosts = new Set(urls.map(u => new URL(u).hostname));
  for (const h of hosts) if (!ALLOWED_HOSTS.includes(h)) bad.push('gọi ra ngoài nguồn cho phép: ' + h);
  const data = urls.filter(u => u.includes('raw.githubusercontent.com')).map(u => u.split('?')[0]);
  if (new Set(data).size !== 1) bad.push('phải chỉ có một nguồn dashboard.json, thấy ' + [...new Set(data)].join(', '));
  const scripts = await o.page.$$eval('script[src]', s => s.map(x => x.src));
  if (scripts.length !== 1 || !/d3/.test(scripts[0])) bad.push('chỉ được có một script ngoài (d3): ' + scripts.join(', '));
  const media = await o.page.evaluate(() => ({ n: document.querySelectorAll('audio,video,embed,object').length, audio: window.__audio }));
  if (media.n || media.audio) bad.push(`không âm thanh: audio/video=${media.n}, gọi Audio/AudioContext=${media.audio}`);
  await o.ctx.close();
  // 390px
  const n = await open(NARROW, mainData()); const F = await readFountain(n.page);
  if (F) {
    const sb = F.secBox;
    for (const s of F.stages) { if (s.box.x < sb.x - 1 || s.box.x + s.box.w > sb.x + sb.w + 1) bad.push(`390px: tầng ${s.id} tràn ngoài khung`); }
    for (let i = 0; i < F.stages.length; i++) for (let j = i + 1; j < F.stages.length; j++) if (overlap(F.stages[i].box, F.stages[j].box) > 1) bad.push(`390px: tầng ${F.stages[i].id} đè tầng ${F.stages[j].id}`);
    if (F.lane && F.stages.some(s => overlap(s.box, F.lane.box) > 1)) bad.push('390px: khối phía Capu đè lên một tầng');
  }
  const over = await n.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (over > 1) bad.push(`390px: trang tràn ngang ${over}px`);
  if (n.errors.length) bad.push('lỗi console: ' + n.errors[0]);
  await n.ctx.close();
  // reduced-motion
  for (const vp of [WIDE, NARROW]) {
    const r = await open(vp, mainData(), { reduce: true });
    const cnt = await r.page.$$eval('#dai-phun-nuoc, #dai-phun-nuoc *', els => els.filter(e => getComputedStyle(e).animationName !== 'none').length);
    if (cnt) bad.push(`reduced-motion: ${cnt} phần tử trong Đài phun nước còn animation`);
    await r.ctx.close();
  }
  if (bad.length) throw new Error(bad.slice(0, 6).join(' ; '));
};

const SHOT_SETS = [...Object.keys(STATE_SETS), 'all'];
const SHOT_NAMES = SHOT_SETS.flatMap(s => ['flow', 'fountain'].flatMap(p => ['wide', 'narrow'].map(v => `${s}-${p}-${v}.png`)));
async function takeShots(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const miss = [];
  for (const set of SHOT_SETS) for (const [vn, vp] of [['wide', WIDE], ['narrow', NARROW]]) {
    const data = set === 'all' ? mainData() : bundle(STATE_SETS[set].tasks(), { regression_evals: 12 });
    const o = await open(vp, data);
    for (const [panel, sel] of [['flow', '#ban-do-luong'], ['fountain', '#dai-phun-nuoc']]) {
      const el = await o.page.$(sel);
      if (!el) { miss.push(`${set}-${panel}-${vn}: không có ${sel}`); continue; }
      await o.page.waitForTimeout(200); await el.screenshot({ path: path.join(dir, `${set}-${panel}-${vn}.png`) });
    }
    await o.ctx.close();
  }
  return miss;
}
checks[10] = async () => { // ảnh chụp từng trạng thái của cả hai bảng đã commit trong repo
  const root = path.join(REPO, 'docs', 'screenshots');
  const dirs = fs.existsSync(root) ? fs.readdirSync(root).filter(d => /^T-\d+$/.test(d) && (!TASK || d === TASK)) : [];
  if (!dirs.length) throw new Error(`không có docs/screenshots/${TASK || 'T-xxx'}/ trong repo`);
  const reasons = [];
  for (const d of dirs) {
    const bad = [];
    for (const f of SHOT_NAMES) {
      const p = path.join(root, d, f);
      if (!fs.existsSync(p)) { bad.push('thiếu ' + f); continue; }
      const b = fs.readFileSync(p);
      if (b.length < 3000 || b.readUInt32BE(0) !== 0x89504e47) bad.push(`${f} không phải PNG hợp lệ`);
      else if (b.readUInt32BE(16) < (f.endsWith('narrow.png') ? 300 : 700)) bad.push(`${f} quá hẹp`);
      const tracked = cp.spawnSync('git', ['-C', REPO, 'ls-files', '--error-unmatch', path.relative(REPO, p)], { encoding: 'utf8' });
      if (tracked.status !== 0) bad.push(`${f} chưa được git theo dõi (commit chưa?)`);
    }
    if (!bad.length) return;
    reasons.push(`${d}: ${bad.slice(0, 4).join(', ')}${bad.length > 4 ? ` (+${bad.length - 4})` : ''}`);
  }
  throw new Error(reasons.join(' ; '));
};

// ---------- chạy ----------
(async () => {
  await new Promise(r => fixtureServer.listen(0, r));
  browser = await chromium.launch();
  if (flag('--write-baseline')) {
    const out = {};
    for (const [vn, vp] of [['wide', WIDE], ['narrow', NARROW]]) { const o = await open(vp, mainData()); const { chars } = await readChars(o.page);
      out[vn] = Object.fromEntries(Object.entries(chars).map(([k, c]) => [k, { cx: +c.cx.toFixed(2), cy: +c.cy.toFixed(2) }])); await o.ctx.close(); }
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(out, null, 1)); console.log('PASS đã ghi ' + BASELINE_FILE);
    await browser.close(); fixtureServer.close(); return;
  }
  if (SHOTS) {
    const miss = await takeShots(path.resolve(SHOTS));
    console.log(miss.length ? 'FAIL ' + miss.slice(0, 4).join(' ; ') : `PASS đã chụp ${SHOT_NAMES.length} ảnh vào ${SHOTS}`);
    await browser.close(); fixtureServer.close(); process.exit(miss.length ? 1 : 0);
  }
  const NAMES = { 1: 'insight có nhân vật riêng, chín vị trí cũ không đổi', 2: 'nhãn vai từ roster', 3: 'đường về spec + Product revising', 4: 'bậc A/B/C + chờ anh merge',
    5: 'giữ T-019', 6: 'sáu tầng đếm đúng', 7: 'cảnh báo nghẽn/spec', 8: 'eval hồi quy ở Bể', 9: 'cùng nguồn, realtime, 390px, reduced-motion', 10: 'ảnh chụp đã commit' };
  const res = [];
  for (const n of Object.keys(checks)) {
    if (ONLY && ONLY !== n) continue;
    try { await checks[n](); res.push([n, true, '']); console.log(`PASS C${n} ${NAMES[n]}`); }
    catch (e) { res.push([n, false, String(e.message || e).replace(/\s+/g, ' ')]); console.log(`FAIL C${n} ${res[res.length - 1][2]}`); }
  }
  await browser.close(); fixtureServer.close();
  const fails = res.filter(r => !r[1]);
  console.log(fails.length ? 'FAIL ' + fails.map(r => `C${r[0]}: ${r[2].slice(0, 160)}`).join(' | ') : 'PASS');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('FAIL lỗi eval: ' + (e && e.message)); process.exit(1); });
