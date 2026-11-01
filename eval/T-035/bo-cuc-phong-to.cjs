#!/usr/bin/env node
// Eval tầng 1 của T-035: bố cục phóng to bảng Mô hình, chế độ phóng to, bot ở hai cổng nằm trên cùng.
// Spec: products/T-035-bo-cuc-phong-to.md. Repo dashboard: một file index.html (bảng #model).
//
//   cd /home/user/tohong-hq && bash eval/T-035/run.sh <thư-mục-repo-dashboard> --task T-035 [--criterion N] [--shots [thư-mục-ảnh]] [--ref origin/main] [--no-old]
//
// In từng dòng `PASS Cn …` / `FAIL Cn.<mục> <lý do>`, rồi một dòng cuối `PASS` hoặc `FAIL …`; mã thoát 0/1.
// Dữ liệu dashboard.json, kênh live (WebSocket) và d3 đều giả/cục bộ: không gọi mạng thật.
//   --criterion N : chỉ chạy tiêu chí N (1..5). Không có thì chạy cả năm.
//   --task <T-xxx>: thư mục ảnh là <repo>/docs/screenshots/<task>/ (bắt buộc cho --shots và tiêu chí 5).
//   --shots [dir] : chỉ chụp ảnh (trước/sau, phóng to, cận cảnh hai cổng), không kiểm gì.
//   --ref <ref>   : bản "trước" cho ảnh (mặc định origin/main).
//   --no-old      : tiêu chí 4 bỏ qua việc chạy lại eval T-028/T-031/T-032 (chỉ chạy bất biến).
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--criterion', '--shots', '--task', '--ref']);
const flag = n => { const i = args.indexOf(n); return i < 0 ? null : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const REPO = path.resolve(args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(args[i - 1])) || '.');
const ONLY = flag('--criterion') ? Number(String(flag('--criterion')).replace(/^C/i, '')) : null;
const SHOTS = flag('--shots');
const TASK = flag('--task') === true ? null : flag('--task');
const REF = flag('--ref') || 'origin/main';
const NO_OLD = !!flag('--no-old');
const INDEX = path.join(REPO, 'index.html');
const HQ = path.resolve(__dirname, '..', '..');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt biến môi trường D3=/đường/dẫn/d3.min.js'); process.exit(1); }
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO); process.exit(1); }
if ((SHOTS || ONLY === 5) && !TASK) { console.log('FAIL cần tham số --task <T-xxx> (thư mục ảnh docs/screenshots/<task>/ không có mặc định)'); process.exit(1); }

// ---------- hằng số theo spec (mục "Số đo") ----------
const CHARS = ['nd_intents', 'nd_spec', 'nd_respec', 'gt_spec', 'nd_exec', 'nd_rework', 'gt_code', 'nd_capu', 'nd_insight', 'nd_kr', 'nd_prod'];
const GATES = ['gt_spec', 'gt_code'];
const BODY_MIN_U = 62, BODY_MAX_U = 100;  // 100u × 0,778 = 78px ở 844px (T-031 P5 trần 80)       // chiều cao thân bot, đơn vị SVG (nay 30)
const BODY_MIN_PX_1280 = 68;                    // 2 × 34px hiện nay
const BODY_MIN_PX_390 = 19;                     // 2 × ~9,7px hiện nay
const BLOCK_MIN_U = 110;                        // cạnh nhỏ nhất của hình chính khối có nhân vật (nay 66–96; cổng 88–92)
const VB_W = 1000, VB_H_MAX = 1200;
const AMP_MIN_U = 8, AMP_REL = 0.25;                            // biên độ lao/nhảy
const TEXT_PX_MIN = { t: 13.0, cap: 11.9, n: 24.9 }; // cỡ chữ khối ở 1280 hiện nay, không được nhỏ đi (dung sai 0,15)
const ALL_BASELINE_BODY_PX_1280 = 34;
const FRAME_MAX = 300;

// ---------- dữ liệu giả ----------
const T = (id, state, owner, o = {}) => ({ id, title: 'Việc ' + id, state, holder: o.holder || owner, owner, reviewer: 'adversary', rounds: 0,
  version: 1, deadline: '', budget: '', cost: 0, created: '2026-10-30T09:00', updated: '2026-11-01T09:00', hours_since_update: 2, tier: 'A', area: 'dashboard/model', evals: 1, spec_returns: 0, evals_added: 0 });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const dash = tasks => ({ generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster,
  model: { invariants: { 'dashboard/model': 1 }, invariants_total: 48, adversarial_evals: 17, regression_evals: 12, insight_reports: 1, last_insight: '', specs: 2 } });
const IDLE = () => dash([T('T-1', 'done', 'engineering'), T('T-2', 'done', 'product'), T('T-3', 'done', 'insight')]);
const ACTIVE = () => dash([T('T-1', 'doing', 'engineering'), T('T-2', 'doing', 'product'), T('T-3', 'doing', 'insight')]);
let evN = 0;
const live = o => ({ type: 'event', id: 'E-' + (9700 + (++evN)), t: '2026-11-01T12:00', round: 0, severity: '', cost: 0, title: '', ...o });
const EV = {
  M6: { task: 'T-1', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' },
  M4: { task: 'T-1', event: 'started', from: 'engineering', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering', round: 1 },
  M5: { task: 'T-2', event: 'handoff', from: 'product', to: 'spec-critic', state: 'review', holder: 'spec-critic', owner: 'product' },
  M12: { task: 'T-2', event: 'rejected', from: 'spec-critic', to: 'product', state: 'spec', holder: 'product', owner: 'product' },
  M16: { task: 'T-1', event: 'evalplus', from: 'adversary', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering' },
  M18: { task: 'T-1', event: 'decided', from: 'capu', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering' },
  M7: { task: 'T-3', event: 'handoff', from: 'insight', to: 'reviewer', state: 'review', holder: 'reviewer', owner: 'insight' },
  M11: { task: 'T-3', event: 'accepted', from: 'reviewer', to: 'done', state: 'done', holder: '-', owner: 'insight' },
  M8: { task: 'T-2', event: 'accepted', from: 'spec-critic', to: 'engineering', state: 'done', holder: '-', owner: 'product' },
  M14: { task: 'T-1', event: 'rejected', from: 'adversary', to: 'engineering', state: 'rework', holder: 'engineering', owner: 'engineering', round: 1 },
  M17: { task: 'T-1', event: 'escalated', from: 'adversary', to: 'capu', state: 'escalated', holder: 'capu', owner: 'engineering' },
  M9: { task: 'T-1', event: 'accepted', from: 'adversary', to: 'done', state: 'done', holder: '-', owner: 'engineering' },
};
const SCENARIO_EVENTS = ['M6', 'M5', 'M12', 'M14', 'M16', 'M11', 'M18', 'M4', 'M17', 'M9', 'M7', 'M8'];

// ---------- bộ lấy mẫu trong trang ----------
const SAMPLER = `(() => {
  const W = window.__w = { log: [], maxGap: 0, last: 0, viol: {}, ovl: {}, bub: {}, dotsSeen: 0, gateDotNear: {}, errs: [] };
  const CH = ${JSON.stringify(CHARS)}, GATES = ${JSON.stringify(GATES)};
  const R = e => e.getBoundingClientRect();
  const inter = (a, b) => ({ w: Math.min(a.right, b.right) - Math.max(a.left, b.left), h: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) });
  const shown = e => { let o = 1, n = e; while (n && n.nodeType === 1 && n.tagName.toLowerCase() !== 'svg') { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden') return false; o *= parseFloat(s.opacity); n = n.parentNode; }
    if (o <= 0.05) return false; const r = R(e); return r.width + r.height > 0; };
  const svgEl = () => document.querySelector('#model svg');
  const desc = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.parentNode && e.parentNode.id ? '(trong #' + e.parentNode.id + ')' : '');
  // Phần tử vẽ SAU thân bot của cổng (theo thứ tự DOM) mà hộp bao giao với hộp bao thân bot. Bỏ bong bóng (đo riêng) và phần tử không hiện.
  W.gateViol = id => { const svg = svgEl(); if (!svg) return []; const g = svg.querySelector('g.mch[data-block="' + id + '"]'); const body = g && g.querySelector('[data-part="body"]'); if (!body) return ['thiếu nhân vật ' + id];
    const b = R(body), out = [];
    for (const e of svg.querySelectorAll('path,circle,rect,line,polyline,polygon,ellipse,text,use,image')) {
      if (g.contains(e) || e.contains(g) || e.closest('defs,symbol,marker,clipPath,mask,.bub')) continue;
      if (!(g.compareDocumentPosition(e) & 4)) continue;
      if (!shown(e)) continue; const x = inter(R(e), b); if (x.w > 0.5 && x.h > 0.5) out.push(desc(e)); }
    return out; };
  W.ovlText = () => { const svg = svgEl(); if (!svg) return []; const sr = R(svg), sc = sr.width / (svg.viewBox.baseVal.width || ${VB_W}), hits = [];
    const texts = [...svg.querySelectorAll('text')].filter(t => !t.closest('.mch,.bub,defs')).map(t => [t, R(t)]).filter(([, r]) => r.width > 0);
    svg.querySelectorAll('g.mch').forEach(g => { const body = g.querySelector('[data-part="body"]'); if (!body) return; const b = R(body); if (!b.width) return;
      for (const [t, r] of texts) { const x = inter(r, b); if (x.w > 2 * sc && x.h > 2 * sc) hits.push(g.getAttribute('data-block') + '[' + g.getAttribute('data-state') + (g.getAttribute('data-dir') ? ' ' + g.getAttribute('data-dir') : '') + '] ↔ "' + t.textContent.trim().slice(0, 22) + '" ' + (x.w / sc).toFixed(1) + '×' + (x.h / sc).toFixed(1)); } });
    return hits; };
  W.bubBody = () => { const svg = svgEl(); if (!svg) return []; const sr = R(svg), sc = sr.width / (svg.viewBox.baseVal.width || ${VB_W}), out = [];
    svg.querySelectorAll('#fx_b .bub').forEach(bb => { const id = bb.getAttribute('data-block'), g = svg.querySelector('g.mch[data-block="' + id + '"]'), body = g && g.querySelector('[data-part="body"]'); if (!body) return;
      const x = inter(R(bb), R(body)); if (x.w > 0.5 * sc && x.h > 0.5 * sc) out.push(id + ' bong bóng đè thân ' + (x.w / sc).toFixed(1) + '×' + (x.h / sc).toFixed(1)); });
    return out; };
  // Đường nối p_* (path.arr) có đi qua thân bot (hộp bao nới 2 đơn vị) của cổng không, lúc nghỉ. Lấy mẫu mỗi 2 đơn vị dọc đường.
  W.pathHit = id => { const svg = svgEl(); if (!svg) return []; const g = svg.querySelector('g.mch[data-block="' + id + '"]'), body = g && g.querySelector('[data-part="body"]'); if (!body) return []; const sr = R(svg), sc = sr.width / (svg.viewBox.baseVal.width || ${VB_W}), b = R(body), pad = 2 * sc, out = [];
    for (const p of svg.querySelectorAll('path')) { if (p.closest('.mch,.bub,defs,marker,symbol') || !(p.id || '').startsWith('p_')) continue; const m = p.getScreenCTM(); if (!m) continue; const L = p.getTotalLength();
      for (let t = 0; t <= L; t += 2) { const q = p.getPointAtLength(t), x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f; if (x >= b.left - pad && x <= b.right + pad && y >= b.top - pad && y <= b.bottom + pad) { out.push(p.id); break; } } }
    return out; };
  W.snap = () => { const svg = svgEl(); if (!svg) return null; const sr = R(svg), sc = sr.width / (svg.viewBox.baseVal.width || ${VB_W}), o = { sc, w: sr.width, h: sr.height, ch: {} };
    svg.querySelectorAll('g.mch').forEach(g => { const body = g.querySelector('[data-part="body"]'); if (!body) return; const b = R(body);
      o.ch[g.getAttribute('data-block')] = { out: (b.left < sr.left - 0.5 * sc || b.right > sr.right + 0.5 * sc || b.top < sr.top - 0.5 * sc || b.bottom > sr.bottom + 0.5 * sc), s: g.getAttribute('data-state'), d: g.getAttribute('data-dir'), cx: (b.left + b.width / 2 - sr.left) / sc, cy: (b.top + b.height / 2 - sr.top) / sc, wu: b.width / sc, hu: b.height / sc, hpx: b.height }; });
    return o; };
  W.base = () => { W.b0 = W.snap(); return W.b0; };
  let frame = 0;
  const tick = t => { frame++; if (W.last) W.maxGap = Math.max(W.maxGap, t - W.last); W.last = t;
    const svg = svgEl();
    if (svg && svg.getScreenCTM() && W.rec) {
      const s = W.snap(); const sr = R(svg), sc = s.sc; const layer = document.getElementById('fx_f'); const dots = [];
      if (layer) for (const c of layer.querySelectorAll('circle')) { if (!shown(c)) continue; const r = R(c); dots.push([(r.left + r.width / 2 - sr.left) / sc, (r.top + r.height / 2 - sr.top) / sc, r.width]); }
      W.dotsSeen += dots.length ? 1 : 0;
      const lit = {}; if (frame % 3 === 0) for (const id of ['nd_exec', 'gt_code', 'gt_spec', 'nd_spec']) { const e = document.getElementById(id), sh = e && e.querySelector(':scope > rect, :scope > circle'); if (sh) lit[id] = parseFloat(getComputedStyle(sh).strokeWidth) || 0; }
      W.log.push({ t, ch: s.ch, dots, lit, h: s.h });
      if (frame % 2 === 0) W.ovlText().forEach(x => { W.ovl[x] = (W.ovl[x] || 0) + 1; });
      if (dots.length || frame % 6 === 0) for (const id of GATES) W.gateViol(id).forEach(x => { const k = id + ' ← ' + x; W.viol[k] = (W.viol[k] || 0) + 1; });
      if (frame % 2 === 0) W.bubBody().forEach(x => { W.bub[x] = (W.bub[x] || 0) + 1; });
    }
    requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})();`;

// ---------- trình duyệt ----------
let browser;
const results = [];
const rec = (c, name, problem) => { results.push([problem ? 'FAIL' : 'PASS', c, name, problem || '']); console.log(problem ? `FAIL C${c}.${name} ${problem}` : `PASS C${c} ${name}`); };
async function open(opt) {
  const ctx = await browser.newContext({ viewport: opt.vp || { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: opt.reduce ? 'reduce' : 'no-preference', colorScheme: 'light' });
  const page = await ctx.newPage(); const o = { ctx, page, sock: null, errors: [] };
  page.on('pageerror', e => o.errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') o.errors.push(m.text()); });
  await page.addInitScript(SAMPLER);
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(opt.data || IDLE()) }));
  await page.routeWebSocket(/\/ws$/, ws => { o.sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + (opt.index || INDEX)); await page.waitForSelector('#model svg'); await page.waitForTimeout(opt.settle || 1500);
  if (opt.markAndScroll !== false) await page.evaluate(() => { window.__mark = 1; });
  return o;
}
const send = (o, k) => { const e = live(typeof k === 'string' ? EV[k] : k); o.sock.send(JSON.stringify(e)); return e; };
const isZoom = o => o.page.evaluate(() => document.querySelector('#model') && document.querySelector('#model').getAttribute('data-zoom') === 'on');
const hasBtn = o => o.page.evaluate(() => !!document.querySelector('button#model-zoom'));
const errsOf = o => o.errors.length ? 'lỗi console: ' + o.errors.slice(0, 2).join(' | ') : null;
const fmt = (v, d = 1) => Number(v).toFixed(d);
const dirVec = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };

// Kịch bản dùng chung: mở trang (nghỉ), chụp vị trí nghỉ, (tuỳ) vào chế độ phóng to, bắn 12 sự kiện, thu log từng khung hình.
const SC = {};
async function scenario(kind) {
  if (SC[kind]) return SC[kind];
  const [mode, w] = kind.split('-'); const vp = w === '390' ? { width: 390, height: 844 } : { width: 1280, height: 900 };
  const o = await open({ vp, data: IDLE() }); const out = { kind, errs: null, zoomOn: null, hasBtn: await hasBtn(o) };
  try { out.base = await o.page.evaluate(() => window.__w.base()); } catch (e) { out.base = null; }
  if (mode === 'zoom') {
    if (out.hasBtn) { await o.page.click('button#model-zoom'); await o.page.waitForTimeout(500); out.zoomOn = await isZoom(o); }
    out.zoomSnap = await o.page.evaluate(() => window.__w.snap());
  }
  try { out.rest = await o.page.evaluate(G => ({ ovl: window.__w.ovlText(), viol: G.map(id => window.__w.gateViol(id).map(x => id + ' ← ' + x)).flat(), bub: window.__w.bubBody(), path: G.map(id => window.__w.pathHit(id).map(x => id + ' ← ' + x)).flat() }), GATES); } catch (e) { out.rest = { ovl: [], viol: [], bub: [], path: [] }; }
  await o.page.evaluate(() => { window.__w.rec = true; });
  for (const k of SCENARIO_EVENTS) { send(o, k); await o.page.waitForTimeout(2300); }
  await o.page.waitForTimeout(1500);
  out.w = await o.page.evaluate(() => { const W = window.__w; W.rec = false; return { log: W.log, viol: W.viol, ovl: W.ovl, bub: W.bub, maxGap: W.maxGap }; });
  out.errs = errsOf(o); await o.ctx.close(); return (SC[kind] = out);
}

function amplitude(sc) {
  const b0 = sc.base; if (!b0) return null; const give = {}, take = {}; let nGive = 0, nTake = 0;
  for (const r of sc.w.log) for (const id of Object.keys(r.ch)) { const c = r.ch[id], b = b0.ch[id]; if (!b) continue;
    if (c.s === 'give' && c.d && dirVec[c.d]) { const v = dirVec[c.d], p = (c.cx - b.cx) * v[0] + (c.cy - b.cy) * v[1]; give[id] = Math.max(give[id] === undefined ? -1e9 : give[id], p); }
    if (c.s === 'take') { take[id] = Math.max(take[id] === undefined ? -1e9 : take[id], b.cy - c.cy); } }
  return { give, take };
}

// ---------- tiêu chí 1: bố cục ----------
async function crit1() {
  for (const w of [1280, 390]) {
    const sc = await scenario('inline-' + w), base = sc.base, tag = `${w}px`;
    if (!base) { rec(1, `${tag} đọc được bảng`, 'không đo được #model svg'); continue; }
    const geo = await geometry(w);
    rec(1, `L1 ${tag} viewBox rộng ${geo.vbw} (giữ ${VB_W}), cao ${geo.vbh} (≤ ${VB_H_MAX})`, geo.vbw === VB_W && geo.vbh <= VB_H_MAX ? null : `viewBox ${geo.vbw}×${geo.vbh}`);
    for (const id of CHARS) { const c = base.ch[id];
      if (!c) { rec(1, `L2 ${tag} ${id} có nhân vật`, 'không thấy g.mch'); continue; }
      const minPx = w === 1280 ? BODY_MIN_PX_1280 : BODY_MIN_PX_390;
      rec(1, `L2 ${tag} ${id} thân cao ${fmt(c.hu)} đơn vị = ${fmt(c.hpx)}px (cần ${BODY_MIN_U}–${BODY_MAX_U} đơn vị, ≥ ${minPx}px)`, c.hu + 0.1 >= BODY_MIN_U && c.hu <= BODY_MAX_U && c.hpx + 0.1 >= minPx ? null : `cao ${fmt(c.hu)} đơn vị / ${fmt(c.hpx)}px`); }
    for (const [id, g] of Object.entries(geo.blocks)) rec(1, `L3 ${tag} ${id} hình chính ${fmt(g.w, 0)}×${fmt(g.h, 0)} đơn vị (cạnh nhỏ ≥ ${BLOCK_MIN_U})`, Math.min(g.w, g.h) + 0.1 >= BLOCK_MIN_U ? null : `${fmt(g.w, 0)}×${fmt(g.h, 0)}`);
    for (const [id, g] of Object.entries(geo.blocks)) { if (!g.inside) continue;
      rec(1, `L4 ${tag} ${id} ${GATES.includes(id) ? 'thân bot nằm trọn trong vòng tròn cổng (cách viền ≥ 2 đơn vị) và trong svg' : 'thân bot lúc nghỉ nằm trọn trong hình chính của khối'}`, g.inside === 'ok' ? null : g.inside); }
    rec(1, `L5b ${tag} cỡ chữ SVG của MỌI khối, cổng và nhãn không nhỏ hơn hiện nay (.t 11,5; .cap 10,5; .n 22; .res .t 12; cổng 8,5; nhãn đường 10,5 đơn vị)`, geo.fs.length ? geo.fs.slice(0, 3).join(' | ') : null);
    if (w === 1280) { for (const k of ['t', 'cap', 'n']) rec(1, `L5 1280px chữ .${k} của khối ${fmt(geo.text[k], 2)}px (không nhỏ hơn ${TEXT_PX_MIN[k]}px)`, geo.text[k] + 0.15 >= TEXT_PX_MIN[k] ? null : `chữ .${k} chỉ ${fmt(geo.text[k], 2)}px`); }
    rec(1, `L6 ${tag} lúc nghỉ thân bot không che chữ nào (> 2 đơn vị)`, sc.rest.ovl.length ? sc.rest.ovl.slice(0, 3).join(' | ') : null);
    const amp = amplitude(sc); const g = Object.entries(amp.give), t = Object.entries(amp.take);
    rec(1, `L7 ${tag} có ít nhất 4 khối lao (give) và 4 khối nhảy (take) trong 12 sự kiện (đo ${g.length}/${t.length})`, g.length >= 4 && t.length >= 4 ? null : `chỉ thấy ${g.length} give, ${t.length} take`);
    const need = id => Math.max(AMP_MIN_U, AMP_REL * (base.ch[id] ? base.ch[id].hu : 0));
    for (const [id, v] of g) rec(1, `L7 ${tag} ${id} lao ${fmt(v)} đơn vị theo chiều đích (≥ max(${AMP_MIN_U}; ${AMP_REL} × thân ${fmt(base.ch[id].hu)}) = ${fmt(need(id))})`, v + 0.1 >= need(id) ? null : `lao ${fmt(v)} < ${fmt(need(id))}`);
    for (const [id, v] of t) rec(1, `L7 ${tag} ${id} nhảy lên ${fmt(v)} đơn vị (≥ ${fmt(need(id))})`, v + 0.1 >= need(id) ? null : `nhảy ${fmt(v)} < ${fmt(need(id))}`);
    const outs = [...new Set(sc.w.log.flatMap(r => Object.entries(r.ch).filter(([, c]) => c.out).map(([id, c]) => id + '[' + c.s + ']')))];
    rec(1, `L7b ${tag} khi cử động thân bot không bị cắt ra ngoài svg`, outs.length ? 'thân ra ngoài svg: ' + outs.slice(0, 4).join(', ') : null);
    const ov = Object.keys(sc.w.ovl); rec(1, `L8 ${tag} trong mọi trạng thái, thân bot không che chữ nào quá 2 đơn vị (${ov.length ? ov.slice(0, 2).join(' | ') : 'ok'})`, ov.length ? `${ov.length} chỗ che chữ: ${ov.slice(0, 3).join(' | ')}` : null);
    const bb = Object.keys(sc.w.bub).concat(sc.rest.bub); rec(1, `L9 ${tag} bong bóng không đè lên thân của chính nhân vật đó`, bb.length ? bb.slice(0, 3).join(' | ') : null);
    rec(1, `L10 ${tag} không lỗi console`, sc.errs);
    if (w === 390) rec(1, 'L11 390px trang không cuộn ngang', geo.hscroll <= 0 ? null : `tràn ngang ${geo.hscroll}px`);
  }
}
async function geometry(w) {
  const o = await open({ vp: w === 390 ? { width: 390, height: 844 } : { width: 1280, height: 900 }, data: IDLE() });
  const g = await o.page.evaluate(({ CHARS, GATES }) => {
    const svg = document.querySelector('#model svg'), sr = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, sc = sr.width / vb.width, out = { vbw: vb.width, vbh: vb.height, blocks: {}, text: {}, hscroll: document.documentElement.scrollWidth - innerWidth };
    for (const id of CHARS) { const blk = document.getElementById(id), shape = blk && blk.querySelector(':scope > rect, :scope > circle'), g = svg.querySelector('g.mch[data-block="' + id + '"]'), body = g && g.querySelector('[data-part="body"]'); if (!shape) continue;
      const s = shape.getBoundingClientRect(), b = body ? body.getBoundingClientRect() : null; let inside = 'ok';
      if (!b) inside = 'không có thân';
      else if (GATES.includes(id)) { const cx0 = s.left + s.width / 2, cy0 = s.top + s.height / 2, cx = b.left + b.width / 2, cy = b.top + b.height / 2; if (!(cx >= s.left && cx <= s.right && cy >= s.top && cy <= s.bottom)) inside = 'tâm thân ngoài cổng'; else if ([[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]].some(([x, y]) => Math.hypot(x - cx0, y - cy0) > s.width / 2 - 2 * sc)) inside = 'viền cổng chạy qua thân bot (thân phải nằm trọn trong vòng tròn, cách viền ≥ 2 đơn vị)'; else if (b.left < sr.left - 0.5 || b.right > sr.right + 0.5 || b.top < sr.top - 0.5 || b.bottom > sr.bottom + 0.5) inside = 'thân bot tràn ra ngoài svg'; }
      else { const e = 0.5 * sc; if (b.left < s.left - e || b.right > s.right + e || b.top < s.top - e || b.bottom > s.bottom + e) inside = 'thân tràn khỏi hình chính ' + (['trái', 'phải', 'trên', 'dưới'][[s.left - b.left, b.right - s.right, s.top - b.top, b.bottom - s.bottom].findIndex(v => v > e)] || ''); }
      out.blocks[id] = { w: s.width / sc, h: s.height / sc, inside }; }
    const px = sel => { const e = document.querySelector(sel); return e ? parseFloat(getComputedStyle(e).fontSize) * sc : 0; };
    out.text = { t: px('#nd_exec .t'), cap: px('#nd_exec .cap'), n: px('#nd_exec .n') };
    out.fs = []; const FS_MIN = [['.node .t', 11.5], ['.node .cap', 10.5], ['.node .n', 22], ['.res .t', 12], ['.res .lbl', 10.5], ['.gate text', 8.5], ['.lbl', 10.5]];
    for (const [sel, min] of FS_MIN) svg.querySelectorAll(sel).forEach(e => { if (e.closest('.mch,.bub')) return; const u = parseFloat(getComputedStyle(e).fontSize); const b = e.closest('g[id]'); if (u + 0.05 < min) out.fs.push((b ? b.id : '?') + ' ' + sel + ' ' + u.toFixed(1) + 'u < ' + min + 'u'); });
    return out; }, { CHARS, GATES });
  await o.ctx.close(); return g;
}

// ---------- tiêu chí 2: chế độ phóng to ----------
const zoomState = o => o.page.evaluate(() => { const m = document.querySelector('#model'), b = document.querySelector('button#model-zoom'), svg = document.querySelector('#model svg'), mr = m.getBoundingClientRect(), sr = svg.getBoundingClientRect();
  const ids = [...document.querySelectorAll('#model [id]')].map(e => e.id), dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  return { on: m.getAttribute('data-zoom') === 'on', role: m.getAttribute('role'), modal: m.getAttribute('aria-modal'), mlabel: m.getAttribute('aria-label'), bText: b ? b.textContent.trim() : null, bLabel: b ? b.getAttribute('aria-label') : null, bExp: b ? b.getAttribute('aria-expanded') : null,
    focus: document.activeElement ? document.activeElement.id || document.activeElement.tagName : '', focusIn: !!(document.activeElement && document.activeElement.closest('#model')),
    mr: { l: mr.left, t: mr.top, w: mr.width, h: mr.height }, sw: sr.width, iw: innerWidth, ih: innerHeight, dh: document.documentElement.scrollWidth, mh: m.scrollWidth - m.clientWidth,
    ox: getComputedStyle(m).overflowX, oy: getComputedStyle(m).overflowY, ta: getComputedStyle(m).touchAction, ob: getComputedStyle(m).overscrollBehavior, sx: window.scrollX, mscrollW: m.scrollWidth, mclientW: m.clientWidth,
    tpx: (() => { const e = document.querySelector('#nd_exec .t'); return e ? parseFloat(getComputedStyle(e).fontSize) * sr.width / 1000 : 0; })(), cpx: (() => { const e = document.querySelector('#nd_exec .cap'); return e ? parseFloat(getComputedStyle(e).fontSize) * sr.width / 1000 : 0; })(),
    svgN: document.querySelectorAll('#model svg').length, dup, y: window.scrollY, url: location.href, mark: window.__mark || 0,
    hpx: (() => { const b = svg.querySelector('g.mch[data-block="nd_exec"] [data-part="body"]'); return b ? b.getBoundingClientRect().height : 0; })(),
    btn: b ? (() => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom }; })() : null }; });
async function crit2() {
  for (const w of [1280, 390]) {
    const vp = w === 390 ? { width: 390, height: 844 } : { width: 1280, height: 900 }, tag = `${w}px`;
    const o = await open({ vp, data: IDLE() });
    try {
      const has = await hasBtn(o);
      rec(2, `Z1 ${tag} có nút button#model-zoom trong #model`, has ? null : 'không có button#model-zoom'); if (!has) { await o.ctx.close(); continue; }
      const st0 = await zoomState(o);
      rec(2, `Z1 ${tag} nhãn nút "Phóng to", aria-label "Phóng to bảng Mô hình", aria-expanded=false, chưa là hộp thoại`, st0.bText === 'Phóng to' && st0.bLabel === 'Phóng to bảng Mô hình' && st0.bExp === 'false' && !st0.on && st0.role !== 'dialog' ? null : `chữ "${st0.bText}", aria-label "${st0.bLabel}", aria-expanded ${st0.bExp}, role ${st0.role}`);
      rec(2, `Z1 ${tag} nút đủ lớn (${st0.btn ? fmt(st0.btn.w, 0) + '×' + fmt(st0.btn.h, 0) : '?'}px; 390: ≥ 44×44, 1280: cao ≥ 32)`, st0.btn && (w === 390 ? st0.btn.w >= 44 && st0.btn.h >= 44 : st0.btn.h >= 32 && st0.btn.w >= 32) ? null : 'nút nhỏ');
      rec(2, `Z1 ${tag} đúng một svg trong #model và không trùng id`, st0.svgN === 1 && !st0.dup.length ? null : `svg: ${st0.svgN}, id trùng: ${st0.dup.slice(0, 3).join(',')}`);
      // viewport meta không chặn phóng bằng hai ngón
      if (w === 390) { const vm = await o.page.evaluate(() => (document.querySelector('meta[name=viewport]') || {}).content || ''); rec(2, 'Z1 390px viewport không chặn phóng bằng hai ngón (không có user-scalable=no, maximum-scale=1)', /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(vm) ? 'viewport: ' + vm : null); }
      await o.page.evaluate(() => { const m = document.querySelector('#model'); window.scrollTo(0, m.getBoundingClientRect().top + window.scrollY - 10); }); await o.page.waitForTimeout(200);
      const vis0 = await o.page.evaluate(() => { const b = document.querySelector('button#model-zoom'), r = b.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, hit: !!(e && b.contains(e)) }; });
      rec(2, `Z1 ${tag} cuộn tới đầu bảng là thấy nút ngay (nằm trong khung nhìn, bấm được, không bị che)`, vis0.inView && vis0.hit ? null : `nút ${vis0.inView ? 'bị che' : 'ngoài khung nhìn'}`);
      const inlineSvgW = st0.sw, inlineBody = st0.hpx;
      await o.page.evaluate(() => { const m = document.querySelector('#model'); window.scrollTo(0, m.getBoundingClientRect().top + window.scrollY - 10); }); await o.page.waitForTimeout(200);
      const y0 = await o.page.evaluate(() => window.scrollY), url0 = o.page.url();
      // vào bằng nút
      await o.page.click('button#model-zoom'); await o.page.waitForTimeout(500);
      let z = await zoomState(o);
      rec(2, `Z2 ${tag} bấm nút thì vào chế độ phóng to (#model[data-zoom=on])`, z.on ? null : 'không vào chế độ phóng to');
      if (z.on) {
        rec(2, `Z2 ${tag} nhãn khi phóng to: "Thu nhỏ", aria-label "Thu nhỏ bảng Mô hình", aria-expanded=true, #model là hộp thoại aria-modal có nhãn`, z.bText === 'Thu nhỏ' && z.bLabel === 'Thu nhỏ bảng Mô hình' && z.bExp === 'true' && z.role === 'dialog' && z.modal === 'true' && z.mlabel ? null : `chữ "${z.bText}", aria-label "${z.bLabel}", expanded ${z.bExp}, role ${z.role}, modal ${z.modal}, label "${z.mlabel}"`);
        rec(2, `Z3 ${tag} #model phủ khung nhìn (${fmt(z.mr.w, 0)}×${fmt(z.mr.h, 0)} / ${z.iw}×${z.ih})`, Math.abs(z.mr.l) <= 1 && Math.abs(z.mr.t) <= 1 && z.mr.w >= z.iw - 1 && z.mr.h >= z.ih - 1 ? null : 'không phủ khung nhìn');
        if (w === 390) {
          rec(2, `Z3 390px svg rộng ${fmt(z.sw, 0)}px (≥ 870px để chữ khối đọc được)`, z.sw >= 870 ? null : 'svg quá hẹp');
          rec(2, `Z3 390px chữ khối khi phóng to: .t ${fmt(z.tpx, 1)}px (≥ 10), .cap ${fmt(z.cpx, 1)}px (≥ 9)`, z.tpx >= 10 && z.cpx >= 9 ? null : 'chữ khối chưa đọc được');
          rec(2, `Z3 390px lớp phủ cuộn được cả hai chiều bên trong (overflow ${z.ox}/${z.oy}; rộng nội dung ${z.mscrollW} > ${z.mclientW}), trang ngoài không cuộn ngang (${z.dh}/${z.iw})`, (z.ox === 'auto' || z.ox === 'scroll') && (z.oy === 'auto' || z.oy === 'scroll') && z.mscrollW > z.mclientW && z.dh <= z.iw ? null : `overflow ${z.ox}/${z.oy}, nội dung ${z.mscrollW}/${z.mclientW}, trang ${z.dh}/${z.iw}`);
          const dr = await o.page.evaluate(() => { const m = document.querySelector('#model'); m.scrollLeft = 120; m.scrollTop = 60; return { l: m.scrollLeft, t: m.scrollTop, px: window.scrollX, de: document.documentElement.scrollWidth - innerWidth }; });
          rec(2, 'Z3 390px kéo trong lớp phủ: #model cuộn được cả ngang lẫn dọc, trang ngoài không dịch', dr.l > 0 && dr.px === 0 && dr.de <= 0 ? null : `scrollLeft ${dr.l}, trang scrollX ${dr.px}, tràn ${dr.de}`);
          rec(2, `Z3 390px một ngón kéo cuộn trong lớp phủ, không kéo trang (touch-action "${z.ta}" không là none; overscroll-behavior "${z.ob}" là contain hoặc none)`, !/^none$/.test(z.ta) && /contain|none/.test(z.ob) ? null : `touch-action ${z.ta}, overscroll ${z.ob}`);
          await o.page.evaluate(() => { const m = document.querySelector('#model'); m.scrollLeft = 0; m.scrollTop = 0; });
        } else {
          rec(2, `Z3 ${tag} svg rộng ${fmt(z.sw, 0)}px = ${fmt(100 * z.sw / z.iw, 0)}% khung nhìn (≥ 94%, và ≥ bản thường ${fmt(inlineSvgW, 0)}px)`, z.sw >= 0.94 * z.iw && z.sw >= inlineSvgW - 1 ? null : 'svg không đủ rộng');
          rec(2, `Z3 ${tag} không cuộn ngang (trang ${z.dh}/${z.iw}, #model dư ${z.mh}px)`, z.dh <= z.iw && z.mh <= 1 ? null : `tràn ngang: trang ${z.dh}/${z.iw}, #model ${z.mh}`);
        }
        rec(2, `Z3 ${tag} nhân vật khi phóng to cao ${fmt(z.hpx)}px (≥ bản thường ${fmt(inlineBody)}px và ≥ ${w === 1280 ? BODY_MIN_PX_1280 : BODY_MIN_PX_390}px)`, z.hpx >= inlineBody - 0.5 && z.hpx >= (w === 1280 ? BODY_MIN_PX_1280 : BODY_MIN_PX_390) ? null : 'nhân vật nhỏ');
        rec(2, `Z3 ${tag} đúng một svg và không trùng id khi phóng to (không nhân bản bảng)`, z.svgN === 1 && !z.dup.length ? null : `svg: ${z.svgN}, id trùng: ${z.dup.slice(0, 3).join(',')}`);
        rec(2, `Z4 ${tag} tiêu điểm chuyển vào nút (#${z.focus}), Tab/Shift+Tab không ra khỏi #model`, await (async () => { if (z.focus !== 'model-zoom') return `tiêu điểm ở ${z.focus}`; for (let i = 0; i < 4; i++) { await o.page.keyboard.press('Tab'); if (!(await zoomState(o)).focusIn) return `Tab lần ${i + 1} ra ngoài #model`; } for (let i = 0; i < 2; i++) { await o.page.keyboard.press('Shift+Tab'); if (!(await zoomState(o)).focusIn) return 'Shift+Tab ra ngoài #model'; } return null; })());
        if (w === 390) {
          const vis = await o.page.evaluate(() => { const m = document.querySelector('#model'); m.scrollTop = 1e6; m.scrollLeft = 1e6; const b = document.querySelector('button#model-zoom'), r = b.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return { inView: r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1, top: !!(e && b.contains(e)), scrolled: m.scrollTop }; });
          rec(2, 'Z5 390px cuộn hết cả hai chiều trong #model thì nút Thu nhỏ vẫn nằm trong màn hình và bấm được', vis.inView && vis.top ? null : `nút ${vis.inView ? 'bị che' : 'ra ngoài màn hình'}`);
          await o.page.evaluate(() => { document.querySelector('#model').scrollTop = 0; document.querySelector('#model').scrollLeft = 0; });
        }
        // thoát bằng nút
        await o.page.click('button#model-zoom'); await o.page.waitForTimeout(500); z = await zoomState(o);
        rec(2, `Z6 ${tag} thoát bằng nút: tắt phóng to, nhãn về "Phóng to", aria-expanded=false, không còn role=dialog, tiêu điểm về nút, vị trí cuộn trang giữ (±2px)`,
          !z.on && z.bText === 'Phóng to' && z.bExp === 'false' && z.role !== 'dialog' && z.focus === 'model-zoom' && Math.abs(z.y - y0) <= 2 ? null : `on=${z.on}, chữ "${z.bText}", expanded ${z.bExp}, role ${z.role}, focus ${z.focus}, cuộn ${z.y} vs ${y0}`);
        // Esc
        await o.page.click('button#model-zoom'); await o.page.waitForTimeout(400); await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(500); z = await zoomState(o);
        rec(2, `Z7 ${tag} thoát bằng Esc: tắt phóng to, tiêu điểm về nút, địa chỉ trang không đổi`, !z.on && z.focus === 'model-zoom' && o.page.url() === url0 ? null : `on=${z.on}, focus ${z.focus}, url ${o.page.url() === url0 ? 'không đổi' : 'đổi'}`);
        // Esc khi không phóng to: không làm gì
        await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(200); z = await zoomState(o);
        rec(2, `Z7 ${tag} Esc khi chưa phóng to không làm gì (không rời trang, không bật)`, !z.on && z.mark === 1 && o.page.url() === url0 ? null : 'Esc khi chưa phóng to đã đổi trạng thái');
        // Back
        await o.page.click('button#model-zoom'); await o.page.waitForTimeout(400); let on1 = (await zoomState(o)).on;
        await o.page.goBack(); await o.page.waitForTimeout(600); z = await zoomState(o).catch(() => null);
        rec(2, `Z8 ${tag} nút Back của trình duyệt đóng phóng to, ở lại đúng trang (không tải lại, địa chỉ không đổi, tiêu điểm về nút)`, on1 && z && !z.on && z.mark === 1 && o.page.url() === url0 && z.focus === 'model-zoom' ? null : (!on1 ? 'không vào được phóng to' : !z ? 'trang đã rời đi' : `on=${z.on}, mark=${z.mark}, url ${o.page.url() === url0 ? 'giữ' : 'đổi'}, focus ${z.focus}`));
        // Mở / thoát nhiều lần: không rò trạng thái
        for (let i = 0; i < 3; i++) { await o.page.click('button#model-zoom'); await o.page.waitForTimeout(250); await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(250); }
        z = await zoomState(o); const sc = await o.page.evaluate(() => { window.scrollTo(0, 40); return window.scrollY; });
        rec(2, `Z9 ${tag} mở/thoát 3 lần: về đúng trạng thái thường, trang còn cuộn được, svg và id không nhân bản`, !z.on && z.svgN === 1 && !z.dup.length && sc > 0 ? null : `on=${z.on}, svg=${z.svgN}, cuộn được=${sc > 0}`);
        // đổi chiều màn hình khi đang phóng to
        await o.page.click('button#model-zoom'); await o.page.waitForTimeout(300);
        const vp2 = w === 390 ? { width: 844, height: 390 } : { width: 390, height: 844 }; await o.page.setViewportSize(vp2); await o.page.waitForTimeout(500); z = await zoomState(o);
        rec(2, `Z10 ${tag} đổi cỡ khung ${w}→${vp2.width}px khi đang phóng to: vẫn bật, svg đúng cỡ (≤ 480px: ≥ 870px; rộng hơn: ≥ 94%), trang không cuộn ngang`, z.on && (z.iw <= 480 ? z.sw >= 870 : z.sw >= 0.94 * z.iw) && z.dh <= z.iw && (z.iw <= 480 || z.mh <= 1) ? null : `on=${z.on}, svg ${fmt(z.sw, 0)}/${z.iw}, tràn ${z.dh - z.iw}/${z.mh}`);
        await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(300);
      }
      const e = errsOf(o); rec(2, `Z11 ${tag} không lỗi console khi vào/ra phóng to`, e);
    } finally { await o.ctx.close(); }
  }
  // chạy trong chế độ phóng to
  for (const w of [1280, 390]) {
    const sc = await scenario('zoom-' + w), tag = `${w}px`;
    if (!sc.hasBtn) { rec(2, `R1 ${tag} có nút phóng to để thử chạy`, 'không có button#model-zoom'); continue; }
    rec(2, `R1 ${tag} vào được chế độ phóng to trước khi bắn sự kiện`, sc.zoomOn ? null : 'không vào được');
    const log = sc.w.log, dots = log.filter(r => r.dots.length), sizes = dots.flatMap(r => r.dots.map(d => d[2])), inside = dots.every(r => r.dots.every(d => d[0] >= -2 && d[0] <= VB_W + 2 && d[1] >= -2 && d[1] <= (sc.zoomSnap ? sc.zoomSnap.h / sc.zoomSnap.sc : 1200) + 2));
    rec(2, `R2 ${tag} phóng to: dot vẫn chạy (${dots.length} khung có dot, đường kính ${sizes.length ? fmt(Math.min(...sizes)) + '–' + fmt(Math.max(...sizes)) : '?'}px, trong 7–16)`, dots.length >= 10 && Math.min(...sizes) >= 7 && Math.max(...sizes) <= 16 && inside ? null : (dots.length < 10 ? 'dot không chạy' : 'dot sai cỡ hoặc ra ngoài svg'));
    const lit = log.map(r => r.lit).filter(l => l && Object.keys(l).length); const litOk = ['nd_exec', 'gt_code'].every(id => lit.some(l => (l[id] || 0) >= 2.5));
    rec(2, `R3 ${tag} phóng to: khối sáng (viền ≥ 2,5px) ở nd_exec và gt_code`, litOk ? null : 'khối không sáng');
    const st = new Set(log.flatMap(r => Object.values(r.ch).map(c => c.s))); const amp = amplitude(sc);
    rec(2, `R4 ${tag} phóng to: nhân vật cử động (có ${[...st].join(', ')}; lao/nhảy ≥ max(${AMP_MIN_U}; ${AMP_REL} × thân))`, st.has('give') && st.has('take') && Object.entries(amp.give).some(([id, v]) => v + 0.1 >= Math.max(AMP_MIN_U, AMP_REL * ((sc.base.ch[id] || {}).hu || 0))) && Object.entries(amp.take).some(([id, v]) => v + 0.1 >= Math.max(AMP_MIN_U, AMP_REL * ((sc.base.ch[id] || {}).hu || 0))) ? null : 'thiếu give/take hoặc biên độ nhỏ');
    const ov = Object.keys(sc.w.ovl); rec(2, `R5 ${tag} phóng to: nhân vật không che chữ`, ov.length ? ov.slice(0, 3).join(' | ') : null);
    rec(2, `R6 ${tag} phóng to: không lỗi console, khung hình không trễ ≥ ${FRAME_MAX}ms (đo ${fmt(sc.w.maxGap, 0)}ms)`, sc.errs || (sc.w.maxGap < FRAME_MAX ? null : `khung trễ ${fmt(sc.w.maxGap, 0)}ms`));
  }
  // reduced-motion
  { const o = await open({ vp: { width: 390, height: 844 }, data: IDLE(), reduce: true });
    try { if (!(await hasBtn(o))) rec(2, 'M1 reduced-motion: có nút phóng to', 'không có button#model-zoom');
      else { await o.page.click('button#model-zoom'); await o.page.waitForTimeout(400); const a = (await zoomState(o)).on; send(o, 'M6'); await o.page.waitForTimeout(1500);
        const info = await o.page.evaluate(() => ({ dots: document.querySelectorAll('#fx_f circle').length, anim: [...document.querySelectorAll('g.mch')].filter(g => g.getAttribute('data-anim') !== 'none').length, run: document.getAnimations().filter(x => x.effect && x.effect.target && x.effect.target.closest && x.effect.target.closest('.mch,.bub') && x.playState === 'running').length }));
        await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(300); const b = (await zoomState(o)).on;
        rec(2, 'M1 reduced-motion: vào bằng nút, thoát bằng Esc được', a && !b ? null : `vào=${a}, sau Esc còn bật=${b}`);
        rec(2, 'M2 reduced-motion khi phóng to: không dot, không animation trên nhân vật (data-anim=none)', info.dots === 0 && info.anim === 0 && info.run === 0 ? null : `dot ${info.dots}, nhân vật còn animation ${info.anim}, đang chạy ${info.run}`); }
      rec(2, 'M3 reduced-motion không lỗi console', errsOf(o)); } finally { await o.ctx.close(); } }
}

// ---------- tiêu chí 3: bot ở hai cổng nằm trên cùng ----------
async function crit3() {
  for (const kind of ['inline-1280', 'inline-390', 'zoom-1280']) {
    const sc = await scenario(kind), tag = kind.replace('-', ' ');
    if (kind.startsWith('zoom') && !sc.zoomOn) { rec(3, `G0 ${tag} vào được chế độ phóng to`, 'không vào được phóng to (xem tiêu chí 2)'); continue; }
    if (kind === 'inline-1280') { const nd = sc.w.log.filter(r => r.dots.length).length; rec(3, `G0 ${tag} dot nhìn thấy được: ${nd} khung hình có dot hiện (cần ≥ 10 trong 12 sự kiện; #fx_f không được display:none)`, nd >= 10 ? null : 'dot không bao giờ hiện ra (lớp #fx_f bị ẩn?) nên không đo được dot có bị vẽ đè hay không'); }
    rec(3, `G4 ${tag} lúc nghỉ không đường nối p_* nào đi qua thân bot ở gt_spec, gt_code (nới 2 đơn vị)`, sc.rest.path.length ? 'đường đi qua thân bot: ' + sc.rest.path.slice(0, 3).join(', ') : null);
    const v = Object.keys(sc.w.viol).concat(sc.rest.viol); const dotHit = v.filter(x => /circle/.test(x));
    rec(3, `G1 ${tag} suốt 12 sự kiện: không phần tử nào vẽ sau (đè lên) thân bot ở gt_spec, gt_code (${v.length ? v[0] : 'ok'})`, v.length ? `${v.length} phần tử vẽ đè, vd: ${v.slice(0, 3).join(' | ')}${dotHit.length ? ' (có dot)' : ''}` : null);
  }
  // Thử bằng một dot thử đặt vào đúng lớp dot (#fx_f): không phụ thuộc thời điểm dot. (Phần tử tĩnh: viền khối, đường, chữ... đã được G1 đo ở trạng thái nghỉ.)
  for (const w of [1280, 390]) {
    const o = await open({ vp: w === 390 ? { width: 390, height: 844 } : { width: 1280, height: 900 }, data: IDLE() });
    try {
      for (const id of GATES) {
        const r = await o.page.evaluate(id => { const svg = document.querySelector('#model svg'), g = svg.querySelector('g.mch[data-block="' + id + '"]'), body = g && g.querySelector('[data-part="body"]'); if (!body) return { err: 'không có nhân vật' };
          const NS = 'http://www.w3.org/2000/svg', b = body.getBoundingClientRect(), inv = svg.getScreenCTM().inverse(), p = new DOMPoint(b.left + b.width / 2, b.top + b.height / 2).matrixTransform(inv);
          const layer = document.getElementById('fx_f'); if (!layer) return { err: 'không có #fx_f' };
          const prevD = layer.style.display; layer.style.display = 'inline';
          const probe = document.createElementNS(NS, 'circle'); probe.setAttribute('cx', p.x); probe.setAttribute('cy', p.y); probe.setAttribute('r', 4); probe.setAttribute('fill', '#d33'); layer.appendChild(probe);
          const a = window.__w.gateViol(id); probe.remove(); layer.style.display = prevD;
          return { dot: a }; }, id);
        rec(3, `G2 ${w}px ${id}: dot (đặt thử vào #fx_f, đè lên thân bot) vẫn nằm DƯỚI bot`, r.err ? r.err : r.dot.length ? 'dot vẽ sau bot: ' + r.dot.slice(0, 2).join(', ') : null);
      }
    } finally { await o.ctx.close(); }
  }
}

// ---------- tiêu chí 4: giữ bất biến cũ, hành vi cũ, reduced-motion, console, hiệu năng ----------
function runShell(cmd, argv, env, timeout) {
  return new Promise(res => { const p = cp.spawn(cmd, argv, { env: { ...process.env, ...env }, cwd: HQ }); let out = ''; const to = setTimeout(() => { p.kill('SIGKILL'); res({ code: -1, out: out + '\n(quá ' + timeout / 1000 + 's)' }); }, timeout);
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d); p.on('close', code => { clearTimeout(to); res({ code, out }); }); });
}
async function pool(jobs, n) { const res = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const j = i++; res[j] = await jobs[j](); } })); return res; }
async function crit4() {
  const invDir = path.join(HQ, 'eval', 'invariants', 'dashboard', 'model');
  const invs = fs.readdirSync(invDir).filter(f => /^inv-\d+.*\.sh$/.test(f)).sort();
  rec(4, `V0 bất biến inv-001..016 có đủ (${invs.length} file)`, invs.length >= 16 ? null : `chỉ ${invs.length} file`);
  const jobs = invs.map(f => () => runShell('bash', [path.join(invDir, f)], { TOHONG_DASHBOARD_REPO: REPO }, 400000).then(r => ({ f, ...r })));
  if (!NO_OLD) {
    const ev = (name, rel, extra = []) => () => runShell('bash', [path.join(HQ, rel), REPO, ...extra], { T028_PAR: '3' }, 580000).then(r => ({ f: name, ...r }));
    // T-028 tiêu chí 3 (khối sáng) bị T-032 sửa có chủ đích (việc new của product/engineering sáng), nên eval T-028 C3 đỏ trên main từ T-032 (C5 của T-028 cũng kéo C3 theo, bỏ; phần không dot giả/trần dot do inv-001/002 giữ): chạy các tiêu chí còn lại của T-028; phần khối sáng do eval T-032 và inv-004/009 giữ.
    for (const c of [1, 2, 4, 6, 7, 8, 9, 10]) jobs.push(ev('eval T-028 C' + c, 'eval/T-028/run.sh', ['--criterion', String(c)]));
    jobs.push(ev('eval T-032', 'eval/T-032/run.sh'), ev('eval T-031', 'eval/T-031/run.sh', ['--task', 'T-034']));
  }
  // Sửa eval cho T-036: bất biến chạy pool 2 như cũ; eval cũ (T-028/T-032/T-031) chạy TUẦN TỰ sau đó và T-028 chỉ 3 ca song song (T028_PAR=3), vì phép đo dot theo khung hình nhạy với tải máy.
  const nInv = invs.length; const rs = (await pool(jobs.slice(0, nInv), 2)).concat(await pool(jobs.slice(nInv), 1));
  for (const r of rs) { const last = r.out.trim().split('\n').filter(l => /^(PASS|FAIL)/.test(l)).slice(-3).join(' / ') || r.out.trim().split('\n').slice(-2).join(' / ');
    rec(4, `V ${r.f}`, r.code === 0 ? null : `thoát ${r.code}: ${last.slice(0, 300)}`); }
  // console + khung hình khi dồn 40 sự kiện (thường và phóng to)
  for (const zoom of [false, true]) {
    const o = await open({ vp: { width: 1280, height: 900 }, data: dash(Array.from({ length: 40 }, (_, i) => T('T-' + (100 + i), 'doing', 'engineering'))) });
    try { if (zoom && (await hasBtn(o))) { await o.page.click('button#model-zoom'); await o.page.waitForTimeout(400); }
      if (zoom && !(await isZoom(o))) { rec(4, 'P1 40 sự kiện khi phóng to', 'không vào được phóng to'); continue; }
      for (let i = 0; i < 40; i++) o.sock.send(JSON.stringify(live({ task: 'T-' + (100 + i), event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' })));
      await o.page.waitForTimeout(4000); const m = await o.page.evaluate(() => ({ gap: window.__w.maxGap, dots: document.querySelectorAll('#fx_f circle').length }));
      rec(4, `P1 40 sự kiện cùng lúc${zoom ? ' (phóng to)' : ''}: khung hình trễ < ${FRAME_MAX}ms (đo ${fmt(m.gap, 0)}ms), ≤ 12 dot (đo ${m.dots})`, m.gap < FRAME_MAX && m.dots <= 12 ? null : `trễ ${fmt(m.gap, 0)}ms, ${m.dots} dot`);
      rec(4, `P2 không lỗi console${zoom ? ' (phóng to)' : ''}`, errsOf(o)); } finally { await o.ctx.close(); }
  }
  // reduced-motion khi bố cục thường: nhân vật đứng yên, không dot
  { const o = await open({ vp: { width: 1280, height: 900 }, data: ACTIVE(), reduce: true });
    try { send(o, 'M6'); await o.page.waitForTimeout(1800); await o.page.evaluate(() => window.__w.base()); await o.page.waitForTimeout(1500); const s = await o.page.evaluate(() => { const a = window.__w.b0, b = window.__w.snap(); let d = 0; for (const id of Object.keys(a.ch)) d = Math.max(d, Math.abs(a.ch[id].cx - b.ch[id].cx), Math.abs(a.ch[id].cy - b.ch[id].cy)); return { d, dots: document.querySelectorAll('#fx_f circle').length }; });
      rec(4, `P3 reduced-motion: không dot, nhân vật đứng yên (lệch ${fmt(s.d, 2)} đơn vị ≤ 0,3)`, s.dots === 0 && s.d <= 0.3 ? null : `dot ${s.dots}, lệch ${fmt(s.d, 2)}`); } finally { await o.ctx.close(); } }
}

// ---------- tiêu chí 5: ảnh đã commit ----------
const SHOT_NAMES = ['truoc-1280', 'sau-1280', 'truoc-390', 'sau-390', 'phong-to-1280', 'phong-to-390', 'can-canh-gt_spec', 'can-canh-gt_code', 'truoc-can-canh-gt_code'];
function crit5() {
  const dir = `docs/screenshots/${TASK}/`; let ls;
  try { ls = cp.execFileSync('git', ['-C', REPO, 'ls-tree', '-r', 'HEAD', '--', dir], { encoding: 'utf8' }).trim().split('\n').filter(Boolean); } catch (e) { rec(5, 'S0 đọc được git HEAD của repo', 'không đọc được git ls-tree: ' + String(e.message).slice(0, 120)); return; }
  const files = Object.fromEntries(ls.map(l => { const [meta, f] = l.split('\t'); return [path.basename(f), meta.split(' ')[2]]; }));
  const miss = SHOT_NAMES.filter(n => !files[n + '.png']); rec(5, `S1 ${dir} đã commit ở HEAD đủ ${SHOT_NAMES.length} ảnh (${SHOT_NAMES.join(', ')})`, miss.length ? 'thiếu ' + miss.join(', ') : null);
  const have = SHOT_NAMES.filter(n => files[n + '.png']); const shas = have.map(n => files[n + '.png']);
  rec(5, 'S2 mỗi ảnh khác nhau (không chụp trùng)', new Set(shas).size === shas.length ? null : 'có ảnh trùng nội dung');
  const small = have.filter(n => Number(cp.execFileSync('git', ['-C', REPO, 'cat-file', '-s', files[n + '.png']], { encoding: 'utf8' })) < 5000); rec(5, 'S3 ảnh không rỗng (≥ 5 KB mỗi ảnh)', small.length ? 'ảnh quá nhỏ: ' + small.join(', ') : null);
  for (const n of ['sau-390', 'phong-to-390']) if (files[n + '.png']) { const buf = cp.execFileSync('git', ['-C', REPO, 'cat-file', 'blob', files[n + '.png']]); const w = buf.readUInt32BE(16); rec(5, `S4 ${n}.png rộng đúng 390px (đo ${w})`, w === 390 ? null : `rộng ${w}px`); }
}

// ---------- chụp ảnh ----------
async function shots() {
  const dir = path.resolve(typeof SHOTS === 'string' ? SHOTS : path.join(REPO, 'docs', 'screenshots', TASK)); fs.mkdirSync(dir, { recursive: true });
  let before = null; try { const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't035-')), f = path.join(tmp, 'index.html'); fs.writeFileSync(f, cp.execFileSync('git', ['-C', REPO, 'show', REF + ':index.html'], { maxBuffer: 64e6, stdio: ['ignore', 'pipe', 'ignore'] })); before = f; } catch (e) { console.log('CẢNH BÁO không lấy được bản trước ' + REF + ': ' + String(e.message).slice(0, 100)); }
  const freeze = o => o.page.evaluate(() => document.getAnimations().forEach(a => { try { a.pause(); } catch (_) { } }));
  const take = async (index, w, name) => { const o = await open({ vp: w === 390 ? { width: 390, height: 844 } : { width: 1280, height: 900 }, data: ACTIVE(), index });
    send(o, 'M6'); await o.page.waitForTimeout(380); await freeze(o);
    // Chụp dải ngang toàn bề rộng khung nhìn (390 hoặc 1280) ở đúng chỗ và cao đúng bằng #model, KHÔNG chụp phần tử #model (hẹp hơn khung nhìn vì lề: 358px ở 390), để ảnh rộng đúng bằng khung nhìn và khớp S4.
    const bb = await o.page.evaluate(() => { const b = document.querySelector('#model').getBoundingClientRect(); return { y: b.top + scrollY, h: b.height, w: document.documentElement.clientWidth }; });
    await o.page.screenshot({ path: path.join(dir, name + '.png'), clip: { x: 0, y: bb.y, width: bb.w, height: bb.h }, fullPage: true }); await o.ctx.close(); console.log('ảnh ' + name); };
  if (before) { await take(before, 1280, 'truoc-1280'); await take(before, 390, 'truoc-390'); }
  await take(INDEX, 1280, 'sau-1280'); await take(INDEX, 390, 'sau-390');
  for (const w of [1280, 390]) { const o = await open({ vp: w === 390 ? { width: 390, height: 844 } : { width: 1280, height: 900 }, data: ACTIVE() });
    if (!(await hasBtn(o))) { console.log('CẢNH BÁO chưa có nút phóng to, bỏ ảnh phong-to-' + w); await o.ctx.close(); continue; }
    await o.page.click('button#model-zoom'); await o.page.waitForTimeout(400); send(o, 'M6'); await o.page.waitForTimeout(420); await freeze(o); await o.page.screenshot({ path: path.join(dir, `phong-to-${w}.png`) }); await o.ctx.close(); console.log('ảnh phong-to-' + w); }
  const gateShot = async (index, id, ev, name) => { const o = await open({ vp: { width: 1280, height: 900 }, data: ACTIVE(), index });
    await o.page.evaluate(() => { window.__w.rec = false; }); send(o, ev);
    const near = await o.page.waitForFunction(id => { const svg = document.querySelector('#model svg'), g = svg.querySelector('g.mch[data-block="' + id + '"] [data-part="body"]'); if (!g) return false; const b = g.getBoundingClientRect();
      for (const c of document.querySelectorAll('#fx_f circle')) { const r = c.getBoundingClientRect(); if (r.width && Math.abs(r.left + r.width / 2 - (b.left + b.width / 2)) < b.width * 0.8 && Math.abs(r.top + r.height / 2 - (b.top + b.height / 2)) < b.height * 0.8) return true; } return false; }, id, { timeout: 7000, polling: 'raf' }).then(() => true, () => false);
    await freeze(o); const box = await o.page.evaluate(id => { const b = document.querySelector('g.mch[data-block="' + id + '"] [data-part="body"]').getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; }, id);
    const pad = Math.max(60, box.h * 0.9), clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.w + 2 * pad, height: box.h + 2 * pad };
    await o.page.screenshot({ path: path.join(dir, name + '.png'), clip, fullPage: true }); await o.ctx.close(); console.log('ảnh ' + name + (near ? '' : ' (dot không vào gần bot trong 7 giây)')); };
  if (before) await gateShot(before, 'gt_code', 'M6', 'truoc-can-canh-gt_code');
  await gateShot(INDEX, 'gt_spec', 'M5', 'can-canh-gt_spec'); await gateShot(INDEX, 'gt_code', 'M6', 'can-canh-gt_code');
  console.log('PASS đã chụp ảnh vào ' + dir);
}

(async () => {
  browser = await chromium.launch();
  try {
    if (SHOTS) { await shots(); await browser.close(); process.exit(0); }
    const want = n => !ONLY || ONLY === n;
    if (want(1)) await crit1();
    if (want(2)) await crit2();
    if (want(3)) await crit3();
    if (want(4)) await crit4();
    if (want(5)) crit5();
  } catch (e) { console.log('FAIL lỗi chạy eval: ' + (e && e.stack || e)); await browser.close(); process.exit(1); }
  await browser.close();
  const bad = results.filter(r => r[0] === 'FAIL');
  console.log(bad.length ? `FAIL ${bad.length}/${results.length} kiểm tra đỏ (tiêu chí ${[...new Set(bad.map(r => r[1]))].join(', ')})` : `PASS ${results.length}/${results.length}`);
  process.exit(bad.length ? 1 : 0);
})();
