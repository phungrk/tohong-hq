#!/usr/bin/env node
// Eval đối kháng tầng 3 của T-029 (adversary, 2026-11-01). Spec: products/T-028-mo-hinh-dot-chay.md.
//   node adv_model.cjs --repo <repo-dashboard> --check <rotate|reconnect|decided|burst50|hidden|orphan>
// Dữ liệu dashboard.json, kênh live, d3 đều giả/cục bộ. Mã thoát 0 = đạt.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), CHECK = arg('--check'), INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO); process.exit(1); }
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js'); process.exit(1); }
const BLOCKS = ['nd_intents', 'nd_spec', 'nd_respec', 'nd_exec', 'nd_rework', 'nd_capu', 'gt_spec', 'gt_code', 'nd_kr', 'nd_rel', 'nd_prod', 'nd_insight', 'src_data', 'src_inc', 'src_fb'];
const T = (id, state, owner, o = {}) => ({ id, title: 'Việc ' + id, state, holder: o.holder || owner, owner, reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-10-30T09:00', updated: '2026-11-01T09:00', hours_since_update: o.h === undefined ? 2 : o.h, tier: o.tier === undefined ? 'A' : o.tier, area: 'dashboard/model', evals: 1, spec_returns: 0, evals_added: 0 });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const dash = (tasks, events = []) => ({ generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events, roster,
  model: { invariants: { 'dashboard/model': 1 }, invariants_total: 1, adversarial_evals: 0, regression_evals: 0, insight_reports: 1, last_insight: '', specs: 1 } });
let n = 0;
const live = o => ({ type: 'event', id: 'E-' + (9000 + (++n)), t: '2026-11-01T12:00', round: 0, severity: '', cost: 0, title: '', ...o });

// Lấy mẫu mỗi khung: số circle, đường kính hiển thị (px màn hình = 2r × hệ số co của getScreenCTM; getBoundingClientRect của circle trả 0 trong Chromium) của dot đang hiện, khoảng cách khung lớn nhất.
const SAMPLER = `(() => { const W = window.__adv = { created: 0, maxTotal: 0, diam: [], maxGap: 0 }; let last = 0;
  new MutationObserver(ms => { for (const m of ms) for (const x of m.addedNodes) if (x.nodeType === 1 && x.tagName.toLowerCase() === 'circle' && x.parentNode && x.parentNode.id === 'fx_f') W.created++; }).observe(document, { childList: true, subtree: true });
  const tick = t => { if (last && !window.__hidden) W.maxGap = Math.max(W.maxGap, t - last); last = t; const L = document.getElementById('fx_f');
    if (L) { const cs = L.querySelectorAll('circle'); W.maxTotal = Math.max(W.maxTotal, cs.length);
      for (const c of cs) if (parseFloat(getComputedStyle(c).opacity) > 0.05) { const m = c.getScreenCTM(); if (m) W.diam.push([+(2 * c.r.baseVal.value * Math.hypot(m.a, m.b)).toFixed(1), innerWidth]); } }
    requestAnimationFrame(tick); }; requestAnimationFrame(tick); })();`;
// Giả lập tab ẩn: khi window.__hidden = true, requestAnimationFrame không gọi callback (như trình duyệt thật), hiện lại thì chạy tiếp.
const HIDER = `(() => { const raf = window.requestAnimationFrame.bind(window); const q = []; window.__hidden = false;
  window.requestAnimationFrame = cb => { if (window.__hidden) { q.push(cb); return 1e6 + q.length; } return raf(cb); };
  window.__show = () => { window.__hidden = false; Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); q.splice(0).forEach(cb => raf(cb)); document.dispatchEvent(new Event('visibilitychange')); };
  window.__hide = () => { window.__hidden = true; Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }; })();`;

let browser;
async function open(opt) {
  const ctx = await browser.newContext({ viewport: opt.vp || { width: 1280, height: 900 }, reducedMotion: 'no-preference', colorScheme: 'light' });
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
const stats = o => o.page.evaluate(() => window.__adv);
const lit = o => o.page.evaluate(ids => { const out = {}; for (const id of ids) { const g = document.getElementById(id); const s = g && g.querySelector(':scope > rect, :scope > circle'); if (!s) continue; const st = getComputedStyle(s); out[id] = parseFloat(st.strokeWidth) || 0; } return out; }, BLOCKS);
const reset = o => o.page.evaluate(() => { const W = window.__adv; W.diam = []; W.maxTotal = 0; W.maxGap = 0; });
const errs = o => o.errors.length ? 'lỗi console: ' + o.errors.slice(0, 2).join(' | ') : null;

const CHECKS = {
  // ADV-01: xoay điện thoại / đổi bề ngang giữa lúc dot đang chạy. Spec mục 3: đường kính 7–16px ở mọi bề ngang 320–1920.
  rotate: async () => {
    const out = [];
    for (const [a, b] of [[{ width: 390, height: 844 }, { width: 844, height: 390 }], [{ width: 1280, height: 900 }, { width: 390, height: 844 }]]) {
      const o = await open({ vp: a, data: dash([T('T-1', 'doing', 'engineering')]) });
      send(o, { task: 'T-1', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' });
      await o.page.waitForTimeout(500); await o.page.setViewportSize(b); await o.page.waitForTimeout(300); await reset(o);
      await o.page.waitForTimeout(700); const s = await stats(o); const e = errs(o); await o.ctx.close();
      if (e) return e;
      const bad = s.diam.filter(([d]) => d < 7 || d > 16);
      if (!s.diam.length) out.push(`${a.width}→${b.width}: không đo được dot sau khi đổi bề ngang`);
      else if (bad.length) out.push(`${a.width}→${b.width}px giữa lúc dot chạy: đường kính ${bad[0][0]}px ở bề ngang ${bad[0][1]}px (cần 7–16)`);
    }
    return out.length ? out.join('; ') : null;
  },
  // ADV-02: kênh live đứt rồi nối lại, snapshot phát lại sự kiện đã chạy và sự kiện lỡ lúc đứt: không dot nào (spec mục 1, mục 6).
  reconnect: async () => {
    const o = await open({ data: dash([T('T-1', 'doing', 'engineering'), T('T-2', 'doing', 'engineering')]) });
    const e1 = send(o, { task: 'T-1', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' });
    await o.page.waitForTimeout(4000); const c0 = (await stats(o)).created;
    if (c0 !== 1) { await o.ctx.close(); return `sự kiện live đầu sinh ${c0} dot (cần 1)`; }
    const e2 = live({ task: 'T-2', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' });
    o.snapshot = [e1, e2]; o.sock.close();
    for (let i = 0; i < 40 && o.socks < 2; i++) await o.page.waitForTimeout(250);
    if (o.socks < 2) { await o.ctx.close(); return 'trang không nối lại kênh live sau 10 giây'; }
    await o.page.waitForTimeout(5000); const c1 = (await stats(o)).created; const l = await lit(o); const e = errs(o); await o.ctx.close();
    if (e) return e;
    if (c1 !== c0) return `nối lại kênh live phát lại ${c1 - c0} dot cho sự kiện cũ trong snapshot`;
    return l.gt_code >= 2.5 ? null : 'sau khi nối lại, Code Gate (2 việc review) không sáng theo A';
  },
  // ADV-03: việc escalated rồi decided: Capu tắt (spec mục 4 A(i) chỉ sáng "suốt thời gian chờ Capu quyết").
  decided: async () => {
    const out = [];
    for (const [st, owner] of [['doing', 'engineering'], ['done', 'chief-of-staff']]) {
      const o = await open({ data: dash([T('T-16', 'escalated', owner, { holder: 'capu' })]) });
      const l0 = (await lit(o)).nd_capu;
      send(o, { task: 'T-16', event: 'decided', from: 'capu', to: st === 'done' ? '-' : owner, state: st, holder: st === 'done' ? '-' : owner, owner });
      await o.page.waitForTimeout(2500); const l1 = (await lit(o)).nd_capu; const e = errs(o); await o.ctx.close();
      if (e) return e;
      if (l0 < 2.5) out.push(`${owner}: Capu không sáng lúc escalated`);
      else if (l1 >= 2.5) out.push(`${owner}: decided → ${st} mà 2,5 giây sau Capu vẫn sáng`);
    }
    return out.length ? out.join('; ') : null;
  },
  // ADV-04: 50 sự kiện trộn loại trong 1 giây (spec mục 3: ≤12 circle, không giật >300ms, sạch sau khi xong).
  burst50: async () => {
    const tasks = Array.from({ length: 50 }, (_, i) => T('T-' + (200 + i), ['doing', 'review', 'review', 'escalated', 'review'][i % 5], i % 5 === 1 ? 'product' : 'engineering', { tier: i % 2 ? 'A' : 'B' }));
    const o = await open({ data: dash(tasks) }); await reset(o);
    for (let i = 0; i < 50; i++) {
      const t = tasks[i], k = i % 5;
      const ev = [{ event: 'handoff', from: 'engineering', to: 'adversary', state: 'review' }, { event: 'accepted', from: 'spec-critic', to: 'engineering', state: 'done' },
        { event: 'rejected', from: 'adversary', to: 'engineering', state: 'rework', severity: 'blocker', round: 1 }, { event: 'decided', from: 'capu', to: 'engineering', state: 'doing' },
        { event: 'evalplus', from: 'adversary', to: 'engineering', state: 'doing' }][k];
      send(o, { task: t.id, holder: ev.to, owner: t.owner, ...ev }); await o.page.waitForTimeout(18);
    }
    await o.page.waitForTimeout(15000); const s = await stats(o); const left = await o.page.evaluate(() => document.querySelectorAll('#fx_f circle').length); const e = errs(o); await o.ctx.close();
    if (e) return e;
    if (s.maxTotal > 12) return `${s.maxTotal} circle cùng lúc`;
    if (!s.created) return 'không có dot nào';
    if (s.maxGap > 300) return `khung hình giật ${Math.round(s.maxGap)}ms`;
    return left ? `còn ${left} dot treo` : null;
  },
  // ADV-05: tab ẩn (requestAnimationFrame dừng) nhận 30 sự kiện, hiện lại: ≤12 circle, không dot treo, không khối kẹt sáng quá 10 giây.
  hidden: async () => {
    const tasks = Array.from({ length: 30 }, (_, i) => T('T-' + (300 + i), 'doing', 'engineering'));
    const o = await open({ data: dash(tasks) }); await o.page.evaluate(() => window.__hide());
    for (const t of tasks) send(o, { task: t.id, event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' });
    await o.page.waitForTimeout(16500); // setInterval render 15 giây vẫn chạy khi ẩn
    const inHidden = (await stats(o)).maxTotal;
    await o.page.evaluate(() => window.__show()); await o.page.waitForTimeout(6000);
    const s = await stats(o); const left = await o.page.evaluate(() => document.querySelectorAll('#fx_f circle').length);
    // sau đó sổ cái không còn việc: mọi việc về done bậc A
    for (const t of tasks) send(o, { task: t.id, event: 'accepted', from: 'adversary', to: 'done', state: 'done', holder: '-', owner: 'engineering' });
    await o.page.waitForTimeout(16000); const l = await lit(o); const e = errs(o); await o.ctx.close();
    if (e) return e;
    if (Math.max(inHidden, s.maxTotal) > 12) return `${Math.max(inHidden, s.maxTotal)} circle cùng lúc khi tab ẩn/hiện`;
    if (left) return `còn ${left} dot treo 6 giây sau khi tab hiện lại`;
    const on = Object.keys(l).filter(k => l[k] >= 2.5);
    return on.length ? 'sổ cái rảnh mà vẫn sáng sau 16 giây: ' + on.join(', ') : null;
  },
  // ADV-06: sự kiện cho việc lạ / không có chủ / thiếu trường: không lỗi, không dot khi quy tắc cần chủ việc (spec mục 1, mục 6).
  orphan: async () => {
    const o = await open({ data: dash([T('T-1', 'doing', 'engineering')]) });
    const evs = [{ task: 'T-777', event: 'accepted', from: 'adversary', to: 'done', state: 'done' }, { task: 'T-778', event: 'rejected', from: 'adversary', to: 'x', state: 'rework' },
      { event: 'accepted', from: 'adversary', to: 'done' }, { task: 'T-779', event: 'rejected', from: 'spec-critic', state: 'spec' }, { task: 'T-780', event: 'decided', from: 'capu' },
      { task: null, event: 'handoff' }, { task: 'T-781', event: 'started', from: 'engineering' }, { task: 'T-782', event: 'started', from: 'engineering', round: 'x' }];
    for (const ev of evs) send(o, ev);
    await o.page.waitForTimeout(4000); const s = await stats(o); const e = errs(o); await o.ctx.close();
    if (e) return e;
    return s.created ? `${s.created} dot cho sự kiện không rõ chủ việc / thiếu trường` : null;
  },
};

(async () => {
  if (!CHECKS[CHECK]) { console.log('FAIL --check phải là: ' + Object.keys(CHECKS).join(', ')); process.exit(1); }
  browser = await chromium.launch(); let err;
  try { err = await CHECKS[CHECK](); } catch (e) { err = 'lỗi chạy: ' + (e && e.message || e); }
  await browser.close();
  console.log(err ? `FAIL ${CHECK}: ${err}` : `PASS ${CHECK}`); process.exit(err ? 1 : 0);
})();
