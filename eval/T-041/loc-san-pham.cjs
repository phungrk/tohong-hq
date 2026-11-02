#!/usr/bin/env node
// Eval tầng 1 của T-041: bộ lọc theo sản phẩm. Spec: products/T-041-loc-san-pham.md. Repo dashboard: một file index.html.
//   cd /home/claude/tohong-hq && bash eval/T-041/run.sh <repo-dashboard> [--criterion N]
// In `PASS Cn …` / `FAIL Cn <lý do>` rồi một dòng cuối `PASS` hoặc `FAIL`; mã thoát 0/1.
// Dữ liệu dashboard.json, kênh live (WebSocket) và d3 đều giả/cục bộ: không gọi mạng thật.
// Cách kiểm tiêu chí 1 và 3 là so sánh vi sai: bảng sau khi lọc P trên dữ liệu hỗn hợp phải GIỐNG HỆT bảng "Tất cả" trên dữ liệu chỉ có việc của P.
// Nhờ vậy eval không cần biết công thức của từng số đếm.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const REPO = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--criterion') || '.');
const ONLY = flag('--criterion') ? Number(String(flag('--criterion')).replace(/^C/i, '')) : null;
const INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt biến môi trường D3=/đường/dẫn/d3.min.js'); process.exit(1); }
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO); process.exit(1); }

const KEY = 'tohong.productFilter';
const T = (id, state, owner, area, o = {}) => ({ id, title: 'Việc ' + id, state, holder: o.holder || owner, owner, reviewer: 'adversary', rounds: o.rounds || 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-10-30T09:00', updated: o.updated || '2026-11-01T09:00', hours_since_update: o.h === undefined ? 2 : o.h, tier: o.tier || 'A', area, evals: 1, spec_returns: 0, evals_added: 0 });
// Dữ liệu hỗn hợp: planner (5 việc), hq (5 việc), vùng cũ không tiền tố, vùng rỗng, vùng gần giống tiền tố (hqx, planner-x).
const PL = [T('T-101', 'doing', 'engineering', 'planner/front/vendor-list'), T('T-102', 'review', 'engineering', 'planner/front/budget', { holder: 'adversary' }),
  T('T-103', 'spec', 'product', 'planner/api', { updated: '2026-11-01T08:00' }), T('T-104', 'done', 'engineering', 'planner/front', { tier: 'B', h: 5, holder: '-' }),
  T('T-105', 'blocked', 'engineering', 'planner/front/vendor-list', { h: 30 })];
const HQ = [T('T-201', 'doing', 'engineering', 'hq/dashboard'), T('T-202', 'escalated', 'product', 'hq/dashboard/model', { holder: 'capu' }),
  T('T-203', 'rework', 'engineering', 'hq/dashboard', { rounds: 1 }), T('T-204', 'new', 'product', 'hq/dashboard'),
  T('T-205', 'done', 'engineering', 'hq/dashboard', { h: 5, holder: '-' }), T('T-206', 'doing', 'engineering', 'hq/dashboard/model', { updated: '2026-11-01T07:00' })];
const OTHER = [T('T-301', 'doing', 'engineering', 'dashboard/model'), T('T-302', 'doing', 'engineering', ''), T('T-303', 'doing', 'engineering', 'hqx/dashboard'),
  T('T-304', 'review', 'engineering', 'planner-x/front', { holder: 'adversary' })];
const MIXED = [...PL, ...HQ, ...OTHER];
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const EV = (i, task, event, from, to) => ({ seq: 'S-' + i, ledger_id: 'E-' + i, t: '2026-10-31T10:0' + i, task, title: '', event, from, to, round: 0, severity: '', detail: '', link: '', cost: 0, state: '', holder: '' });
const EVENTS = [EV(1, 'T-101', 'assigned', 'chief-of-staff', 'engineering'), EV(2, 'T-201', 'assigned', 'chief-of-staff', 'engineering'), EV(3, 'T-102', 'handoff', 'engineering', 'adversary')];
const dash = (tasks, invariants) => { const inv = invariants || { 'hq/dashboard/model': 1 };
  return { generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: EVENTS, roster,
    model: { invariants: inv, invariants_total: Object.values(inv).reduce((a, b) => a + b, 0), adversarial_evals: 1, regression_evals: 0, insight_reports: 1, last_insight: '', specs: 1 } }; };

let browser;
async function open(data, opt = {}) {
  const ctx = await browser.newContext({ viewport: opt.vp || { width: 1280, height: 900 }, reducedMotion: 'no-preference', colorScheme: 'light' });
  const page = await ctx.newPage(); const o = { ctx, page, errors: [] };
  page.on('pageerror', e => o.errors.push(String(e)));
  if (opt.init) await page.addInitScript(opt.init);
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  await page.routeWebSocket(/\/ws$/, ws => { ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1500);
  return o;
}
const pick = async (o, v) => { await o.page.selectOption('#product-filter', v, { timeout: 3000 }); await o.page.waitForTimeout(500); };
// Bảng việc có bảy cột (new, doing, review, rework, blocked, escalated, done); việc ở trạng thái spec không có thẻ trên bảng, chỉ đếm trong các khối mô hình.
const ON_BOARD = ['new', 'doing', 'review', 'rework', 'blocked', 'escalated', 'done'];
const onBoard = ts => ts.filter(t => ON_BOARD.includes(t.state)).map(t => t.id).sort().join();
// Mọi thứ hiển thị phụ thuộc danh sách việc: thẻ trên bảng (theo cột), số đếm cột, KPI, số trên khối mô hình.
const snap = o => o.page.evaluate(() => {
  const txt = s => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; };
  const cols = [...document.querySelectorAll('#board .col')].map(c => ({ head: [...c.querySelectorAll('.colh span')].map(s => s.textContent.trim()).join('|'),
    cards: [...c.querySelectorAll('.tcard')].map(k => k.textContent.trim().replace(/\s+/g, ' ')) }));
  const side = {}; for (const s of ['#team tbody', '#alerts tbody', '#timeline tbody', '#feed tbody']) side[s] = txt(s);
  const kpi = {}; for (const k of ['k-wip', 'k-capu', 'k-stuck', 'k-done', 'k-fpy']) kpi[k] = txt('#' + k);
  const blk = {}; for (const id of ['nd_intents', 'nd_spec', 'nd_respec', 'nd_exec', 'nd_rework', 'nd_capu']) { blk[id] = txt('#' + id + ' .n'); blk[id + '.cap'] = txt('#' + id + ' .cap'); }
  blk.sgateQ = txt('#sgateQ'); blk.gateQ = txt('#gateQ');
  return { cols, kpi, blk, side };
});
const ids = s => s.cols.flatMap(c => c.cards.map(k => (/T-\d+/.exec(k) || [''])[0]));
const same = (a, b, what) => { const x = JSON.stringify(a), y = JSON.stringify(b); return x === y ? null : `${what} khác nhau:\n    lọc    = ${x}\n    chuẩn  = ${y}`; };
// Chữ ký hình học của mô hình: mọi thứ trừ chữ nội dung, dot (#fx_f), nhân vật (.mch, cử động) và hàng biểu tượng người/robot (use.ic, số lượng theo số đếm).
const shape = o => o.page.evaluate(() => {
  const svg = document.querySelector('#model svg'); const out = [];
  const A = ['x', 'y', 'width', 'height', 'rx', 'r', 'cx', 'cy', 'd', 'points', 'transform', 'viewBox', 'x1', 'y1', 'x2', 'y2'];
  svg.querySelectorAll('*').forEach(e => { if (e.closest('#fx_f') || e.closest('.mch') || e.matches('use.ic')) return;
    const at = {}; for (const a of A) if (e.hasAttribute(a)) at[a] = e.getAttribute(a);
    const cs = getComputedStyle(e), r = e.getBoundingClientRect(), nobox = ['text', 'tspan', 'g'].includes(e.tagName.toLowerCase());
    out.push([e.tagName.toLowerCase(), e.id || '', at, cs.display, cs.visibility, nobox ? '' : [r.x, r.y, r.width, r.height].map(v => Math.round(v * 2) / 2).join(',')]); });
  const r = svg.getBoundingClientRect(); return { svg: [r.width, r.height].map(Math.round).join('x'), n: out.length, out };
});

const CHECKS = {
  // C1: bộ chọn Tất cả / planner / hq; lọc theo tiền tố vùng; bảng việc và số đếm chỉ còn việc của sản phẩm
  1: async () => {
    const bad = [];
    const o = await open(dash(MIXED)); const sel = await o.page.$('#product-filter');
    if (!sel) { await o.ctx.close(); return ['không có <select id="product-filter">']; }
    const opts = await o.page.$$eval('#product-filter option', os => os.map(x => [x.value, x.textContent.trim()]));
    if (JSON.stringify(opts) !== JSON.stringify([['all', 'Tất cả'], ['planner', 'planner'], ['hq', 'hq']])) bad.push('các lựa chọn phải là đúng [all:Tất cả, planner:planner, hq:hq] theo thứ tự, thấy ' + JSON.stringify(opts));
    const base = await snap(o);
    if (ids(base).sort().join() !== onBoard(MIXED)) bad.push('mặc định Tất cả phải hiện đủ mọi việc, kể cả vùng cũ/rỗng/hqx/planner-x; thấy ' + ids(base).join());
    for (const p of ['planner', 'hq']) {
      const mine = (p === 'planner' ? PL : HQ);
      const ref = await open(dash(mine)); const want = await snap(ref); await ref.ctx.close();
      await pick(o, p); const got = await snap(o);
      // đèn khớp số đếm đã lọc (cùng luật với inv-009): khối đếm được sáng khi và chỉ khi số hiển thị > 0
      const lamp = await o.page.evaluate(() => { const num = x => { const m = /(\d+)/.exec(x || ''); return m ? +m[1] : NaN; }; const out = {};
        for (const id of ['nd_intents', 'nd_spec', 'nd_respec', 'nd_exec', 'nd_rework', 'nd_capu', 'gt_spec', 'gt_code']) {
          const g = document.getElementById(id), r = g && g.querySelector(':scope > rect, :scope > circle'); if (!r) { out[id] = null; continue; }
          let n = id === 'gt_spec' ? num((document.getElementById('sgateQ') || {}).textContent) : id === 'gt_code' ? num((document.getElementById('gateQ') || {}).textContent) : num((g.querySelector('.n') || {}).textContent);
          if (id === 'nd_exec') { const w = /(\d+)\s*chờ/.exec((g.querySelector('.cap') || {}).textContent || ''); n += w ? +w[1] : 0; }
          out[id] = [n, parseFloat(getComputedStyle(r).strokeWidth) >= 2.5]; } return out; });
      for (const [id, v] of Object.entries(lamp)) if (v && !((v[0] > 0) === v[1])) bad.push(`lọc ${p}: ${id} có số đếm ${v[0]} mà ${v[1] ? 'sáng' : 'không sáng'} (đèn phải khớp số đã lọc)`);
      const idsGot = ids(got).sort().join(), idsWant = onBoard(mine);
      if (idsGot !== idsWant) bad.push(`lọc ${p}: thẻ trên bảng phải là ${idsWant}, thấy ${idsGot}`);
      const es = same(got.side, base.side, `lọc ${p}: bảng Đội ngũ, Cảnh báo, Dòng thời gian, Feed (không được lọc)`); if (es) bad.push(es);
      for (const k of ['cols', 'kpi', 'blk']) { const e = same(got[k], want[k], `lọc ${p}: ${k}`); if (e) bad.push(e); }
    }
    await pick(o, 'all'); const back = await snap(o);
    const e = same(back, base, 'quay lại Tất cả không cần tải lại trang: bảng và số đếm'); if (e) bad.push(e);
    if (o.errors.length) bad.push('lỗi trang: ' + o.errors[0]);
    await o.ctx.close(); return bad;
  },
  // C2: Knowledge Reservoir hiện số bất biến theo cây: _shared riêng, mỗi sản phẩm một dòng, tổng khớp dashboard.json
  2: async () => {
    const bad = [];
    const read = o => o.page.evaluate(() => {
      const blk = document.querySelector('#nd_kr'), br = blk.querySelector('rect').getBoundingClientRect();
      const rows = [...blk.querySelectorAll('[data-kr-scope]')].map(e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); const n = /(\d+)\D*$/.exec(e.textContent);
        return { scope: e.getAttribute('data-kr-scope'), n: n ? +n[1] : NaN, text: e.textContent.trim(), shown: r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0,
          inside: r.left >= br.left - 1 && r.right <= br.right + 1 && r.top >= br.top - 1 && r.bottom <= br.bottom + 1 }; });
      const head = (document.getElementById('krTxt') || {}).textContent || ''; return { rows, head: /\d+/.exec(head) ? +/\d+/.exec(head)[0] : NaN };
    });
    const inv = { '_shared': 2, 'planner/front/vendor-list': 3, 'planner/front': 1, 'hq/dashboard/model': 5, 'hq/dashboard': 1, 'dashboard/model': 4 };
    const total = Object.values(inv).reduce((a, b) => a + b, 0);
    for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const tag = vp.width + 'px';
      const o = await open(dash(MIXED, inv), { vp }); let r = await read(o);
      const by = {}; for (const x of r.rows) { if (by[x.scope]) bad.push(`${tag}: scope "${x.scope}" xuất hiện hai lần`); by[x.scope] = x; }
      const want = { '_shared': 2, planner: 4, hq: 6, khac: 4 };
      if (Object.keys(by).sort().join() !== Object.keys(want).sort().join()) bad.push(`${tag}: các dòng phải là ${Object.keys(want).sort().join()} (khac = vùng không có tiền tố sản phẩm), thấy ${Object.keys(by).sort().join()}`);
      for (const [k, v] of Object.entries(want)) if (by[k]) {
        if (by[k].n !== v) bad.push(`${tag}: dòng ${k} phải là ${v}, thấy "${by[k].text}"`);
        if (!by[k].shown) bad.push(`${tag}: dòng ${k} không hiện`);
        if (!by[k].inside) bad.push(`${tag}: dòng ${k} nằm ngoài khung khối Knowledge Reservoir`);
      }
      const sum = r.rows.reduce((a, x) => a + (x.n || 0), 0);
      if (sum !== total) bad.push(`${tag}: tổng các dòng ${sum} phải bằng model.invariants_total ${total}`);
      if (r.head !== total) bad.push(`${tag}: số bất biến ở tiêu đề khối (mặc định Tất cả) phải là ${total}, thấy ${r.head}`);
      // lọc: các dòng của cây KHÔNG đổi; số ở tiêu đề = _shared + sản phẩm đó
      for (const [p, n] of [['planner', 2 + 4], ['hq', 2 + 6]]) {
        await pick(o, p); r = await read(o);
        const got = Object.fromEntries(r.rows.map(x => [x.scope, x.n]));
        if (JSON.stringify(got) !== JSON.stringify(Object.fromEntries(Object.keys(by).map(k => [k, by[k].n])))) bad.push(`${tag}: lọc ${p}, các dòng của cây phải giữ nguyên, thấy ${JSON.stringify(got)}`);
        if (r.head !== n) bad.push(`${tag}: lọc ${p}, số bất biến ở tiêu đề khối phải là _shared + ${p} = ${n}, thấy ${r.head}`);
      }
      await o.ctx.close();
    }
    // không có vùng cũ: không có dòng khac; sản phẩm không có bất biến vẫn có dòng, số 0
    const o2 = await open(dash(MIXED, { '_shared': 2, 'hq/dashboard': 3 })); const r2 = await read(o2); await o2.ctx.close();
    const m = Object.fromEntries(r2.rows.map(x => [x.scope, x.n]));
    if (JSON.stringify(m) !== JSON.stringify({ '_shared': 2, planner: 0, hq: 3 }) && JSON.stringify(Object.entries(m).sort()) !== JSON.stringify(Object.entries({ '_shared': 2, planner: 0, hq: 3 }).sort()))
      bad.push('không có vùng cũ và planner chưa có bất biến: phải có đúng ba dòng _shared=2, planner=0, hq=3, thấy ' + JSON.stringify(m));
    return bad;
  },
  // C3: mô hình luồng không đổi hình khi lọc; chỉ chữ số đếm đổi
  3: async () => {
    const bad = [];
    for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const tag = vp.width + 'px';
      const o = await open(dash(MIXED), { vp }); const s0 = await shape(o), c0 = await snap(o);
      if (!(s0.n > 40)) bad.push(`${tag}: không đọc được mô hình (${s0.n} phần tử)`);
      for (const p of ['planner', 'hq', 'all']) {
        await pick(o, p); const s = await shape(o), c = await snap(o);
        const e = same(s, s0, `${tag}: hình mô hình khi chọn ${p}`);
        if (e) { const i = s.out.findIndex((x, k) => JSON.stringify(x) !== JSON.stringify(s0.out[k])); bad.push(e.split('\n')[0] + (i >= 0 ? ` (phần tử đầu tiên khác: lọc ${JSON.stringify(s.out[i]).slice(0, 160)} so với chuẩn ${JSON.stringify(s0.out[i]).slice(0, 160)})` : ` (số phần tử ${s.n} so với ${s0.n})`)); }
        if (p === 'planner' && c.blk.nd_exec === c0.blk.nd_exec && c.blk.nd_capu === c0.blk.nd_capu) bad.push(`${tag}: lọc planner nhưng số đếm trên khối không đổi (Agent code ${c.blk.nd_exec}, Capu ${c.blk.nd_capu})`);
        if (p === 'hq' && c.blk.nd_capu === c0.blk.nd_capu && c.blk.nd_exec === c0.blk.nd_exec) bad.push(`${tag}: lọc hq nhưng số đếm trên khối không đổi`);
      }
      if (o.errors.length) bad.push('lỗi trang: ' + o.errors[0]);
      await o.ctx.close();
    }
    return bad;
  },
  // C4: nhớ trong localStorage (mặc định Tất cả), đọc được ở 390px
  4: async () => {
    const bad = [];
    const val = o => o.page.$eval('#product-filter', s => s.value).catch(() => null);
    let o = await open(dash(MIXED));
    if (await val(o) !== 'all') bad.push('lần đầu (localStorage trống) phải là all, thấy ' + await val(o));
    await pick(o, 'planner');
    const stored = await o.page.evaluate(k => localStorage.getItem(k), KEY);
    if (stored !== 'planner') bad.push(`chọn planner xong localStorage["${KEY}"] phải là "planner", thấy ${JSON.stringify(stored)}`);
    await o.page.reload(); await o.page.waitForSelector('#model svg'); await o.page.waitForTimeout(1500);
    if (await val(o) !== 'planner') bad.push('tải lại trang: lựa chọn phải còn planner, thấy ' + await val(o));
    const ids1 = ids(await snap(o)).sort().join(); if (ids1 !== onBoard(PL)) bad.push('tải lại trang: bảng phải đã lọc planner ngay, thấy ' + ids1);
    await pick(o, 'all'); await o.page.reload(); await o.page.waitForSelector('#model svg'); await o.page.waitForTimeout(1500);
    if (await val(o) !== 'all') bad.push('chọn lại Tất cả rồi tải lại: phải là all, thấy ' + await val(o));
    await o.ctx.close();
    for (const [pre, want] of [['hq', 'hq'], ['zzz', 'all'], ['', 'all'], ['Planner', 'all']]) {
      o = await open(dash(MIXED), { init: `try{localStorage.setItem(${JSON.stringify(KEY)},${JSON.stringify(pre)})}catch(e){}` });
      const v = await val(o); const n = ids(await snap(o)).length; await o.ctx.close();
      if (v !== want) bad.push(`localStorage đã có ${JSON.stringify(pre)}: bộ chọn phải là ${want}, thấy ${v}`);
      if (want === 'all' && n !== onBoard(MIXED).split(',').length) bad.push(`localStorage đã có giá trị lạ ${JSON.stringify(pre)}: phải hiện đủ ${onBoard(MIXED).split(',').length} việc, thấy ${n}`);
    }
    // localStorage bị cấm (duyệt riêng tư): trang vẫn chạy, mặc định Tất cả, vẫn lọc được trong phiên
    o = await open(dash(MIXED), { init: 'Storage.prototype.getItem=function(){throw new Error("denied")};Storage.prototype.setItem=function(){throw new Error("denied")}' });
    if (await val(o) !== 'all') bad.push('localStorage bị cấm: mặc định phải là all, thấy ' + await val(o));
    await pick(o, 'hq'); const n2 = ids(await snap(o)).length;
    if (n2 !== onBoard(HQ).split(',').length) bad.push(`localStorage bị cấm: chọn hq vẫn phải lọc (${onBoard(HQ).split(',').length} việc), thấy ${n2}`);
    if (o.errors.length) bad.push('localStorage bị cấm: lỗi trang ' + o.errors[0]);
    await o.ctx.close();
    // 390px: bộ chọn đọc và bấm được, trang không cuộn ngang, kể cả khi đang lọc
    for (const p of ['all', 'planner']) {
      o = await open(dash(MIXED), { vp: { width: 390, height: 844 }, init: `try{localStorage.setItem(${JSON.stringify(KEY)},${JSON.stringify(p)})}catch(e){}` });
      const r = await o.page.evaluate(() => { const s = document.getElementById('product-filter'); if (!s) return null; s.scrollIntoView({ block: 'center' }); const b = s.getBoundingClientRect(), cs = getComputedStyle(s);
        const mid = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        const label = (s.getAttribute('aria-label') || '') + ((s.labels && s.labels[0]) ? s.labels[0].textContent : '');
        return { x: b.x, right: b.right, w: b.width, h: b.height, fs: parseFloat(cs.fontSize), vis: cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0,
          hit: mid === s || s.contains(mid) || (s.labels && [...s.labels].some(l => l.contains(mid))), label: label.trim(),
          over: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth }; });
      if (!r) bad.push('390px: không có #product-filter');
      else {
        const t = `390px, đang chọn ${p}`;
        if (!r.vis) bad.push(`${t}: bộ chọn không hiện`);
        if (r.x < 0 || r.right > 390) bad.push(`${t}: bộ chọn tràn khỏi màn hình (${r.x.toFixed(0)}..${r.right.toFixed(0)})`);
        if (r.h < 32 || r.w < 80) bad.push(`${t}: bộ chọn quá nhỏ để chạm (${r.w.toFixed(0)}x${r.h.toFixed(0)}, cần ≥ 80x32)`);
        if (r.fs < 14) bad.push(`${t}: chữ bộ chọn ${r.fs}px, cần ≥ 14px`);
        if (!r.hit) bad.push(`${t}: bộ chọn bị phần tử khác che giữa`);
        if (!r.label) bad.push(`${t}: bộ chọn không có nhãn (label hoặc aria-label)`);
        if (r.over > 0) bad.push(`${t}: trang tràn ngang ${r.over}px`);
      }
      await o.ctx.close();
    }
    return bad;
  },
};

(async () => {
  browser = await chromium.launch(); let fails = 0;
  const list = ONLY ? [ONLY] : [1, 2, 3, 4];
  for (const n of list) {
    if (!CHECKS[n]) { console.log('FAIL tiêu chí ' + n + ' không tồn tại (1..4)'); fails++; continue; }
    let bad; try { bad = await CHECKS[n](); } catch (e) { bad = ['lỗi khi chạy eval: ' + String(e).split('\n')[0]]; }
    if (bad.length) { fails++; bad.forEach(b => console.log(`FAIL C${n} ${b}`)); } else console.log(`PASS C${n}`);
  }
  await browser.close(); console.log(fails ? 'FAIL ' + fails + ' tiêu chí đỏ' : 'PASS'); process.exit(fails ? 1 : 0);
})();
