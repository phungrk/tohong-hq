#!/usr/bin/env node
// Eval đối kháng T-038 (adversary, 2026-11-02). Spec products/T-037-bam-nhan-vat-tom-tat.md.
//   node adv_sum.cjs --repo <repo-dashboard> --check <motion|xss|rapid|esc>
// motion: mục 3 "sum-bg không chồng lên thân bot của chính nhân vật đó (≤ 0,5u)" + mục 6 "nhân vật đang give/take vẫn bấm được; cử động không đổi".
//   Thân bot = [data-part=body] đo bằng getBoundingClientRect TẠI THỜI ĐIỂM ĐO (như T-035 mục 0 và inv-026), nên khi nhân vật
//   đang take (nhảy -9 đơn vị cục bộ ≈ 20u) hay give (lao 9 đơn vị cục bộ), tóm tắt đang mở vẫn không được đè thân bot ở khung nào.
//   Tầng 1 và inv-026 chỉ đo lúc nhân vật đứng yên. Cử động được kích bằng sự kiện live thật (dot đi qua khối).
// xss: tên việc chứa thẻ HTML/SVG và emoji: hiện nguyên văn, không tạo phần tử, không chạy mã.
// rapid: bấm liên tiếp 11 nhân vật nhanh (30ms) hai vòng: luôn ≤ 1 g.sum, đúng nhân vật cuối, aria-expanded đúng, không lỗi console.
// esc: Esc 5 lần liên tiếp (thường và phóng to): không lỗi, tóm tắt đóng, lần Esc thứ hai đóng phóng to, sau đó Esc không làm gì lạ.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const args = process.argv.slice(2), arg = n => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), CHECK = arg('--check'), INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!D3) { console.log(`FAIL ${CHECK}: thiếu d3.min.js cục bộ (biến D3)`); process.exit(1); }
const CHARS = ['nd_intents', 'nd_spec', 'nd_respec', 'gt_spec', 'nd_exec', 'nd_rework', 'gt_code', 'nd_capu', 'nd_insight', 'nd_kr', 'nd_prod'];
const T = (id, state, owner, o = {}) => ({ id, title: o.title || 'Việc ' + id, state, holder: owner, owner, reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-10-30T09:00', updated: '2026-11-01T09:00', hours_since_update: 2, tier: o.tier || 'A', area: 'dashboard/model', evals: 1, spec_returns: 0, evals_added: 0 });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const dash = tasks => ({ generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster,
  model: { invariants: { 'dashboard/model': 1 }, invariants_total: 48, adversarial_evals: 17, regression_evals: 12, insight_reports: 1, last_insight: '', specs: 2 } });
let evN = 0;
const live = o => ({ type: 'event', id: 'E-' + (9900 + (++evN)), t: '2026-11-01T12:00', round: 0, severity: '', cost: 0, title: '', detail: '', link: '', ...o });
let browser;
async function open(vp, data, motion) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: motion ? 'no-preference' : 'reduce', colorScheme: 'light' });
  const page = await ctx.newPage(); const o = { ctx, page, sock: null, errors: [] };
  page.on('pageerror', e => o.errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') o.errors.push(m.text()); });
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  await page.routeWebSocket(/\/ws$/, ws => { o.sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1500);
  return o;
}
const send = (o, e) => o.sock && o.sock.send(JSON.stringify(live(e)));
async function clickChar(o, id) {
  const c = await o.page.evaluate(id => { const b = document.querySelector('#model svg g.mch[data-block="' + id + '"] [data-part=body]'); if (!b) return null;
    b.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
  if (!c) return false; await o.page.mouse.click(c.x, c.y); return true;
}
const sumN = o => o.page.evaluate(() => document.querySelectorAll('#fx_s g.sum').length);
// Ghi mỗi khung: chồng (đơn vị u) giữa sum-bg và thân bot của chính nhân vật.
const startRec = o => o.page.evaluate(() => { const sv = document.querySelector('#model svg'); window.__R = { on: true, s: [] };
  const f = () => { if (!window.__R.on) return; const g = document.querySelector('#fx_s g.sum');
    if (g) { const id = g.getAttribute('data-block'), bg = g.querySelector('[data-part=sum-bg]'), body = document.querySelector('#model svg g.mch[data-block="' + id + '"] [data-part=body]');
      const sc = sv.getBoundingClientRect().width / 1000, r = bg.getBoundingClientRect(), b = body.getBoundingClientRect();
      const ox = (Math.min(r.right, b.right) - Math.max(r.left, b.left)) / sc, oy = (Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top)) / sc;
      window.__R.s.push({ id, ox, oy, anim: document.querySelector('#model svg g.mch[data-block="' + id + '"]').getAttribute('data-anim') }); }
    requestAnimationFrame(f); }; requestAnimationFrame(f); });
const stopRec = o => o.page.evaluate(() => { window.__R.on = false; return window.__R.s; });
// Sự kiện live làm dot đi qua khối (take ở khối nhận, give ở khối giao).
const FLOWS = [
  ['nd_spec', { task: 'T-2', event: 'review', from: 'doing', to: 'review', state: 'review', holder: 'spec-critic', owner: 'product' }],
  ['gt_spec', { task: 'T-2', event: 'review', from: 'doing', to: 'review', state: 'review', holder: 'spec-critic', owner: 'product' }],
  ['gt_spec', { task: 'T-2', event: 'accepted', from: 'review', to: 'done', state: 'done', holder: '-', owner: 'product' }],
  ['nd_kr', { task: 'T-2', event: 'accepted', from: 'review', to: 'done', state: 'done', holder: '-', owner: 'product' }],
  ['nd_exec', { task: 'T-3', event: 'review', from: 'doing', to: 'review', state: 'review', holder: 'adversary', owner: 'engineering' }],
  ['gt_code', { task: 'T-3', event: 'review', from: 'doing', to: 'review', state: 'review', holder: 'adversary', owner: 'engineering' }],
  ['nd_rework', { task: 'T-3', event: 'rejected', from: 'review', to: 'rework', state: 'rework', holder: 'engineering', owner: 'engineering' }],
  ['nd_respec', { task: 'T-3', event: 'rejected', from: 'review', to: 'spec', state: 'spec', holder: 'product', owner: 'engineering' }],
  ['nd_capu', { task: 'T-3', event: 'escalated', from: 'review', to: 'escalated', state: 'escalated', holder: 'capu', owner: 'engineering' }],
];
const CHECKS = {
  motion: async () => {
    const errs = [];
    for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      for (const [id, ev] of FLOWS) {
        const pre = ev.task === 'T-2' ? [T('T-2', 'doing', 'product', { title: 'Spec: thử cử động' })] : [T('T-3', 'doing', 'engineering', { title: 'App: thử cử động' })];
        const o = await open(vp, dash(pre), true);
        try {
          if (!await clickChar(o, id) || await sumN(o) !== 1) { errs.push(`${vp.width} ${id}: bấm không mở tóm tắt`); continue; }
          await o.page.waitForTimeout(300); await startRec(o); send(o, ev); await o.page.waitForTimeout(5000);
          const S = (await stopRec(o)).filter(x => x.id === id);
          const moving = S.filter(x => x.anim === 'give' || x.anim === 'take');
          const bad = S.filter(x => x.ox > 0.5 && x.oy > 0.5);
          if (!moving.length) { console.log(`  (thông tin) ${vp.width} ${id}: không thấy give/take trong 5 giây`); }
          if (bad.length) { const w = bad.reduce((a, x) => Math.min(x.ox, x.oy) > Math.min(a.ox, a.oy) ? x : a);
            errs.push(`${vp.width}px ${id}: tóm tắt đè thân bot ${bad.length}/${S.length} khung khi nhân vật '${w.anim}' (chồng ${w.ox.toFixed(1)}×${w.oy.toFixed(1)}u > 0,5u)`); }
          if (o.errors.length) errs.push(`${vp.width} ${id}: lỗi console ${o.errors[0]}`);
        } finally { await o.ctx.close(); }
      }
    }
    return errs;
  },
  xss: async () => {
    const errs = [];
    const evil = 'App: <img src=x onerror="window.__x=1"><script>window.__x=2</script>&amp; 👩‍👩‍👧 🇻🇳 "q" \'s\'';
    const o = await open({ width: 1280, height: 900 }, dash([T('T-7', 'doing', 'product', { title: evil }), T('T-8', 'doing', 'product', { title: '<svg onload=window.__x=3>' })]));
    try {
      await clickChar(o, 'nd_spec'); await o.page.waitForTimeout(400);
      const r = await o.page.evaluate(() => { const g = document.querySelector('#fx_s g.sum');
        return { x: window.__x, n: g ? g.querySelectorAll('img,script,svg,foreignObject').length : -1, lines: g ? [...g.querySelectorAll('[data-part=sum-line]')].map(l => l.textContent) : [], live: document.getElementById('model-sum-live').textContent,
          liveEls: document.getElementById('model-sum-live').children.length }; });
      if (r.x) errs.push('mã trong tên việc đã chạy (window.__x=' + r.x + ')');
      if (r.n) errs.push('tên việc tạo phần tử trong g.sum (' + r.n + ')');
      if (r.liveEls) errs.push('#model-sum-live có phần tử con');
      if (!r.lines.some(l => l.includes('<img src=x'))) errs.push('tên có thẻ không hiện nguyên văn: ' + JSON.stringify(r.lines));
      if (!r.lines.some(l => l.includes('<svg onload'))) errs.push('tên <svg> không hiện nguyên văn: ' + JSON.stringify(r.lines));
      if (o.errors.length) errs.push('lỗi console: ' + o.errors[0]);
    } finally { await o.ctx.close(); }
    return errs;
  },
  rapid: async () => {
    const errs = [];
    const o = await open({ width: 1280, height: 900 }, dash([T('T-1', 'doing', 'product'), T('T-3', 'doing', 'engineering')]), true);
    try {
      await o.page.evaluate(() => { window.__maxSum = 0; new MutationObserver(() => { window.__maxSum = Math.max(window.__maxSum, document.querySelectorAll('#fx_s g.sum').length); }).observe(document.getElementById('fx_s'), { childList: true, subtree: true }); });
      const pts = await o.page.evaluate(ids => ids.map(id => { const r = document.querySelector('#model svg g.mch[data-block="' + id + '"] [data-part=body]').getBoundingClientRect(); return [id, r.left + r.width / 2, r.top + r.height / 2]; }), CHARS);
      for (let k = 0; k < 2; k++) for (const [id, x, y] of pts) { await o.page.evaluate(() => window.scrollTo(0, document.querySelector('#model').offsetTop - 20)); }
      await o.page.evaluate(() => window.scrollTo(0, document.querySelector('#model svg').getBoundingClientRect().top + scrollY - 10));
      const P = await o.page.evaluate(ids => ids.map(id => { const r = document.querySelector('#model svg g.mch[data-block="' + id + '"] [data-part=body]').getBoundingClientRect(); return [id, r.left + r.width / 2, r.top + r.height / 2]; }), CHARS);
      const vis = P.filter(p => p[2] > 0 && p[2] < 900);
      for (let k = 0; k < 2; k++) for (const [, x, y] of vis) { await o.page.mouse.click(x, y); await o.page.waitForTimeout(30); }
      await o.page.waitForTimeout(300);
      const r = await o.page.evaluate(() => ({ n: document.querySelectorAll('#fx_s g.sum').length, max: window.__maxSum, b: (document.querySelector('#fx_s g.sum') || { getAttribute: () => null }).getAttribute('data-block'),
        exp: [...document.querySelectorAll('#model g.mch[aria-expanded=true]')].map(g => g.getAttribute('data-block')) }));
      const last = vis[vis.length - 1][0];
      if (r.max > 1) errs.push('có lúc ' + r.max + ' tóm tắt cùng lúc');
      if (r.n !== 1 || r.b !== last) errs.push(`sau loạt bấm: ${r.n} tóm tắt, của ${r.b}, mong đợi 1 của ${last}`);
      if (r.exp.length !== 1 || r.exp[0] !== last) errs.push('aria-expanded=true ở ' + JSON.stringify(r.exp));
      if (o.errors.length) errs.push('lỗi console: ' + o.errors[0]);
    } finally { await o.ctx.close(); }
    return errs;
  },
  esc: async () => {
    const errs = [];
    const o = await open({ width: 1280, height: 900 }, dash([T('T-1', 'doing', 'product')]), true);
    try {
      await clickChar(o, 'nd_spec'); for (let i = 0; i < 5; i++) { await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(60); }
      if (await sumN(o)) errs.push('thường: Esc x5 mà tóm tắt còn');
      await o.page.click('#model-zoom'); await o.page.waitForTimeout(500);
      await clickChar(o, 'gt_code'); await o.page.waitForTimeout(200);
      await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(150);
      let z = await o.page.evaluate(() => document.querySelector('#model').getAttribute('data-zoom'));
      if (z !== 'on') errs.push('phóng to: Esc 1 đã đóng phóng to'); if (await sumN(o)) errs.push('phóng to: Esc 1 không đóng tóm tắt');
      for (let i = 0; i < 4; i++) { await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(100); }
      z = await o.page.evaluate(() => document.querySelector('#model').getAttribute('data-zoom'));
      if (z === 'on') errs.push('phóng to: Esc nhiều lần không đóng phóng to');
      await clickChar(o, 'nd_spec'); await o.page.waitForTimeout(200);
      if (await sumN(o) !== 1) errs.push('sau Esc x5: bấm nhân vật không mở được nữa');
      if (o.errors.length) errs.push('lỗi console: ' + o.errors[0]);
    } finally { await o.ctx.close(); }
    return errs;
  },
};
(async () => {
  if (!CHECKS[CHECK]) { console.log(`FAIL ${CHECK}: không có check này`); process.exit(1); }
  browser = await chromium.launch();
  if (args.includes('--inv')) { // dùng làm bất biến: chưa có tóm tắt (trước T-037/T-038) thì chưa áp dụng
    const o = await open({ width: 1280, height: 900 }, dash([])); const has = await o.page.evaluate(() => !!document.getElementById('model-sum-live')); await o.ctx.close();
    if (!has) { await browser.close(); console.log(`PASS ${CHECK} (chưa áp dụng: trang chưa có #model-sum-live)`); process.exit(0); } }
  let errs; try { errs = await CHECKS[CHECK](); } catch (e) { errs = ['lỗi chạy: ' + (e && e.stack || e)]; } finally { await browser.close(); }
  if (errs.length) { console.log(`FAIL ${CHECK}: ` + errs.join('; ')); process.exit(1); } console.log(`PASS ${CHECK}`);
})();
