#!/usr/bin/env node
// Eval đối kháng T-033 (adversary, 2026-11-01). Spec: products/T-032-khoi-co-viec-thi-sang.md (quy tắc chung + bảng "Quyết định từng khối"); ADR-013/014.
//   node adv_t033.cjs --repo <repo-dashboard> --check <newdoing|drain|rework|mixcolor|noowner>
// Dữ liệu dashboard.json, kênh live, d3 đều giả/cục bộ. Mã thoát 0 = đạt.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), CHECK = arg('--check'), INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO); process.exit(1); }
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js'); process.exit(1); }
const HEX = { spec: '#14754d', code: '#2b7fb8', back: '#d9931f', bad: '#d33', ins: '#8a5cf6' };
const rgbOf = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const toRGB = s => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); return m ? m[1].split(/[ ,\/]+/).filter(Boolean).slice(0, 3).map(Number) : null; };
const near = (a, b) => a && b && a.every((v, i) => Math.abs(v - b[i]) <= 3);
const BLOCKS = ['nd_intents', 'nd_spec', 'nd_respec', 'nd_exec', 'nd_rework', 'nd_capu', 'gt_spec', 'gt_code', 'nd_kr', 'nd_rel', 'nd_prod', 'nd_insight', 'src_data', 'src_inc', 'src_fb'];
const T = (id, state, owner, o = {}) => { const t = { id, title: 'Việc ' + id, state, holder: o.holder || owner, owner, reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-10-30T09:00', updated: '2026-11-01T09:00', hours_since_update: 2, tier: 'A', area: 'dashboard/model', evals: 1, spec_returns: 0, evals_added: 0 }; if (o.noOwner) delete t.owner; return t; };
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const dash = tasks => ({ generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster,
  model: { invariants: { 'dashboard/model': 1 }, invariants_total: 1, adversarial_evals: 0, regression_evals: 0, insight_reports: 1, last_insight: '', specs: 1 } });
let n = 0, minute = 0;
const live = o => ({ type: 'event', id: 'E-' + (9500 + (++n)), t: '2026-11-01T12:' + String(10 + (++minute)).padStart(2, '0'), round: 0, severity: '', cost: 0, title: '', ...o });

let browser;
async function open(data) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference', colorScheme: 'light' });
  const page = await ctx.newPage(); const o = { ctx, page, sock: null, errors: [] };
  page.on('pageerror', e => o.errors.push(String(e)));
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  await page.routeWebSocket(/\/ws$/, ws => { o.sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1500);
  return o;
}
const send = (o, ev) => o.sock.send(JSON.stringify(live(ev)));
// trạng thái mỗi khối: null = tối, ngược lại tên màu viền (spec/code/back/bad/ins/?) ; kèm số đếm hiển thị
const read = o => o.page.evaluate(ids => { const out = { lit: {}, n: {}, cap: {} };
  for (const id of ids) { const g = document.getElementById(id); const s = g && g.querySelector(':scope > rect, :scope > circle'); if (!s) continue; const st = getComputedStyle(s);
    out.lit[id] = [parseFloat(st.strokeWidth) || 0, st.stroke]; const N = g.querySelector('.n'); if (N) out.n[id] = Number(N.textContent.trim()); const C = g.querySelector('.cap'); if (C) out.cap[id] = C.textContent.trim(); }
  return out; }, BLOCKS);
const col = (r, id) => { const l = r.lit[id]; if (!l || l[0] < 2.5) return null; const c = toRGB(l[1]); return Object.keys(HEX).find(k => near(c, rgbOf(HEX[k]))) || l[1]; };
const waiting = r => { const m = /(\d+)\s*chờ/.exec(r.cap.nd_exec || ''); return m ? Number(m[1]) : NaN; };
// quy tắc chung T-032: Ý định sáng spec ⇔ .n > 0; Thực thi sáng code ⇔ .n > 0 hoặc "N chờ" > 0 (khi không có dot giữ)
function rule(r, tag) { const out = [];
  const ni = r.n.nd_intents, ci = col(r, 'nd_intents');
  if (ni > 0 && ci !== 'spec') out.push(`${tag}: Ý định ghi ${ni} mà ${ci ? 'màu ' + ci : 'tối'}`);
  if (!(ni > 0) && ci) out.push(`${tag}: Ý định ghi ${ni} mà sáng ${ci}`);
  const ne = r.n.nd_exec, w = waiting(r), ce = col(r, 'nd_exec');
  if ((ne > 0 || w > 0) && ce !== 'code') out.push(`${tag}: Thực thi "${ne}" / "${r.cap.nd_exec}" mà ${ce ? 'màu ' + ce : 'tối'}`);
  if (!(ne > 0 || w > 0) && ce) out.push(`${tag}: Thực thi "${ne}" / "${r.cap.nd_exec}" mà sáng ${ce}`);
  return out; }
const errs = o => o.errors.length ? 'lỗi trang: ' + o.errors.slice(0, 2).join(' | ') : null;

const CHECKS = {
  // ADV-01: việc new chuyển doing qua live: Ý định tắt, Spec Writer sáng spec; việc engineering new → doing: Thực thi vẫn sáng code (chờ 0, đang code 1).
  newdoing: async () => {
    const o = await open(dash([T('T-1', 'new', 'product'), T('T-2', 'new', 'engineering')])); const out = [];
    let r = await read(o); out.push(...rule(r, 'mở trang'));
    send(o, { task: 'T-1', event: 'started', from: 'product', to: 'product', state: 'doing', holder: 'product', owner: 'product' });
    send(o, { task: 'T-2', event: 'started', from: 'engineering', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering' });
    await o.page.waitForTimeout(12500); r = await read(o); out.push(...rule(r, 'sau started'));
    if (r.n.nd_intents !== 0) out.push(`Ý định ghi ${r.n.nd_intents} sau khi việc product sang doing (cần 0)`);
    if (col(r, 'nd_spec') !== 'spec') out.push('Spec Writer không sáng spec khi có việc product doing');
    if (r.n.nd_exec !== 1 || waiting(r) !== 0) out.push(`Thực thi "${r.n.nd_exec}" / "${r.cap.nd_exec}" (cần 1 đang code · 0 chờ)`);
    const e = errs(o); await o.ctx.close(); return e || (out.length ? out.join('; ') : null);
  },
  // ADV-02: ba việc product new giảm dần về 0 qua live (mỗi bước một started): Ý định sáng tới khi số về 0 thì tắt, số đếm đúng.
  drain: async () => {
    const o = await open(dash([T('T-1', 'new', 'product'), T('T-2', 'new', 'product'), T('T-3', 'new', 'product')])); const out = [];
    let r = await read(o); out.push(...rule(r, 'mở trang (3)')); if (r.n.nd_intents !== 3) out.push(`mở trang Ý định ghi ${r.n.nd_intents} (cần 3)`);
    for (const [i, id] of ['T-1', 'T-2', 'T-3'].entries()) {
      send(o, { task: id, event: i === 1 ? 'blocked' : 'started', from: 'product', to: 'product', state: i === 1 ? 'blocked' : 'doing', holder: 'product', owner: 'product' });
      await o.page.waitForTimeout(2500); r = await read(o); out.push(...rule(r, `còn ${2 - i}`));
      if (r.n.nd_intents !== 2 - i) out.push(`sau bước ${i + 1} Ý định ghi ${r.n.nd_intents} (cần ${2 - i})`);
    }
    const e = errs(o); await o.ctx.close(); return e || (out.length ? out.join('; ') : null);
  },
  // ADV-03: việc engineering new trong lúc một việc khác bị reject về rework (dot tới nd_rework): Thực thi giữ màu code, Rework màu back; rework → doing (dot về Thực thi) rồi hết giữ: vẫn code.
  rework: async () => {
    const o = await open(dash([T('T-1', 'new', 'engineering'), T('T-2', 'review', 'engineering', { holder: 'adversary' })])); const out = [];
    send(o, { task: 'T-2', event: 'rejected', from: 'adversary', to: 'engineering', state: 'rework', holder: 'engineering', owner: 'engineering', severity: 'blocker', round: 1 });
    await o.page.waitForTimeout(3000); let r = await read(o);
    if (col(r, 'nd_exec') !== 'code') out.push(`lúc dot rework: Thực thi ${col(r, 'nd_exec') || 'tối'} (cần code, 1 chờ)`);
    if (col(r, 'nd_rework') !== 'back') out.push(`lúc dot rework: Rework ${col(r, 'nd_rework') || 'tối'} (cần back)`);
    await o.page.waitForTimeout(11000); r = await read(o); out.push(...rule(r, 'sau 14 giây'));
    if (col(r, 'nd_rework') !== 'back') out.push(`sau 14 giây: Rework ${col(r, 'nd_rework') || 'tối'} (có 1 việc rework, cần back)`);
    if (r.n.nd_exec !== 0 || waiting(r) !== 1) out.push(`Thực thi "${r.n.nd_exec}" / "${r.cap.nd_exec}" (cần 0 đang code · 1 chờ; rework không tính vào Thực thi)`);
    send(o, { task: 'T-2', event: 'started', from: 'engineering', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering' });
    await o.page.waitForTimeout(12500); r = await read(o); out.push(...rule(r, 'rework → doing'));
    if (col(r, 'nd_rework')) out.push(`Rework vẫn sáng ${col(r, 'nd_rework')} khi không còn việc rework`);
    const e = errs(o); await o.ctx.close(); return e || (out.length ? out.join('; ') : null);
  },
  // ADV-04: khối vừa có dot (B) vừa có việc (A): trong lúc dot màu theo dot, sau đó về màu A, không tắt. Ý định (ping insight) và Thực thi (giữ dot rồi hết hạn 10 giây).
  mixcolor: async () => {
    const o = await open(dash([T('T-1', 'new', 'product'), T('T-2', 'new', 'engineering'), T('T-3', 'review', 'engineering', { holder: 'adversary' })])); const out = [];
    send(o, { task: 'T-9', event: 'assigned', from: 'insight', to: 'product', state: 'new', holder: 'product', owner: 'product' });
    send(o, { task: 'T-3', event: 'evalplus', from: 'adversary', to: 'engineering', state: 'doing', holder: 'engineering', owner: 'engineering' });
    let seen = new Set();
    for (let i = 0; i < 30; i++) { await o.page.waitForTimeout(150); const r = await read(o); seen.add(col(r, 'nd_intents')); }
    await o.page.waitForTimeout(12000); const r = await read(o); out.push(...rule(r, 'sau dot'));
    if (r.n.nd_intents !== 2) out.push(`Ý định ghi ${r.n.nd_intents} sau assigned (cần 2)`);
    if (seen.has(null)) out.push('Ý định tắt giữa chừng lúc dot tới dù số đếm > 0');
    if (r.n.nd_exec !== 1 || waiting(r) !== 1) out.push(`Thực thi "${r.n.nd_exec}" / "${r.cap.nd_exec}" (cần 1 · 1 chờ)`);
    const e = errs(o); await o.ctx.close(); return e || (out.length ? out.join('; ') : null);
  },
  // ADV-05: dữ liệu thiếu owner (dashboard.json và live): không lỗi; khối sáng ⇔ số đếm hiển thị > 0 (không sáng mà ghi 0, không ghi > 0 mà tối).
  noowner: async () => {
    const o = await open(dash([T('T-1', 'new', 'product', { noOwner: true }), T('T-2', 'new', 'engineering', { noOwner: true }), T('T-3', 'new', '', {}), { id: 'T-4', state: 'new' }])); const out = [];
    let r = await read(o); out.push(...rule(r, 'json thiếu owner'));
    send(o, { task: 'T-50', event: 'assigned', from: 'chief-of-staff', to: 'product', state: 'new', holder: 'product' });
    send(o, { task: 'T-51', event: 'assigned', from: 'chief-of-staff', to: 'engineering', state: 'new', holder: 'engineering' });
    await o.page.waitForTimeout(12500); r = await read(o); out.push(...rule(r, 'live thiếu owner'));
    const e = errs(o); await o.ctx.close(); return e || (out.length ? out.join('; ') : null);
  },
};

(async () => {
  if (!CHECKS[CHECK]) { console.log('FAIL --check phải là: ' + Object.keys(CHECKS).join(', ')); process.exit(1); }
  browser = await chromium.launch(); let err;
  try { err = await CHECKS[CHECK](); } catch (e) { err = 'lỗi chạy: ' + (e && e.message || e); }
  await browser.close();
  console.log(err ? `FAIL ${CHECK}: ${err}` : `PASS ${CHECK}`); process.exit(err ? 1 : 0);
})();
