#!/usr/bin/env node
// Eval tầng 1 cho T-028: bảng Mô hình Eval-Gated 2029 có dot chạy và khối sáng khi xử lý
// (repo phungrk/tohong-hq-dashboard, một file index.html). Spec: products/T-028-mo-hinh-dot-chay.md.
//
//   cd /home/user/tohong-hq && bash eval/T-028/run.sh <thư-mục-repo-dashboard> [--criterion N] [--shots <thư-mục-ảnh>]
//
// In từng dòng `PASS Cn …` / `FAIL Cn.<mục> <lý do>`, rồi một dòng cuối `PASS` hoặc `FAIL <lý do>`; mã thoát 0/1.
// Dữ liệu dashboard.json, kênh live (WebSocket) và d3 đều giả/cục bộ: không gọi mạng thật.
// Hợp đồng phần tử mà eval dựa vào nằm ở mục "Hợp đồng quan sát" của spec.
//   --shots <dir>  : chỉ chụp ảnh các trạng thái (9 file PNG) vào <dir>, không kiểm gì khác.
//   BASE_REF=<ref> : bản đối chứng cho tiêu chí 9 (mặc định: merge-base của HEAD với origin/main, hoặc 326027c).
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--criterion', '--shots', '--ref']);
const flag = n => { const i = args.indexOf(n); return i < 0 ? null : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const REPO = path.resolve(args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(args[i - 1])) || '.');
const ONLY = flag('--criterion') ? Number(String(flag('--criterion')).replace(/^C/i, '')) : null;
const SHOTS = flag('--shots');
const REF = flag('--ref') || 'HEAD';
const INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt biến môi trường D3=/đường/dẫn/d3.min.js'); process.exit(1); }
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO); process.exit(1); }

// ---------- hằng số theo spec ----------
const HEX = { spec: '#14754d', code: '#2b7fb8', back: '#d9931f', bad: '#d33', ins: '#8a5cf6' };
const rgbOf = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const RGB = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [k, rgbOf(v)]));
const BLOCKS = ['nd_intents', 'nd_spec', 'nd_respec', 'nd_exec', 'nd_rework', 'nd_capu', 'gt_spec', 'gt_code', 'nd_kr', 'nd_rel', 'nd_prod', 'nd_insight', 'src_data', 'src_inc', 'src_fb'];
const RES = new Set(['nd_kr', 'nd_prod']);   // khối loại .res: nền 22%; còn lại 18%
const DOT_CAP = 12, HOLD_MAX_MS = 10000, PING_MS = 600;
const ALLOWED_HOSTS = ['cdnjs.cloudflare.com', 'raw.githubusercontent.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'tohong-live.phungnc.workers.dev', 'localhost', '127.0.0.1', ''];

// ---------- dữ liệu giả ----------
const T = (id, state, owner, o = {}) => ({ id, title: 'Việc ' + id, state, holder: o.holder || owner, owner, reviewer: o.reviewer || 'adversary', rounds: o.rounds || 0,
  version: 1, deadline: '', budget: '', cost: 0, created: '2026-10-30T09:00', updated: '2026-11-01T09:00', hours_since_update: o.h === undefined ? 2 : o.h,
  tier: o.tier === undefined ? 'A' : o.tier, area: 'dashboard/model', evals: 1, spec_returns: 0, evals_added: 0 });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent',
  reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const model = n => ({ invariants: { 'dashboard/model': 1 }, invariants_total: 1, adversarial_evals: 1, regression_evals: 0, insight_reports: n === undefined ? 1 : n, last_insight: '2026-10-25-weekly.md', specs: 2 });
const dash = (tasks, events = [], m = model()) => ({ generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events, roster, model: m });
let evN = 0;
const live = o => ({ type: 'event', id: 'E-' + (9000 + (++evN)), t: '2026-11-01T12:00', round: 0, severity: '', cost: 0, title: '', ...o });
const histEv = (i, event, from, to, task) => ({ seq: 'S-' + i, ledger_id: 'E-' + i, t: '2026-10-31T10:0' + (i % 10), task, title: '', event, from, to, round: 0, severity: '', detail: '', link: '', cost: 0, state: '', holder: '' });

// ---------- bộ lấy mẫu trong trang ----------
const SAMPLER = `(() => {
  const W = window.__fx = { log: [], created: 0, maxTotal: 0, maxGap: 0, last: 0 };
  const IDS = ${JSON.stringify(BLOCKS)};
  const mo = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && n.tagName.toLowerCase() === 'circle' && n.parentNode && n.parentNode.id === 'fx_f') W.created++; });
  mo.observe(document, { childList: true, subtree: true });
  const tick = t => {
    if (W.last) W.maxGap = Math.max(W.maxGap, t - W.last); W.last = t;
    const rec = { t, d: [], total: 0, lit: {} };
    const layer = document.getElementById('fx_f'), svg = document.querySelector('#model svg');
    if (layer && svg && svg.getScreenCTM()) {
      const inv = svg.getScreenCTM().inverse(); const cs = layer.querySelectorAll('circle');
      rec.total = cs.length; W.maxTotal = Math.max(W.maxTotal, cs.length);
      for (const c of cs) { const st = getComputedStyle(c);
        if (parseFloat(st.opacity) > 0.05) { const m = c.getScreenCTM(); if (!m) continue; const q = new DOMPoint(c.cx.baseVal.value, c.cy.baseVal.value).matrixTransform(m); const p = q.matrixTransform(inv);
          const rr = parseFloat(st.r) || c.r.baseVal.value; rec.d.push([p.x, p.y, st.fill, 2 * rr * Math.hypot(m.a, m.b)]); } }
    }
    for (const id of IDS) { const g = document.getElementById(id); if (!g) continue; const s = g.querySelector(':scope > rect, :scope > circle'); if (!s) continue;
      const st = getComputedStyle(s); rec.lit[id] = [parseFloat(st.strokeWidth) || 0, st.stroke, st.fill]; }
    W.log.push(rec); requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

// ---------- trình duyệt ----------
let browser;
const allErrors = [], allHosts = new Set();
async function open(opt = {}) {
  const ctx = await browser.newContext({ viewport: opt.vp || { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: opt.reduce ? 'reduce' : 'no-preference', colorScheme: 'light' });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
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
const statsOf = o => o.page.evaluate(() => ({ created: window.__fx.created, maxTotal: window.__fx.maxTotal, maxGap: window.__fx.maxGap }));
const getPaths = page => page.evaluate(() => { const out = {}; document.querySelectorAll('#model path[id^="p_"]').forEach(p => { const L = p.getTotalLength(), pts = []; for (let s = 0; s <= L; s += 2) { const q = p.getPointAtLength(s); pts.push([q.x, q.y]); } const e = p.getPointAtLength(L); pts.push([e.x, e.y]); out[p.id] = pts; }); return out; });

// ---------- phân tích ----------
const toRGB = s => { if (!s) return null; let m = /rgba?\(([^)]+)\)/.exec(s); if (m) return m[1].split(/[ ,\/]+/).filter(Boolean).slice(0, 3).map(Number);
  m = /color\(srgb ([^)]+)\)/.exec(s); if (m) return m[1].split(/[ \/]+/).slice(0, 3).map(x => Math.round(parseFloat(x) * 255)); return null; };
const near = (a, b, tol) => a && b && a.every((v, i) => Math.abs(v - b[i]) <= tol);
const mix = (c, p, pct) => c.map((v, i) => Math.round(v * pct + p[i] * (1 - pct)));
const dist = (pt, poly) => { let m = 1e9; for (const q of poly) { const d = Math.hypot(pt[0] - q[0], pt[1] - q[1]); if (d < m) m = d; } return m; };
const at = (log, t) => { let b = null, bd = 1e12; for (const r of log) { const d = Math.abs(r.t - t); if (d < bd) { bd = d; b = r; } } return b; };
const between = (log, a, b) => log.filter(r => r.t >= a && r.t <= b);
const litOf = (rec, id) => { const l = rec && rec.lit[id]; return l ? { on: l[0] >= 2.5, w: l[0], stroke: toRGB(l[1]), fill: toRGB(l[2]) } : null; };

// phân tích dot của một sự kiện trong cửa sổ [t0, t1]; legs = danh sách id đường mong đợi theo thứ tự
function analyzeDots(log, t0, t1, paths, legs, colorKey) {
  const seg = between(log, t0, t1); const smp = [];
  for (const r of seg) for (const d of r.d) smp.push({ t: r.t, p: [d[0], d[1]], fill: toRGB(d[2]), w: d[3], conc: r.d.length });
  const out = { n: smp.length, problems: [] };
  if (!smp.length) { out.problems.push('không có dot nào xuất hiện'); return out; }
  out.first = smp[0].t; out.last = smp[smp.length - 1].t; out.startLag = out.first - t0;
  out.maxConc = Math.max(...seg.map(r => r.d.length));
  out.sizes = [Math.min(...smp.map(s => s.w)), Math.max(...smp.map(s => s.w))];
  if (out.startLag > 1500) out.problems.push(`dot xuất hiện quá muộn (${Math.round(out.startLag)}ms sau sự kiện)`);
  if (out.maxConc > 1) out.problems.push(`một sự kiện sinh ${out.maxConc} dot cùng lúc (phải đúng một dot)`);
  // gán mỗi mẫu cho đường mong đợi gần nhất
  const idx = smp.map(s => { let bi = 0, bd = 1e9; legs.forEach((id, i) => { const d = dist(s.p, paths[id] || []); if (d < bd) { bd = d; bi = i; } }); return { i: bi, d: bd }; });
  const onFrac = idx.filter(x => x.d <= 5).length / smp.length; out.onFrac = onFrac;
  if (onFrac < 0.85) {
    let seen = new Set(); for (const s of smp) { let bi = null, bd = 1e9; for (const [id, poly] of Object.entries(paths)) { const d = dist(s.p, poly); if (d < bd) { bd = d; bi = id; } } if (bd <= 5) seen.add(bi); }
    out.problems.push(`dot không nằm trên đường ${legs.join(' → ')} (${Math.round(onFrac * 100)}% mẫu trên đường; thấy trên: ${[...seen].join(', ') || 'không đường nào'})`);
  }
  // thứ tự chặng, mỗi chặng 0,7–2,8 giây
  const order = idx.map(x => x.i); for (let k = 1; k < order.length; k++) if (order[k] < order[k - 1]) { out.problems.push('dot đi sai thứ tự các đường'); break; }
  legs.forEach((id, i) => { const ts = smp.filter((s, k) => idx[k].i === i && idx[k].d <= 5).map(s => s.t);
    if (ts.length < 3) out.problems.push(`không thấy dot chạy trên ${id}`);
    else { const dur = ts[ts.length - 1] - ts[0]; if (dur < 700 || dur > 2800) out.problems.push(`dot chạy hết ${id} trong ${Math.round(dur)}ms (phải 0,7–2,8 giây)`); } });
  const p0 = paths[legs[0]], pN = paths[legs[legs.length - 1]];
  if (p0 && dist(smp[0].p, [p0[0]]) > 16) out.problems.push(`dot không xuất phát từ đầu đường ${legs[0]}`);
  if (pN && dist(smp[smp.length - 1].p, [pN[pN.length - 1]]) > 16) out.problems.push(`dot không tới cuối đường ${legs[legs.length - 1]}`);
  out.colorProblems = [];
  const want = RGB[colorKey]; const bad = smp.filter(s => !near(s.fill, want, 3));
  if (bad.length) out.colorProblems.push(`màu dot ${JSON.stringify(bad[0].fill)} khác ${HEX[colorKey]}`);
  return out;
}
// khối đích phải sáng đúng màu và đúng nền (18% hoặc 22%) tại thời điểm t
function checkLit(log, id, t, colorKey, panel) {
  const l = litOf(at(log, t), id); if (!l) return `không đọc được khối ${id}`;
  if (!l.on) return `${id} không sáng (viền ${l.w}px, cần 3px)`;
  if (Math.abs(l.w - 3) > 0.3) return `${id} viền ${l.w}px (cần 3px)`;
  if (!near(l.stroke, RGB[colorKey], 3)) return `${id} viền màu ${JSON.stringify(l.stroke)} khác ${HEX[colorKey]}`;
  const want = mix(RGB[colorKey], panel, RES.has(id) ? 0.22 : 0.18);
  if (!near(l.fill, want, 7)) return `${id} nền ${JSON.stringify(l.fill)} khác color-mix ${RES.has(id) ? 22 : 18}% = ${JSON.stringify(want)}`;
  return null;
}
const checkOff = (log, id, t) => { const l = litOf(at(log, t), id); if (!l) return `không đọc được khối ${id}`; return l.on ? `${id} vẫn sáng (viền ${l.w}px) lúc ${Math.round(t)}` : null; };
const checkOn = (log, id, t) => { const l = litOf(at(log, t), id); if (!l) return `không đọc được khối ${id}`; return l.on ? null : `${id} không sáng lúc cần sáng`; };

// ---------- sổ kết quả ----------
const R = {};   // tiêu chí -> [{ok,msg}]
const rec = (c, name, err) => { (R[c] = R[c] || []).push({ name, ok: !err, msg: err || '' }); };
const want = c => ONLY === null || ONLY === c;
const panelOf = page => page.evaluate(() => { const v = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || '#fff';
  const h = v.replace('#', ''); const f = h.length === 3 ? [...h].map(c => c + c).join('') : h; return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)); });

// ---------- Bảng ánh xạ (bản máy đọc của mục "Bảng ánh xạ" trong spec) ----------
// tasks: dữ liệu dashboard.json trước sự kiện; ev: sự kiện live; legs: các đường; target: khối đích cuối cùng và kiểu giữ
const CASES = [
  { id: 'M1', name: 'assigned → product', tasks: [], ev: { task: 'T-901', event: 'assigned', from: 'chief-of-staff', to: 'product', state: 'new', holder: 'product', owner: 'product', reviewer: 'spec-critic' }, legs: ['p_intent_spec'], color: 'spec', target: 'nd_spec', mode: 'hold' },
  { id: 'M2', name: 'assigned → engineering', tasks: [], ev: { task: 'T-901', event: 'assigned', from: 'chief-of-staff', to: 'engineering', state: 'new', holder: 'engineering', owner: 'engineering' }, legs: ['p_gate_exec'], color: 'code', target: 'nd_exec', mode: 'hold' },
  { id: 'M3', name: 'assigned → insight', tasks: [], ev: { task: 'T-901', event: 'assigned', from: 'chief-of-staff', to: 'insight', state: 'new', holder: 'insight', owner: 'insight' }, legs: ['p_src1'], color: 'ins', target: 'nd_insight', mode: 'hold', ceiling: true },
  { id: 'M4', name: 'started engineering, vòng ≥ 1', tasks: [T('T-901', 'rework', 'engineering', { rounds: 1 })], ev: { task: 'T-901', event: 'started', from: 'engineering', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering', round: 1, rounds: 1 }, legs: ['p_rework_exec'], color: 'back', target: 'nd_exec', mode: 'hold' },
  { id: 'M5', name: 'handoff từ product', tasks: [T('T-901', 'doing', 'product', { reviewer: 'spec-critic' })], ev: { task: 'T-901', event: 'handoff', from: 'product', to: 'spec-critic', state: 'review', holder: 'spec-critic', owner: 'product', reviewer: 'spec-critic' }, legs: ['p_spec_gate'], color: 'spec', target: 'gt_spec', mode: 'hold' },
  { id: 'M6', name: 'handoff từ engineering', tasks: [T('T-901', 'doing', 'engineering')], ev: { task: 'T-901', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' }, legs: ['p_exec_gate'], color: 'code', target: 'gt_code', mode: 'hold' },
  { id: 'M7', name: 'handoff từ insight', tasks: [T('T-901', 'doing', 'insight')], ev: { task: 'T-901', event: 'handoff', from: 'insight', to: 'reviewer', state: 'review', holder: 'reviewer', owner: 'insight' }, legs: ['p_insight_intent'], color: 'ins', target: 'nd_intents', mode: 'ping' },
  { id: 'M8', name: 'accepted, việc của product (Spec Gate qua)', tasks: [T('T-901', 'review', 'product', { reviewer: 'spec-critic' })], ev: { task: 'T-901', event: 'accepted', from: 'spec-critic', to: 'done', state: 'done', holder: '-', owner: 'product', reviewer: 'spec-critic' }, legs: ['p_gate_kr'], color: 'spec', target: 'nd_kr', mode: 'ping' },
  { id: 'M9', name: 'accepted, việc của engineering, bậc A', tasks: [T('T-901', 'review', 'engineering', { tier: 'A' })], ev: { task: 'T-901', event: 'accepted', from: 'adversary', to: 'done', state: 'done', holder: '-', owner: 'engineering' }, legs: ['p_gate_rel', 'p_rel_res'], color: 'code', target: 'nd_prod', mode: 'ping', mid: 'nd_rel' },
  { id: 'M10', name: 'accepted, việc của engineering, bậc B', tasks: [T('T-901', 'review', 'engineering', { tier: 'B' })], ev: { task: 'T-901', event: 'accepted', from: 'adversary', to: 'done', state: 'done', holder: '-', owner: 'engineering' }, legs: ['p_gate_capu'], color: 'code', target: 'nd_capu', mode: 'hold' },
  { id: 'M11', name: 'accepted, việc của insight', tasks: [T('T-901', 'review', 'insight')], ev: { task: 'T-901', event: 'accepted', from: 'reviewer', to: 'done', state: 'done', holder: '-', owner: 'insight' }, legs: ['p_insight_kr'], color: 'ins', target: 'nd_kr', mode: 'ping' },
  { id: 'M12', name: 'rejected state=spec, việc của product (Spec Gate chặn)', tasks: [T('T-901', 'review', 'product', { reviewer: 'spec-critic' })], ev: { task: 'T-901', event: 'rejected', from: 'spec-critic', to: 'product', state: 'spec', holder: 'product', owner: 'product', reviewer: 'spec-critic', severity: 'blocker', round: 1 }, legs: ['p_gate_respec'], color: 'back', target: 'nd_respec', mode: 'hold' },
  { id: 'M13', name: 'rejected state=spec, việc của engineering (Code Gate: spec lệch)', tasks: [T('T-901', 'review', 'engineering')], ev: { task: 'T-901', event: 'rejected', from: 'adversary', to: 'engineering', state: 'spec', holder: 'product', owner: 'engineering', severity: 'blocker', round: 1 }, legs: ['p_gate_respec2'], color: 'back', target: 'nd_respec', mode: 'hold' },
  { id: 'M14', name: 'rejected state=rework (Code Gate: code sai)', tasks: [T('T-901', 'review', 'engineering')], ev: { task: 'T-901', event: 'rejected', from: 'adversary', to: 'engineering', state: 'rework', holder: 'engineering', owner: 'engineering', severity: 'blocker', round: 1 }, legs: ['p_gate_rework'], color: 'back', target: 'nd_rework', mode: 'hold' },
  { id: 'M15', name: 'respec', tasks: [T('T-901', 'spec', 'engineering', { holder: 'product' })], ev: { task: 'T-901', event: 'respec', from: 'product', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering' }, legs: ['p_respec_spec'], color: 'spec', target: 'nd_spec', mode: 'hold' },
  { id: 'M16', name: 'evalplus', tasks: [T('T-901', 'review', 'engineering')], ev: { task: 'T-901', event: 'evalplus', from: 'adversary', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering' }, legs: ['p_gate_kr2'], color: 'ins', target: 'nd_kr', mode: 'ping' },
  { id: 'M17', name: 'escalated → capu', tasks: [T('T-901', 'doing', 'engineering')], ev: { task: 'T-901', event: 'escalated', from: 'chief-of-staff', to: 'capu', state: 'escalated', holder: 'capu', owner: 'engineering' }, legs: ['p_gate_capu'], color: 'bad', target: 'nd_capu', mode: 'hold' },
  { id: 'M18', name: 'decided (Capu quyết, việc quay lại doing)', tasks: [T('T-901', 'escalated', 'engineering', { holder: 'capu' })], ev: { task: 'T-901', event: 'decided', from: 'capu', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering' }, legs: ['p_capu_exec'], color: 'back', target: 'nd_exec', mode: 'hold' },
];
// sự kiện bỏ qua: không được sinh dot nào
const IGNORED = [
  ['rejected severity=minor (accepted theo sau sẽ vẽ)', { event: 'rejected', from: 'adversary', to: 'engineering', state: 'review', owner: 'engineering', severity: 'minor' }],
  ['rejected state=escalated (escalated theo sau sẽ vẽ)', { event: 'rejected', from: 'adversary', to: 'engineering', state: 'escalated', holder: 'chief-of-staff', owner: 'engineering', severity: 'blocker' }],
  ['rejected state=rework, việc của product', { event: 'rejected', from: 'spec-critic', to: 'product', state: 'rework', holder: 'product', owner: 'product', severity: 'blocker' }],
  ['blocked', { event: 'blocked', from: 'chief-of-staff', to: 'chief-of-staff', state: 'blocked', holder: 'chief-of-staff', owner: 'engineering' }],
  ['unblocked', { event: 'unblocked', from: 'chief-of-staff', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering' }],
  ['cost', { event: 'cost', from: 'engineering', to: 'engineering', cost: 0.5 }],
  ['requested', { event: 'requested', from: 'capu', to: 'chief-of-staff' }],
  ['file_written', { event: 'file_written', from: 'product', to: 'products' }],
  ['board_edited_directly', { event: 'board_edited_directly', from: 'engineering', to: 'board', severity: 'warning' }],
  ['decided state=done (Capu đóng việc)', { event: 'decided', from: 'capu', to: 'done', state: 'done', holder: '-', owner: 'engineering' }],
  ['assigned → chief-of-staff', { event: 'assigned', from: 'chief-of-staff', to: 'chief-of-staff', state: 'new', holder: 'chief-of-staff', owner: 'chief-of-staff' }],
  ['started của product', { event: 'started', from: 'product', to: 'product', state: 'doing', holder: 'product', owner: 'product' }],
  ['started của engineering, vòng 0', { event: 'started', from: 'engineering', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering', round: 0 }],
  ['handoff từ chief-of-staff', { event: 'handoff', from: 'chief-of-staff', to: 'reviewer', state: 'review', holder: 'reviewer', owner: 'chief-of-staff' }],
  ['accepted, việc của chief-of-staff', { event: 'accepted', from: 'reviewer', to: 'done', state: 'done', holder: '-', owner: 'chief-of-staff' }],
  ['rejected không có state và không rõ việc', { task: 'T-NOPE', event: 'rejected', from: 'reviewer', to: 'someone' }],
  ['accepted không rõ chủ việc', { task: 'T-NOPE', event: 'accepted', from: 'reviewer', to: 'done' }],
  ['escalated không tới capu', { event: 'escalated', from: 'chief-of-staff', to: 'chief-of-staff', state: 'escalated', holder: 'chief-of-staff', owner: 'engineering' }],
];

// ---------- kịch bản 1: từng dòng bảng ánh xạ (tiêu chí 1, 2, 3) ----------
async function runMapping(c, paths) {
  const waitMs = c.ceiling ? 13500 : (c.legs.length > 1 ? 8500 : 4800);
  const o = await open({ data: dash(c.tasks) });
  try {
    const panel = await panelOf(o.page);
    const t0 = await send(o, live(c.ev)); await o.page.waitForTimeout(waitMs);
    const log = await logOf(o); const a = analyzeDots(log, t0, t0 + waitMs, paths, c.legs, c.color);
    const tag = `${c.id} ${c.name} → ${c.legs.join(' → ')}`;
    rec(1, tag, a.problems.length ? a.problems[0] : null);
    if (c.id === 'M6') rec(7, 'P0 1280px: dot hiển thị đường kính 7–16px (đo được ' + (a.sizes ? a.sizes.map(x => x.toFixed(1)).join('–') : '?') + ')', a.sizes && a.sizes[0] >= 7 && a.sizes[1] <= 16 ? null : 'dot ngoài khoảng 7–16px');
    rec(2, tag, (a.colorProblems && a.colorProblems[0]) || (a.n ? null : 'không có dot để đo màu'));
    if (a.n) {
      const arrive = a.last;
      let err = checkLit(log, c.target, arrive + 350, c.color, panel);
      if (!err && c.mid) { // khối giữa chuỗi (Release) cũng phải sáng khi dot ở đó
        const midSmp = between(log, t0, t0 + waitMs).filter(r => r.d.length && dist([r.d[0][0], r.d[0][1]], paths[c.legs[1]].slice(0, 1)) < 16);
        err = midSmp.length ? checkLit(log, c.mid, midSmp[0].t - 60, c.color, panel) || null : `không thấy dot ở khối ${c.mid}`;
        if (err) err = `khối giữa chuỗi: ${err}`;
      }
      if (!err && c.mode === 'ping') err = checkOff(log, c.target, arrive + 1800 + PING_MS * 0);
      if (!err && c.mode === 'hold' && !c.ceiling) err = checkOn(log, c.target, arrive + 1800);
      if (!err && c.ceiling) { err = checkOn(log, c.target, arrive + 3000) || checkOff(log, c.target, arrive + HOLD_MAX_MS + 1500); if (err) err = 'giữ tối đa 10 giây rồi tắt: ' + err; }
      rec(3, tag + ' (khối đích sáng/tắt)', err);
    } else rec(3, tag + ' (khối đích sáng/tắt)', 'không có dot nên không đo được khối');
    // C8: không lỗi console ở từng ca
    rec(8, tag + ' (console)', o.errors.length ? o.errors[0] : null);
  } finally { await o.ctx.close(); }
}

// ---------- kịch bản 2: dòng chảy một việc, khối nguồn tắt khi dot rời, khối đích sáng (tiêu chí 3) ----------
async function runFlow(paths) {
  const o = await open({ data: dash([T('T-901', 'doing', 'engineering', { tier: 'B' })]) });
  try {
    const panel = await panelOf(o.page);
    let log = await logOf(o); const l0 = at(log, log[log.length - 1].t);
    rec(3, 'F0 trước mọi sự kiện: Agent code sáng vì có việc đang code (không cần dot)', checkLit(log, 'nd_exec', l0.t, 'code', panel));
    const base = { owner: 'engineering', task: 'T-901' };
    const steps = [
      { n: 'F1 handoff engineering', ev: { ...base, event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary' }, leg: 'p_exec_gate', color: 'code', tgt: 'gt_code', tOn: true },
      { n: 'F2 rejected rework', ev: { ...base, event: 'rejected', from: 'adversary', to: 'engineering', state: 'rework', holder: 'engineering', severity: 'blocker', round: 1 }, leg: 'p_gate_rework', color: 'back', tgt: 'nd_rework', src: 'gt_code', tOn: true },
      { n: 'F3 started vòng 1', ev: { ...base, event: 'started', from: 'engineering', to: 'engineering', state: 'doing', holder: 'engineering', round: 1, rounds: 1 }, leg: 'p_rework_exec', color: 'back', tgt: 'nd_exec', src: 'nd_rework', tOn: true },
      { n: 'F4 handoff engineering lần 2', ev: { ...base, event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', round: 1 }, leg: 'p_exec_gate', color: 'code', tgt: 'gt_code', src: null, tOn: true },
      { n: 'F5 accepted bậc B', ev: { ...base, event: 'accepted', from: 'adversary', to: 'done', state: 'done', holder: '-' }, leg: 'p_gate_capu', color: 'code', tgt: 'nd_capu', src: 'gt_code', tOn: true },
    ];
    for (const s of steps) {
      const t0 = await send(o, live(s.ev)); await o.page.waitForTimeout(4600);
      log = await logOf(o); const a = analyzeDots(log, t0, t0 + 4600, paths, [s.leg], s.color);
      if (!a.n) { rec(3, s.n, 'không có dot'); continue; }
      const dotStart = a.first, arrive = a.last;
      let err = checkLit(log, s.tgt, arrive + 350, s.color, panel);
      if (!err && s.src) err = checkOff(log, s.src, dotStart + 600) && `khối nguồn ${checkOff(log, s.src, dotStart + 600)} (dot đã rời, sổ cái không còn việc ở đó)`;
      if (!err && s.n.startsWith('F1')) err = checkOff(log, 'nd_exec', arrive + 350) && `Agent code phải tắt khi việc đã sang cổng: ${checkOff(log, 'nd_exec', arrive + 350)}`;
      if (!err && s.n.startsWith('F4')) err = checkOff(log, 'nd_exec', dotStart + 600) && `Agent code phải tắt khi dot rời: ${checkOff(log, 'nd_exec', dotStart + 600)}`;
      if (!err) err = checkOn(log, s.tgt, arrive + 1800);
      rec(3, s.n, err);
    }
    // sau F5: khối khác không sáng oan
    log = await logOf(o); const last = log[log.length - 1];
    const stray = ['nd_spec', 'nd_respec', 'gt_spec', 'nd_exec', 'nd_rework', 'gt_code', 'nd_kr', 'nd_rel', 'nd_prod', 'nd_insight', 'nd_intents'].filter(id => litOf(last, id) && litOf(last, id).on);
    rec(3, 'F6 cuối chuỗi chỉ còn Capu sáng (diff chờ đọc), mọi khối khác tắt', stray.length ? 'sáng oan: ' + stray.join(', ') : null);
    rec(8, 'flow console', o.errors.length ? o.errors[0] : null);
  } finally { await o.ctx.close(); }
}

// ---------- kịch bản 3: hai việc trong cổng, một việc đi ra, cổng vẫn sáng (tiêu chí 3) ----------
async function runTwoInGate(paths) {
  const o = await open({ data: dash([T('T-901', 'review', 'engineering'), T('T-902', 'review', 'engineering')]) });
  try {
    const panel = await panelOf(o.page);
    const t0 = await send(o, live({ task: 'T-901', event: 'rejected', from: 'adversary', to: 'engineering', state: 'rework', holder: 'engineering', owner: 'engineering', severity: 'blocker', round: 1 }));
    await o.page.waitForTimeout(4800); const log = await logOf(o); const a = analyzeDots(log, t0, t0 + 4800, paths, ['p_gate_rework'], 'back');
    const e1 = a.n ? checkLit(log, 'gt_code', a.last + 350, 'code', panel) : 'không có dot';
    rec(3, 'G1 hai việc trong Code Gate, một việc bị trả về: Code Gate vẫn sáng vì còn T-902', e1);
    const e2 = a.n ? checkLit(log, 'nd_rework', a.last + 350, 'back', panel) : 'không có dot';
    rec(3, 'G2 Code rework sáng màu hổ phách', e2);
  } finally { await o.ctx.close(); }
}

// ---------- kịch bản 3b: dot không rời khối giữ sớm hơn 1,0 giây sau khi dot trước tới (tiêu chí 3) ----------
async function runMinHold(paths) {
  const o = await open({ data: dash([T('T-901', 'doing', 'engineering')]) });
  try {
    const t0 = await send(o, live({ task: 'T-901', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' }));
    await o.page.waitForTimeout(120);
    await o.sock.send(JSON.stringify(live({ task: 'T-901', event: 'rejected', from: 'adversary', to: 'engineering', state: 'rework', holder: 'engineering', owner: 'engineering', severity: 'blocker', round: 1 })));
    await o.page.waitForTimeout(7000); const log = await logOf(o);
    const on = id => log.filter(r => r.t >= t0).map(r => r.d.map(d => ({ t: r.t, p: [d[0], d[1]] })).filter(x => dist(x.p, paths[id]) <= 5)).flat();
    const a = on('p_exec_gate'), b = on('p_gate_rework');
    rec(3, 'H1 hai sự kiện liền nhau: dot thứ hai (rời Code Gate) xuất phát không sớm hơn 1,0 giây sau khi dot thứ nhất tới Code Gate',
      !a.length || !b.length ? 'thiếu dot ở một trong hai đường' : (b[0].t - a[a.length - 1].t >= 900 ? null : `dot rời sau ${Math.round(b[0].t - a[a.length - 1].t)}ms (cần ≥ 900ms, spec 1000ms trừ dung sai khung hình)`));
  } finally { await o.ctx.close(); }
}

// ---------- kịch bản 4: khối sáng theo trạng thái sổ cái, không dot (tiêu chí 3, 5) ----------
async function runState() {
  const tasks = [T('T-1', 'doing', 'product', { reviewer: 'spec-critic' }), T('T-2', 'review', 'product', { reviewer: 'spec-critic' }), T('T-3', 'spec', 'engineering', { holder: 'product' }),
    T('T-4', 'doing', 'engineering'), T('T-5', 'rework', 'engineering'), T('T-6', 'review', 'engineering'), T('T-7', 'escalated', 'engineering', { holder: 'capu' }),
    T('T-8', 'doing', 'insight'), T('T-9', 'new', 'product', { reviewer: 'spec-critic' })];
  const hist = [histEv(1, 'assigned', 'chief-of-staff', 'engineering', 'T-4'), histEv(2, 'handoff', 'engineering', 'adversary', 'T-6'), histEv(3, 'rejected', 'adversary', 'engineering', 'T-5'),
    histEv(4, 'handoff', 'product', 'spec-critic', 'T-2'), histEv(5, 'escalated', 'chief-of-staff', 'capu', 'T-7'), histEv(6, 'assigned', 'chief-of-staff', 'insight', 'T-8')];
  const snap = [{ type: 'event', id: 'E-8001', t: '2026-11-01T10:00', task: 'T-6', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering', round: 0, severity: '', cost: 0 },
    { type: 'event', id: 'E-8002', t: '2026-11-01T10:05', task: 'T-5', event: 'rejected', from: 'adversary', to: 'engineering', state: 'rework', holder: 'engineering', owner: 'engineering', round: 1, severity: 'blocker', cost: 0 }];
  const o = await open({ data: dash(tasks, hist), snapshot: snap, settle: 1200 });
  try {
    const panel = await panelOf(o.page);
    await o.page.waitForTimeout(5500);
    const log = await logOf(o), st = await statsOf(o), last = log[log.length - 1];
    const expectOn = { nd_spec: 'spec', gt_spec: 'spec', nd_respec: 'back', nd_exec: 'code', nd_rework: 'back', gt_code: 'code', nd_capu: 'bad', nd_insight: 'ins' };
    for (const [id, c] of Object.entries(expectOn)) rec(3, `S1 khối ${id} sáng theo trạng thái sổ cái (màu ${HEX[c]})`, checkLit([last], id, last.t, c, panel));
    for (const id of ['nd_intents', 'nd_kr', 'nd_rel', 'nd_prod', 'src_data', 'src_inc', 'src_fb']) rec(3, `S1 khối rảnh ${id} không tô`, checkOff([last], id, last.t));
    rec(5, 'S2 mở trang với sự kiện cũ (dashboard.json + snapshot live), 7 giây không việc mới: không dot nào', st.created === 0 && st.maxTotal === 0 ? null : `đã tạo ${st.created} dot (tối đa ${st.maxTotal} cùng lúc) dù không có sự kiện mới`);
    rec(8, 'state console', o.errors.length ? o.errors[0] : null);
  } finally { await o.ctx.close(); }
  // chỉ Capu: diff chờ đọc (done bậc B/C < 48 giờ) -> xanh code; mọi thứ rảnh -> không tô
  const o2 = await open({ data: dash([T('T-1', 'done', 'engineering', { tier: 'B', h: 5, holder: '-' })]) });
  try { const panel = await panelOf(o2.page); const log = await logOf(o2); const last = log[log.length - 1];
    rec(3, 'S3 diff hành vi chờ đọc (bậc B xong < 48 giờ) làm khối Capu sáng màu việc/code', checkLit([last], 'nd_capu', last.t, 'code', panel)); } finally { await o2.ctx.close(); }
  const o3 = await open({ data: dash([T('T-1', 'done', 'engineering', { tier: 'A', h: 5, holder: '-' }), T('T-2', 'blocked', 'engineering', { holder: 'chief-of-staff' }), T('T-3', 'new', 'engineering'), T('T-4', 'doing', 'chief-of-staff'), T('T-5', 'new', 'product', { reviewer: 'spec-critic' }), T('T-6', 'done', 'engineering', { tier: 'B', h: 60, holder: '-' })]) });
  try { const log = await logOf(o3); const last = log[log.length - 1]; const on = BLOCKS.filter(id => litOf(last, id) && litOf(last, id).on);
    rec(3, 'S4 chỉ có việc new, blocked, của chief-of-staff, done bậc A hoặc done quá 48 giờ: không khối nào sáng', on.length ? 'sáng oan: ' + on.join(', ') : null); } finally { await o3.ctx.close(); }
}

// ---------- kịch bản 5: sự kiện bỏ qua không sinh dot (tiêu chí 1) ----------
async function runIgnored() {
  const o = await open({ data: dash([T('T-901', 'doing', 'engineering')]) });
  try {
    for (const [, ev] of IGNORED) { await o.sock.send(JSON.stringify(live({ task: 'T-901', ...ev }))); await o.page.waitForTimeout(80); }
    await o.page.waitForTimeout(3500); const st = await statsOf(o);
    rec(1, `I* ${IGNORED.length} sự kiện không ánh xạ (minor, cost, requested, blocked...) không sinh dot nào`, st.created === 0 ? null : `đã sinh ${st.created} dot cho sự kiện phải bỏ qua`);
    rec(5, 'I* sự kiện bỏ qua không tạo dot giả', st.created === 0 ? null : `đã sinh ${st.created} dot`);
  } finally { await o.ctx.close(); }
}

// ---------- kịch bản 6: giới hạn dot khi dồn nhiều sự kiện (tiêu chí 5) ----------
async function runBurst() {
  const tasks = Array.from({ length: 40 }, (_, i) => T('T-' + (100 + i), 'doing', 'engineering'));
  const o = await open({ data: dash(tasks) });
  try {
    tasks.forEach(t => o.sock.send(JSON.stringify(live({ task: t.id, event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' }))));
    await o.page.waitForTimeout(3000); let st = await statsOf(o); const log = await logOf(o);
    const vis = Math.max(...log.map(r => r.d.length));
    rec(5, `B1 40 sự kiện cùng lúc: số dot trong #fx_f không quá ${DOT_CAP} (đo được ${st.maxTotal})`, st.maxTotal <= DOT_CAP ? null : `${st.maxTotal} dot cùng tồn tại (tối đa ${DOT_CAP})`);
    rec(5, 'B2 40 sự kiện cùng lúc: vẫn thấy dot chạy (không nuốt hết)', vis >= 1 ? null : 'không thấy dot nào');
    rec(5, 'B3 40 sự kiện cùng lúc: không giật (khoảng cách giữa hai khung hình < 300ms)', st.maxGap < 300 ? null : `có khung hình trễ ${Math.round(st.maxGap)}ms`);
    await o.page.waitForTimeout(12000);
    const left = await o.page.evaluate(() => document.querySelectorAll('#fx_f circle').length);
    rec(5, 'B4 sau khi xong, #fx_f sạch dot (không dot treo)', left === 0 ? null : `còn ${left} dot treo`);
    rec(8, 'burst console', o.errors.length ? o.errors[0] : null);
  } finally { await o.ctx.close(); }
}

// ---------- kịch bản 7: sự kiện mới giữa hai lần tải, kênh live bật/tắt, loại trùng (tiêu chí 1, 5) ----------
async function runReload(liveOn, paths) {
  const L = { type: 'event', id: 'E-7001', t: '2026-11-01T12:00', task: 'T-901', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering', round: 0, severity: '', cost: 0, title: '' };
  const N = { seq: 'S-9', ledger_id: 'E-7002', t: '2026-11-01T12:10', task: 'T-902', title: '', event: 'assigned', from: 'chief-of-staff', to: 'engineering', round: 0, severity: '', detail: '', link: '', cost: 0, state: 'new', holder: 'engineering' };
  const Lrow = { seq: 'S-8', ledger_id: L.id, t: L.t, task: L.task, title: '', event: L.event, from: L.from, to: L.to, round: 0, severity: '', detail: '', link: '', cost: 0, state: L.state, holder: L.holder };
  const tasks = [T('T-901', 'doing', 'engineering'), T('T-902', 'new', 'engineering')];
  const o = await open({ data: dash(tasks, liveOn ? [] : [Lrow], model(1)), clock: true, liveOff: !liveOn });
  const tag = liveOn ? 'kênh live bật' : 'kênh live tắt';
  try {
    const liveTxt = await o.page.$eval('#model-live', e => e.textContent.trim()).catch(() => '');
    rec(5, `R0 ${tag}: dòng trạng thái dot nói đúng nguồn (#model-live)`, (liveOn ? /trực tiếp/i : /sau mỗi lần tải/i).test(liveTxt) ? null : `#model-live = "${liveTxt}"`);
    let t0 = null;
    if (liveOn) { t0 = await send(o, L); await settle(o, 4500); }
    const tAfterLive = await now(o);
    // lần tải tiếp theo: dashboard.json có thêm sự kiện live đã thấy (loại trùng), một sự kiện mới, và một báo cáo insight mới
    const T2 = [T('T-901', 'review', 'engineering'), T('T-902', 'new', 'engineering')];
    o.data = dash(T2, [Lrow, N], model(2));
    const tReload = await now(o);
    await settle(o, 61000); await o.page.waitForTimeout(600); await settle(o, 9000);
    const log = await logOf(o), st = await statsOf(o);
    const seen = new Set(); for (const r of log.filter(r => r.t >= tReload)) for (const d of r.d) { let bi = null, bd = 1e9; for (const [id, poly] of Object.entries(paths)) { const q = dist([d[0], d[1]], poly); if (q < bd) { bd = q; bi = id; } } if (bd <= 5) seen.add(bi); }
    rec(1, `R1 ${tag}: sự kiện mới giữa hai lần tải (assigned → engineering) có dot trên p_gate_exec`, seen.has('p_gate_exec') ? null : `thấy dot trên: ${[...seen].join(', ') || 'không đường nào'}`);
    rec(1, `R2 ${tag}: báo cáo insight tăng (model.insight_reports 1 → 2) có một dot p_src1 → p_insight_intent`, seen.has('p_src1') && seen.has('p_insight_intent') ? null : `thấy dot trên: ${[...seen].join(', ') || 'không đường nào'}`);
    if (liveOn) {
      rec(5, 'R3 sự kiện đã chạy qua kênh live rồi mới vào dashboard.json: không chạy dot lần hai (p_exec_gate)', seen.has('p_exec_gate') ? 'dot chạy lần hai trên p_exec_gate' : null);
      const first = analyzeDots(log, t0, tAfterLive, paths, ['p_exec_gate'], 'code');
      rec(1, 'R4 kênh live bật: sự kiện live chạy dot ngay (p_exec_gate)', first.problems.length ? first.problems[0] : null);
    } else {
      rec(5, 'R3 kênh live tắt: sự kiện cũ trong dashboard.json (handoff) không bị phát lại thành dot', seen.has('p_exec_gate') ? 'dot chạy cho sự kiện đã có từ lần tải đầu' : null);
    }
    const seenAll = new Set(); void seenAll;
    rec(8, `reload ${tag} console`, o.errors.length ? o.errors[0] : null);
  } finally { await o.ctx.close(); }
}

// ---------- kịch bản 8: prefers-reduced-motion (tiêu chí 6) ----------
async function runReduced() {
  const o = await open({ reduce: true, data: dash([T('T-901', 'doing', 'engineering'), T('T-902', 'review', 'product', { reviewer: 'spec-critic' })]) });
  try {
    const panel = await panelOf(o.page);
    let log = await logOf(o), last = log[log.length - 1];
    rec(6, 'RM1 lúc tải: khối có việc vẫn sáng (Agent code, Spec Gate), không cần dot', checkLit([last], 'nd_exec', last.t, 'code', panel) || checkLit([last], 'gt_spec', last.t, 'spec', panel));
    let t0 = await send(o, live({ task: 'T-901', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' })); await o.page.waitForTimeout(700);
    log = await logOf(o); let st = await statsOf(o);
    rec(6, 'RM2 có sự kiện: không dot nào được tạo ra', st.created === 0 ? null : `đã tạo ${st.created} dot`);
    rec(6, 'RM3 handoff engineering: Code Gate sáng trong 600ms (màu việc/code)', checkLit(log, 'gt_code', t0 + 600, 'code', panel));
    rec(6, 'RM4 handoff engineering: Agent code tắt (không còn việc đang code)', checkOff(log, 'nd_exec', t0 + 600));
    t0 = await send(o, live({ task: 'T-901', event: 'rejected', from: 'adversary', to: 'engineering', state: 'spec', holder: 'product', owner: 'engineering', severity: 'blocker', round: 1 })); await o.page.waitForTimeout(900);
    log = await logOf(o); st = await statsOf(o);
    rec(6, 'RM5 rejected state=spec: Spec rework sáng (hổ phách) và Code Gate tắt trong 800ms, không dot', checkLit(log, 'nd_respec', t0 + 800, 'back', panel) || checkOff(log, 'gt_code', t0 + 800) || (st.created === 0 ? null : 'có dot'));
    t0 = await send(o, live({ task: 'T-902', event: 'accepted', from: 'spec-critic', to: 'done', state: 'done', holder: '-', owner: 'product', reviewer: 'spec-critic' })); await o.page.waitForTimeout(3000);
    log = await logOf(o);
    rec(6, 'RM6 Spec Gate qua: Knowledge Reservoir nháy (xanh spec) rồi tắt, không dot', checkLit(log, 'nd_kr', t0 + 500, 'spec', panel) || checkOff(log, 'nd_kr', t0 + 2600));
    o.data = o.data; // giữ dữ liệu
    const o2 = await open({ reduce: true, data: dash([T('T-903', 'review', 'engineering', { tier: 'A' })]) });
    try { const p2 = await panelOf(o2.page); const u0 = await send(o2, live({ task: 'T-903', event: 'accepted', from: 'adversary', to: 'done', state: 'done', holder: '-', owner: 'engineering' })); await o2.page.waitForTimeout(2600);
      const l2 = await logOf(o2), s2 = await statsOf(o2);
      rec(6, 'RM7 accepted bậc A: Release nháy rồi Production nháy, lần lượt, không dot', (s2.created === 0 ? null : 'có dot') || checkLit(l2, 'nd_rel', u0 + 350, 'code', p2) || checkOff(l2, 'nd_rel', u0 + 950) || checkLit(l2, 'nd_prod', u0 + 950, 'code', p2) || checkOff(l2, 'nd_prod', u0 + 2000));
      rec(8, 'reduced2 console', o2.errors.length ? o2.errors[0] : null); } finally { await o2.ctx.close(); }
    rec(8, 'reduced console', o.errors.length ? o.errors[0] : null);
  } finally { await o.ctx.close(); }
}

// ---------- kịch bản 9: 390px (tiêu chí 7) ----------
async function runPhone(paths) {
  const o = await open({ vp: { width: 390, height: 844 }, data: dash([T('T-901', 'doing', 'engineering')]) });
  try {
    const m = await o.page.evaluate(() => {
      const se = document.documentElement, svg = document.querySelector('#model svg'), r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
      const scale = r.width / vb.width; const num = document.querySelector('#nd_exec .n');
      const items = [...document.querySelectorAll('#model .mlegend > *')].map(e => { const b = e.getBoundingClientRect(); return { right: b.right, left: b.left, fs: parseFloat(getComputedStyle(e).fontSize), txt: e.textContent.trim() }; }).filter(x => x.txt);
      return { overflow: se.scrollWidth - window.innerWidth, bodyOverflow: document.body.scrollWidth - window.innerWidth, w: r.width, left: r.left, right: r.right, numPx: num ? parseFloat(getComputedStyle(num).fontSize) * scale : 0, items };
    });
    rec(7, 'P1 390px: trang không cuộn ngang', m.overflow <= 0 && m.bodyOverflow <= 0 ? null : `tràn ngang ${Math.max(m.overflow, m.bodyOverflow)}px`);
    rec(7, 'P2 390px: bảng vừa màn hình (rộng 300–390px, nằm trong khung nhìn)', m.w >= 300 && m.w <= 390 && m.left >= 0 && m.right <= 390 ? null : `bảng rộng ${Math.round(m.w)}px, trái ${Math.round(m.left)}, phải ${Math.round(m.right)}`);
    rec(7, 'P3 390px: số đếm trên khối hiển thị ≥ 9px', m.numPx >= 9 ? null : `số đếm chỉ ${m.numPx.toFixed(1)}px`);
    const badLeg = m.items.filter(x => x.right > 390.5 || x.left < -0.5 || x.fs < 11);
    rec(7, 'P4 390px: chú giải nằm trong màn hình và chữ ≥ 11px', badLeg.length ? `"${badLeg[0].txt.slice(0, 30)}" lệch (${Math.round(badLeg[0].left)}–${Math.round(badLeg[0].right)}px, chữ ${badLeg[0].fs}px)` : null);
    const t0 = await send(o, live({ task: 'T-901', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' })); await o.page.waitForTimeout(4800);
    const log = await logOf(o); const a = analyzeDots(log, t0, t0 + 4800, paths, ['p_exec_gate'], 'code'); const panel = await panelOf(o.page);
    rec(7, 'P5 390px: dot vẫn chạy đúng đường p_exec_gate và đúng màu', a.problems[0] || (a.colorProblems && a.colorProblems[0]) || null);
    rec(7, 'P6 390px: dot hiển thị đường kính 7–16px (đo được ' + (a.sizes ? a.sizes.map(x => x.toFixed(1)).join('–') : '?') + ')', a.sizes && a.sizes[0] >= 7 && a.sizes[1] <= 16 ? null : 'dot quá nhỏ hoặc quá to để nhìn trên điện thoại');
    rec(7, 'P7 390px: Code Gate sáng khi dot tới', a.n ? checkLit(log, 'gt_code', a.last + 350, 'code', panel) : 'không có dot');
    rec(8, 'phone console', o.errors.length ? o.errors[0] : null);
  } finally { await o.ctx.close(); }
}

// ---------- tiêu chí 4: chú giải ----------
async function runLegend() {
  const o = await open({ data: dash([T('T-901', 'doing', 'engineering')]) });
  try {
    const m = await o.page.evaluate(() => {
      const lg = document.querySelector('#model .mlegend'); if (!lg) return null;
      const sw = [...lg.querySelectorAll('*')].filter(e => { const b = getComputedStyle(e).backgroundColor; return b && b !== 'rgba(0, 0, 0, 0)' && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().width <= 16; })
        .map(e => ({ bg: getComputedStyle(e).backgroundColor, label: (e.parentElement.textContent || '').trim() }));
      return { sw, text: lg.textContent.replace(/\s+/g, ' ').trim() };
    });
    if (!m) { rec(4, 'L0 có chú giải trong #model (.mlegend)', 'không thấy .mlegend'); return; }
    for (const [k, h] of Object.entries(HEX)) { const s = m.sw.find(x => near(toRGB(x.bg), RGB[k], 3)); rec(4, `L1 chú giải có chấm ${h} kèm chữ`, s && s.label.length >= 3 ? null : `thiếu chấm ${h} có chữ giải thích`); }
    rec(4, 'L2 chú giải nói ý nghĩa khối sáng (có cụm "khối sáng" và "đang xử lý")', /khối sáng/i.test(m.text) && /đang xử lý/i.test(m.text) ? null : `chú giải: "${m.text.slice(0, 120)}"`);
  } finally { await o.ctx.close(); }
}

// ---------- tiêu chí 8: không thư viện/mạng ngoài mới ----------
async function runNoNew() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const scripts = [...html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/gi)].map(m => m[1]);
  const bad = scripts.filter(s => !/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/d3\//.test(s));
  rec(8, 'N1 chỉ có một thẻ script ngoài (d3 từ cdnjs)', bad.length ? `script ngoài mới: ${bad.join(', ')}` : null);
  const links = [...html.matchAll(/<link[^>]*href=["']([^"']+)["']/gi)].map(m => m[1]).filter(h => !/fonts\.(googleapis|gstatic)\.com/.test(h));
  rec(8, 'N2 không thêm stylesheet/liên kết ngoài mới', links.length ? `link ngoài mới: ${links.join(', ')}` : null);
  const hosts = [...allHosts].filter(h => !ALLOWED_HOSTS.includes(h));
  rec(8, 'N3 mọi yêu cầu mạng chỉ tới host đã có (cdnjs, fonts Google, raw.githubusercontent.com, tohong-live)', hosts.length ? `host lạ: ${hosts.join(', ')}` : null);
  rec(8, 'N4 không lỗi console / pageerror trong toàn bộ eval', allErrors.length ? `${allErrors.length} lỗi, đầu tiên: ${allErrors[0]}` : null);
}

// ---------- tiêu chí 9: các bảng khác giữ nguyên ----------
function baseRef() {
  if (process.env.BASE_REF) return process.env.BASE_REF;
  const tryGit = a => { try { return cp.execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_) { return ''; } };
  return tryGit(['merge-base', 'HEAD', 'origin/main']) || '326027c';
}
async function runOthers() {
  const ref = baseRef(); let baseHtml;
  try { baseHtml = cp.execFileSync('git', ['-C', REPO, 'show', ref + ':index.html'], { encoding: 'utf8', maxBuffer: 1 << 26 }); }
  catch (e) { rec(9, 'O0 lấy bản đối chứng index.html', `không đọc được ${ref}:index.html trong repo (đặt BASE_REF)`); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't028-base-')); const bf = path.join(tmp, 'index.html'); fs.writeFileSync(bf, baseHtml);
  const tasks = [T('T-1', 'doing', 'product', { reviewer: 'spec-critic' }), T('T-2', 'review', 'engineering'), T('T-3', 'rework', 'engineering'), T('T-4', 'done', 'engineering', { tier: 'B', h: 5, holder: '-' }), T('T-5', 'escalated', 'product', { holder: 'capu' })];
  const hist = [histEv(1, 'assigned', 'chief-of-staff', 'product', 'T-1'), histEv(2, 'handoff', 'engineering', 'adversary', 'T-2'), histEv(3, 'rejected', 'adversary', 'engineering', 'T-3')];
  const grab = async file => {
    const o = await open({ file, data: dash(tasks, hist), settle: 2500 });
    try { await o.page.clock.setFixedTime(new Date('2026-11-01T05:00:00Z')).catch(() => {});
      return await o.page.evaluate(() => { const b = document.body.cloneNode(true); b.querySelectorAll('#model').forEach(e => e.remove()); b.querySelectorAll('script').forEach(e => e.remove());
        return [...b.querySelectorAll('section, header, footer')].map(e => (e.id || e.className || e.tagName) + '::' + e.outerHTML.replace(/\s+/g, ' ')); }); }
    finally { await o.ctx.close(); }
  };
  try {
    const a = await grab(bf), b = await grab(INDEX);
    const diffIdx = a.findIndex((x, i) => x !== b[i]);
    rec(9, `O1 mọi phần ngoài #model (Bản đồ luồng, nhân vật T-019, bảng khác) giống bản ${ref.slice(0, 8)}`,
      a.length === b.length && diffIdx < 0 ? null : (a.length !== b.length ? `số khối khác (${a.length} vs ${b.length})` : `khác ở khối "${a[diffIdx].split('::')[0]}"`));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ---------- tiêu chí 10: ảnh chụp đã commit ----------
function runShotsCommitted() {
  const d = 'docs/screenshots/T-028';
  const NEED = ['idle', 'lit-by-state', 'dot-spec', 'dot-code', 'dot-back', 'dot-bad', 'dot-ins', 'reduced-motion', 'phone-390'];
  let files = [];
  try { files = cp.execFileSync('git', ['-C', REPO, 'ls-tree', '--name-only', REF, d + '/'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean); } catch (_) { }
  const missing = [];
  for (const n of NEED) {
    const f = files.find(x => path.basename(x) === n + '.png');
    if (!f) { missing.push(n + '.png (không có)'); continue; }
    const b = cp.execFileSync('git', ['-C', REPO, 'show', REF + ':' + f], { maxBuffer: 1 << 26 });
    if (b.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') { missing.push(n + '.png (không phải PNG)'); continue; }
    if (n === 'phone-390' && b.readUInt32BE(16) !== 390) missing.push(`phone-390.png rộng ${b.readUInt32BE(16)}px (cần đúng 390)`);
  }
  rec(10, `K1 ${d}/ đã commit ở ${REF} đủ 9 ảnh PNG`, missing.length ? 'thiếu: ' + missing.join('; ') : null);
}

// ---------- chụp ảnh (--shots) ----------
async function takeShots(dir, paths) {
  fs.mkdirSync(dir, { recursive: true });
  const shot = async (o, name, opt = {}) => { const el = await o.page.$('#model'); await el.screenshot({ path: path.join(dir, name + '.png'), ...opt }); };
  const waitDot = async (o, ms = 150) => { await o.page.waitForFunction(() => window.__fx.log.length && window.__fx.log[window.__fx.log.length - 1].d.length > 0, null, { timeout: 4000 }); await o.page.waitForTimeout(ms); };
  { const o = await open({ data: dash([]) }); await shot(o, 'idle'); await o.ctx.close(); }
  { const tasks = [T('T-1', 'doing', 'product', { reviewer: 'spec-critic' }), T('T-2', 'review', 'product', { reviewer: 'spec-critic' }), T('T-3', 'spec', 'engineering', { holder: 'product' }), T('T-4', 'doing', 'engineering'), T('T-5', 'rework', 'engineering'), T('T-6', 'review', 'engineering'), T('T-7', 'escalated', 'engineering', { holder: 'capu' }), T('T-8', 'doing', 'insight')];
    const o = await open({ data: dash(tasks) }); await shot(o, 'lit-by-state'); await o.ctx.close(); }
  const evs = { 'dot-spec': CASES[4], 'dot-code': CASES[5], 'dot-back': CASES[13], 'dot-bad': CASES[16], 'dot-ins': CASES[15] };
  for (const [name, c] of Object.entries(evs)) { const o = await open({ data: dash(c.tasks) }); await send(o, live(c.ev)); await waitDot(o); await shot(o, name); await o.ctx.close(); }
  { const o = await open({ reduce: true, data: dash(CASES[5].tasks) }); await send(o, live(CASES[5].ev)); await o.page.waitForTimeout(700); await shot(o, 'reduced-motion'); await o.ctx.close(); }
  { const o = await open({ vp: { width: 390, height: 844 }, data: dash(CASES[5].tasks) }); await send(o, live(CASES[5].ev)); await waitDot(o);
    const b = await (await o.page.$('#model')).boundingBox(); await o.page.screenshot({ path: path.join(dir, 'phone-390.png'), fullPage: true, clip: { x: 0, y: b.y + (await o.page.evaluate(() => window.scrollY)), width: 390, height: Math.min(b.height, 1400) } }); await o.ctx.close(); }
  console.log('Đã chụp 9 ảnh vào ' + dir);
}

// ---------- chạy ----------
(async () => {
  browser = await chromium.launch();
  try {
    const probe = await open({ data: dash([]) }); const paths = await getPaths(probe.page); await probe.ctx.close();
    if (!Object.keys(paths).length) { console.log('FAIL không thấy đường p_* trong #model svg'); process.exit(1); }
    if (SHOTS) { await takeShots(path.resolve(SHOTS === true ? path.join(REPO, 'docs/screenshots/T-028') : SHOTS), paths); await browser.close(); console.log('PASS'); process.exit(0); }
    const par = (...fs) => Promise.all(fs);
    if (want(1) || want(2) || want(3) || want(8)) {
      for (let i = 0; i < CASES.length; i += 9) await par(...CASES.slice(i, i + 9).map(c => runMapping(c, paths)));
    }
    const B = [];
    if (want(1) || want(5)) B.push(runIgnored());
    if (want(3)) { B.push(runFlow(paths)); B.push(runTwoInGate(paths)); B.push(runMinHold(paths)); }
    if (want(3) || want(5)) B.push(runState());
    if (want(4)) B.push(runLegend());
    if (want(6)) B.push(runReduced());
    if (want(7)) B.push(runPhone(paths));
    if (want(9)) B.push(runOthers());
    await par(...B);
    if (want(5)) await runBurst();
    if (want(1) || want(5)) await par(runReload(true, paths), runReload(false, paths));
    if (want(10)) runShotsCommitted();
    if (want(8)) await runNoNew();
  } catch (e) { console.log('FAIL lỗi chạy eval: ' + (e && e.stack || e)); await browser.close(); process.exit(1); }
  await browser.close();
  const TITLES = { 1: 'bảng ánh xạ: mỗi sự kiện một dot đúng đường, sự kiện bỏ qua không dot', 2: 'màu dot đúng 5 loại', 3: 'khối đang xử lý sáng, khối rảnh không tô', 4: 'chú giải màu và khối sáng',
    5: 'không dot giả, giới hạn dot, tải lại, kênh live tắt', 6: 'prefers-reduced-motion', 7: '390px', 8: 'không lỗi console, không thư viện/mạng ngoài mới', 9: 'các bảng khác giữ nguyên', 10: 'ảnh chụp đã commit' };
  let fails = 0; const failed = [];
  for (const c of Object.keys(R).map(Number).sort((a, b) => a - b)) {
    const bad = R[c].filter(x => !x.ok);
    for (const b of bad) console.log(`FAIL C${c} ${b.name}: ${b.msg}`);
    if (bad.length) { fails++; failed.push('C' + c); console.log(`FAIL C${c} ${TITLES[c]} (${bad.length}/${R[c].length} ý sai)`); } else console.log(`PASS C${c} ${TITLES[c]} (${R[c].length}/${R[c].length})`);
  }
  console.log(fails ? `FAIL ${failed.join(', ')} chưa đạt` : 'PASS');
  process.exit(fails ? 1 : 0);
})();
