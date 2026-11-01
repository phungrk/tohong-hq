#!/usr/bin/env node
// Thư viện đo bất biến vùng dashboard/model (nguồn: T-028, spec products/T-028-mo-hinh-dot-chay.md, qua Spec Gate 2026-11-01).
// Viết lại gọn từ các ca của eval/T-028/model-dots.cjs (S2, B1/B4, dot trên đường, M3/S4, RM2, P1, S5); bản cố định, không phụ thuộc eval việc.
//   node model_inv.cjs --repo <repo-dashboard> --check <no-fake-dots|dot-cap|dot-on-path|no-stuck-lit|reduced-no-dots|no-hscroll-390|capu-escalated>
// Dữ liệu dashboard.json, kênh live (WebSocket) và d3 đều giả/cục bộ. Mã thoát 0 = đạt.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), CHECK = arg('--check'), INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO + ' (đặt TOHONG_DASHBOARD_REPO)'); process.exit(1); }
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js'); process.exit(1); }

const COLORS = ['#14754d', '#2b7fb8', '#d9931f', '#dd3333', '#8a5cf6'].map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
const BAD = [0xdd, 0x33, 0x33];
const BLOCKS = ['nd_intents', 'nd_spec', 'nd_respec', 'nd_exec', 'nd_rework', 'nd_capu', 'gt_spec', 'gt_code', 'nd_kr', 'nd_rel', 'nd_prod', 'nd_insight', 'src_data', 'src_inc', 'src_fb'];
const T = (id, state, owner, o = {}) => ({ id, title: 'Việc ' + id, state, holder: o.holder || owner, owner, reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-10-30T09:00', updated: '2026-11-01T09:00', hours_since_update: o.h === undefined ? 2 : o.h, tier: o.tier === undefined ? 'A' : o.tier, area: 'dashboard/model', evals: 1, spec_returns: 0, evals_added: 0 });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const dash = (tasks, events = []) => ({ generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events, roster,
  model: { invariants: { 'dashboard/model': 1 }, invariants_total: 1, adversarial_evals: 0, regression_evals: 0, insight_reports: 1, last_insight: '', specs: 1 } });
let n = 0;
const live = o => ({ type: 'event', id: 'E-' + (9000 + (++n)), t: '2026-11-01T12:00', round: 0, severity: '', cost: 0, title: '', ...o });
const hist = (i, event, from, to, task, state) => ({ seq: 'S-' + i, ledger_id: 'E-' + i, t: '2026-10-31T10:0' + i, task, title: '', event, from, to, round: 0, severity: '', detail: '', link: '', cost: 0, state: state || '', holder: '' });

const SAMPLER = `(() => { const W = window.__inv = { created: 0, maxTotal: 0, dots: [] };
  new MutationObserver(ms => { for (const m of ms) for (const x of m.addedNodes) if (x.nodeType === 1 && x.tagName.toLowerCase() === 'circle' && x.parentNode && x.parentNode.id === 'fx_f') W.created++; }).observe(document, { childList: true, subtree: true });
  const tick = () => { const L = document.getElementById('fx_f'), svg = document.querySelector('#model svg');
    if (L && svg && svg.getScreenCTM()) { const inv = svg.getScreenCTM().inverse(), cs = L.querySelectorAll('circle'); W.maxTotal = Math.max(W.maxTotal, cs.length);
      for (const c of cs) { const st = getComputedStyle(c); if (parseFloat(st.opacity) > 0.05 && c.getScreenCTM()) { const p = new DOMPoint(c.cx.baseVal.value, c.cy.baseVal.value).matrixTransform(c.getScreenCTM()).matrixTransform(inv); W.dots.push([p.x, p.y, st.fill]); } } }
    requestAnimationFrame(tick); }; requestAnimationFrame(tick); })();`;

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
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1500);
  return o;
}
const send = (o, ev) => o.sock.send(JSON.stringify(live(ev)));
const stats = o => o.page.evaluate(() => ({ created: window.__inv.created, maxTotal: window.__inv.maxTotal, dots: window.__inv.dots }));
const lit = o => o.page.evaluate(ids => { const out = {}; for (const id of ids) { const g = document.getElementById(id); const s = g && g.querySelector(':scope > rect, :scope > circle'); if (!s) continue; const st = getComputedStyle(s); out[id] = [parseFloat(st.strokeWidth) || 0, st.stroke]; } return out; }, BLOCKS);
const rgb = s => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); return m ? m[1].split(/[ ,\/]+/).filter(Boolean).slice(0, 3).map(Number) : null; };
const near = (a, b) => a && b && a.every((v, i) => Math.abs(v - b[i]) <= 3);

const CHECKS = {
  // Bất biến 1: không có sự kiện mới thì không dot (kể cả có sự kiện cũ trong dashboard.json và snapshot)
  'no-fake-dots': async () => {
    const o = await open({ data: dash([T('T-1', 'doing', 'engineering'), T('T-2', 'review', 'engineering')], [hist(1, 'assigned', 'chief-of-staff', 'engineering', 'T-1', 'new'), hist(2, 'handoff', 'engineering', 'adversary', 'T-2', 'review')]),
      snapshot: [live({ task: 'T-2', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' })] });
    await o.page.waitForTimeout(7000); const s = await stats(o); await o.ctx.close();
    return s.created === 0 ? null : `tạo ${s.created} dot dù không có sự kiện mới`;
  },
  // Bất biến 2: không bao giờ quá 12 circle trong #fx_f; sau khi xong #fx_f rỗng
  'dot-cap': async () => {
    const tasks = Array.from({ length: 40 }, (_, i) => T('T-' + (100 + i), 'doing', 'engineering'));
    const o = await open({ data: dash(tasks) });
    tasks.forEach(t => send(o, { task: t.id, event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' }));
    await o.page.waitForTimeout(16000); const s = await stats(o); const left = await o.page.evaluate(() => document.querySelectorAll('#fx_f circle').length); await o.ctx.close();
    if (s.maxTotal > 12) return `${s.maxTotal} circle cùng lúc trong #fx_f (tối đa 12)`;
    if (s.created === 0) return 'không có dot nào cho 40 sự kiện (phải vẫn thấy dot)';
    return left === 0 ? null : `còn ${left} dot treo sau khi xong`;
  },
  // Bất biến 3: mọi dot nằm trên một đường p_* và có fill thuộc 5 màu
  'dot-on-path': async () => {
    const o = await open({ data: dash([T('T-1', 'doing', 'engineering'), T('T-2', 'review', 'product'), T('T-3', 'review', 'engineering'), T('T-4', 'doing', 'engineering')]) });
    const paths = await o.page.evaluate(() => { const r = []; document.querySelectorAll('#model svg path[id^="p_"]').forEach(p => { const L = p.getTotalLength(); for (let s = 0; s <= L; s += 2) { const q = p.getPointAtLength(s); r.push([q.x, q.y]); } }); return r; });
    send(o, { task: 'T-1', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' });
    send(o, { task: 'T-2', event: 'rejected', from: 'spec-critic', to: 'product', state: 'spec', holder: 'product', owner: 'product', severity: 'blocker', round: 1 });
    send(o, { task: 'T-3', event: 'evalplus', from: 'adversary', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering' });
    send(o, { task: 'T-4', event: 'escalated', from: 'chief-of-staff', to: 'capu', state: 'escalated', holder: 'capu', owner: 'engineering' });
    send(o, { task: 'T-9', event: 'assigned', from: 'chief-of-staff', to: 'product', state: 'new', holder: 'product', owner: 'product' });
    await o.page.waitForTimeout(6000); const s = await stats(o); await o.ctx.close();
    if (!s.dots.length) return 'không thấy dot nào cho 5 sự kiện có ánh xạ';
    for (const d of s.dots) {
      let m = 1e9; for (const q of paths) m = Math.min(m, Math.hypot(d[0] - q[0], d[1] - q[1]));
      if (m > 5) return `dot tại (${d[0].toFixed(0)},${d[1].toFixed(0)}) cách đường p_* gần nhất ${m.toFixed(1)}`;
      if (!COLORS.some(c => near(rgb(d[2]), c))) return `dot màu ${d[2]} ngoài 5 màu`;
    }
    return null;
  },
  // Bất biến 4: khối không có việc theo sổ cái và không nhận dot trong 10 giây thì tắt; dữ liệu rảnh thì không khối nào sáng
  'no-stuck-lit': async () => {
    const o = await open({ data: dash([T('T-1', 'done', 'engineering', { tier: 'A' }), T('T-2', 'blocked', 'engineering'), T('T-3', 'new', 'product'), T('T-4', 'done', 'engineering', { tier: 'B', h: 60 })]) });
    let l = await lit(o); const on0 = Object.keys(l).filter(k => l[k][0] >= 2.5);
    if (on0.length) { await o.ctx.close(); return 'dữ liệu rảnh mà khối sáng: ' + on0.join(', '); }
    send(o, { task: 'T-901', event: 'assigned', from: 'chief-of-staff', to: 'insight', state: 'new', holder: 'insight', owner: 'insight' });
    await o.page.waitForTimeout(14500); l = await lit(o); await o.ctx.close();
    const on = Object.keys(l).filter(k => l[k][0] >= 2.5);
    return on.length ? 'sau 10 giây không có việc vẫn sáng: ' + on.join(', ') : null;
  },
  // Bất biến 5: prefers-reduced-motion: reduce thì không circle nào trong #fx_f
  'reduced-no-dots': async () => {
    const o = await open({ reduce: true, data: dash([T('T-1', 'doing', 'engineering'), T('T-2', 'review', 'engineering', { tier: 'A' })]) });
    send(o, { task: 'T-1', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' });
    send(o, { task: 'T-2', event: 'accepted', from: 'adversary', to: 'done', state: 'done', holder: '-', owner: 'engineering' });
    await o.page.waitForTimeout(3000); const s = await stats(o); await o.ctx.close();
    return s.created === 0 ? null : `reduced-motion vẫn tạo ${s.created} dot`;
  },
  // Bất biến 6: trang dashboard không cuộn ngang ở 390px
  'no-hscroll-390': async () => {
    const o = await open({ vp: { width: 390, height: 844 }, data: dash([T('T-1', 'doing', 'engineering'), T('T-2', 'escalated', 'product', { holder: 'capu' })]) });
    const ov = await o.page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth); await o.ctx.close();
    return ov <= 0 ? null : `tràn ngang ${ov}px ở 390px`;
  },
  // Bất biến 7: có việc escalated (mọi chủ việc, kể cả chief-of-staff) thì khối Capu sáng đỏ, không tắt theo thời gian
  'capu-escalated': async () => {
    const o = await open({ data: dash([T('T-16', 'escalated', 'chief-of-staff', { holder: 'capu' })]) });
    const chk = async w => { const l = (await lit(o)).nd_capu; if (!l) return 'không đọc được nd_capu'; if (l[0] < 2.5) return `${w}: Capu không sáng (viền ${l[0]}px)`; return near(rgb(l[1]), BAD) ? null : `${w}: viền Capu màu ${l[1]}, cần #d33`; };
    let e = await chk('lúc mở trang'); if (!e) { await o.page.waitForTimeout(11500); e = await chk('sau 11 giây'); }
    await o.ctx.close(); return e;
  },
};

(async () => {
  if (!CHECKS[CHECK]) { console.log('FAIL --check phải là: ' + Object.keys(CHECKS).join(', ')); process.exit(1); }
  browser = await chromium.launch(); let err;
  try { err = await CHECKS[CHECK](); } catch (e) { err = 'lỗi chạy: ' + (e && e.message || e); }
  await browser.close();
  console.log(err ? `FAIL ${CHECK}: ${err}` : `PASS ${CHECK}`); process.exit(err ? 1 : 0);
})();
