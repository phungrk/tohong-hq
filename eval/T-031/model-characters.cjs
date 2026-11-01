#!/usr/bin/env node
// Eval tầng 1 cho T-031: nhân vật bot/người trong khối của bảng Mô hình (repo phungrk/tohong-hq-dashboard, một file index.html).
// Spec: products/T-031-nhan-vat-khoi-mo-hinh.md.
//
//   cd /home/user/tohong-hq && bash eval/T-031/run.sh <thư-mục-repo-dashboard> --task T-031 [--criterion N] [--shots [thư-mục-ảnh]]
//
// In từng dòng `PASS Cn …` / `FAIL Cn.<mục> <lý do>`, rồi một dòng cuối `PASS` hoặc `FAIL …`; mã thoát 0/1.
// Dữ liệu dashboard.json, kênh live (WebSocket) và d3 đều giả/cục bộ: không gọi mạng thật.
//   --task <T-xxx> : bắt buộc cho tiêu chí 12 và --shots; thư mục ảnh là <repo>/docs/screenshots/<task> (không có mặc định).
//   --shots [dir]  : chỉ chụp 11 ảnh, mỗi ảnh chụp lúc nhân vật ĐANG cử động (chờ tới khi đạt độ lệch rồi đóng băng animation mới chụp).
//   BASE_REF=<ref> : bản đối chứng cho tiêu chí 11 (mặc định: merge-base của HEAD với origin/main).
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), crypto = require('crypto');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--criterion', '--shots', '--task', '--ref']);
const flag = n => { const i = args.indexOf(n); return i < 0 ? null : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const REPO = path.resolve(args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(args[i - 1])) || '.');
const ONLY = flag('--criterion') ? Number(String(flag('--criterion')).replace(/^C/i, '')) : null;
const SHOTS = flag('--shots');
const TASK = flag('--task') === true ? null : flag('--task');
const REF = flag('--ref') || 'HEAD';
const INDEX = path.join(REPO, 'index.html');
const HERE = __dirname;
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt biến môi trường D3=/đường/dẫn/d3.min.js'); process.exit(1); }
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO); process.exit(1); }
if ((SHOTS || ONLY === 12) && !TASK) { console.log('FAIL cần tham số --task <T-xxx> (thư mục ảnh docs/screenshots/<task>/ không có mặc định)'); process.exit(1); }

// ---------- hằng số theo spec ----------
const HEX = { spec: '#14754d', code: '#2b7fb8', back: '#d9931f', bad: '#d33', ins: '#8a5cf6' };
const rgbOf = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const RGB = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [k, rgbOf(v)]));
const KIND = { nd_intents: 'human', nd_spec: 'bot', nd_respec: 'bot', gt_spec: 'bot', nd_exec: 'bot', nd_rework: 'bot', gt_code: 'bot', nd_capu: 'human', nd_insight: 'bot', nd_kr: 'bot', nd_prod: 'bot' };
const CHARS = Object.keys(KIND);
const BLOCKS = ['nd_intents', 'nd_spec', 'nd_respec', 'nd_exec', 'nd_rework', 'nd_capu', 'gt_spec', 'gt_code', 'nd_kr', 'nd_rel', 'nd_prod', 'nd_insight', 'src_data', 'src_inc', 'src_fb'];
const NOCHAR = BLOCKS.filter(b => !KIND[b]);
const SL = 80;                       // dung sai khung hình (ms)
const ALLOWED_HOSTS = ['cdnjs.cloudflare.com', 'raw.githubusercontent.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'tohong-live.phungnc.workers.dev', 'localhost', '127.0.0.1', ''];
const BYTES_MAX = 40960;

// ---------- dữ liệu giả ----------
const T = (id, state, owner, o = {}) => ({ id, title: 'Việc ' + id, state, holder: o.holder || owner, owner, reviewer: o.reviewer || 'adversary', rounds: o.rounds || 0,
  version: 1, deadline: '', budget: '', cost: 0, created: '2026-10-30T09:00', updated: '2026-11-01T09:00', hours_since_update: o.h === undefined ? 2 : o.h,
  tier: o.tier === undefined ? 'A' : o.tier, area: 'dashboard/model', evals: 1, spec_returns: 0, evals_added: 0 });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent',
  reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const model = n => ({ invariants: { 'dashboard/model': 1 }, invariants_total: 48, adversarial_evals: 17, regression_evals: 12, insight_reports: n === undefined ? 1 : n, last_insight: '2026-10-25-weekly.md', specs: 2 });
const dash = (tasks, events = [], m = model()) => ({ generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events, roster, model: m });
let evN = 0;
const live = o => ({ type: 'event', id: 'E-' + (9000 + (++evN)), t: '2026-11-01T12:00', round: 0, severity: '', cost: 0, title: '', ...o });
const histEv = (i, event, from, to, task) => ({ seq: 'S-' + i, ledger_id: 'E-' + i, t: '2026-10-31T10:0' + (i % 10), task, title: '', event, from, to, round: 0, severity: '', detail: '', link: '', cost: 0, state: '', holder: '' });

// ---------- bộ lấy mẫu trong trang ----------
const SAMPLER = `(() => {
  const W = window.__fx = { log: [], created: 0, maxGap: 0, last: 0, kfBad: [], filterBad: 0, snap: null };
  const CH = ${JSON.stringify(CHARS)}, BL = ${JSON.stringify(BLOCKS)};
  const OK_KF = new Set(['offset', 'computedOffset', 'easing', 'composite', 'transform', 'opacity']);
  const vis = (el, svg) => { let o = 1, n = el; while (n && n !== svg && n.nodeType === 1) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden') return false; o *= parseFloat(s.opacity); n = n.parentNode; }
    if (o <= 0.05) return false; const r = el.getBoundingClientRect(); return r.width + r.height > 0; };
  const opChain = (el, svg) => { let o = 1, n = el; while (n && n !== svg && n.nodeType === 1) { o *= parseFloat(getComputedStyle(n).opacity); n = n.parentNode; } return o; };
  W.snap = id => {
    const svg = document.querySelector('#model svg'); const g = svg && svg.querySelector('g.mch[data-block="' + id + '"]'); if (!g) return null;
    const sr = svg.getBoundingClientRect(), sc = sr.width / (svg.viewBox.baseVal.width || 1000);
    const body = g.querySelector('[data-part="body"]'), br = body ? body.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    const eye = g.querySelector('[data-part="eye"]'), er = eye ? eye.getBoundingClientRect() : { height: 0 }, lamp = g.querySelector('[data-part="lamp"]');
    const v = ['sweat', 'paper', 'speed', 'question'].map(p => [...g.querySelectorAll('[data-part="' + p + '"]')].some(e => vis(e, svg)));
    return { s: g.getAttribute('data-state'), a: g.getAttribute('data-anim'), dr: g.getAttribute('data-dir'), o: opChain(g, svg), lf: lamp ? getComputedStyle(lamp).fill : '',
      cx: (br.left + br.width / 2 - sr.left) / sc, cy: (br.top + br.height / 2 - sr.top) / sc, bh: br.height, eh: er.height / sc, v };
  };
  const mo = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && n.tagName.toLowerCase() === 'circle' && n.parentNode && n.parentNode.id === 'fx_f') W.created++; });
  mo.observe(document, { childList: true, subtree: true });
  let frame = 0;
  const tick = t => {
    frame++; if (W.last) W.maxGap = Math.max(W.maxGap, t - W.last); W.last = t;
    const rec = { t, ch: {}, lit: {}, b: [], d: [], an: -1, ca: -1 };
    const svg = document.querySelector('#model svg'), layer = document.getElementById('fx_f');
    if (svg && svg.getScreenCTM()) {
      const sr = svg.getBoundingClientRect(), sc = sr.width / (svg.viewBox.baseVal.width || 1000), inv = svg.getScreenCTM().inverse();
      for (const id of CH) { const s = W.snap(id); if (s) rec.ch[id] = s; }
      for (const id of BL) { const g = document.getElementById(id); if (!g) continue; const s = g.querySelector(':scope > rect, :scope > circle'); if (!s) continue; const st = getComputedStyle(s); rec.lit[id] = [parseFloat(st.strokeWidth) || 0, st.stroke, st.fill]; }
      for (const b of svg.querySelectorAll('#fx_b .bub')) { if (!vis(b, svg)) continue; const r = b.getBoundingClientRect(), tx = b.querySelector('[data-part="bubble-text"]');
        rec.b.push([b.getAttribute('data-block'), tx ? tx.textContent : '', (r.left - sr.left) / sc, (r.top - sr.top) / sc, (r.right - sr.left) / sc, (r.bottom - sr.top) / sc, tx ? parseFloat(getComputedStyle(tx).fontSize) * sc : 0]); }
      if (layer) for (const c of layer.querySelectorAll('circle')) { const st = getComputedStyle(c);
        if (parseFloat(st.opacity) > 0.05) { const m = c.getScreenCTM(); if (!m) continue; const q = new DOMPoint(c.cx.baseVal.value, c.cy.baseVal.value).matrixTransform(m); const p = q.matrixTransform(inv); rec.d.push([p.x, p.y, st.fill]); } }
      if (frame % 3 === 0 && document.getAnimations) {
        let an = 0, ca = 0;
        for (const a of document.getAnimations()) { const tg = a.effect && a.effect.target; if (!tg || !tg.closest || !tg.closest('#model')) continue; if (a.playState !== 'running' && a.playState !== 'pending') continue;
          an++; if (tg.closest('.mch,.bub')) { ca++; try { for (const kf of a.effect.getKeyframes()) for (const k of Object.keys(kf)) if (!OK_KF.has(k)) W.kfBad.push(k); } catch (_) { } } }
        rec.an = an; rec.ca = ca;
      }
      if (frame % 30 === 0) for (const e of svg.querySelectorAll('.mch *, .bub *')) { if (getComputedStyle(e).filter !== 'none') { W.filterBad++; break; } }
    }
    W.log.push(rec); requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

// ---------- trình duyệt ----------
let browser;
const allErrors = [], allHosts = new Set();
async function open(opt = {}) {
  const ctx = await browser.newContext({ viewport: opt.vp || { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: opt.reduce ? 'reduce' : 'no-preference', colorScheme: opt.dark ? 'dark' : 'light' });
  const page = await ctx.newPage(); page.setDefaultTimeout(9000);
  const o = { ctx, page, sock: null, data: opt.data, errors: [], clock: !!opt.clock };
  page.on('console', m => { if (m.type() === 'error') { o.errors.push(m.text()); allErrors.push(m.text()); } });
  page.on('pageerror', e => { o.errors.push(String(e)); allErrors.push(String(e)); });
  page.on('request', r => { try { allHosts.add(new URL(r.url()).host); } catch (_) { } });
  await page.addInitScript(SAMPLER);
  if (opt.clock) await page.clock.install({ time: new Date('2026-11-01T05:00:00Z') });
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(o.data) }));
  await page.routeWebSocket(/\/ws$/, ws => {
    if (opt.liveOff) { ws.close(); return; }
    o.sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: opt.snapshot || [], activity: [] }));
  });
  await page.goto('file://' + (opt.file || INDEX));
  await page.waitForSelector('#model svg');
  await settle(o, opt.settle === undefined ? 1500 : opt.settle);
  return o;
}
const settle = async (o, ms) => { if (o.clock) { for (let i = 0; i < ms; i += 500) { await o.page.clock.runFor(Math.min(500, ms - i)); await o.page.waitForTimeout(2); } } else await o.page.waitForTimeout(ms); };
const now = o => o.page.evaluate(() => performance.now());
const send = async (o, ev) => { const t0 = await now(o); o.sock.send(JSON.stringify(ev)); return t0; };
const logOf = o => o.page.evaluate(() => window.__fx.log);
const statsOf = o => o.page.evaluate(() => ({ created: window.__fx.created, maxGap: window.__fx.maxGap, kfBad: window.__fx.kfBad, filterBad: window.__fx.filterBad }));
const getPaths = page => page.evaluate(() => { const out = {}; document.querySelectorAll('#model path[id^="p_"]').forEach(p => { const L = p.getTotalLength(), pts = []; for (let s = 0; s <= L; s += 2) { const q = p.getPointAtLength(s); pts.push([q.x, q.y]); } const e = p.getPointAtLength(L); pts.push([e.x, e.y]); out[p.id] = pts; }); return out; });
const getCenters = page => page.evaluate(() => { const out = {}; for (const id of ['nd_intents', 'nd_spec', 'nd_respec', 'nd_exec', 'nd_rework', 'nd_capu', 'gt_spec', 'gt_code', 'nd_kr', 'nd_rel', 'nd_prod', 'nd_insight', 'src_data']) { const g = document.getElementById(id); const s = g && g.querySelector(':scope > rect, :scope > circle'); if (!s) continue; const b = s.getBBox(); out[id] = [b.x + b.width / 2, b.y + b.height / 2]; } return out; });

// ---------- phân tích ----------
const toRGB = s => { if (!s) return null; let m = /rgba?\(([^)]+)\)/.exec(s); if (m) return m[1].split(/[ ,\/]+/).filter(Boolean).slice(0, 3).map(Number);
  m = /color\(srgb ([^)]+)\)/.exec(s); if (m) return m[1].split(/[ \/]+/).slice(0, 3).map(x => Math.round(parseFloat(x) * 255)); return null; };
const near = (a, b, tol) => a && b && a.every((v, i) => Math.abs(v - b[i]) <= tol);
const dist = (pt, poly) => { let m = 1e9; for (const q of poly) { const d = Math.hypot(pt[0] - q[0], pt[1] - q[1]); if (d < m) m = d; } return m; };
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrast = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
const mixC = (a, b, k) => a.map((v, i) => v * k + b[i] * (1 - k));
const range = xs => xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
const mean = xs => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const lits = (rec, id) => { const l = rec && rec.lit[id]; return l ? { on: l[0] >= 2.5, w: l[0], stroke: toRGB(l[1]), fill: toRGB(l[2]) } : null; };
const DUMMY = { s: null, a: null, dr: null, o: 0, lf: '', cx: 0, cy: 0, bh: 0, eh: 0, v: [false, false, false, false], missing: true };
const ch = (rec, id) => (rec && rec.ch[id]) || DUMMY;
// các đoạn liên tiếp có cùng state của một nhân vật
function segs(log, id, state) {
  const out = []; let cur = null;
  for (let i = 0; i < log.length; i++) { const c = log[i].ch[id]; const ok = c && c.s === state;
    if (ok && !cur) cur = { t0: log[i].t, i0: i, i1: i, t1: log[i].t }; else if (ok) { cur.i1 = i; cur.t1 = log[i].t; } else if (cur) { cur.next = c ? c.s : null; out.push(cur); cur = null; } }
  if (cur) out.push(cur); return out;
}
const frames = (log, s) => log.slice(s.i0, s.i1 + 1);
const segLen = (log, s) => (s.i1 + 1 < log.length ? log[s.i1 + 1].t : s.t1 + 16) - s.t0;
const firstSeg = (log, id, state, lo, hi) => segs(log, id, state).find(s => s.t0 >= lo && s.t0 <= hi);
const bubbleRuns = log => {   // các lần hiện liên tiếp của (khối, chữ)
  const runs = []; const open = new Map();
  for (let i = 0; i < log.length; i++) { const seen = new Set();
    for (const b of log[i].b) { const k = b[0] + '|' + b[1]; seen.add(k); if (!open.has(k)) { const r = { block: b[0], text: b[1], t0: log[i].t, t1: log[i].t, i0: i, rep: false }; open.set(k, r); runs.push(r); } else open.get(k).t1 = log[i].t; }
    for (const [k, r] of open) if (!seen.has(k)) { r.end = log[i].t; open.delete(k); } }
  for (const r of runs) { if (r.end === undefined) r.end = r.t1 + 16; r.dur = r.end - r.t0;
    r.rep = runs.some(q => q !== r && q.block === r.block && q.t0 > r.t0 && q.t0 <= r.end + 20); }
  return runs;
};
// độ lệch trạng thái ↔ khối sáng kéo dài quá 0,3 giây (+ dung sai)
function consistency(log, ids, from) {
  for (const id of ids) { let bad = null;
    for (const r of log) { if (r.t < from) continue; const c = r.ch[id], l = lits(r, id); if (!c || !l) continue;
      const mis = (c.s === 'work' && !l.on) || (c.s === 'idle' && l.on) || (c.s === 'wait' && !(l.on && id === 'nd_capu'));
      if (mis) { if (!bad) bad = { t0: r.t, s: c.s, on: l.on }; else if (r.t - bad.t0 > 300 + SL + 20) return `${id} ở ${bad.s} nhưng khối ${bad.on ? 'sáng' : 'không sáng'} suốt hơn 0,3 giây (từ ${Math.round(bad.t0)})`; } else bad = null; } }
  return null;
}

// ---------- sổ kết quả ----------
const R = {};
const rec = (c, name, err) => { (R[c] = R[c] || []).push({ name, ok: !err, msg: err || '' }); };
const want = c => ONLY === null || ONLY === c;
const dirOf = (C, a, b) => { if (!C[a] || !C[b]) return null; const dx = C[b][0] - C[a][0], dy = C[b][1] - C[a][1]; return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); };
const DV = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };

// ---------- Bảng M1–M19 (bản máy đọc: dữ liệu của T-028 + chữ bong bóng của T-031) ----------
// legs: [đường, khối nguồn, khối đích, chữ gửi, chữ nhận]; chữ chỉ áp dụng nếu khối đó có nhân vật.
const CASES = [
  { id: 'M1', tasks: [], ev: { task: 'T-901', event: 'assigned', from: 'chief-of-staff', to: 'product', state: 'new', holder: 'product', owner: 'product', reviewer: 'spec-critic' }, color: 'spec', legs: [['p_intent_spec', 'nd_intents', 'nd_spec', 'Giao việc!', 'Nhận việc!']] },
  { id: 'M2', tasks: [], ev: { task: 'T-901', event: 'assigned', from: 'chief-of-staff', to: 'engineering', state: 'new', holder: 'engineering', owner: 'engineering' }, color: 'code', legs: [['p_gate_exec', 'gt_spec', 'nd_exec', 'Giao việc!', 'Nhận việc!']] },
  { id: 'M3', tasks: [], ev: { task: 'T-901', event: 'assigned', from: 'chief-of-staff', to: 'insight', state: 'new', holder: 'insight', owner: 'insight' }, color: 'ins', legs: [['p_src1', 'src_data', 'nd_insight', null, 'Nhận việc!']] },
  { id: 'M4', tasks: [T('T-901', 'rework', 'engineering', { rounds: 1 })], ev: { task: 'T-901', event: 'started', from: 'engineering', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering', round: 1, rounds: 1 }, color: 'back', legs: [['p_rework_exec', 'nd_rework', 'nd_exec', 'Sửa xong!', 'Làm lại!']] },
  { id: 'M5', tasks: [T('T-901', 'doing', 'product', { reviewer: 'spec-critic' })], ev: { task: 'T-901', event: 'handoff', from: 'product', to: 'spec-critic', state: 'review', holder: 'spec-critic', owner: 'product', reviewer: 'spec-critic' }, color: 'spec', legs: [['p_spec_gate', 'nd_spec', 'gt_spec', 'Xong, giao đây!', 'Đã nhận!']] },
  { id: 'M6', tasks: [T('T-901', 'doing', 'engineering')], ev: { task: 'T-901', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' }, color: 'code', legs: [['p_exec_gate', 'nd_exec', 'gt_code', 'Xong, giao đây!', 'Đã nhận!']] },
  { id: 'M7', tasks: [T('T-901', 'doing', 'insight')], ev: { task: 'T-901', event: 'handoff', from: 'insight', to: 'reviewer', state: 'review', holder: 'reviewer', owner: 'insight' }, color: 'ins', legs: [['p_insight_intent', 'nd_insight', 'nd_intents', 'Xong, giao đây!', 'Đã nhận!']] },
  { id: 'M8', tasks: [T('T-901', 'review', 'product', { reviewer: 'spec-critic' })], ev: { task: 'T-901', event: 'accepted', from: 'spec-critic', to: 'done', state: 'done', holder: '-', owner: 'product', reviewer: 'spec-critic' }, color: 'spec', legs: [['p_gate_kr', 'gt_spec', 'nd_kr', 'Qua cổng!', 'Lưu bất biến!']] },
  { id: 'M9', tasks: [T('T-901', 'review', 'engineering', { tier: 'A' })], ev: { task: 'T-901', event: 'accepted', from: 'adversary', to: 'done', state: 'done', holder: '-', owner: 'engineering' }, color: 'code', long: true, legs: [['p_gate_rel', 'gt_code', 'nd_rel', 'Qua cổng!', null], ['p_rel_res', 'nd_rel', 'nd_prod', null, 'Lên sóng!']] },
  { id: 'M10', tasks: [T('T-901', 'review', 'engineering', { tier: 'B' })], ev: { task: 'T-901', event: 'accepted', from: 'adversary', to: 'done', state: 'done', holder: '-', owner: 'engineering' }, color: 'code', legs: [['p_gate_capu', 'gt_code', 'nd_capu', 'Qua cổng!', 'Diff chờ đọc!']] },
  { id: 'M11', tasks: [T('T-901', 'review', 'insight')], ev: { task: 'T-901', event: 'accepted', from: 'reviewer', to: 'done', state: 'done', holder: '-', owner: 'insight' }, color: 'ins', legs: [['p_insight_kr', 'nd_insight', 'nd_kr', 'Gửi vào bể!', 'Lưu insight!']] },
  { id: 'M12', tasks: [T('T-901', 'review', 'product', { reviewer: 'spec-critic' })], ev: { task: 'T-901', event: 'rejected', from: 'spec-critic', to: 'product', state: 'spec', holder: 'product', owner: 'product', reviewer: 'spec-critic', severity: 'blocker', round: 1 }, color: 'back', legs: [['p_gate_respec', 'gt_spec', 'nd_respec', 'Trả về!', 'Sửa spec!']] },
  { id: 'M13', tasks: [T('T-901', 'review', 'engineering')], ev: { task: 'T-901', event: 'rejected', from: 'adversary', to: 'engineering', state: 'spec', holder: 'product', owner: 'engineering', severity: 'blocker', round: 1 }, color: 'back', legs: [['p_gate_respec2', 'gt_code', 'nd_respec', 'Trả về!', 'Sửa spec!']] },
  { id: 'M14', tasks: [T('T-901', 'review', 'engineering')], ev: { task: 'T-901', event: 'rejected', from: 'adversary', to: 'engineering', state: 'rework', holder: 'engineering', owner: 'engineering', severity: 'blocker', round: 1 }, color: 'back', legs: [['p_gate_rework', 'gt_code', 'nd_rework', 'Trả về!', 'Sửa code!']] },
  { id: 'M15', tasks: [T('T-901', 'spec', 'engineering', { holder: 'product' })], ev: { task: 'T-901', event: 'respec', from: 'product', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering' }, color: 'spec', legs: [['p_respec_spec', 'nd_respec', 'nd_spec', 'Spec đã sửa!', 'Viết lại!']] },
  { id: 'M16', tasks: [T('T-901', 'review', 'engineering')], ev: { task: 'T-901', event: 'evalplus', from: 'adversary', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering' }, color: 'ins', legs: [['p_gate_kr2', 'gt_code', 'nd_kr', 'Thêm eval!', 'Vào bể!']] },
  { id: 'M17', tasks: [T('T-901', 'doing', 'engineering')], ev: { task: 'T-901', event: 'escalated', from: 'chief-of-staff', to: 'capu', state: 'escalated', holder: 'capu', owner: 'engineering' }, color: 'bad', extra: [['nd_capu', 'Chờ quyết…']], legs: [['p_gate_capu', 'gt_code', 'nd_capu', 'Báo Capu!', 'Cần quyết!']] },
  { id: 'M18', tasks: [T('T-901', 'escalated', 'engineering', { holder: 'capu' })], ev: { task: 'T-901', event: 'decided', from: 'capu', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering' }, color: 'back', legs: [['p_capu_exec', 'nd_capu', 'nd_exec', 'Quyết rồi!', 'Làm tiếp!']] },
];
const IGNORED = [
  { event: 'rejected', from: 'adversary', to: 'engineering', state: 'review', owner: 'engineering', severity: 'minor' },
  { event: 'rejected', from: 'adversary', to: 'engineering', state: 'escalated', holder: 'chief-of-staff', owner: 'engineering', severity: 'blocker' },
  { event: 'rejected', from: 'spec-critic', to: 'product', state: 'rework', holder: 'product', owner: 'product', severity: 'blocker' },
  { event: 'blocked', from: 'chief-of-staff', to: 'chief-of-staff', state: 'blocked', holder: 'chief-of-staff', owner: 'engineering' },
  { event: 'unblocked', from: 'chief-of-staff', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering' },
  { event: 'cost', from: 'engineering', to: 'engineering', cost: 0.5 }, { event: 'requested', from: 'capu', to: 'chief-of-staff' },
  { event: 'file_written', from: 'product', to: 'products' }, { event: 'board_edited_directly', from: 'engineering', to: 'board', severity: 'warning' },
  { event: 'decided', from: 'capu', to: 'done', state: 'done', holder: '-', owner: 'engineering' },
  { event: 'assigned', from: 'chief-of-staff', to: 'chief-of-staff', state: 'new', holder: 'chief-of-staff', owner: 'chief-of-staff' },
  { event: 'started', from: 'product', to: 'product', state: 'doing', holder: 'product', owner: 'product' },
  { event: 'started', from: 'engineering', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering', round: 0 },
  { event: 'handoff', from: 'chief-of-staff', to: 'reviewer', state: 'review', holder: 'reviewer', owner: 'chief-of-staff' },
  { event: 'accepted', from: 'reviewer', to: 'done', state: 'done', holder: '-', owner: 'chief-of-staff' },
  { task: 'T-NOPE', event: 'accepted', from: 'reviewer', to: 'done' }, { event: 'escalated', from: 'chief-of-staff', to: 'chief-of-staff', state: 'escalated', holder: 'chief-of-staff', owner: 'engineering' },
];

// ---------- kiểm một ca (tiêu chí 4, 5, và 7 nếu reduce) ----------
// Trả về lỗi đầu tiên cho từng nhóm: giao-nhận (g) và bong bóng (b)
function analyzeCase(c, log, t0, paths, C, reduce) {
  const errG = [], errB = []; const want = []; const ids = new Set();
  const dots = legId => { const pts = []; for (const r of log) for (const d of r.d) if (dist([d[0], d[1]], paths[legId] || []) <= 5) pts.push(r.t); return pts; };
  c.legs.forEach(([pid, src, dst, gtx, ttx], i) => {
    let tg, tk;
    if (reduce) { tg = [t0 + 600 * i - 400, t0 + 600 * i + 400]; tk = tg; }
    else { const ts = dots(pid); if (ts.length < 3) { errG.push(`không thấy dot trên ${pid} để căn giờ giao/nhận`); return; }
      tg = [ts[0] - 350, ts[0] + 250 + SL]; tk = [ts[ts.length - 1] - 250 - SL, ts[ts.length - 1] + 350]; }
    const dir = dirOf(C, src, dst), dv = DV[dir] || [0, 0];
    for (const [id, st, txt, lo, hi] of [[src, 'give', gtx, tg[0], tg[1]], [dst, 'take', ttx, tk[0], tk[1]]]) {
      if (!KIND[id]) { // khối không có nhân vật: không được có g.mch
        if (log.some(r => r.ch[id])) errG.push(`${id} không được có nhân vật`); continue; }
      ids.add(id);
      const s = firstSeg(log, id, st, lo, hi);
      if (!s) { errG.push(`${id} không vào ${st} đúng lúc (cần trong ${Math.round(lo)}–${Math.round(hi)}ms; ${c.id} ${pid})`); continue; }
      const L = segLen(log, s), interrupted = s.next === 'give' || s.next === 'take';
      if (!interrupted && (L < 1000 - SL || L > 1500 + SL)) errG.push(`${id} ${st} kéo dài ${Math.round(L)}ms (cần 1,0–1,5 giây)`);
      if (interrupted && L < 250) errG.push(`${id} ${st} chỉ ${Math.round(L)}ms trước khi bị cắt`);
      const fr = frames(log, s), mid = fr[Math.min(fr.length - 1, Math.floor(fr.length * 0.3))], cc = ch(mid, id);
      if (!near(toRGB(cc.lf), RGB[c.color], 3)) errG.push(`${id} ${st}: lamp ${cc.lf} khác màu dot ${HEX[c.color]}`);
      if (cc.o < 0.95) errG.push(`${id} ${st}: opacity ${cc.o.toFixed(2)} (cần ≥ 0,95)`);
      if (!fr.some(r => ch(r, id).v[1])) errG.push(`${id} ${st}: không thấy paper`);
      if (!reduce) {
        if (st === 'give') {
          const dirs = new Set(fr.map(r => ch(r, id).dr)); if (!(dirs.size === 1 && dirs.has(dir))) errG.push(`${id} give: data-dir ${[...dirs].join('/')} (cần ${dir})`);
          if (!fr.some(r => ch(r, id).v[2])) errG.push(`${id} give: không thấy speed`);
          const p = fr.map(r => ch(r, id).cx * dv[0] + ch(r, id).cy * dv[1]); const reach = Math.max(...p) - p[0];
          if (reach < 2.7) errG.push(`${id} give: chỉ lao ${reach.toFixed(1)} đơn vị về phía ${dir} (cần ≥ 3)`);
        } else {
          const ys = fr.map(r => ch(r, id).cy); const hop = ys[0] - Math.min(...ys); if (hop < 1.8) errG.push(`${id} take: chỉ nhảy ${hop.toFixed(1)} đơn vị (cần ≥ 2)`);
          if (fr.some(r => ch(r, id).dr)) errG.push(`${id} take: không được có data-dir`);
          if (fr.some(r => ch(r, id).v[2])) errG.push(`${id} take: không được hiện speed`);
        }
      } else {
        const cx = fr.map(r => ch(r, id).cx), cy = fr.map(r => ch(r, id).cy); if (range(cx) > 0.1 || range(cy) > 0.1) errG.push(`${id} ${st}: reduced-motion mà thân vẫn dịch ${Math.max(range(cx), range(cy)).toFixed(2)} đơn vị`);
        if (fr.some(r => ch(r, id).a !== 'none')) errG.push(`${id} ${st}: data-anim phải là none khi reduced-motion`);
        if (st === 'give' && !fr.some(r => ch(r, id).dr === dir)) errG.push(`${id} give: data-dir cần ${dir}`);
      }
      if (txt) want.push({ id, txt, from: s.t0 });
    }
  });
  // bong bóng
  const runs = bubbleRuns(log);
  const extraTx = (c.extra || []).map(x => x[1]);
  for (const w of want) {
    const r = runs.find(x => x.block === w.id && x.text === w.txt && x.t0 >= w.from - 80 && x.t0 <= w.from + 300 + SL);
    if (!r) { errB.push(`${w.id}: không thấy bong bóng "${w.txt}" trong 300ms từ lúc ${Math.round(w.from)} (thấy: ${runs.filter(x => x.block === w.id).map(x => '"' + x.text + '"').join(', ') || 'không bong bóng nào'})`); continue; }
    if (!r.rep && (r.dur < 1800 - SL || r.dur > 2400 + SL)) errB.push(`${w.id} "${w.txt}" hiện ${Math.round(r.dur)}ms (cần 1,8–2,4 giây)`);
    if (r.rep && r.dur < 900) errB.push(`${w.id} "${w.txt}" bị thay sau ${Math.round(r.dur)}ms (quá sớm)`);
    if (w.txt.length > 16) errB.push(`"${w.txt}" dài ${w.txt.length} ký tự (> 16)`);
  }
  for (const r of runs) if (r.t0 >= t0 - 200 && !want.some(w => w.id === r.block && w.txt === r.text) && !(extraTx.includes(r.text) && (c.extra || []).some(x => x[0] === r.block))) errB.push(`bong bóng lạ ${r.block}: "${r.text}"`);
  for (const [b, tx] of (c.extra || [])) if (!runs.some(x => x.block === b && x.text === tx)) errB.push(`${b}: không thấy bong bóng "${tx}"`);
  // mỗi khối ≤ 1 bong bóng cùng lúc, nằm trong svg
  for (const r of log) { const cnt = {}; for (const b of r.b) { cnt[b[0]] = (cnt[b[0]] || 0) + 1; if (b[2] < -1 || b[3] < -1 || b[4] > 1001 || b[5] > 791) { errB.push(`bong bóng ${b[0]} "${b[1]}" ra ngoài svg (${b[2].toFixed(0)},${b[3].toFixed(0)})–(${b[4].toFixed(0)},${b[5].toFixed(0)})`); break; } }
    const dup = Object.entries(cnt).find(([, n]) => n > 1); if (dup) { errB.push(`khối ${dup[0]} có ${dup[1]} bong bóng cùng lúc (tối đa 1)`); break; }
    if (r.b.length > 3) { errB.push(`${r.b.length} bong bóng cùng lúc (tối đa 3)`); break; } }
  const cons = consistency(log, CHARS, t0 + 100); if (cons) errG.push('nhân vật lệch khối sáng: ' + cons);
  return { errG, errB };
}

async function runCase(c, paths, C, reduce) {
  const waitMs = c.long ? 10500 : 6200;
  const o = await open({ data: dash(c.tasks), reduce });
  try {
    const t0 = await send(o, live(c.ev)); await o.page.waitForTimeout(waitMs);
    const log = await logOf(o).then(l => l.filter(r => r.t >= t0 - 1000));
    const { errG, errB } = analyzeCase(c, log, t0, paths, C, reduce);
    const tag = `${c.id} ${c.ev.event}`;
    if (reduce) { rec(7, `${tag} (reduced-motion): give/take đúng lịch, thân đứng yên, data-anim none`, errG[0] || null); rec(7, `${tag} (reduced-motion): bong bóng đúng chữ và thời gian`, errB[0] || null); const st = await statsOf(o); rec(7, `${tag} (reduced-motion): không circle dot nào`, st.created === 0 ? null : `đã tạo ${st.created} dot`);
      const ca = Math.max(...log.map(r => r.ca)); rec(7, `${tag} (reduced-motion): không animation/transition trên nhân vật và bong bóng (đo ${ca})`, ca > 0 ? `có ${ca} animation đang chạy` : null); }
    else { rec(4, `${tag} → ${c.legs.map(l => l[0]).join(' → ')}`, errG[0] || null); rec(5, `${tag} (chữ bong bóng)`, errB[0] || null); }
    rec(10, `${tag} console`, o.errors.length ? o.errors[0] : null);
  } finally { await o.ctx.close(); }
}

// M19: báo cáo insight tăng giữa hai lần tải (đồng hồ giả)
async function runM19(paths, C) {
  const o = await open({ data: dash([T('T-901', 'doing', 'engineering')], [], model(1)), clock: true });
  try {
    o.data = dash([T('T-901', 'doing', 'engineering')], [], model(2));
    const t0 = await now(o); await settle(o, 61000); await o.page.waitForTimeout(500); await settle(o, 9000);
    const log = await logOf(o).then(l => l.filter(r => r.t >= t0));
    const c = { id: 'M19', color: 'ins', legs: [['p_src1', 'src_data', 'nd_insight', null, 'Có insight!'], ['p_insight_intent', 'nd_insight', 'nd_intents', 'Gửi insight!', 'Ý định mới!']] };
    // M19: dot chạm nd_insight ở chặng 1 (take), rời chặng 2 (give), chạm nd_intents (take)
    const errs = analyzeCase(c, log, t0, paths, C, false);
    // analyzeCase gắn "Gửi insight!" vào give của nd_insight ở chặng 2 và "Có insight!" ở take của chặng 1: đúng bảng spec
    rec(4, 'M19 insight_reports tăng → p_src1 → p_insight_intent', errs.errG[0] || null);
    rec(5, 'M19 (chữ bong bóng)', errs.errB[0] || null);
  } finally { await o.ctx.close(); }
}

// ---------- tiêu chí 1: nhân vật ở đúng khối, đủ bộ phận, cỡ, vị trí ----------
async function runStructure() {
  const o = await open({ data: dash([]) });
  try {
    const m = await o.page.evaluate(({ CHARS, NOCHAR }) => {
      const svg = document.querySelector('#model svg'), sr = svg.getBoundingClientRect(), sc = sr.width / svg.viewBox.baseVal.width;
      const out = { total: svg.querySelectorAll('g.mch').length, chars: {}, nochar: {}, ext: [] };
      for (const id of NOCHAR) out.nochar[id] = svg.querySelectorAll('g.mch[data-block="' + id + '"]').length + (document.querySelector('#' + id + ' .mch') ? 1 : 0);
      for (const id of CHARS) { const g = svg.querySelector('g.mch[data-block="' + id + '"]'); if (!g) { out.chars[id] = null; continue; }
        const blk = document.getElementById(id), shape = blk.querySelector(':scope > rect, :scope > circle'), sb = shape.getBoundingClientRect();
        const body = g.querySelector('[data-part="body"]'), lamp = g.querySelector('[data-part="lamp"]');
        const part = p => g.querySelectorAll('[data-part="' + p + '"]').length;
        const br = body ? body.getBoundingClientRect() : null;
        const ov = []; blk.querySelectorAll('text').forEach(t => { if (t.closest('.mch,.bub')) return; const tr = t.getBoundingClientRect(); if (!tr.width) return;
          const w = Math.min(br.right, tr.right) - Math.max(br.left, tr.left), h = Math.min(br.bottom, tr.bottom) - Math.max(br.top, tr.top); if (w > 2 * sc && h > 2 * sc) ov.push(t.textContent.trim().slice(0, 18)); });
        const bad = []; g.querySelectorAll('*').forEach(e => { const tn = e.tagName.toLowerCase(); if (['image', 'foreignobject', 'img', 'canvas', 'script', 'text'].includes(tn)) bad.push(tn); const h = e.getAttribute('href') || e.getAttribute('xlink:href'); if (h && !h.startsWith('#')) bad.push('href=' + h.slice(0, 20)); });
        out.chars[id] = { kind: g.getAttribute('data-kind'), state: g.getAttribute('data-state'), nodes: g.querySelectorAll('*').length, body: part('body'), eye: part('eye'), lamp: part('lamp'), sweat: part('sweat'), paper: part('paper'), speed: part('speed'), question: part('question'),
          cxIn: br ? (br.left + br.width / 2 >= sb.left && br.left + br.width / 2 <= sb.right && br.top + br.height / 2 >= sb.top && br.top + br.height / 2 <= sb.bottom) : false, h: br ? br.height : 0, ov, bad,
          crisp: body ? getComputedStyle(body).shapeRendering : '', inTop: !!g.closest('#model svg') };
      }
      return out;
    }, { CHARS, NOCHAR });
    rec(1, 'S1 đúng 11 g.mch trong #model svg', m.total === 11 ? null : `có ${m.total} g.mch (cần 11)`);
    for (const id of NOCHAR) rec(1, `S2 ${id} không có nhân vật`, m.nochar[id] ? `${id} có nhân vật` : null);
    for (const id of CHARS) { const c = m.chars[id];
      if (!c) { rec(1, `S3 ${id} có nhân vật (${KIND[id]})`, `không thấy g.mch[data-block="${id}"]`); continue; }
      rec(1, `S3 ${id} data-kind=${KIND[id]}`, c.kind === KIND[id] ? null : `data-kind=${c.kind}`);
      const miss = ['body', 'eye', 'lamp', 'sweat', 'paper', 'speed'].filter(p => !(c[p] >= (p === 'eye' ? 2 : 1))); if (KIND[id] === 'human' && !c.question) miss.push('question');
      rec(1, `S4 ${id} đủ data-part (body, eye ≥ 2, lamp, sweat, paper, speed${KIND[id] === 'human' ? ', question' : ''})`, miss.length ? 'thiếu ' + miss.join(', ') : (KIND[id] === 'bot' && c.question ? 'bot không được có question' : null));
      rec(1, `S5 ${id} chỉ phần tử SVG nội tuyến, không ảnh/foreignObject/href ngoài, ≤ 40 phần tử (có ${c.nodes}), crispEdges`, c.bad.length ? 'có ' + c.bad.join(', ') : c.nodes > 40 ? `${c.nodes} phần tử` : c.crisp.toLowerCase() !== 'crispedges' ? `shape-rendering=${c.crisp}` : null);
      rec(1, `S6 ${id} tâm thân nằm trong khối, không che chữ của khối (${c.ov.join(' | ') || 'ok'})`, !c.cxIn ? 'tâm thân ngoài khối' : c.ov.length ? 'che chữ: ' + c.ov.join(', ') : null);
      rec(1, `S7 ${id} cao ${c.h.toFixed(1)}px ở 1280px (68–114; T-035 thay 20–56)`, c.h >= 68 && c.h <= 114 ? null : `cao ${c.h.toFixed(1)}px`);
      rec(1, `S8 ${id} có data-state hợp lệ`, ['idle', 'work', 'give', 'take', 'wait'].includes(c.state) ? null : `data-state=${c.state}`); }
  } finally { await o.ctx.close(); }
}

// ---------- tiêu chí 2 và 10(idle): khối rảnh ----------
async function runIdle() {
  const o = await open({ data: dash([T('T-1', 'done', 'engineering', { tier: 'A', h: 5, holder: '-' })]), settle: 800 });
  try {
    const tt = await now(o) + 300; await o.page.waitForTimeout(8200);
    const log = (await logOf(o)).filter(r => r.t > tt); const last = log[log.length - 1];
    for (const id of CHARS) {
      const cs = log.map(r => ch(r, id)).filter(Boolean); if (!cs.length) { rec(2, `${id} idle`, 'không có nhân vật'); continue; }
      const l = cs[cs.length - 1];
      rec(2, `${id}: data-state=idle, data-anim=blink`, cs.every(c => c.s === 'idle' && c.a === 'blink') ? null : `state=${l.s} anim=${l.a}`);
      rec(2, `${id}: opacity 0,30–0,50 (đo ${l.o.toFixed(2)})`, l.o >= 0.30 && l.o <= 0.50 ? null : `opacity ${l.o.toFixed(2)}`);
      const lc = toRGB(l.lf); rec(2, `${id}: lamp xám, không thuộc 5 màu (${l.lf})`, lc && !Object.values(RGB).some(c => near(lc, c, 6)) ? null : `lamp ${l.lf}`);
      rec(2, `${id}: thân đứng yên trong 8 giây (dịch ${Math.max(range(cs.map(c => c.cx)), range(cs.map(c => c.cy))).toFixed(2)} đơn vị)`, Math.max(range(cs.map(c => c.cx)), range(cs.map(c => c.cy))) <= 0.3 ? null : 'thân dịch chuyển khi rảnh');
      const eh = cs.map(c => c.eh), mx = Math.max(...eh); let blinks = 0, closed = false; for (const h of eh) { if (h < mx * 0.6) { if (!closed) { blinks++; closed = true; } } else closed = false; }
      rec(2, `${id}: chớp mắt chậm (${blinks} lần trong 8 giây, cần 1–3)`, blinks >= 1 && blinks <= 3 ? null : `${blinks} lần chớp`);
      rec(2, `${id}: không phần phụ nào hiện khi rảnh`, cs.some(c => c.v.some(Boolean)) ? 'có phần phụ (sweat/paper/speed/question) đang hiện' : null);
    }
    rec(2, 'không bong bóng nào khi rảnh', log.some(r => r.b.length) ? 'có bong bóng khi rảnh' : null);
    const idleAn = Math.max(...log.map(r => r.an)); rec(10, `P1 ≤ 22 animation khi mọi khối rảnh (đo ${idleAn})`, idleAn <= 22 ? null : `${idleAn} animation`);
    const st = await statsOf(o); rec(10, 'P2 keyframe animation của nhân vật chỉ transform/opacity', st.kfBad.length ? `có thuộc tính ${[...new Set(st.kfBad)].join(', ')}` : null);
    rec(10, 'P3 không filter trên nhân vật/bong bóng', st.filterBad ? 'có phần tử con có filter' : null);
    rec(10, 'idle console', o.errors.length ? o.errors[0] : null);
  } finally { await o.ctx.close(); }
}

// ---------- tiêu chí 3: khối đang xử lý (quy tắc A) ----------
async function runWork() {
  const tasks = [T('T-1', 'doing', 'product', { reviewer: 'spec-critic' }), T('T-2', 'review', 'product', { reviewer: 'spec-critic' }), T('T-3', 'spec', 'engineering', { holder: 'product' }),
    T('T-4', 'doing', 'engineering'), T('T-5', 'rework', 'engineering'), T('T-6', 'review', 'engineering'), T('T-8', 'doing', 'insight'), T('T-9', 'done', 'engineering', { tier: 'B', h: 5, holder: '-' })];
  const o = await open({ data: dash(tasks), settle: 1000 });
  try {
    const tt = await now(o) + 700; await o.page.waitForTimeout(3600);
    const log = (await logOf(o)).filter(r => r.t > tt); const last = log[log.length - 1];
    const exp = { nd_spec: 'spec', gt_spec: 'spec', nd_respec: 'back', nd_exec: 'code', nd_rework: 'back', gt_code: 'code', nd_insight: 'ins', nd_capu: 'code' };
    for (const [id, col] of Object.entries(exp)) {
      const cs = log.map(r => ch(r, id)).filter(Boolean); const l = cs[cs.length - 1]; const lit = lits(last, id);
      rec(3, `${id}: data-state=work, data-anim=work (khối sáng ${col}${id === 'nd_capu' ? ', Capu đọc diff' : ''})`, cs.every(c => c.s === 'work' && c.a === 'work') ? null : `state=${l.s} anim=${l.a}`);
      rec(3, `${id}: opacity ≥ 0,95 (đo ${l.o.toFixed(2)})`, l.o >= 0.95 ? null : `opacity ${l.o.toFixed(2)}`);
      rec(3, `${id}: lamp đúng màu viền khối (${HEX[col]})`, near(toRGB(l.lf), RGB[col], 3) && lit && near(lit.stroke, RGB[col], 3) ? null : `lamp ${l.lf}, viền ${lit && lit.stroke}`);
      rec(3, `${id}: thân nhún dọc ≥ 1,2 đơn vị (đo ${range(cs.map(c => c.cy)).toFixed(2)})`, range(cs.map(c => c.cy)) >= 1.2 ? null : 'không nhún');
      rec(3, `${id}: có giọt mồ hôi trong 3 giây`, cs.some(c => c.v[0]) ? null : 'không thấy sweat');
      rec(3, `${id}: không paper/speed/question khi làm`, cs.some(c => c.v[1] || c.v[2] || c.v[3]) ? 'phần phụ không đúng đang hiện' : null);
    }
    for (const id of ['nd_intents', 'nd_kr', 'nd_prod']) { const cs = log.map(r => ch(r, id)).filter(Boolean); rec(3, `${id}: khối rảnh vẫn idle trong khi các khối khác làm`, cs.every(c => c.s === 'idle' && c.o <= 0.5) ? null : `state=${cs[cs.length - 1].s}`); }
    rec(3, 'nhân vật khớp khối sáng', consistency(log, CHARS, tt));
    rec(3, 'Capu không ở wait khi chỉ đọc diff (không có việc escalated)', log.some(r => ch(r, 'nd_capu').s === 'wait') ? 'Capu vào wait oan' : null);
    rec(10, 'work console', o.errors.length ? o.errors[0] : null);
  } finally { await o.ctx.close(); }
}

// ---------- tiêu chí 4: sự kiện bỏ qua và sự kiện cũ ----------
async function runIgnoredAndOld() {
  const o = await open({ data: dash([T('T-901', 'doing', 'engineering')]) });
  try {
    let ix = 0; for (const ev of IGNORED) { o.sock.send(JSON.stringify(live({ task: 'T-95' + (ix++), ...ev }))); await o.page.waitForTimeout(80); }
    await o.page.waitForTimeout(3500); const log = await logOf(o);
    const gt = log.some(r => Object.values(r.ch).some(c => c.s === 'give' || c.s === 'take')), bb = log.some(r => r.b.some(x => x[1] !== 'Chờ quyết…'));   // event giả mang state=escalated làm Capu wait: bong bóng Chờ quyết… là đúng
    rec(4, `I* ${IGNORED.length} sự kiện không ánh xạ không tạo give/take`, gt ? 'có nhân vật vào give/take' : null);
    rec(5, `I* ${IGNORED.length} sự kiện không ánh xạ không tạo bong bóng`, bb ? 'có bong bóng' : null);
  } finally { await o.ctx.close(); }
  const hist = [histEv(1, 'assigned', 'chief-of-staff', 'engineering', 'T-4'), histEv(2, 'handoff', 'engineering', 'adversary', 'T-6'), histEv(3, 'rejected', 'adversary', 'engineering', 'T-5')];
  const snap = [{ type: 'event', id: 'E-8001', t: '2026-11-01T10:00', task: 'T-6', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering', round: 0, severity: '', cost: 0 }];
  const o2 = await open({ data: dash([T('T-4', 'doing', 'engineering'), T('T-6', 'review', 'engineering'), T('T-5', 'rework', 'engineering')], hist), snapshot: snap, settle: 600 });
  try { await o2.page.waitForTimeout(7000); const log = await logOf(o2);
    rec(4, 'O1 mở trang với sự kiện cũ (dashboard.json + snapshot): 7 giây không give/take', log.some(r => Object.values(r.ch).some(c => c.s === 'give' || c.s === 'take')) ? 'có give/take từ sự kiện cũ' : null);
    rec(5, 'O1 mở trang với sự kiện cũ: không bong bóng', log.some(r => r.b.length) ? 'có bong bóng từ sự kiện cũ' : null); } finally { await o2.ctx.close(); }
}

// ---------- tiêu chí 6: Capu chờ quyết ----------
async function runWait() {
  const o = await open({ data: dash([T('T-7', 'escalated', 'engineering', { holder: 'capu' })]), settle: 300 });
  try {
    const t0 = await now(o), tt = t0 + 400;
    await o.page.waitForTimeout(12800);
    let log = (await logOf(o)).filter(r => r.t >= t0);
    const cs = log.filter(r => r.t > tt).map(r => ch(r, 'nd_capu')); const last = cs[cs.length - 1];
    rec(6, 'W1 Capu ở wait (data-anim=wait) trong suốt 12 giây, không bị cắt ở mốc 10 giây', cs.every(c => c.s === 'wait' && c.a === 'wait') ? null : `state=${last.s} anim=${last.a}`);
    rec(6, 'W2 lamp #d33, opacity ≥ 0,95', near(toRGB(last.lf), RGB.bad, 3) && last.o >= 0.95 ? null : `lamp ${last.lf} opacity ${last.o.toFixed(2)}`);
    rec(6, 'W3 dấu ? hiện, không giọt mồ hôi/giấy/vệt', cs.some(c => c.v[3]) && !cs.some(c => c.v[0] || c.v[1] || c.v[2]) ? null : 'phần phụ không đúng');
    const early = log.filter(r => r.t > tt && r.t < tt + 3000).map(r => ch(r, 'nd_capu'));
    rec(6, `W4 đung đưa ngang ≥ 1,2 đơn vị (đo ${range(early.map(c => c.cx)).toFixed(2)}), không nhún dọc (dọc ${range(early.map(c => c.cy)).toFixed(2)} ≤ 0,8)`, range(early.map(c => c.cx)) >= 1.2 && range(early.map(c => c.cy)) <= 0.8 ? null : 'không đung đưa ngang');
    const runs = bubbleRuns(await logOf(o)).filter(r => r.block === 'nd_capu' && r.t0 < t0 + 12800);   // dùng toàn bộ log: bong bóng hiện từ lúc tải trang
    rec(6, 'W5 bong bóng "Chờ quyết…" đúng một lần', runs.length === 1 && runs[0].text === 'Chờ quyết…' ? null : `thấy ${runs.map(r => '"' + r.text + '"').join(', ') || 'không bong bóng'}`);
    rec(6, `W6 "Chờ quyết…" hiện 2,7–3,4 giây (đo ${runs[0] ? Math.round(runs[0].dur) : '?'}ms)`, runs[0] && runs[0].dur >= 2700 - SL && runs[0].dur <= 3400 + SL ? null : 'sai thời gian hiện');
    rec(6, 'W7 nhân vật khớp khối sáng khi chờ', consistency(log, CHARS, tt));
    // Capu quyết: việc quay lại doing -> rời wait
    const t1 = await send(o, live({ task: 'T-7', event: 'decided', from: 'capu', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering' }));
    await o.page.waitForTimeout(5500); log = await logOf(o); const after = log.filter(r => r.t > t1 + 2600).map(r => ch(r, 'nd_capu'));
    rec(6, 'W8 Capu quyết xong thì rời wait (sau 2,6 giây không còn wait)', after.length && after.every(c => c.s !== 'wait') ? null : 'vẫn ở wait');
    rec(10, 'wait console', o.errors.length ? o.errors[0] : null);
  } finally { await o.ctx.close(); }
}

// ---------- tiêu chí 5, 10: dồn 40 sự kiện ----------
async function runBurst() {
  const MIX = [['product', { event: 'handoff', from: 'product', to: 'spec-critic', state: 'review', holder: 'spec-critic' }], ['engineering', { event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary' }],
    ['product', { event: 'assigned', from: 'chief-of-staff', to: 'product', state: 'new', holder: 'product' }], ['engineering', { event: 'rejected', from: 'adversary', to: 'engineering', state: 'rework', holder: 'engineering', severity: 'blocker', round: 1 }],
    ['engineering', { event: 'respec', from: 'product', to: 'engineering', state: 'doing', holder: 'engineering' }], ['insight', { event: 'handoff', from: 'insight', to: 'reviewer', state: 'review', holder: 'reviewer' }],
    ['engineering', { event: 'decided', from: 'capu', to: 'engineering', state: 'doing', holder: 'engineering' }], ['engineering', { event: 'evalplus', from: 'adversary', to: 'engineering', state: 'doing', holder: 'engineering' }]];
  const tasks = Array.from({ length: 40 }, (_, i) => T('T-' + (100 + i), 'doing', MIX[i % MIX.length][0]));
  const o = await open({ data: dash(tasks) });
  try {
    tasks.forEach((t, i) => o.sock.send(JSON.stringify(live({ task: t.id, owner: MIX[i % MIX.length][0], ...MIX[i % MIX.length][1] }))));
    await o.page.waitForTimeout(3500);
    // Đọc stats (maxGap) TRƯỚC log: việc kéo cả log qua CDP tự làm trang khựng 200–350ms, không được lọt vào phép đo.
    let st = await statsOf(o); let log = await logOf(o);
    const maxB = Math.max(...log.map(r => r.b.length));
    rec(5, `B1 dồn 40 sự kiện: không quá 3 bong bóng cùng lúc (đo ${maxB})`, maxB <= 3 ? null : `${maxB} bong bóng cùng lúc`);
    rec(5, 'B2 dồn 40 sự kiện: vẫn có bong bóng (không nuốt hết)', maxB >= 1 ? null : 'không thấy bong bóng nào');
    const fxf = await o.page.evaluate(() => [...document.querySelectorAll('#fx_f > *')].filter(e => e.tagName.toLowerCase() !== 'circle').length);
    rec(5, 'B3 #fx_f chỉ chứa circle (bong bóng ở #fx_b)', fxf === 0 && !(await o.page.$('#fx_f .bub')) && (await o.page.$('#fx_b')) ? null : '#fx_f chứa phần tử không phải dot, hoặc không có #fx_b');
    const an = Math.max(...log.map(r => r.an)); rec(10, `P4 dồn 40 sự kiện: ≤ 60 animation chạy cùng lúc (đo ${an})`, an <= 60 ? null : `${an} animation`);
    rec(10, `P5 dồn 40 sự kiện: không khung hình trễ > 300ms (đo ${Math.round(st.maxGap)}ms)`, st.maxGap < 300 ? null : `trễ ${Math.round(st.maxGap)}ms`);
    rec(10, 'P6 keyframe animation chỉ transform/opacity khi dồn sự kiện', st.kfBad.length ? `có ${[...new Set(st.kfBad)].join(', ')}` : null);
    await o.page.waitForTimeout(16000); log = await logOf(o); const lastT = log[log.length - 1].t;
    const quiet = log.filter(r => r.t > lastT - 5000);
    rec(5, 'B4 5 giây yên sau dồn sự kiện: #fx_b rỗng và không bong bóng nào treo', quiet.some(r => r.b.length) ? 'còn bong bóng sau 5 giây yên' : null);
    const stuck = CHARS.filter(id => { const c = ch(log[log.length - 1], id); return c && (c.s === 'give' || c.s === 'take'); });
    rec(4, 'B5 sau dồn 40 sự kiện: không nhân vật nào kẹt ở give/take', stuck.length ? 'kẹt: ' + stuck.join(', ') : null);
    const maxDur = bubbleRuns(log).reduce((m, r) => Math.max(m, r.dur), 0); rec(5, `B6 mỗi bong bóng ≤ 3,5 giây (dài nhất ${Math.round(maxDur)}ms)`, maxDur <= 3500 + SL ? null : 'bong bóng treo quá lâu');
    rec(10, 'burst console', o.errors.length ? o.errors[0] : null);
  } finally { await o.ctx.close(); }
}

// ---------- tiêu chí 7: reduced-motion (chung) ----------
async function runReducedStates(paths, C) {
  const tasks = [T('T-901', 'doing', 'engineering'), T('T-902', 'review', 'product', { reviewer: 'spec-critic' }), T('T-7', 'escalated', 'engineering', { holder: 'capu' })];
  const o = await open({ reduce: true, data: dash(tasks) });
  try {
    const tt = await now(o) + 300; await o.page.waitForTimeout(2200);
    let log = (await logOf(o)).filter(r => r.t > tt); const last = log[log.length - 1];
    rec(7, 'R1 lúc tải: Agent code work, Spec Gate work, Capu wait (khối sáng theo A), data-anim none', ['nd_exec', 'gt_spec'].every(id => ch(last, id).s === 'work' && ch(last, id).a === 'none' && ch(last, id).o >= 0.95) && ch(last, 'nd_capu').s === 'wait' && ch(last, 'nd_capu').a === 'none' && ch(last, 'nd_capu').v[3] ? null : `exec=${ch(last, 'nd_exec').s}/${ch(last, 'nd_exec').a} gt_spec=${ch(last, 'gt_spec').s} capu=${ch(last, 'nd_capu').s}`);
    rec(7, 'R2 lúc tải: Agent code lamp đúng màu việc, Capu lamp #d33', near(toRGB(ch(last, 'nd_exec').lf), RGB.code, 3) && near(toRGB(ch(last, 'nd_capu').lf), RGB.bad, 3) ? null : `exec lamp ${ch(last, 'nd_exec').lf}, capu lamp ${ch(last, 'nd_capu').lf}`);
    const rr = CHARS.map(id => { const cs = log.map(r => ch(r, id)).filter(Boolean); return [id, Math.max(range(cs.map(c => c.cx)), range(cs.map(c => c.cy)))]; }).filter(x => x[1] > 0.1);
    rec(7, 'R3 thân mọi nhân vật đứng yên tuyệt đối ở work/wait/idle', rr.length ? `dịch: ${rr.map(x => x[0] + ' ' + x[1].toFixed(2)).join(', ')}` : null);
    const idleEye = CHARS.filter(id => ch(last, id).s === 'idle').filter(id => { const eh = log.map(r => ch(r, id).eh); return range(eh) > 0.05; });
    rec(7, 'R4 nhân vật idle không chớp mắt khi reduced-motion', idleEye.length ? 'còn chớp: ' + idleEye.join(', ') : null);
    const ca = Math.max(...log.map(r => r.ca)); rec(7, `R5 không animation/transition nào trên nhân vật và bong bóng (đo ${ca})`, ca <= 0 ? null : `${ca} animation đang chạy`);
    const idleOp = CHARS.filter(id => ch(last, id).s === 'idle').filter(id => ch(last, id).o < 0.3 || ch(last, id).o > 0.5); rec(7, 'R6 idle vẫn mờ 0,30–0,50 khi reduced-motion (highlight vẫn có)', idleOp.length ? 'sai opacity: ' + idleOp.join(', ') : null);
    rec(10, 'reduced states console', o.errors.length ? o.errors[0] : null);
  } finally { await o.ctx.close(); }
}

// ---------- tiêu chí 8: 390px, tối, đổi bề ngang ----------
async function runPhoneDark(paths, C) {
  const tasks = [T('T-901', 'doing', 'engineering'), T('T-902', 'review', 'product', { reviewer: 'spec-critic' })];
  const ev = CASES.find(c => c.id === 'M6').ev;
  const o = await open({ vp: { width: 390, height: 844 }, data: dash(tasks) });
  try {
    const sizes = async tag => o.page.evaluate(({ CHARS }) => { const svg = document.querySelector('#model svg'), sr = svg.getBoundingClientRect(), sc = sr.width / svg.viewBox.baseVal.width;
      return { sc, w: sr.width, over: document.documentElement.scrollWidth - innerWidth, hs: CHARS.map(id => { const b = svg.querySelector('g.mch[data-block="' + id + '"] [data-part="body"]'); return [id, b ? b.getBoundingClientRect().height : 0]; }),
        ov: CHARS.map(id => { const g = svg.querySelector('g.mch[data-block="' + id + '"]'); const body = g && g.querySelector('[data-part="body"]'); if (!body) return null; const br = body.getBoundingClientRect(); let n = 0;
          document.querySelectorAll('#' + id + ' text').forEach(t => { if (t.closest('.mch,.bub')) return; const tr = t.getBoundingClientRect(); if (!tr.width) return; const w = Math.min(br.right, tr.right) - Math.max(br.left, tr.left), h = Math.min(br.bottom, tr.bottom) - Math.max(br.top, tr.top); if (w > 2 * sc && h > 2 * sc) n++; }); return n ? id : null; }).filter(Boolean) }; }, { CHARS });
    let m = await sizes();
    rec(8, 'P1 390px: trang không cuộn ngang', m.over <= 0 ? null : `tràn ngang ${m.over}px`);
    const small = m.hs.filter(([, h]) => h < 19 || h > 56); rec(8, 'P2 390px: mọi nhân vật cao 19–56px (T-035 nâng sàn từ 9)', small.length ? small.map(([id, h]) => `${id} ${h.toFixed(1)}px`).join(', ') : null);
    rec(8, 'P3 390px: nhân vật không che chữ của khối', m.ov.length ? 'che chữ ở ' + m.ov.join(', ') : null);
    const t0 = await send(o, live(ev)); await o.page.waitForTimeout(1900); let log = await logOf(o);
    const bs = log.filter(r => r.t >= t0).flatMap(r => r.b);
    rec(8, 'P4 390px: có bong bóng, chữ 9–16px, nằm trong svg', !bs.length ? 'không thấy bong bóng' : bs.some(b => b[6] < 9 || b[6] > 16) ? `cỡ chữ ${Math.min(...bs.map(b => b[6])).toFixed(1)}–${Math.max(...bs.map(b => b[6])).toFixed(1)}px` : bs.some(b => b[2] < -1 || b[4] > 1001 || b[3] < -1 || b[5] > 791) ? 'ra ngoài svg' : null);
    // đổi bề ngang giữa lúc đang cử động: 390 -> 844 (ngang)
    await send(o, live({ ...ev, event: 'rejected', from: 'adversary', to: 'engineering', state: 'rework', holder: 'engineering', severity: 'blocker', round: 1, task: 'T-901' }));
    await o.page.waitForTimeout(1300); await o.page.setViewportSize({ width: 844, height: 390 }); await o.page.waitForTimeout(400);
    m = await sizes(); log = await logOf(o); const last = log[log.length - 1];
    const small2 = m.hs.filter(([, h]) => h < 19 || h > 80); rec(8, 'P5 xoay 390 → 844 giữa lúc đang cử động: nhân vật vẫn cao 19–80px (không tính một lần; T-035/ADR-015 nâng sàn từ 9, trần từ 56: 100 đơn vị × 0,778 = 78px ở 844)', small2.length ? small2.map(([id, h]) => `${id} ${h.toFixed(1)}px`).join(', ') : null);
    rec(8, 'P6 xoay ngang: không cuộn ngang', m.over <= 0 ? null : `tràn ${m.over}px`);
    const fs2 = log.filter(r => r.t > last.t - 600).flatMap(r => r.b).map(b => b[6]); rec(8, 'P7 xoay ngang: chữ bong bóng vẫn 9–16px', fs2.length && (Math.min(...fs2) < 9 || Math.max(...fs2) > 16) ? `cỡ chữ ${Math.min(...fs2).toFixed(1)}–${Math.max(...fs2).toFixed(1)}px` : null);
    rec(8, 'phone console', o.errors.length ? o.errors[0] : null);
  } finally { await o.ctx.close(); }
  for (const dark of [false, true]) {
    const tag = dark ? 'tối' : 'sáng';
    const o2 = await open({ dark, data: dash([T('T-901', 'doing', 'engineering'), T('T-902', 'review', 'engineering')]) });
    try {
      const pre = await o2.page.evaluate(() => { const bg = id => getComputedStyle(document.querySelector('#' + id + ' > rect, #' + id + ' > circle')).fill; const body = id => { const b = document.querySelector('g.mch[data-block="' + id + '"] [data-part="body"]'); const sh = b.matches('rect,path,circle,ellipse,polygon') ? b : b.querySelector('rect,path,circle,ellipse,polygon'); return getComputedStyle(sh).fill; };   // màu thật được tô, không phải fill của g bọc
        return { exec: [bg('nd_exec'), body('nd_exec')], gate: [bg('gt_code'), body('gt_code')], idleBg: bg('nd_kr'), idleBody: body('nd_kr'), idleOp: parseFloat(getComputedStyle(document.querySelector('g.mch[data-block="nd_kr"]')).opacity), panel: getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() }; });
      for (const k of ['exec', 'gate']) { const c = contrast(toRGB(pre[k][1]), toRGB(pre[k][0])); rec(8, `D1 chế độ ${tag}: thân ${k === 'exec' ? 'Agent code' : 'Code Gate'} tương phản với nền khối sáng ≥ 3,0 (đo ${c.toFixed(2)})`, c >= 3.0 ? null : `tương phản ${c.toFixed(2)}`); }
      const bgc = toRGB(pre.idleBg), eff = mixC(toRGB(pre.idleBody), bgc, pre.idleOp), ci = contrast(eff, bgc); rec(8, `D2 chế độ ${tag}: nhân vật rảnh (đã tính opacity) tương phản ≥ 1,5 (đo ${ci.toFixed(2)})`, ci >= 1.5 ? null : `tương phản ${ci.toFixed(2)}`);
      await send(o2, live(ev)); await o2.page.waitForTimeout(1900);
      const bub = await o2.page.evaluate(() => { const b = document.querySelector('#fx_b .bub'); if (!b) return null; return [getComputedStyle(b.querySelector('[data-part="bubble-bg"]')).fill, getComputedStyle(b.querySelector('[data-part="bubble-text"]')).fill, parseFloat(getComputedStyle(b.querySelector('[data-part="bubble-bg"]')).fillOpacity)]; });
      if (!bub) rec(8, `D3 chế độ ${tag}: có bong bóng để đo`, 'không thấy bong bóng'); else { const cb = contrast(toRGB(bub[1]), toRGB(bub[0])); rec(8, `D3 chế độ ${tag}: chữ bong bóng tương phản ≥ 4,5 (đo ${cb.toFixed(2)})`, cb >= 4.5 ? null : `tương phản ${cb.toFixed(2)}`); }
      rec(8, `dark(${tag}) console`, o2.errors.length ? o2.errors[0] : null);
    } finally { await o2.ctx.close(); }
  }
}

// ---------- tiêu chí 9: bất biến dashboard/model ----------
async function runInvariants() {
  const dir = path.join(HERE, '..', 'invariants', 'dashboard', 'model'); const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^inv-00[1-8].*\.sh$/.test(f)).sort() : [];
  if (files.length < 8) { rec(9, 'I0 có đủ inv-001..008', `chỉ thấy ${files.length} file trong ${dir}`); return; }
  const env = { ...process.env, TOHONG_DASHBOARD_REPO: REPO, NODE_PATH: process.env.NODE_PATH || '', D3 };
  const run = f => new Promise(res => { const p = cp.spawn('bash', [path.join(dir, f)], { env }); let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d); p.on('close', code => res([f, code, out.trim().split('\n').pop()])); });
  for (let i = 0; i < files.length; i += 4) { const rs = await Promise.all(files.slice(i, i + 4).map(run)); for (const [f, code, last] of rs) rec(9, `${f.replace(/\.sh$/, '')}`, code === 0 ? null : last); }
}

// ---------- tiêu chí 10 (phần tĩnh): byte, không thư viện/mạng ngoài ----------
function baseRef() {
  if (process.env.BASE_REF) return process.env.BASE_REF;
  const tryGit = a => { try { return cp.execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_) { return ''; } };
  return tryGit(['merge-base', 'HEAD', 'origin/main']) || 'e184780';
}
function runStatic() {
  const ref = baseRef(); let baseLen = null;
  try { baseLen = cp.execFileSync('git', ['-C', REPO, 'show', ref + ':index.html'], { maxBuffer: 1 << 26 }).length; } catch (_) { }
  const len = fs.statSync(INDEX).size;
  rec(10, `P7 index.html nặng thêm ≤ ${BYTES_MAX} byte so với ${ref.slice(0, 8)} (thêm ${baseLen === null ? '?' : len - baseLen})`, baseLen === null ? `không đọc được ${ref}:index.html (đặt BASE_REF)` : len - baseLen <= BYTES_MAX ? null : `thêm ${len - baseLen} byte`);
  const html = fs.readFileSync(INDEX, 'utf8');
  const scripts = [...html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/gi)].map(m => m[1]).filter(s => !/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/d3\//.test(s));
  rec(10, 'N1 chỉ một thẻ script ngoài (d3 cdnjs)', scripts.length ? `script ngoài mới: ${scripts.join(', ')}` : null);
  const links = [...html.matchAll(/<link[^>]*href=["']([^"']+)["']/gi)].map(m => m[1]).filter(h => !/fonts\.(googleapis|gstatic)\.com/.test(h));
  rec(10, 'N2 không thêm liên kết ngoài mới', links.length ? `link ngoài mới: ${links.join(', ')}` : null);
}
function runNetwork() {
  const hosts = [...allHosts].filter(h => !ALLOWED_HOSTS.includes(h));
  rec(10, 'N3 mọi yêu cầu mạng chỉ tới host đã có', hosts.length ? `host lạ: ${hosts.join(', ')}` : null);
  rec(10, 'N4 không lỗi console / pageerror trong toàn bộ eval', allErrors.length ? `${allErrors.length} lỗi, đầu tiên: ${allErrors[0]}` : null);
}

// ---------- tiêu chí 11: Bản đồ luồng, T-019, bảng khác giữ nguyên ----------
async function runOthers() {
  const ref = baseRef(); let baseHtml;
  try { baseHtml = cp.execFileSync('git', ['-C', REPO, 'show', ref + ':index.html'], { encoding: 'utf8', maxBuffer: 1 << 26 }); }
  catch (e) { rec(11, 'O0 lấy bản đối chứng index.html', `không đọc được ${ref}:index.html trong repo (đặt BASE_REF)`); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't031-base-')); const bf = path.join(tmp, 'index.html'); fs.writeFileSync(bf, baseHtml);
  const tasks = [T('T-1', 'doing', 'product', { reviewer: 'spec-critic' }), T('T-2', 'review', 'engineering'), T('T-3', 'rework', 'engineering'), T('T-4', 'done', 'engineering', { tier: 'B', h: 5, holder: '-' }), T('T-5', 'escalated', 'product', { holder: 'capu' })];
  const hist = [histEv(1, 'assigned', 'chief-of-staff', 'product', 'T-1'), histEv(2, 'handoff', 'engineering', 'adversary', 'T-2'), histEv(3, 'rejected', 'adversary', 'engineering', 'T-3')];
  const grab = async file => {
    const o = await open({ file, data: dash(tasks, hist), settle: 2500 });
    try { await o.page.clock.setFixedTime(new Date('2026-11-01T05:00:00Z')).catch(() => { });
      return await o.page.evaluate(() => {
        const b = document.body.cloneNode(true); b.querySelectorAll('#model').forEach(e => e.remove()); b.querySelectorAll('script').forEach(e => e.remove());
        const html = [...b.querySelectorAll('section, header, footer')].map(e => (e.id || e.className || e.tagName) + '::' + e.outerHTML.replace(/\s+/g, ' '));
        const names = new Set(); document.querySelectorAll('body *').forEach(e => { if (e.closest('#model')) return; const s = getComputedStyle(e); if (s.animationName !== 'none') names.add(s.animationName + '/' + s.animationDuration); });
        const rules = []; const walk = (rs, pre) => { for (const r of rs) { if (r.cssRules && !r.selectorText) walk(r.cssRules, pre + (r.conditionText ? '@' + r.conditionText + ' ' : r.name ? '@kf ' + r.name + ' ' : '')); else { const t = pre + r.cssText; if (!/#model|mch|\.bub|fx_b|^@kf mc-/.test(t)) rules.push(t); } } };
        for (const sh of document.styleSheets) { try { walk(sh.cssRules, ''); } catch (_) { } }
        return { html, names: [...names].sort(), rules };
      }); }
    finally { await o.ctx.close(); }
  };
  try {
    const a = await grab(bf), b = await grab(INDEX);
    const di = a.html.findIndex((x, i) => x !== b.html[i]);
    rec(11, `O1 HTML ngoài #model (Bản đồ luồng, nhân vật T-019, bảng khác) giống bản ${ref.slice(0, 8)}`, a.html.length === b.html.length && di < 0 ? null : (a.html.length !== b.html.length ? `số khối khác (${a.html.length} vs ${b.html.length})` : `khác ở khối "${a.html[di].split('::')[0]}"`));
    rec(11, 'O2 tên animation tính ra của mọi phần tử ngoài #model giống bản đối chứng', JSON.stringify(a.names) === JSON.stringify(b.names) ? null : `khác: ${JSON.stringify(a.names)} vs ${JSON.stringify(b.names)}`.slice(0, 200));
    const sa = new Set(a.rules), sb = new Set(b.rules); const lost = [...sa].filter(x => !sb.has(x)), added = [...sb].filter(x => !sa.has(x));
    const touch = added.filter(x => /\.chr|\.st-|\.c-(arm|prop|rays)|\.fx-|\.role-/.test(x));   // luật mới được phép nếu không đụng selector của T-019
    rec(11, 'O3 mọi luật CSS cũ ngoài #model (kể cả .chr, .st-* của T-019) còn nguyên, không luật mới nào đụng selector T-019', lost.length || touch.length ? `mất/đổi ${lost.length} luật${lost[0] ? ': ' + lost[0].slice(0, 90) : ''}; luật mới đụng T-019: ${touch.length}${touch[0] ? ' ' + touch[0].slice(0, 90) : ''}` : null);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ---------- tiêu chí 12: ảnh đã commit ----------
const SHOT_NAMES = ['idle', 'work', 'work-2', 'give', 'take', 'wait', 'bubble', 'reduced-motion', 'phone-390', 'dark', 'dark-work'];
function runShotsCommitted() {
  const d = `docs/screenshots/${TASK}`; let files = [];
  try { files = cp.execFileSync('git', ['-C', REPO, 'ls-tree', '--name-only', REF, d + '/'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean); } catch (_) { }
  const missing = [], hashes = new Map();
  for (const n of SHOT_NAMES) { const f = files.find(x => path.basename(x) === n + '.png'); if (!f) { missing.push(n + '.png (không có)'); continue; }
    const b = cp.execFileSync('git', ['-C', REPO, 'show', REF + ':' + f], { maxBuffer: 1 << 26 });
    if (b.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') { missing.push(n + '.png (không phải PNG)'); continue; }
    if (n === 'phone-390' && b.readUInt32BE(16) !== 390) missing.push(`phone-390.png rộng ${b.readUInt32BE(16)}px (cần đúng 390)`);
    const h = crypto.createHash('sha1').update(b).digest('hex'); if (hashes.has(h)) missing.push(`${n}.png giống hệt ${hashes.get(h)}.png`); else hashes.set(h, n); }
  rec(12, `K1 ${d}/ đã commit ở ${REF} đủ ${SHOT_NAMES.length} ảnh PNG, mỗi ảnh khác nhau`, missing.length ? 'thiếu/lỗi: ' + missing.join('; ') : null);
}

// ---------- chụp ảnh (--shots): chờ tới khi ĐANG cử động, đóng băng rồi mới chụp ----------
async function takeShots(dir) {
  const out = {}; const paths = null; const notes = [];
  const rest = {};
  { const o = await open({ data: dash([]) }); const l = await logOf(o); const last = l[l.length - 1]; for (const id of CHARS) rest[id] = [ch(last, id).cx, ch(last, id).cy]; out.idle = await (await o.page.$('#model')).screenshot(); await o.ctx.close(); }
  const freeze = o => o.page.evaluate(() => { document.getAnimations().forEach(a => a.pause()); });
  const catchIt = async (o, id, kind, dir) => {
    const dv = DV[dir] || [0, 0];
    await o.page.waitForFunction(({ id, kind, rest, dv }) => { const L = window.__fx.log; const r = L[L.length - 1]; const c = r && r.ch[id]; if (!c) return false; const dx = c.cx - rest[0], dy = c.cy - rest[1];
      if (kind === 'work') return c.s === 'work' && Math.abs(dy) >= 1.2; if (kind === 'give') return c.s === 'give' && (dx * dv[0] + dy * dv[1]) >= 3; if (kind === 'take') return c.s === 'take' && -dy >= 2; if (kind === 'wait') return c.s === 'wait' && Math.abs(dx) >= 1.2; return false; },
      { id, kind, rest: rest[id], dv }, { polling: 'raf', timeout: 9000 });
    await freeze(o); await o.page.waitForTimeout(60);
    const c = await o.page.evaluate(id => window.__fx.snap(id), id); const dx = c.cx - rest[id][0], dy = c.cy - rest[id][1];
    const ok = c.s === kind && (kind === 'work' ? Math.abs(dy) >= 1.2 : kind === 'give' ? (dx * dv[0] + dy * dv[1]) >= 3 : kind === 'take' ? -dy >= 2 : Math.abs(dx) >= 1.2);
    if (!ok) throw new Error(`ảnh ${kind} (${id}): lúc chụp state=${c.s}, lệch (${dx.toFixed(1)}, ${dy.toFixed(1)}) không đạt ngưỡng cử động`);
    notes.push(`${kind} ${id}: lệch (${dx.toFixed(1)}, ${dy.toFixed(1)}) đơn vị lúc chụp`); return c;
  };
  const workTasks = [T('T-4', 'doing', 'engineering'), T('T-1', 'doing', 'product', { reviewer: 'spec-critic' }), T('T-8', 'doing', 'insight')];
  { const o = await open({ data: dash(workTasks) }); const c1 = await catchIt(o, 'nd_exec', 'work');
    out.work = await (await o.page.$('#model')).screenshot();
    await o.page.evaluate(() => document.getAnimations().forEach(a => a.play())); await o.page.waitForTimeout(80);
    await o.page.waitForFunction(({ y }) => { const L = window.__fx.log; const c = L[L.length - 1].ch.nd_exec; return Math.abs(c.cy - y) >= 1.0; }, { y: c1.cy }, { polling: 'raf', timeout: 5000 });
    await freeze(o); await o.page.waitForTimeout(60); out['work-2'] = await (await o.page.$('#model')).screenshot(); await o.ctx.close(); }
  const M6 = CASES.find(c => c.id === 'M6'); const C = await (async () => { const o = await open({ data: dash([]) }); const c = await getCenters(o.page); await o.ctx.close(); return c; })();
  const dir6 = dirOf(C, 'nd_exec', 'gt_code');
  { const o = await open({ data: dash(M6.tasks) }); await send(o, live(M6.ev)); await catchIt(o, 'nd_exec', 'give', dir6); out.give = await (await o.page.$('#model')).screenshot(); await o.ctx.close(); }
  { const o = await open({ data: dash(M6.tasks) }); await send(o, live(M6.ev)); await catchIt(o, 'gt_code', 'take'); out.take = await (await o.page.$('#model')).screenshot();
    await o.ctx.close(); }
  { const o = await open({ data: dash([T('T-7', 'escalated', 'engineering', { holder: 'capu' })]) }); await catchIt(o, 'nd_capu', 'wait'); out.wait = await (await o.page.$('#model')).screenshot(); await o.ctx.close(); }
  { const o = await open({ data: dash(M6.tasks) }); await send(o, live(M6.ev)); await o.page.waitForFunction(() => { const L = window.__fx.log; return L[L.length - 1].b.length > 0; }, null, { polling: 'raf', timeout: 5000 });
    await o.page.waitForTimeout(150); const n = await o.page.evaluate(() => document.querySelectorAll('#fx_b .bub').length); if (!n) throw new Error('ảnh bubble: lúc chụp không còn bong bóng'); out.bubble = await (await o.page.$('#model')).screenshot(); await o.ctx.close(); }
  { const o = await open({ reduce: true, data: dash(M6.tasks) }); await send(o, live(M6.ev)); await o.page.waitForFunction(() => { const L = window.__fx.log; const r = L[L.length - 1]; return r.ch.gt_code.s === 'take' && r.b.length > 0; }, null, { polling: 'raf', timeout: 5000 });
    const ca = await o.page.evaluate(() => window.__fx.log[window.__fx.log.length - 1].ca); if (ca > 0) throw new Error('ảnh reduced-motion: còn animation chạy'); out['reduced-motion'] = await (await o.page.$('#model')).screenshot(); await o.ctx.close(); }
  { const o = await open({ vp: { width: 390, height: 844 }, data: dash(M6.tasks) }); await send(o, live(M6.ev)); await o.page.waitForFunction(() => { const L = window.__fx.log; const r = L[L.length - 1]; return r.ch.nd_exec.s === 'give' && r.b.length > 0; }, null, { polling: 'raf', timeout: 5000 });
    const b = await (await o.page.$('#model')).boundingBox(); out['phone-390'] = await o.page.screenshot({ fullPage: true, clip: { x: 0, y: b.y + (await o.page.evaluate(() => window.scrollY)), width: 390, height: Math.min(b.height, 1400) } }); await o.ctx.close(); }
  { const o = await open({ dark: true, data: dash([]) }); out.dark = await (await o.page.$('#model')).screenshot(); await o.ctx.close(); }
  { const o = await open({ dark: true, data: dash(workTasks) }); await catchIt(o, 'nd_exec', 'work'); out['dark-work'] = await (await o.page.$('#model')).screenshot(); await o.ctx.close(); }
  fs.mkdirSync(dir, { recursive: true });
  for (const n of SHOT_NAMES) { if (!out[n]) throw new Error('thiếu ảnh ' + n); fs.writeFileSync(path.join(dir, n + '.png'), out[n]); }
  const hs = new Set(SHOT_NAMES.map(n => crypto.createHash('sha1').update(out[n]).digest('hex'))); if (hs.size !== SHOT_NAMES.length) throw new Error('có ảnh giống hệt nhau');
  notes.forEach(n => console.log('  ' + n)); console.log(`Đã chụp ${SHOT_NAMES.length} ảnh vào ${dir}`);
}

// ---------- chạy ----------
(async () => {
  browser = await chromium.launch();
  try {
    const probe = await open({ data: dash([]) }); const paths = await getPaths(probe.page); const C = await getCenters(probe.page); await probe.ctx.close();
    if (!Object.keys(paths).length) { console.log('FAIL không thấy đường p_* trong #model svg'); process.exit(1); }
    if (SHOTS) { const dir = path.resolve(SHOTS === true ? path.join(REPO, 'docs/screenshots', TASK) : SHOTS);
      try { await takeShots(dir); } catch (e) { console.log('FAIL ' + (e && e.message || e)); await browser.close(); process.exit(1); } await browser.close(); console.log('PASS'); process.exit(0); }
    const G = (crit, p) => p.catch(e => rec(crit, 'lỗi đo (thiếu phần tử hay sai hợp đồng quan sát?)', String(e && e.message || e).split('\n')[0].slice(0, 160)));
    const par = (...f) => Promise.all(f);
    if (want(4) || want(5) || want(10)) { for (let i = 0; i < CASES.length; i += 6) await par(...CASES.slice(i, i + 6).map(c => G(4, runCase(c, paths, C, false)))); await G(4, runM19(paths, C)); }
    const B = [];
    if (want(1)) B.push(G(1, runStructure()));
    if (want(2) || want(10)) B.push(G(2, runIdle()));
    if (want(3)) B.push(G(3, runWork()));
    if (want(4) || want(5)) B.push(G(4, runIgnoredAndOld()));
    if (want(6)) B.push(G(6, runWait()));
    if (want(7)) { B.push(G(7, runReducedStates(paths, C))); }
    if (want(8)) B.push(G(8, runPhoneDark(paths, C)));
    if (want(9)) B.push(G(9, runInvariants()));
    if (want(11)) B.push(G(11, runOthers()));
    await par(...B);
    if (want(7)) { const RC = ['M1', 'M5', 'M6', 'M9', 'M14', 'M18'].map(id => CASES.find(c => c.id === id)); for (let i = 0; i < RC.length; i += 3) await par(...RC.slice(i, i + 3).map(c => G(7, runCase(c, paths, C, true)))); }
    if (want(5) || want(10)) await G(5, runBurst());
    if (want(12)) runShotsCommitted();
    if (want(10)) { runStatic(); runNetwork(); }
  } catch (e) { console.log('FAIL lỗi chạy eval: ' + (e && e.stack || e)); await browser.close(); process.exit(1); }
  await browser.close();
  const TITLES = { 1: 'cấu trúc: 11 nhân vật đúng khối, bộ phận, cỡ, vị trí', 2: 'khối rảnh: mờ, chớp mắt chậm, yên', 3: 'khối đang xử lý: sáng và làm việc', 4: 'giao/nhận theo M1–M19, sự kiện bỏ qua/cũ không giao-nhận', 5: 'bong bóng thoại: chữ, thời gian, trần 3, tự tắt',
    6: 'Capu chờ quyết', 7: 'prefers-reduced-motion', 8: '390px, chế độ tối, đổi bề ngang', 9: 'bất biến dashboard/model inv-001..008', 10: 'hiệu năng, không lỗi console, không thư viện/mạng ngoài', 11: 'Bản đồ luồng, T-019, bảng khác giữ nguyên', 12: 'ảnh chụp đã commit' };
  let fails = 0; const failed = [];
  for (const c of Object.keys(R).map(Number).sort((a, b) => a - b)) {
    const bad = R[c].filter(x => !x.ok);
    for (const b of bad.slice(0, 25)) console.log(`FAIL C${c} ${b.name}: ${b.msg}`);
    if (bad.length > 25) console.log(`... và ${bad.length - 25} ý sai nữa ở C${c}`);
    if (bad.length) { fails++; failed.push('C' + c); console.log(`FAIL C${c} ${TITLES[c]} (${bad.length}/${R[c].length} ý sai)`); } else console.log(`PASS C${c} ${TITLES[c]} (${R[c].length}/${R[c].length})`);
  }
  console.log(fails ? `FAIL ${failed.join(', ')} chưa đạt` : 'PASS');
  process.exit(fails ? 1 : 0);
})();
