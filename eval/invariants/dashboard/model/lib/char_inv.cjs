#!/usr/bin/env node
// Thư viện đo bất biến nhân vật của bảng Mô hình, vùng dashboard/model.
// Nguồn: T-031 (spec products/T-031-nhan-vat-khoi-mo-hinh.md v1, qua Spec Gate 2026-11-01, spec-critic).
// Viết gọn từ các ca của eval/T-031/model-characters.cjs (C2, C3, C4 "sự kiện cũ", C5, C7, C10); bản cố định, không phụ thuộc eval việc.
//   node char_inv.cjs --repo <repo-dashboard> --check <char-match-lit|idle-dim|reduced-still|bubble-cap|no-fake-handover|char-own-paint>
// Chỉ đọc hợp đồng quan sát của spec: g.mch[data-block|data-state|data-anim], [data-part], #fx_b g.bub, #fx_f; khối sáng = stroke-width tính ra
// của hình chính khối >= 2,5px (định nghĩa T-028 mục 4, không phụ thuộc quy tắc nào làm khối sáng: T-028 hay T-032 hay sau này).
// Áp dụng: nếu trang chưa có g.mch nào và repo chưa có docs/screenshots/T-031/ (việc T-031 chưa vào) thì in PASS "chưa áp dụng";
// có docs/screenshots/T-031/ mà không có nhân vật thì FAIL (nhân vật bị gỡ).
// Dữ liệu dashboard.json, kênh live (WebSocket) và d3 đều giả/cục bộ. Mã thoát 0 = đạt.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), CHECK = arg('--check'), INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO + ' (đặt TOHONG_DASHBOARD_REPO)'); process.exit(1); }
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js'); process.exit(1); }

const BLOCKS = ['nd_intents', 'nd_spec', 'nd_respec', 'nd_exec', 'nd_rework', 'nd_capu', 'gt_spec', 'gt_code', 'nd_kr', 'nd_rel', 'nd_prod', 'nd_insight', 'src_data', 'src_inc', 'src_fb'];
const T = (id, state, owner, o = {}) => ({ id, title: 'Việc ' + id, state, holder: o.holder || owner, owner, reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-10-30T09:00', updated: '2026-11-01T09:00', hours_since_update: o.h === undefined ? 2 : o.h, tier: o.tier === undefined ? 'A' : o.tier, area: 'dashboard/model', evals: 1, spec_returns: 0, evals_added: 0 });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const dash = (tasks, events = []) => ({ generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events, roster,
  model: { invariants: { 'dashboard/model': 1 }, invariants_total: 1, adversarial_evals: 0, regression_evals: 0, insight_reports: 1, last_insight: '', specs: 1 } });
let n = 0;
const live = o => ({ type: 'event', id: 'E-' + (9500 + (++n)), t: '2026-11-01T12:00', round: 0, severity: '', cost: 0, title: '', ...o });
const hist = (i, event, from, to, task, state) => ({ seq: 'S-' + i, ledger_id: 'E-' + i, t: '2026-10-31T10:0' + i, task, title: '', event, from, to, round: 0, severity: '', detail: '', link: '', cost: 0, state: state || '', holder: '' });

// Dữ liệu "nhiều khối có việc": có cả việc new của product và engineering, để bất biến đúng với mọi quy tắc sáng hiện hành.
const BUSY = () => [T('T-1', 'new', 'product'), T('T-2', 'doing', 'product'), T('T-3', 'review', 'product'), T('T-4', 'spec', 'engineering', { holder: 'product' }),
  T('T-5', 'new', 'engineering'), T('T-6', 'doing', 'engineering'), T('T-7', 'rework', 'engineering'), T('T-8', 'review', 'engineering'), T('T-9', 'doing', 'insight'),
  T('T-10', 'done', 'engineering', { tier: 'B', h: 5, holder: '-' })];
const IDLE = () => [T('T-1', 'done', 'engineering', { tier: 'A', h: 5, holder: '-' })];
const SHAPES = 'rect,circle,ellipse,path,polygon,polyline,line';
const ACC = '[data-part="lamp"],[data-part="sweat"],[data-part="paper"],[data-part="speed"],[data-part="question"]';
const OK_KF = ['offset', 'computedOffset', 'easing', 'composite', 'transform', 'opacity'];

const SAMPLER = `(() => { const W = window.__ci = { log: [], kfBad: [], filterBad: 0, swBase: null, swBad: [] };
  const BL = ${JSON.stringify(BLOCKS)}, SH = ${JSON.stringify(SHAPES)}, OK = new Set(${JSON.stringify(OK_KF)});
  const op = (el, svg) => { let o = 1, x = el; while (x && x !== svg && x.nodeType === 1) { o *= parseFloat(getComputedStyle(x).opacity); x = x.parentNode; } return o; };
  let f = 0;
  const tick = t => { f++; const svg = document.querySelector('#model svg');
    if (svg && svg.getScreenCTM()) { const sr = svg.getBoundingClientRect(), sc = sr.width / (svg.viewBox.baseVal.width || 1000); const r = { t, ch: {}, lit: {}, b: [], ca: -1 };
      for (const g of svg.querySelectorAll('g.mch[data-block]')) { const id = g.getAttribute('data-block'), body = g.querySelector('[data-part="body"]'); const br = body ? body.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
        r.ch[id] = { s: g.getAttribute('data-state'), a: g.getAttribute('data-anim'), o: op(g, svg), cx: (br.left + br.width / 2 - sr.left) / sc, cy: (br.top + br.height / 2 - sr.top) / sc }; }
      for (const id of BL) { const g = document.getElementById(id); const s = g && g.querySelector(':scope > rect, :scope > circle'); if (s) r.lit[id] = parseFloat(getComputedStyle(s).strokeWidth) || 0; }
      for (const b of svg.querySelectorAll('#fx_b .bub')) { if (op(b, svg) <= 0.05) continue; const tx = b.querySelector('[data-part="bubble-text"]'); r.b.push([b.getAttribute('data-block'), tx ? tx.textContent : '']); }
      if (f % 3 === 0 && document.getAnimations) { let ca = 0;
        for (const a of document.getAnimations()) { const tg = a.effect && a.effect.target; if (!tg || !tg.closest || !tg.closest('#model .mch, #model .bub')) continue; if (a.playState !== 'running' && a.playState !== 'pending') continue; ca++;
          try { for (const kf of a.effect.getKeyframes()) for (const k of Object.keys(kf)) if (!OK.has(k)) W.kfBad.push(k); } catch (_) { } }
        r.ca = ca;
        const sw = [...svg.querySelectorAll('g.mch')].map(g => [...g.querySelectorAll(SH)].map(e => getComputedStyle(e).strokeWidth));
        if (!W.swBase) W.swBase = sw; else sw.forEach((a, i) => a.forEach((v, j) => { const b = W.swBase[i] && W.swBase[i][j]; if (b !== undefined && v !== b && W.swBad.length < 5) W.swBad.push(i + ':' + j + ' ' + b + '->' + v); })); }
      if (f % 30 === 0) for (const e of svg.querySelectorAll('.mch, .mch *, .bub, .bub *')) { if (getComputedStyle(e).filter !== 'none') { W.filterBad++; break; } }
      W.log.push(r); }
    requestAnimationFrame(tick); };
  requestAnimationFrame(tick); })();`;

let browser;
async function open(opt) {
  const ctx = await browser.newContext({ viewport: opt.vp || { width: 1280, height: 900 }, reducedMotion: opt.reduce ? 'reduce' : 'no-preference', colorScheme: 'light' });
  const page = await ctx.newPage(); const o = { ctx, page, sock: null, errors: [] };
  page.on('pageerror', e => o.errors.push(String(e)));
  await page.addInitScript(SAMPLER);
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(opt.data) }));
  await page.routeWebSocket(/\/ws$/, ws => { o.sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: opt.snapshot || [], activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(opt.settle === undefined ? 1500 : opt.settle);
  return o;
}
const send = (o, ev) => o.sock.send(JSON.stringify(live(ev)));
const now = o => o.page.evaluate(() => performance.now());
const logOf = (o, from = 0) => o.page.evaluate(f => window.__ci.log.filter(r => r.t >= f), from);
const range = xs => xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
const STATES = new Set(['idle', 'work', 'give', 'take', 'wait']);

// Sai lệch trạng thái nhân vật ↔ khối sáng kéo dài quá 0,3 giây (+ dung sai khung hình). give/take không xét.
function mismatch(log) {
  const ids = new Set(); log.forEach(r => Object.keys(r.ch).forEach(k => ids.add(k)));
  for (const id of ids) { let bad = null;
    for (const r of log) { const c = r.ch[id], w = r.lit[id]; if (!c || w === undefined) continue;
      if (!STATES.has(c.s)) return `${id} có data-state "${c.s}" ngoài 5 trạng thái`;
      if (c.s === 'wait' && id !== 'nd_capu') return `${id} ở wait (chỉ nd_capu được chờ quyết)`;
      const on = w >= 2.5, mis = ((c.s === 'work' || c.s === 'wait') && !on) || (c.s === 'idle' && on);
      if (mis) { if (!bad) bad = { t0: r.t, s: c.s, on }; else if (r.t - bad.t0 > 400) return `${id} ở ${bad.s} nhưng khối ${bad.on ? 'sáng' : 'không sáng'} hơn 0,3 giây`; } else bad = null; } }
  return null;
}
const paint = o => o.page.evaluate(([SH, ACC]) => { const out = {};
  for (const g of document.querySelectorAll('#model svg g.mch[data-block]')) { const blk = document.getElementById(g.getAttribute('data-block')); const s = blk && blk.querySelector(':scope > rect, :scope > circle');
    out[g.getAttribute('data-block')] = { on: s ? (parseFloat(getComputedStyle(s).strokeWidth) || 0) >= 2.5 : false,
      els: [...g.querySelectorAll(SH)].map(e => { const st = getComputedStyle(e); return [st.strokeWidth, st.stroke, st.fill, !!e.closest(ACC), !!e.closest('[data-part="lamp"]')]; }) }; }
  return out; }, [SHAPES, ACC]);

const CHECKS = {
  // inv-010: ngoài give/take, nhân vật work/wait thì khối của nó sáng, idle thì khối không sáng (lệch ≤ 0,3 giây), dù khối sáng theo quy tắc nào.
  'char-match-lit': async () => {
    for (const [name, tasks, ev] of [['rảnh', IDLE(), null], ['nhiều khối có việc', BUSY(), { task: 'T-2', event: 'handoff', from: 'product', to: 'spec-critic', state: 'review', holder: 'spec-critic', owner: 'product' }],
      ['Capu chờ quyết', [T('T-20', 'escalated', 'engineering', { holder: 'capu' })], null]]) {
      const o = await open({ data: dash(tasks) }); const t0 = await now(o);
      if (ev) { await o.page.waitForTimeout(2500); send(o, ev); }
      await o.page.waitForTimeout(ev ? 6000 : 4000); const log = await logOf(o, t0); await o.ctx.close();
      if (o.errors.length) return `${name}: lỗi trang ${o.errors[0]}`;
      const e = mismatch(log); if (e) return `${name}: ${e}`;
      if (name !== 'rảnh') { const last = log[log.length - 1]; const lit = Object.keys(last.ch).filter(id => last.lit[id] >= 2.5);
        if (!lit.length) return `${name}: tiền đề sai, không khối có nhân vật nào sáng`; }
    }
    return null;
  },
  // inv-011: idle thì mờ (opacity tính ra 0,30–0,50) và thân đứng yên; trạng thái khác opacity ≥ 0,95.
  'idle-dim': async () => {
    const o = await open({ data: dash(BUSY()) }); const t0 = await now(o); await o.page.waitForTimeout(4500); const log = await logOf(o, t0); await o.ctx.close();
    const ids = Object.keys(log[0].ch); let seenIdle = false, seenOther = false;
    for (const id of ids) { const cs = log.map(r => r.ch[id]).filter(Boolean);
      for (const c of cs) { if (c.s === 'idle') { seenIdle = true; if (c.o < 0.30 - 0.01 || c.o > 0.50 + 0.01) return `${id} idle mà opacity ${c.o.toFixed(2)} (cần 0,30–0,50)`; }
        else if (c.o < 0.95 && !(c.s === 'give' || c.s === 'take')) return `${id} ở ${c.s} mà opacity ${c.o.toFixed(2)} (cần ≥ 0,95)`; else seenOther = true; }
      const idleRun = cs.every(c => c.s === 'idle'); if (idleRun) { const d = Math.max(range(cs.map(c => c.cx)), range(cs.map(c => c.cy))); if (d > 0.3) return `${id} idle mà thân dịch ${d.toFixed(2)} đơn vị`; } }
    if (!seenIdle || !seenOther) return 'tiền đề sai: cần vừa có nhân vật idle vừa có nhân vật đang làm';
    return null;
  },
  // inv-012: prefers-reduced-motion: reduce thì không animation/transition trên g.mch, g.bub; data-anim=none; thân đứng yên ở mọi trạng thái kể cả give/take.
  'reduced-still': async () => {
    const o = await open({ reduce: true, data: dash(BUSY()) }); const t0 = await now(o);
    send(o, { task: 'T-6', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' });
    send(o, { task: 'T-2', event: 'handoff', from: 'product', to: 'spec-critic', state: 'review', holder: 'spec-critic', owner: 'product' });
    await o.page.waitForTimeout(4000); const log = await logOf(o, t0); await o.ctx.close();
    const ca = Math.max(...log.map(r => r.ca)); if (ca > 0) return `${ca} animation/transition chạy trên nhân vật/bong bóng khi reduced-motion`;
    for (const id of Object.keys(log[0].ch)) { const cs = log.map(r => r.ch[id]).filter(Boolean);
      if (cs.some(c => c.a !== 'none')) return `${id} data-anim ${cs.find(c => c.a !== 'none').a} (cần none)`;
      const d = Math.max(range(cs.map(c => c.cx)), range(cs.map(c => c.cy))); if (d > 0.1) return `${id} thân dịch ${d.toFixed(2)} đơn vị khi reduced-motion`; }
    if (!log.some(r => Object.values(r.ch).some(c => c.s === 'give' || c.s === 'take'))) return 'tiền đề sai: reduced-motion mà sự kiện không tạo give/take nào (chỉ được tắt cử động, không tắt trạng thái)';
    return null;
  },
  // inv-013: ≤ 3 bong bóng cùng lúc, mỗi khối ≤ 1, mỗi bong bóng ≤ 3,5 giây; #fx_b rỗng sau khi hết sự kiện; #fx_f chỉ chứa circle; #fx_b không nằm trong #fx_f.
  'bubble-cap': async () => {
    const MIX = [['product', { event: 'handoff', from: 'product', to: 'spec-critic', state: 'review', holder: 'spec-critic' }], ['engineering', { event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary' }],
      ['engineering', { event: 'rejected', from: 'adversary', to: 'engineering', state: 'rework', holder: 'engineering', severity: 'blocker', round: 1 }], ['insight', { event: 'handoff', from: 'insight', to: 'reviewer', state: 'review', holder: 'reviewer' }],
      ['engineering', { event: 'evalplus', from: 'adversary', to: 'engineering', state: 'doing', holder: 'engineering' }]];
    const tasks = Array.from({ length: 40 }, (_, i) => T('T-' + (100 + i), 'doing', MIX[i % MIX.length][0]));
    const o = await open({ data: dash(tasks) }); const t0 = await now(o);
    tasks.forEach((t, i) => send(o, { task: t.id, owner: MIX[i % MIX.length][0], ...MIX[i % MIX.length][1] }));
    await o.page.waitForTimeout(10000); const log = await logOf(o, t0);
    const dom = await o.page.evaluate(() => ({ fxb: !!document.getElementById('fx_b'), inF: !!document.querySelector('#fx_f #fx_b, #fx_f .bub'), left: document.querySelectorAll('#fx_b > *').length,
      nonCircle: [...document.querySelectorAll('#fx_f > *')].filter(e => e.tagName.toLowerCase() !== 'circle').length }));
    await o.ctx.close();
    if (!dom.fxb) return 'không có lớp #fx_b'; if (dom.inF || dom.nonCircle) return '#fx_f chứa phần tử không phải circle dot (bong bóng phải ở #fx_b)';
    const maxB = Math.max(...log.map(r => r.b.length)); if (maxB > 3) return `${maxB} bong bóng cùng lúc (tối đa 3)`; if (maxB < 1) return 'tiền đề sai: 40 sự kiện mà không bong bóng nào';
    for (const r of log) { const s = new Set(); for (const b of r.b) { if (s.has(b[0])) return `khối ${b[0]} có 2 bong bóng cùng lúc`; s.add(b[0]); } }
    const open1 = new Map(); for (const r of log) { const cur = new Set(r.b.map(b => b[0] + '|' + b[1]));
      for (const k of cur) { if (!open1.has(k)) open1.set(k, r.t); else if (r.t - open1.get(k) > 3500 + 100) return `bong bóng ${k} hiện quá 3,5 giây`; }
      for (const k of [...open1.keys()]) if (!cur.has(k)) open1.delete(k); }
    return dom.left ? `#fx_b còn ${dom.left} phần tử 10 giây sau sự kiện cuối` : null;
  },
  // inv-014: mở trang với sự kiện cũ (dashboard.json + snapshot live) không tạo give/take/bong bóng giao-nhận.
  'no-fake-handover': async () => {
    const o = await open({ data: dash([T('T-1', 'doing', 'engineering'), T('T-2', 'review', 'engineering'), T('T-3', 'rework', 'engineering')],
      [hist(1, 'assigned', 'chief-of-staff', 'engineering', 'T-1', 'new'), hist(2, 'handoff', 'engineering', 'adversary', 'T-2', 'review'), hist(3, 'rejected', 'adversary', 'engineering', 'T-3', 'rework')]),
      snapshot: [live({ task: 'T-2', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' })], settle: 300 });
    await o.page.waitForTimeout(7000); const log = await logOf(o); await o.ctx.close();
    if (log.some(r => Object.values(r.ch).some(c => c.s === 'give' || c.s === 'take'))) return 'sự kiện cũ làm nhân vật vào give/take';
    return log.some(r => r.b.length) ? 'sự kiện cũ tạo bong bóng' : null;
  },
  // inv-015: nhân vật tự giữ nét vẽ: khối sáng hay nháy (CSS tô viền/nền của khối) không đổi stroke, stroke-width của phần nào, không đổi fill của phần
  // không phải lamp/phần phụ; animation trên nhân vật và bong bóng chỉ có transform/opacity; không filter.
  'char-own-paint': async () => {
    let o = await open({ data: dash(IDLE()) }); const base = await paint(o); await o.ctx.close();
    o = await open({ data: dash(BUSY()) }); const busy = await paint(o); await o.ctx.close();
    let litSeen = 0;
    for (const [id, b] of Object.entries(busy)) { const a = base[id]; if (!a || !b.on) continue; litSeen++;
      if (a.els.length !== b.els.length) return `${id}: số phần tử vẽ đổi khi khối sáng (${a.els.length} → ${b.els.length})`;
      for (let i = 0; i < a.els.length; i++) { const [sw0, s0, f0, acc] = a.els[i], [sw1, s1, f1] = b.els[i];
        if (sw0 !== sw1) return `${id}: phần tử ${i} đổi stroke-width ${sw0} → ${sw1} khi khối sáng (bị viền của khối tô)`;
        if (!a.els[i][4] && s0 !== s1) return `${id}: phần tử ${i} đổi stroke ${s0} → ${s1} khi khối sáng`;
        if (!acc && f0 !== f1) return `${id}: phần tử ${i} đổi fill ${f0} → ${f1} khi khối sáng (bị nền của khối tô)`; } }
    if (!litSeen) return 'tiền đề sai: không khối có nhân vật nào sáng';
    // khối nháy (dot tới) và đổi sáng/tối liên tục: stroke-width giữ nguyên, keyframe chỉ transform/opacity
    o = await open({ data: dash(BUSY()) });
    send(o, { task: 'T-6', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' });
    send(o, { task: 'T-3', event: 'accepted', from: 'spec-critic', to: 'done', state: 'done', holder: '-', owner: 'product' });
    send(o, { task: 'T-8', event: 'rejected', from: 'adversary', to: 'engineering', state: 'rework', holder: 'engineering', owner: 'engineering', severity: 'blocker', round: 1 });
    send(o, { task: 'T-7', event: 'started', from: 'engineering', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering', round: 1, rounds: 1 });
    await o.page.waitForTimeout(5000);
    const st = await o.page.evaluate(() => ({ kf: window.__ci.kfBad, sw: window.__ci.swBad, fl: window.__ci.filterBad })); await o.ctx.close();
    if (st.sw.length) return 'stroke-width của nhân vật đổi khi khối sáng/nháy: ' + st.sw.join(', ');
    if (st.kf.length) return 'animation/transition trên nhân vật/bong bóng có thuộc tính ' + [...new Set(st.kf)].join(', ') + ' (chỉ được transform/opacity)';
    return st.fl ? 'có filter trên nhân vật/bong bóng' : null;
  },
};

(async () => {
  if (!CHECKS[CHECK]) { console.log('FAIL --check phải là: ' + Object.keys(CHECKS).join(', ')); process.exit(1); }
  browser = await chromium.launch(); let err, na = false;
  try {
    const o = await open({ data: dash(IDLE()), settle: 800 }); const cnt = await o.page.evaluate(() => document.querySelectorAll('#model svg g.mch[data-block]').length); await o.ctx.close();
    if (!cnt) { if (fs.existsSync(path.join(REPO, 'docs', 'screenshots', 'T-031'))) err = 'không có g.mch nào trong #model dù T-031 đã vào (có docs/screenshots/T-031/): nhân vật bị gỡ'; else na = true; }
    else err = await CHECKS[CHECK]();
  } catch (e) { err = 'lỗi chạy: ' + (e && e.message || e); }
  await browser.close();
  console.log(err ? `FAIL ${CHECK}: ${err}` : na ? `PASS ${CHECK} (chưa áp dụng: trang chưa có nhân vật T-031)` : `PASS ${CHECK}`); process.exit(err ? 1 : 0);
})();
