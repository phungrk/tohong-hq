#!/usr/bin/env node
// Eval tầng 1 cho T-032: khối nào trên bảng Mô hình có số đếm > 0 thì sáng (quy tắc A), về 0 thì tắt.
// Spec: products/T-032-khoi-co-viec-thi-sang.md (sửa đổi T-028 mục 4). Repo dashboard: một file index.html.
//   cd /home/user/tohong-hq && bash eval/T-032/run.sh <repo-dashboard> [--criterion N] [--shots <dir>] [--task T-032]
// Dữ liệu dashboard.json, kênh live (WebSocket) và d3 đều giả/cục bộ: không gọi mạng thật.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--criterion', '--shots', '--task']);
const flag = n => { const i = args.indexOf(n); return i < 0 ? null : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const REPO = path.resolve(args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(args[i - 1])) || '.');
const ONLY = flag('--criterion') ? Number(String(flag('--criterion')).replace(/^C/i, '')) : null;
const SHOTS = flag('--shots'), TASK = flag('--task') || 'T-032';
const INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt biến môi trường D3=/đường/dẫn/d3.min.js'); process.exit(1); }
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO); process.exit(1); }

const HEX = { spec: '#14754d', code: '#2b7fb8', back: '#d9931f', bad: '#d33', ins: '#8a5cf6' };
const rgbOf = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const RGB = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [k, rgbOf(v)]));
const BLOCKS = ['nd_intents', 'nd_spec', 'nd_respec', 'nd_exec', 'nd_rework', 'nd_capu', 'gt_spec', 'gt_code', 'nd_kr', 'nd_rel', 'nd_prod', 'nd_insight', 'src_data', 'src_inc', 'src_fb'];
const RES = new Set(['nd_kr', 'nd_prod']);

const T = (id, state, owner, o = {}) => ({ id, title: 'Việc ' + id, state, holder: o.holder || owner, owner, reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-10-30T09:00', updated: o.updated || '2026-11-01T09:00', hours_since_update: o.h === undefined ? 2 : o.h, tier: o.tier === undefined ? 'A' : o.tier, area: 'dashboard/model', evals: 1, spec_returns: 0, evals_added: 0 });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const dash = (tasks, events = []) => ({ generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events, roster,
  model: { invariants: { 'dashboard/model': 1 }, invariants_total: 3, adversarial_evals: 2, regression_evals: 0, insight_reports: 2, last_insight: '2026-10-25-weekly.md', specs: 4 } });
let evN = 0;
const live = o => ({ type: 'event', id: 'E-' + (9100 + (++evN)), t: '2026-11-01T12:00', round: 0, severity: '', cost: 0, title: '', ...o });
const histEv = (i, event, from, to, task, state) => ({ seq: 'S-' + i, ledger_id: 'E-' + i, t: '2026-10-31T10:0' + i, task, title: '', event, from, to, round: 0, severity: '', detail: '', link: '', cost: 0, state: state || '', holder: '' });

const SAMPLER = `(() => { const W = window.__t32 = { created: 0 };
  new MutationObserver(ms => { for (const m of ms) for (const x of m.addedNodes) if (x.nodeType === 1 && x.tagName.toLowerCase() === 'circle' && x.parentNode && x.parentNode.id === 'fx_f') W.created++; }).observe(document, { childList: true, subtree: true }); })();`;

let browser;
async function open(opt) {
  const ctx = await browser.newContext({ viewport: opt.vp || { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: opt.reduce ? 'reduce' : 'no-preference', colorScheme: 'light' });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  const o = { ctx, page, sock: null, errors: [] };
  page.on('pageerror', e => o.errors.push(String(e)));
  await page.addInitScript(SAMPLER);
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(opt.data) }));
  await page.routeWebSocket(/\/ws$/, ws => { o.sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1500);
  return o;
}
const send = (o, ev) => o.sock.send(JSON.stringify(live(ev)));
const toRGB = s => { let m = /rgba?\(([^)]+)\)/.exec(s || ''); if (m) return m[1].split(/[ ,\/]+/).filter(Boolean).slice(0, 3).map(Number);
  m = /color\(srgb ([^)]+)\)/.exec(s || ''); if (m) return m[1].split(/[ \/]+/).slice(0, 3).map(x => Math.round(parseFloat(x) * 255)); return null; };
const near = (a, b, tol) => a && b && a.every((v, i) => Math.abs(v - b[i]) <= tol);
const mix = (c, p, pct) => c.map((v, i) => Math.round(v * pct + p[i] * (1 - pct)));
// đọc trạng thái sáng + số đếm hiển thị của mọi khối
const read = o => o.page.evaluate(ids => {
  const out = { lit: {}, n: {}, cap: {}, txt: {}, panel: null };
  const v = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || '#fff'; out.panel = v;
  for (const id of ids) { const g = document.getElementById(id); if (!g) continue; const s = g.querySelector(':scope > rect, :scope > circle'); if (!s) continue;
    const st = getComputedStyle(s); out.lit[id] = [parseFloat(st.strokeWidth) || 0, st.stroke, st.fill];
    const N = g.querySelector('.n'); if (N) { out.n[id] = N.textContent.trim(); out.nfs = out.nfs || {}; const m = N.getScreenCTM(); out.nfs[id] = parseFloat(getComputedStyle(N).fontSize) * (m ? Math.hypot(m.a, m.b) : 1); }
    const C = g.querySelector('.cap'); if (C) out.cap[id] = C.textContent.trim(); }
  for (const id of ['sgateQ', 'gateQ', 'relTxt', 'resTxt', 'krTxt', 'insCap']) { const e = document.getElementById(id); if (e) out.txt[id] = e.textContent.trim(); }
  out.hscroll = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth;
  out.created = window.__t32.created; return out;
}, BLOCKS);
const panelRGB = s => { s = (s || '#fff').replace('#', ''); const f = s.length === 3 ? [...s].map(c => c + c).join('') : s; return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)); };
const isOn = (r, id) => r.lit[id] && r.lit[id][0] >= 2.5;
// khối `id` phải sáng đúng màu `ck` (viền 3px, nền 18%/22%)
function wantLit(r, id, ck) {
  const l = r.lit[id]; if (!l) return `không đọc được khối ${id}`;
  if (l[0] < 2.5) return `${id} KHÔNG sáng (viền ${l[0]}px, cần 3px)`;
  if (Math.abs(l[0] - 3) > 0.3) return `${id} viền ${l[0]}px (cần 3px)`;
  if (!near(toRGB(l[1]), RGB[ck], 3)) return `${id} viền màu ${l[1]} khác ${HEX[ck]}`;
  const want = mix(RGB[ck], panelRGB(r.panel), RES.has(id) ? 0.22 : 0.18);
  if (!near(toRGB(l[2]), want, 7)) return `${id} nền ${l[2]} khác color-mix ${RES.has(id) ? 22 : 18}% của ${HEX[ck]}`;
  return null;
}
const wantOff = (r, id, why) => !r.lit[id] ? `không đọc được khối ${id}` : (isOn(r, id) ? `${id} sáng oan (${why})` : null);
const others = (r, except) => BLOCKS.filter(id => !except.includes(id) && isOn(r, id));

const R = {};
const rec = (c, name, err) => { (R[c] = R[c] || []).push({ name, ok: !err, msg: err || '' }); };
const want = c => ONLY === null || ONLY === c;
const NEWP = (id = 'T-901') => T(id, 'new', 'product');
const ASSIGN_PRODUCT = id => ({ task: id, event: 'assigned', from: 'chief-of-staff', to: 'product', state: 'new', holder: 'product', owner: 'product' });
const START_PRODUCT = id => ({ task: id, event: 'started', from: 'product', to: 'product', state: 'doing', holder: 'product', owner: 'product' });

async function shot(o, name) { if (!SHOTS) return; const dir = path.join(path.resolve(SHOTS), TASK); fs.mkdirSync(dir, { recursive: true }); await o.page.locator('#model').screenshot({ path: path.join(dir, name + '.png') }); }

// ---------- Tiêu chí 1: khối Ý định (đúng ảnh của Capu) ----------
async function c1() {
  // 1a: ảnh của Capu: 1 việc product `new` -> Ý định sáng màu spec, ghi đúng "1" và "việc product chờ viết spec"
  let o = await open({ data: dash([NEWP()]) });
  try { const r = await read(o); await shot(o, 'c1a-intents-sang');
    rec(1, '1a số hiển thị "1" và chú thích "việc product chờ viết spec"', r.n.nd_intents === '1' && /việc product chờ viết spec/.test(r.cap.nd_intents || '') ? null : `n=${r.n.nd_intents} cap=${r.cap.nd_intents}`);
    rec(1, '1a Ý định sáng màu spec #14754d khi 1 việc product new (ảnh của Capu)', wantLit(r, 'nd_intents', 'spec'));
    rec(1, '1a ngoài Ý định không khối nào khác sáng', others(r, ['nd_intents']).length ? 'sáng oan: ' + others(r, ['nd_intents']).join(', ') : null);
    // 1b: về 0 (việc đi tiếp sang doing, qua kênh live) -> Ý định tắt, Spec sáng
    send(o, START_PRODUCT('T-901')); await o.page.waitForTimeout(1500);
    const r2 = await read(o); await shot(o, 'c1b-intents-tat');
    rec(1, '1b việc new -> doing: số về "0"', r2.n.nd_intents === '0' ? null : 'n=' + r2.n.nd_intents);
    rec(1, '1b … Ý định tắt khi về 0', wantOff(r2, 'nd_intents', 'số đếm 0'));
    rec(1, '1b … Spec sáng (doing)', wantLit(r2, 'nd_spec', 'spec'));
    // 1c: có việc mới giao tới -> sáng lại, không chờ tải lại trang
    send(o, ASSIGN_PRODUCT('T-902')); await o.page.waitForTimeout(1800);
    const r3 = await read(o); rec(1, '1c việc product mới giao qua live: Ý định sáng lại màu spec sau khi nháy 0,6 giây', wantLit(r3, 'nd_intents', 'spec'));
    send(o, ASSIGN_PRODUCT('T-903')); await o.page.waitForTimeout(1800);
    const r4 = await read(o); rec(1, '1c hai việc new: số "2", vẫn sáng spec', r4.n.nd_intents === '2' ? wantLit(r4, 'nd_intents', 'spec') : 'n=' + r4.n.nd_intents);
    rec(1, 'console không lỗi', o.errors.length ? o.errors[0] : null);
  } finally { await o.ctx.close(); }
  // 1d: dữ liệu rảnh (không việc) -> tắt
  o = await open({ data: dash([]) });
  try { const r = await read(o); rec(1, '1d không có việc: Ý định "0" và tắt', r.n.nd_intents === '0' ? wantOff(r, 'nd_intents', 'không có việc') : 'n=' + r.n.nd_intents); } finally { await o.ctx.close(); }
  // 1e: việc new của chủ khác không được đếm vào Ý định (số 0 thì tối)
  o = await open({ data: dash([T('T-1', 'new', 'engineering'), T('T-2', 'new', 'insight'), T('T-3', 'new', 'chief-of-staff')]) });
  try { const r = await read(o); rec(1, '1e việc new của engineering/insight/chief-of-staff: Ý định "0" và tắt', r.n.nd_intents === '0' ? wantOff(r, 'nd_intents', 'số đếm 0') : 'n=' + r.n.nd_intents); } finally { await o.ctx.close(); }
  // 1f: ngược lại với ảnh: khối không có số lớn >0 thì tối, kể cả caption có "chờ": engineering new làm caption Thực thi ghi "1 chờ" nhưng số lớn là 0
  o = await open({ data: dash([T('T-1', 'new', 'engineering')]) });
  try { const r = await read(o);
    rec(1, '1f Thực thi: số lớn "0", chú thích "… 1 chờ" -> tắt (ngoại lệ E1: chỉ số lớn quyết định)', r.n.nd_exec === '0' && /1 chờ/.test(r.cap.nd_exec || '') ? wantOff(r, 'nd_exec', 'số lớn 0') : `n=${r.n.nd_exec} cap=${r.cap.nd_exec}`); } finally { await o.ctx.close(); }
}

// ---------- Tiêu chí 2: mọi khối có số đếm việc: số > 0 <=> sáng, đúng màu loại ----------
async function c2() {
  const tasks = [NEWP('T-1'), T('T-2', 'doing', 'product'), T('T-3', 'review', 'product'), T('T-4', 'spec', 'engineering', { holder: 'product' }), T('T-5', 'doing', 'engineering'),
    T('T-6', 'rework', 'engineering'), T('T-7', 'review', 'engineering'), T('T-8', 'escalated', 'engineering', { holder: 'capu' }), T('T-9', 'doing', 'insight')];
  const colors = { nd_intents: 'spec', nd_spec: 'spec', gt_spec: 'spec', nd_respec: 'back', nd_exec: 'code', nd_rework: 'back', gt_code: 'code', nd_capu: 'bad', nd_insight: 'ins' };
  let o = await open({ data: dash(tasks) });
  try { const r = await read(o); await shot(o, 'c2-day-du-viec');
    const count = { nd_intents: +r.n.nd_intents, nd_spec: +r.n.nd_spec, nd_respec: +r.n.nd_respec, nd_exec: +r.n.nd_exec, nd_rework: +r.n.nd_rework, nd_capu: +r.n.nd_capu,
      gt_spec: parseInt(r.txt.sgateQ), gt_code: parseInt(r.txt.gateQ) };
    for (const [id, n] of Object.entries(count)) rec(2, `2a ${id}: số đếm ${n} > 0 thì sáng màu ${HEX[colors[id]]}`, n > 0 ? wantLit(r, id, colors[id]) : `tiền đề sai: ${id} đếm ${n}`);
    rec(2, '2a nd_insight (việc insight doing, số báo cáo là tích luỹ nên không phải số đếm) sáng ins', wantLit(r, 'nd_insight', 'ins'));
  } finally { await o.ctx.close(); }
  // 2b: tất cả số đếm việc = 0 (chỉ có việc new/blocked của chủ khác, done bậc A, done quá 48 giờ) -> không khối nào sáng
  const idle = [T('T-1', 'done', 'engineering', { tier: 'A', h: 5, holder: '-' }), T('T-2', 'blocked', 'engineering', { holder: 'chief-of-staff' }), T('T-3', 'new', 'engineering'),
    T('T-4', 'done', 'engineering', { tier: 'B', h: 60, holder: '-' }), T('T-5', 'done', 'product', { tier: 'B', h: 5, holder: '-' }), T('T-6', 'doing', 'chief-of-staff')];
  o = await open({ data: dash(idle) });
  try { const r = await read(o); const on = BLOCKS.filter(id => isOn(r, id));
    rec(2, '2b mọi số đếm việc = 0: không khối nào sáng', on.length ? 'sáng oan: ' + on.join(', ') : null); } finally { await o.ctx.close(); }
  // 2c: từng khối đếm: thêm đúng một việc thì đúng khối đó (và Ý định riêng cho new) sáng, khối khác không
  const single = [['nd_spec', T('T-1', 'rework', 'product'), 'spec'], ['gt_spec', T('T-1', 'review', 'product'), 'spec'], ['nd_respec', T('T-1', 'spec', 'engineering', { holder: 'product' }), 'back'],
    ['nd_exec', T('T-1', 'doing', 'engineering'), 'code'], ['nd_rework', T('T-1', 'rework', 'engineering'), 'back'], ['gt_code', T('T-1', 'review', 'engineering'), 'code'],
    ['nd_capu', T('T-1', 'done', 'engineering', { tier: 'B', h: 5, holder: '-' }), 'code'], ['nd_intents', NEWP('T-1'), 'spec']];
  for (const [id, t, ck] of single) { o = await open({ data: dash([t]) });
    try { const r = await read(o); const e = wantLit(r, id, ck) || (others(r, [id]).length ? 'sáng oan: ' + others(r, [id]).join(', ') : null); rec(2, `2c chỉ một việc ${t.owner}/${t.state}: chỉ ${id} sáng (${HEX[ck]})`, e); } finally { await o.ctx.close(); } }
}

// ---------- Tiêu chí 3: khối đếm tích luỹ (kr, rel, prod, insight báo cáo, src_*) không sáng chỉ vì số > 0 ----------
async function c3() {
  const nowIso = new Date().toISOString().slice(0, 16);
  const tasks = [T('T-1', 'done', 'engineering', { tier: 'A', h: 1, holder: '-', updated: nowIso }), T('T-2', 'done', 'engineering', { tier: 'A', h: 100, holder: '-' }), T('T-3', 'done', 'insight', { h: 3, holder: '-', updated: nowIso })];
  const events = [histEv(1, 'rejected', 'adversary', 'engineering', 'T-1', 'review'), histEv(2, 'accepted', 'adversary', 'done', 'T-1', 'done')];
  events[0].severity = 'minor';
  const o = await open({ data: dash(tasks, events) });
  try { const r = await read(o); await shot(o, 'c3-tich-luy');
    const prem = [];
    if (!(parseInt(r.txt.resTxt) > 0)) prem.push('Production phải đếm > 0 việc xong, thấy: ' + r.txt.resTxt);
    if (!(parseInt(r.txt.krTxt) > 0)) prem.push('Reservoir phải đếm > 0 bất biến, thấy: ' + r.txt.krTxt);
    if (!(parseInt(r.txt.insCap) > 0)) prem.push('Insight phải ghi > 0 báo cáo tuần, thấy: ' + r.txt.insCap);
    rec(3, '3a tiền đề: các số tích luỹ đều > 0', prem.length ? prem.join('; ') : null);
    rec(3, '3b Production (' + r.txt.resTxt + ') không sáng chỉ vì số tích luỹ > 0 (E2)', wantOff(r, 'nd_prod', 'đếm release tích luỹ'));
    rec(3, '3c Release (' + r.txt.relTxt + ') không sáng chỉ vì số release 7 ngày > 0 (E3)', wantOff(r, 'nd_rel', 'đếm release theo cửa sổ 7 ngày'));
    rec(3, '3d Reservoir (' + r.txt.krTxt + ') không sáng chỉ vì số bất biến/eval > 0 (E4)', wantOff(r, 'nd_kr', 'đếm tích luỹ của bể'));
    rec(3, '3e Insight (' + r.txt.insCap + ') không sáng chỉ vì số báo cáo > 0 khi không có việc insight đang làm (E5)', wantOff(r, 'nd_insight', 'đếm báo cáo tích luỹ'));
    for (const id of ['src_data', 'src_inc', 'src_fb']) rec(3, `3f ${id} không có số đếm: không sáng nếu không có dot (E6)`, wantOff(r, id, 'không có số đếm'));
    const on = BLOCKS.filter(id => isOn(r, id)); rec(3, '3g không khối nào sáng (sổ cái không có việc đang xử lý)', on.length ? 'sáng oan: ' + on.join(', ') : null);
  } finally { await o.ctx.close(); }
  // 3h: khối tích luỹ vẫn nháy 0,6 giây khi dot tới (B giữ nguyên): đích Production qua accepted bậc A, rồi tắt
  const o2 = await open({ data: dash([T('T-901', 'review', 'engineering', { tier: 'A' })]) });
  try { send(o2, { task: 'T-901', event: 'accepted', from: 'adversary', to: 'done', state: 'done', holder: '-', owner: 'engineering' }); await o2.page.waitForTimeout(13500);
    const r = await read(o2); rec(3, '3h sau dot tới Production (nháy 0,6 giây) và 13 giây: Production, Release đã tắt', wantOff(r, 'nd_prod', 'quá thời gian nháy') || wantOff(r, 'nd_rel', 'quá thời gian chờ')); } finally { await o2.ctx.close(); }
}

// ---------- Tiêu chí 4: dot (quy tắc B) đè lên khối đang sáng theo A, xong thì về màu A ----------
async function c4() {
  const o = await open({ data: dash([NEWP('T-901'), T('T-902', 'doing', 'insight')]) });
  try {
    send(o, { task: 'T-902', event: 'handoff', from: 'insight', to: 'reviewer', state: 'review', holder: 'reviewer', owner: 'insight' });
    await o.page.waitForTimeout(5000);
    const r = await read(o);
    rec(4, '4a dot insight tới Ý định (nháy 0,6 giây) rồi: Ý định vẫn sáng, về màu spec vì số đếm còn 1', wantLit(r, 'nd_intents', 'spec'));
    rec(4, '4b … và không sáng oan khối khác ngoài Ý định', others(r, ['nd_intents']).length ? 'sáng oan: ' + others(r, ['nd_intents']).join(', ') : null);
  } finally { await o.ctx.close(); }
  // 4c: Ý định số 0 nhận dot thì nháy rồi tắt (hành vi T-028 giữ nguyên)
  const o2 = await open({ data: dash([T('T-902', 'doing', 'insight')]) });
  try { send(o2, { task: 'T-902', event: 'handoff', from: 'insight', to: 'reviewer', state: 'review', holder: 'reviewer', owner: 'insight' });
    await o2.page.waitForTimeout(5000); const r = await read(o2); rec(4, '4c Ý định số 0 nhận dot: sau 5 giây đã tắt', wantOff(r, 'nd_intents', 'số đếm 0 sau khi nháy'));
  } finally { await o2.ctx.close(); }
}

// ---------- Tiêu chí 5: prefers-reduced-motion ----------
async function c5() {
  const o = await open({ reduce: true, data: dash([NEWP('T-901')]) });
  try { let r = await read(o); await shot(o, 'c5-reduced-motion');
    rec(5, '5a reduced-motion: 1 việc product new -> Ý định sáng spec', wantLit(r, 'nd_intents', 'spec'));
    send(o, START_PRODUCT('T-901')); await o.page.waitForTimeout(1500); r = await read(o);
    rec(5, '5b reduced-motion: về 0 -> Ý định tắt', wantOff(r, 'nd_intents', 'số đếm 0'));
    send(o, ASSIGN_PRODUCT('T-902')); await o.page.waitForTimeout(1800); r = await read(o);
    rec(5, '5c reduced-motion: việc mới qua live -> Ý định sáng spec', wantLit(r, 'nd_intents', 'spec'));
    rec(5, '5d reduced-motion: không tạo circle nào trong #fx_f', r.created === 0 ? null : `tạo ${r.created} dot`);
  } finally { await o.ctx.close(); }
}

// ---------- Tiêu chí 6: 390px ----------
async function c6() {
  const vp = { width: 390, height: 844 };
  const o = await open({ vp, data: dash([NEWP('T-901'), T('T-2', 'doing', 'engineering')]) });
  try { let r = await read(o); await shot(o, 'c6-390px');
    rec(6, '6a 390px: Ý định sáng spec, Thực thi sáng code', wantLit(r, 'nd_intents', 'spec') || wantLit(r, 'nd_exec', 'code'));
    rec(6, '6b 390px: không cuộn ngang', r.hscroll <= 0 ? null : `tràn ngang ${r.hscroll}px`);
    rec(6, '6c 390px: số đếm trên khối Ý định hiển thị ≥ 9px', r.nfs && r.nfs.nd_intents >= 9 ? null : `cỡ chữ hiển thị ${r.nfs && r.nfs.nd_intents}px`);
    send(o, START_PRODUCT('T-901')); await o.page.waitForTimeout(1500); r = await read(o);
    rec(6, '6d 390px: về 0 -> Ý định tắt', wantOff(r, 'nd_intents', 'số đếm 0'));
  } finally { await o.ctx.close(); }
}

(async () => {
  browser = await chromium.launch();
  try {
    if (SHOTS) { await c1(); await c2(); await c3(); await c5(); await c6(); console.log('ảnh trong ' + path.join(path.resolve(SHOTS), TASK)); await browser.close(); process.exit(0); }
    const runs = [[1, c1], [2, c2], [3, c3], [4, c4], [5, c5], [6, c6]];
    for (const [n, f] of runs) if (want(n)) { try { await f(); } catch (e) { rec(n, 'chạy tiêu chí ' + n, 'lỗi chạy: ' + (e && e.message || e)); } }
  } finally { await browser.close(); }
  let bad = 0;
  for (const c of Object.keys(R).sort()) { const rs = R[c]; const f = rs.filter(x => !x.ok);
    if (!f.length) console.log(`PASS C${c} (${rs.length} ý)`); else { bad++; for (const x of f) console.log(`FAIL C${c}.${x.name}: ${x.msg}`); } }
  console.log(bad ? `FAIL ${bad} tiêu chí đỏ` : 'PASS'); process.exit(bad ? 1 : 0);
})();
