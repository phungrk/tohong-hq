#!/usr/bin/env node
// Eval đối kháng T-034 (adversary, 2026-11-01). Spec: products/T-031-nhan-vat-khoi-mo-hinh.md mục 2, 4, 6.
//   node eval/T-034/lib/adv_chars.cjs --repo <repo-dashboard> --check <rapid|bub4|reconnect|overlap|hidden|resize|krprod>
// Dữ liệu dashboard.json, kênh live, d3 đều giả/cục bộ. Mã thoát 0 = đạt.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), CHECK = arg('--check'), INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO); process.exit(1); }
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js'); process.exit(1); }
const CHARS = ['nd_intents', 'nd_spec', 'nd_respec', 'gt_spec', 'nd_exec', 'nd_rework', 'gt_code', 'nd_capu', 'nd_insight', 'nd_kr', 'nd_prod'];
const T = (id, state, owner, o = {}) => ({ id, title: 'Việc ' + id, state, holder: o.holder || owner, owner, reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-10-30T09:00', updated: '2026-11-01T09:00', hours_since_update: 2, tier: o.tier === undefined ? 'A' : o.tier, area: 'dashboard/model', evals: 1, spec_returns: 0, evals_added: 0 });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const dash = (tasks, events = []) => ({ generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events, roster,
  model: { invariants: { 'dashboard/model': 1 }, invariants_total: 1, adversarial_evals: 0, regression_evals: 0, insight_reports: 1, last_insight: '', specs: 1 } });
let n = 0;
const live = o => ({ type: 'event', id: 'E-' + (9500 + (++n)), t: '2026-11-01T12:00', round: 0, severity: '', cost: 0, title: '', ...o });
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
// Mỗi khung: trạng thái nhân vật, bong bóng đang có (khối, chữ, cỡ chữ px), khoảng cách khung.
const SAMPLER = `(() => { const W = window.__adv = { log: [], maxGap: 0 }; let last = 0;
  const tick = t => { if (last && !window.__hidden) W.maxGap = Math.max(W.maxGap, t - last); last = t;
    const svg = document.querySelector('#model svg');
    if (svg) { const sc = svg.getBoundingClientRect().width / 1000; const r = { t, ch: {}, b: [] };
      svg.querySelectorAll('g.mch').forEach(g => r.ch[g.getAttribute('data-block')] = g.getAttribute('data-state'));
      svg.querySelectorAll('#fx_b .bub').forEach(b => { const tx = b.querySelector('[data-part=bubble-text]'); r.b.push([b.getAttribute('data-block'), tx ? tx.textContent : '', tx ? parseFloat(getComputedStyle(tx).fontSize) * sc : 0]); });
      W.log.push(r); }
    requestAnimationFrame(tick); }; requestAnimationFrame(tick); })();`;
const HIDER = `(() => { const raf = window.requestAnimationFrame.bind(window); const q = []; window.__hidden = false;
  window.requestAnimationFrame = cb => { if (window.__hidden) { q.push(cb); return 1e6 + q.length; } return raf(cb); };
  window.__show = () => { window.__hidden = false; Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); q.splice(0).forEach(cb => raf(cb)); document.dispatchEvent(new Event('visibilitychange')); };
  window.__hide = () => { window.__hidden = true; Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }; })();`;

let browser;
async function open(opt) {
  const ctx = await browser.newContext({ viewport: opt.vp || { width: 1280, height: 900 }, reducedMotion: opt.reduce ? 'reduce' : 'no-preference', colorScheme: opt.dark ? 'dark' : 'light' });
  const page = await ctx.newPage(); const o = { ctx, page, sock: null, socks: 0, errors: [], snapshot: opt.snapshot || [] };
  page.on('pageerror', e => o.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') o.errors.push(m.text()); });
  await page.addInitScript(HIDER); await page.addInitScript(SAMPLER);
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(opt.data) }));
  await page.routeWebSocket(/\/ws$/, ws => { o.sock = ws; o.socks++; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: o.snapshot, activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1500);
  return o;
}
const send = (o, ev) => { const e = live(ev); o.sock.send(JSON.stringify(e)); return e; };
const now = o => o.page.evaluate(() => performance.now());
const logAfter = async (o, t0) => (await o.page.evaluate(() => window.__adv.log)).filter(r => r.t >= t0);
const errs = o => o.errors.length ? 'lỗi console: ' + o.errors.slice(0, 2).join(' | ') : null;
const runsOf = (log, id, st) => { const out = []; let cur = null; for (const r of log) { const on = r.ch[id] === st; if (on && !cur) cur = { t0: r.t, t1: r.t }; if (on) cur.t1 = r.t; if (!on && cur) { out.push(cur); cur = null; } } if (cur) out.push(cur); return out; };
const base = () => dash([T('T-1', 'doing', 'engineering'), T('T-2', 'doing', 'product'), T('T-3', 'doing', 'insight')]);

const CHECKS = {
  // ADV-01: 4 dot liên tiếp rời cùng khối nd_exec (M6 ×4, 250 ms) xen với M4 (dot chạm nd_exec): không kẹt give/take, không quá 1 bong bóng mỗi khối,
  // 2,5 giây sau dot cuối chạm thì không nhân vật nào còn give/take (spec mục 2: mỗi cái 1,2 giây; mục 4: mỗi khối tối đa một bong bóng).
  rapid: async () => {
    const o = await open({ data: base() }); const t0 = await now(o);
    for (let i = 0; i < 4; i++) { send(o, EV.M6); if (i === 1) send(o, EV.M4); await o.page.waitForTimeout(250); }
    await o.page.waitForTimeout(9000); const log = await logAfter(o, t0); const e = errs(o); await o.ctx.close();
    if (e) return e;
    const perBlock = Math.max(...log.map(r => { const c = {}; r.b.forEach(b => c[b[0]] = (c[b[0]] || 0) + 1); return Math.max(0, ...Object.values(c)); }));
    if (perBlock > 1) return `${perBlock} bong bóng cùng khối cùng lúc`;
    if (Math.max(...log.map(r => r.b.length)) > 3) return 'quá 3 bong bóng';
    const lastT = log[log.length - 1].t, tail = log.filter(r => r.t > lastT - 2500);
    const stuck = CHARS.filter(id => tail.some(r => r.ch[id] === 'give' || r.ch[id] === 'take'));
    if (stuck.length) return 'còn give/take sau khi yên: ' + stuck.join(', ');
    const g = runsOf(log, 'nd_exec', 'give'); if (!g.length) return 'nd_exec không có give';
    return null;
  },
  // ADV-02: bong bóng thứ 4 (4 khối gửi khác nhau cùng lúc): ≤ 3 bong bóng; cái cũ nhất bị gỡ (spec mục 4).
  bub4: async () => {
    const o = await open({ data: base(), reduce: true }); const t0 = await now(o);
    for (const k of ['M6', 'M5', 'M7', 'M18']) { send(o, EV[k]); await o.page.waitForTimeout(60); }
    await o.page.waitForTimeout(1500); const log = await logAfter(o, t0); const e = errs(o); await o.ctx.close();
    if (e) return e;
    const mx = Math.max(...log.map(r => r.b.length)); if (mx > 3) return `${mx} bong bóng cùng lúc`;
    const last = log[log.length - 1].b.map(b => b[0] + ':' + b[1]);
    if (last.some(x => x.startsWith('nd_exec:Xong'))) return 'bong bóng cũ nhất (nd_exec "Xong, giao đây!") không bị gỡ: ' + last.join(', ');
    return last.length === 3 ? null : 'sau 4 sự kiện còn ' + last.length + ' bong bóng: ' + last.join(', ');
  },
  // ADV-03: kênh live đứt rồi nối lại; snapshot chứa sự kiện đã chạy và sự kiện lỡ: không give/take/bong bóng nào (spec mục 6 "Tải lại, kênh live nối lại").
  reconnect: async () => {
    const o = await open({ data: base() });
    const e1 = send(o, EV.M6); await o.page.waitForTimeout(5000);
    const e2 = live(EV.M5), e3 = live(EV.M16);
    o.snapshot = [e1, e2, e3]; const t0 = await now(o); o.sock.close();
    for (let i = 0; i < 40 && o.socks < 2; i++) await o.page.waitForTimeout(250);
    if (o.socks < 2) { await o.ctx.close(); return 'trang không nối lại kênh live sau 10 giây'; }
    await o.page.waitForTimeout(4000); const log = await logAfter(o, t0); const e = errs(o); await o.ctx.close();
    if (e) return e;
    const gt = CHARS.filter(id => log.some(r => r.ch[id] === 'give' || r.ch[id] === 'take'));
    const bb = [...new Set(log.flatMap(r => r.b.map(b => b[0] + ':' + b[1])))];
    if (gt.length) return 'nối lại sinh give/take giả: ' + gt.join(', ');
    return bb.length ? 'nối lại sinh bong bóng giả: ' + bb.join(', ') : null;
  },
  // ADV-04: hộp bao [data-part=body] không chồng lên chữ của khối nó quá 2 đơn vị SVG theo mỗi chiều ở MỌI trạng thái, kể cả lúc give lao và take nhảy
  // (spec mục 1 "Vị trí và cỡ" không giới hạn ở trạng thái nghỉ; mục 6 390px "nhân vật không che chữ của khối; mọi trạng thái đúng như desktop"). Đo ở 1280 và 390.
  overlap: async () => {
    const out = [];
    for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const o = await open({ vp, data: base() });
      const scan = () => o.page.evaluate(() => { const svg = document.querySelector('#model svg'), sr = svg.getBoundingClientRect(), sc = sr.width / 1000, hits = [];
        svg.querySelectorAll('g.mch').forEach(g => { const id = g.getAttribute('data-block'), blk = document.getElementById(id); if (!blk) return;
          const texts = [...blk.querySelectorAll('text')].filter(t => !t.closest('.mch,.bub,#fx_b') && t.getBoundingClientRect().width > 0);
          const body = g.querySelector('[data-part="body"]'); if (!body) return; const a = body.getBoundingClientRect(); if (!a.width) return;
          for (const t of texts) { const b = t.getBoundingClientRect(); const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (w > 2 * sc && h > 2 * sc) hits.push(id + '[' + g.getAttribute('data-state') + (g.getAttribute('data-dir') ? ' ' + g.getAttribute('data-dir') : '') + '] body ↔ "' + t.textContent.slice(0, 24) + '" ' + (w / sc).toFixed(1) + '×' + (h / sc).toFixed(1)); } });
        return [...new Set(hits)]; });
      const all = new Set(await scan());
      for (const k of ['M6', 'M5', 'M7', 'M8', 'M12', 'M14', 'M16', 'M11', 'M18', 'M4', 'M17', 'M9']) { send(o, EV[k]); for (let i = 0; i < 24; i++) { await o.page.waitForTimeout(100); (await scan()).forEach(x => all.add(x)); } }
      const e = errs(o); await o.ctx.close(); if (e) return e;
      if (all.size) out.push(vp.width + 'px: ' + [...all].slice(0, 6).join('; ') + (all.size > 6 ? ` (+${all.size - 6})` : ''));
    }
    return out.length ? out.join(' || ') : null;
  },
  // ADV-05: tab ẩn (rAF dừng) nhận 20 sự kiện rồi hiện lại: ≤ 3 bong bóng, 6 giây sau không nhân vật nào kẹt give/take, #fx_b rỗng (spec mục 4, mục 6 dồn sự kiện).
  hidden: async () => {
    const o = await open({ data: base() }); await o.page.evaluate(() => window.__hide());
    const ks = ['M6', 'M5', 'M7', 'M16', 'M12'];
    for (let i = 0; i < 20; i++) send(o, EV[ks[i % ks.length]]);
    await o.page.waitForTimeout(5000); const t0 = await now(o); await o.page.evaluate(() => window.__show());
    await o.page.waitForTimeout(14000); const log = await logAfter(o, t0); const e = errs(o); await o.ctx.close();
    if (e) return e;
    const mx = Math.max(...log.map(r => r.b.length)); if (mx > 3) return `${mx} bong bóng cùng lúc khi tab hiện lại`;
    const lastT = log[log.length - 1].t, tail = log.filter(r => r.t > lastT - 5000);
    const stuck = CHARS.filter(id => tail.some(r => r.ch[id] === 'give' || r.ch[id] === 'take'));
    if (stuck.length) return 'kẹt give/take sau khi tab hiện lại: ' + stuck.join(', ');
    return tail.some(r => r.b.length) ? 'còn bong bóng 9 giây sau khi tab hiện lại' : null;
  },
  // ADV-06: đổi bề ngang (1280→390, 390→844) GIỮA LÚC bong bóng đang hiện: chữ bong bóng 9–16px (spec mục 4, mục 6 đổi bề ngang).
  resize: async () => {
    const out = [];
    for (const [a, b] of [[{ width: 1280, height: 900 }, { width: 390, height: 844 }], [{ width: 390, height: 844 }, { width: 844, height: 390 }], [{ width: 390, height: 844 }, { width: 1920, height: 1000 }]]) {
      const o = await open({ vp: a, data: base() }); send(o, EV.M6); await o.page.waitForTimeout(500);
      await o.page.setViewportSize(b); await o.page.waitForTimeout(200); const t0 = await now(o); await o.page.waitForTimeout(500);
      const log = await logAfter(o, t0); const e = errs(o); await o.ctx.close(); if (e) return e;
      const fs = log.flatMap(r => r.b.map(x => x[2])); if (!fs.length) { out.push(`${a.width}→${b.width}: không còn bong bóng để đo`); continue; }
      const bad = fs.filter(f => f < 9 || f > 16); if (bad.length) out.push(`${a.width}→${b.width}: chữ bong bóng ${bad[0].toFixed(1)}px`);
    }
    return out.length ? out.join('; ') : null;
  },
  // ADV-07: nd_kr và nd_prod chỉ idle/take (spec mục 1), kể cả khi nhiều dot chạm liên tiếp và khi reduced-motion.
  krprod: async () => {
    const out = [];
    for (const reduce of [false, true]) {
      const o = await open({ data: base(), reduce }); const t0 = await now(o);
      for (const k of ['M16', 'M11', 'M9', 'M16']) { send(o, EV[k]); await o.page.waitForTimeout(300); }
      await o.page.waitForTimeout(6000); const log = await logAfter(o, t0); const e = errs(o); await o.ctx.close(); if (e) return e;
      for (const id of ['nd_kr', 'nd_prod']) { const bad = [...new Set(log.map(r => r.ch[id]).filter(s => s !== 'idle' && s !== 'take'))]; if (bad.length) out.push(`${id}${reduce ? ' (reduced)' : ''}: ${bad.join(',')}`); }
      if (!log.some(r => r.ch.nd_kr === 'take')) out.push(`nd_kr${reduce ? ' (reduced)' : ''} không có take`);
    }
    return out.length ? out.join('; ') : null;
  },
};

(async () => {
  if (!CHECKS[CHECK]) { console.log('FAIL --check phải là: ' + Object.keys(CHECKS).join(', ')); process.exit(1); }
  browser = await chromium.launch(); let err;
  try { err = await CHECKS[CHECK](); } catch (e) { err = 'lỗi chạy: ' + (e && e.message || e); }
  await browser.close();
  console.log(err ? `FAIL ${CHECK}: ${err}` : `PASS ${CHECK}`); process.exit(err ? 1 : 0);
})();
