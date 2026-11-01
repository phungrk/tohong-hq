#!/usr/bin/env node
// Eval tầng 1 của T-037: bấm nhân vật bảng Mô hình để nghe tóm tắt việc đang giữ (bong bóng gõ chữ).
// Spec: products/T-037-bam-nhan-vat-tom-tat.md. Repo dashboard: một file index.html (bảng #model).
//
//   cd /home/user/tohong-hq && bash eval/T-037/run.sh <thư-mục-repo-dashboard> --task T-037 [--criterion N] [--shots [thư-mục-ảnh]] [--no-inv]
//
// In từng dòng `PASS Cn …` / `FAIL Cn.<mã> <lý do>`, rồi một dòng cuối `PASS` hoặc `FAIL …`; mã thoát 0/1.
// Dữ liệu dashboard.json, kênh live (WebSocket) và d3 đều giả/cục bộ: không gọi mạng thật.
//   --criterion N : chỉ chạy tiêu chí N (1..6). Không có thì chạy cả sáu (tiêu chí 5 chạy lâu: 21 bất biến).
//   --task <T-xxx>: bắt buộc cho tiêu chí 6 và --shots (thư mục ảnh docs/screenshots/<task>/).
//   --shots [dir] : chỉ chụp ảnh lúc chữ đang gõ dở, không kiểm gì khác.
//   --no-inv      : tiêu chí 5 không chạy lại 21 bất biến (chỉ phần riêng của T-037).
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--criterion', '--shots', '--task']);
const flag = n => { const i = args.indexOf(n); return i < 0 ? null : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const REPO = path.resolve(args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(args[i - 1])) || '.');
const ONLY = flag('--criterion') ? Number(String(flag('--criterion')).replace(/^C/i, '')) : null;
const SHOTS = flag('--shots');
const TASK = flag('--task') === true ? null : flag('--task');
const NO_INV = !!flag('--no-inv');
const INDEX = path.join(REPO, 'index.html');
const HQ = path.resolve(__dirname, '..', '..');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt biến môi trường D3=/đường/dẫn/d3.min.js'); process.exit(1); }
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO); process.exit(1); }
if ((SHOTS || ONLY === 6) && !TASK) { console.log('FAIL cần tham số --task <T-xxx> (thư mục ảnh docs/screenshots/<task>/ không có mặc định)'); process.exit(1); }

// ---------- hằng số theo spec ----------
const CHARS = ['nd_intents', 'nd_spec', 'nd_respec', 'gt_spec', 'nd_exec', 'nd_rework', 'gt_code', 'nd_capu', 'nd_insight', 'nd_kr', 'nd_prod'];
const NAME = { nd_intents: 'Ý định', nd_spec: 'Spec Writer', nd_respec: 'Spec rework', gt_spec: 'Spec Gate', nd_exec: 'Agent code', nd_rework: 'Code rework', gt_code: 'Code Gate', nd_capu: 'Capu (người)', nd_insight: 'Insight', nd_kr: 'Knowledge Reservoir', nd_prod: 'Production' };
const WORD = { new: 'Mới giao', doing: 'Đang làm', review: 'Chờ duyệt', rework: 'Đang sửa', spec: 'Sửa spec', escalated: 'Chờ Capu', done: 'Chờ đọc diff' };
const NO_RULE_A = new Set(['nd_kr', 'nd_prod']);
const TITLE_MAX = 28, MAX_LINES = 3, CPS_MIN = 30, CPS_MAX = 50, FRAME_MAX = 300;
const LATENCY = 200, FIRST_CHAR = 400, UPDATE_MS = 1000;
const SHOT_NAMES = ['dang-go-1280', 'dang-go-1280-sau', 'xong-1280', 'ranh-1280', 'dang-go-390', 'phong-to-390', 'toi-390'];

// ---------- oracle: viết lại đúng từ spec (mục 1, 2), độc lập với mã trang ----------
const heldBy = {
  nd_intents: t => t.owner === 'product' && t.state === 'new',
  nd_spec: t => t.owner === 'product' && (t.state === 'doing' || t.state === 'rework'),
  gt_spec: t => t.owner === 'product' && t.state === 'review',
  nd_respec: t => t.state === 'spec',
  nd_exec: t => t.owner === 'engineering' && (t.state === 'new' || t.state === 'doing'),
  nd_rework: t => t.owner === 'engineering' && t.state === 'rework',
  gt_code: t => t.owner === 'engineering' && t.state === 'review',
  nd_capu: t => t.state === 'escalated' || (t.owner === 'engineering' && t.state === 'done' && t.tier !== 'A' && (t.hours_since_update !== undefined ? t.hours_since_update : 0) < 48),
  nd_insight: t => t.owner === 'insight' && (t.state === 'doing' || t.state === 'rework'),
  nd_kr: () => false, nd_prod: () => false,
};
const idNum = id => { const m = /(\d+)/.exec(String(id)); return m ? parseInt(m[1], 10) : Infinity; };
function shortTitle(title) {
  let t = String(title || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const m = /^[^:]{1,24}:\s+/.exec(t); if (m && t.length > m[0].length) t = t.slice(m[0].length);   // ADR-017: bỏ tiền tố "<từ>:" đầu tên
  const a = Array.from(t);
  if (!a.length) return '(không tên)';
  if (a.length <= TITLE_MAX) return a.join('');
  return a.slice(0, TITLE_MAX - 1).join('').trimEnd() + '…';
}
function expectLines(block, tasks) {
  const held = tasks.filter(heldBy[block]).sort((a, b) => (b.state === 'escalated') - (a.state === 'escalated') || idNum(a.id) - idNum(b.id) || String(a.id).localeCompare(String(b.id)));
  if (!held.length) return ['Đang rảnh'];
  const out = held.slice(0, MAX_LINES).map(t => `${t.id} · ${shortTitle(t.title)} · ${WORD[t.state]}`);
  if (held.length > MAX_LINES) out.push(`+${held.length - MAX_LINES} việc nữa`);
  return out;
}
const liveText = (block, lines) => `${NAME[block]}: ${lines.join('. ')}`;
const nchars = lines => lines.reduce((a, l) => a + Array.from(l).length, 0);

// ---------- dữ liệu giả ----------
const T = (id, state, owner, o = {}) => ({ id, title: o.title !== undefined ? o.title : 'Việc ' + id, state, holder: o.holder || owner, owner, reviewer: 'adversary', rounds: 0,
  version: 1, deadline: '', budget: '', cost: 0, created: '2026-10-30T09:00', updated: '2026-11-01T09:00', hours_since_update: o.hours !== undefined ? o.hours : 2, tier: o.tier || 'A', area: 'dashboard/model', evals: 1, spec_returns: 0, evals_added: 0,
  // trường riêng tư (bản --public không có): tóm tắt tuyệt đối không được hiện
  detail: 'SECRET-DETAIL', link: 'SECRET-LINK/path', notes: 'SECRET-NOTE', defect: 'SECRET-DEFECT' });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const dash = tasks => ({ generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster,
  model: { invariants: { 'dashboard/model': 1 }, invariants_total: 48, adversarial_evals: 17, regression_evals: 12, insight_reports: 1, last_insight: '', specs: 2 } });
const nfd = s => s.normalize('NFD');
// DATA_A: khối nhiều việc (nd_spec 5 việc, id lệch thứ tự), tên dài/ranh giới 20-21, khối rảnh (nd_rework, nd_insight, nd_kr, nd_prod), nd_capu có escalated lẫn diff chờ đọc.
const TASKS_A = [
  T('T-1030', 'doing', 'product', { title: 'Việc id bốn chữ số' }),
  T('T-106', 'doing', 'product', { title: 'Spec: Chuyện này dài hơn hai mươi ký tự rất nhiều' }),
  T('T-104', 'doing', 'product', { title: '1234567890123456789012345678' }),
  T('T-102', 'rework', 'product', { title: '  Hai   khoảng  trắng  ' }),
  T('T-105', 'doing', 'product', { title: '12345678901234567890123456789' }),
  T('T-101', 'new', 'product', { title: 'abcdefghijklmnopqrstuvwxyz tiếp theo' }),
  T('T-107', 'review', 'product', { title: 'Chờ cổng spec' }),
  T('T-108', 'spec', 'product', { title: 'Spec bị trả về' }), T('T-117', 'spec', 'engineering', { title: '' }),
  T('T-110', 'new', 'engineering', { title: 'Chờ nhận' }), T('T-109', 'doing', 'engineering', { title: nfd('Hiển thị tóm tắt nhân vật khối') }),
  T('T-111', 'review', 'engineering', { title: 'Chờ cổng code' }),
  T('T-120', 'escalated', 'engineering', { title: 'Cần Capu quyết' }), T('T-113', 'done', 'engineering', { title: 'Diff chờ đọc', tier: 'B', hours: 5 }),
  T('T-114', 'done', 'engineering', { title: 'Xong bậc A', tier: 'A', hours: 3 }), T('T-115', 'blocked', 'product', { title: 'Bị chặn' }), T('T-116', 'new', 'insight', { title: 'Insight mới' }),
];
const DATA_A = () => dash(TASKS_A.map(t => ({ ...t })));
const DATA_IDLE = () => dash([T('T-1', 'done', 'engineering'), T('T-2', 'done', 'product')]);
const DATA_L = () => dash([T('T-1', 'doing', 'product', { title: 'Việc một' }), T('T-2', 'doing', 'product', { title: 'Việc hai' }), T('T-9', 'doing', 'engineering', { title: 'Việc chín' })]);
// DATA_W: xấu nhất cho bố cục: mọi khối nhiều việc, tên 20 chữ W, dòng dài nhất.
const DATA_W = () => { const W = 'CẬP NHẬT BẢNG MÔ HÌNH ĐỒ THỊ', out = [], add = (own, st, tier) => { for (let i = 0; i < 4; i++) out.push(T('T-' + (900 + out.length), st, own, { title: W, tier: tier || 'A', hours: 1 })); };
  add('product', 'new'); add('product', 'doing'); add('product', 'review'); add('product', 'spec'); add('engineering', 'doing'); add('engineering', 'rework'); add('engineering', 'review'); add('engineering', 'done', 'B'); add('insight', 'doing'); return dash(out); };
let evN = 0;
const live = o => ({ type: 'event', id: 'E-' + (9800 + (++evN)), t: '2026-11-01T12:00', round: 0, severity: '', cost: 0, title: '', detail: 'SECRET-EVENT-DETAIL', link: 'SECRET-EVENT-LINK', ...o });

// ---------- trình duyệt ----------
let browser; const results = []; const ALLERR = [];
const rec = (c, name, problem) => { results.push([problem ? 'FAIL' : 'PASS', c, name, problem || '']); console.log(problem ? `FAIL C${c}.${name} ${problem}` : `PASS C${c} ${name}`); };
const INIT = `(() => {
  const R = window.__R = { on: false, s: [], tc: 0, maxGap: 0, last: 0, maxBub: 0, maxSum: 0, maxDots: 0 };
  document.addEventListener('click', () => { R.tc = performance.now(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') R.tc = performance.now(); }, true);
  const vis = e => { let o = 1, n = e; while (n && n.nodeType === 1 && n.tagName.toLowerCase() !== 'svg') { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden') return false; o *= parseFloat(s.opacity); n = n.parentNode; } return o > 0.05; };
  const tick = t => { if (R.on) { if (R.last) R.maxGap = Math.max(R.maxGap, t - R.last); R.last = t;
      const gs = document.querySelectorAll('#fx_s g.sum'), g = gs[0], bub = document.querySelectorAll('#fx_b .bub').length, dots = document.querySelectorAll('#fx_f circle').length;
      R.maxBub = Math.max(R.maxBub, bub); R.maxSum = Math.max(R.maxSum, gs.length); R.maxDots = Math.max(R.maxDots, dots);
      const s = { t, n: gs.length, bub, bb: [...document.querySelectorAll('#fx_b .bub')].map(b => b.getAttribute('data-block')) }; if (g) { const bg = g.querySelector('[data-part=sum-bg]'), r = bg && bg.getBoundingClientRect();
        s.block = g.getAttribute('data-block'); s.st = g.getAttribute('data-state'); s.vis = !!(bg && vis(bg) && r.width > 0); s.w = r ? r.width : 0; s.h = r ? r.height : 0; s.el = g === window.__sumEl;
        const ls = [...g.querySelectorAll('[data-part=sum-line]')]; s.lines = ls.map(l => l.textContent); s.nText = g.querySelectorAll('text').length;
        s.lv = ls.every(l => !l.textContent || (vis(l) && getComputedStyle(l).fill !== 'none' && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(getComputedStyle(l).fill))); }
      R.s.push(s); } else R.last = 0;
    requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})();`;
async function open(opt = {}) {
  const ctx = await browser.newContext({ viewport: opt.vp || { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: opt.reduce ? 'reduce' : 'no-preference', colorScheme: opt.dark ? 'dark' : 'light' });
  const page = await ctx.newPage(); const o = { ctx, page, sock: null, errors: [] };
  page.on('pageerror', e => o.errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') o.errors.push(m.text()); });
  await page.addInitScript(INIT);
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(opt.data || DATA_A()) }));
  await page.routeWebSocket(/\/ws$/, ws => { o.sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(opt.settle || 1500);
  return o;
}
const close = async o => { ALLERR.push(...o.errors); await o.ctx.close(); };
const send = (o, e) => { const x = live(e); o.sock.send(JSON.stringify(x)); return x; };
const errsOf = o => o.errors.length ? 'lỗi console: ' + o.errors.slice(0, 2).join(' | ') : null;
const fmt = (v, d = 1) => Number(v).toFixed(d);
const sleep = (o, ms) => o.page.waitForTimeout(ms);
const startRec = o => o.page.evaluate(() => { const R = window.__R; R.s = []; R.maxGap = 0; R.last = 0; R.maxBub = 0; R.maxSum = 0; R.maxDots = 0; R.on = true; });
const stopRec = o => o.page.evaluate(() => { const R = window.__R; R.on = false; return { s: R.s, tc: R.tc, maxGap: R.maxGap, maxBub: R.maxBub, maxSum: R.maxSum, maxDots: R.maxDots }; });

// đọc trạng thái tóm tắt đang mở (một lần gọi, trong trang)
const READ = () => {
  const svg = document.querySelector('#model svg'), sr = svg.getBoundingClientRect(), sc = sr.width / (svg.viewBox.baseVal.width || 1000);
  const gs = [...document.querySelectorAll('#fx_s g.sum')], g = gs[0], liveEl = document.getElementById('model-sum-live');
  const o = { n: gs.length, live: liveEl ? liveEl.textContent : null, sc, svgW: sr.width, innerW: innerWidth, innerH: innerHeight, scrollX: window.scrollX };
  if (!g) return o;
  o.block = g.getAttribute('data-block'); o.state = g.getAttribute('data-state'); o.html = g.outerHTML;
  const lines = [...g.querySelectorAll('[data-part=sum-line]')]; o.lines = lines.map(l => l.textContent);
  o.ariaHidden = lines.length > 0 && lines.every(l => l.getAttribute('aria-hidden') === 'true');
  const bg = g.querySelector('[data-part=sum-bg]'), r = bg && bg.getBoundingClientRect();
  if (!bg || !r) return o;
  o.bg = { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
  o.inside = r.left >= sr.left - 0.5 && r.right <= sr.right + 0.5 && r.top >= sr.top - 0.5 && r.bottom <= sr.bottom + 0.5;
  o.inVp = r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5;
  o.fontPx = lines.map(l => parseFloat(getComputedStyle(l).fontSize) * sc);
  o.textOutside = lines.filter(l => { const q = l.getBoundingClientRect(); return q.width > 0 && (q.left < r.left - 1 || q.right > r.right + 1 || q.top < r.top - 1 || q.bottom > r.bottom + 1); }).length;
  const mch = document.querySelector('#model svg g.mch[data-block="' + o.block + '"]'), body = mch && mch.querySelector('[data-part=body]');
  if (body) { const b = body.getBoundingClientRect(), w = Math.min(r.right, b.right) - Math.max(r.left, b.left), h = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top); o.ownOverlap = (w > 0.5 * sc && h > 0.5 * sc) ? [w / sc, h / sc] : null; }
  const own = document.getElementById(o.block); o.ownText = [];
  if (own) own.querySelectorAll('text').forEach(t => { if (t.closest('.mch')) return; const q = t.getBoundingClientRect(); if (!q.width || !t.textContent.trim()) return; const w = Math.min(r.right, q.right) - Math.max(r.left, q.left), h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top); if (w > 0.5 && h > 0.5) o.ownText.push(t.textContent.trim().slice(0, 20) + ' ' + w.toFixed(1) + '×' + h.toFixed(1) + 'px'); });
  const vis2 = e => { let op = 1, n = e; while (n && n.nodeType === 1 && n.tagName.toLowerCase() !== 'svg') { const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden') return false; op *= parseFloat(c.opacity); n = n.parentNode; } const f = getComputedStyle(e).fill; return op > 0.05 && f !== 'none' && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(f); };
  o.hidden = lines.filter(l => l.textContent && !vis2(l)).length; o.nText = g.querySelectorAll('text').length;
  o.notTop = lines.filter(l => { const q = l.getBoundingClientRect(); if (!l.textContent || !q.width) return false; const e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return !(e && e.closest('g.sum')); }).length;
  o.bgFill = getComputedStyle(bg).fill; o.txtFill = lines.length ? getComputedStyle(lines[0]).fill : null;
  o.parentOk = g.parentNode && g.parentNode.id === 'fx_s' && g.parentNode === svg.lastElementChild && !g.closest('#fx_b');
  o.hasForeign = !!g.querySelector('foreignObject,svg,image');
  o.anims = document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#fx_s')).length;
  return o;
};
const read = o => o.page.evaluate(READ);
const lum = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); if (!m) return null; const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(+m[1]) + 0.7152 * f(+m[2]) + 0.0722 * f(+m[3]); };
const contrast = (a, b) => { const x = lum(a), y = lum(b); if (x === null || y === null) return null; const hi = Math.max(x, y), lo = Math.min(x, y); return (hi + 0.05) / (lo + 0.05); };
const centerOf = (o, id) => o.page.evaluate(id => { const g = document.querySelector('#model svg g.mch[data-block="' + id + '"]'), b = g && g.querySelector('[data-part=body]'); if (!b) return null;
  b.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, id);
async function clickChar(o, id) { const c = await centerOf(o, id); if (!c) return false; await o.page.mouse.click(c.x, c.y); return true; }
async function keyOpen(o, id, key = 'Enter') { await o.page.evaluate(id => { const g = document.querySelector('#model svg g.mch[data-block="' + id + '"]'); if (g && g.focus) g.focus(); }, id); await o.page.keyboard.press(key); }
async function waitSum(o, pred, timeout = 1500) { const t0 = Date.now(); let s; while (Date.now() - t0 < timeout) { s = await read(o); if (pred(s)) return s; await o.page.waitForTimeout(40); } return s; }
const isOpen = (s, id) => s && s.n === 1 && (!id || s.block === id);
async function fullText(o, id, how = 'click') { // mở rồi chờ gõ xong tự nhiên (tối đa 8 giây)
  if (how === 'click') await clickChar(o, id); else await keyOpen(o, id);
  const s = await waitSum(o, x => isOpen(x, id) && x.state === 'done', 8000); return s; }
const joined = lines => lines.join('\n');
const zoomOn = o => o.page.evaluate(() => document.querySelector('#model') && document.querySelector('#model').getAttribute('data-zoom') === 'on');
async function enterZoom(o) { await o.page.click('#model-zoom'); await o.page.waitForTimeout(500); return zoomOn(o); }

// ---------- tiêu chí 1: nội dung ----------
async function crit1() {
  const o = await open({ data: DATA_A() });
  try {
    const pre = await read(o);
    rec(1, 'A0 lúc mở trang không có tóm tắt; #fx_s là con cuối của #model svg, sau #fx_b; #model-sum-live rỗng', await o.page.evaluate(() => { const svg = document.querySelector('#model svg'), l = svg.lastElementChild, b = document.getElementById('fx_b');
      if (!document.getElementById('fx_s')) return 'không có g#fx_s'; if (l.id !== 'fx_s') return 'con cuối của svg là #' + l.id + ', không phải #fx_s'; if (!b || !(b.compareDocumentPosition(l) & 4)) return '#fx_s không đứng sau #fx_b';
      if (document.querySelectorAll('#fx_s g.sum').length) return 'có g.sum lúc mở trang'; const lv = document.getElementById('model-sum-live'); if (!lv) return 'không có #model-sum-live'; return lv.textContent ? '#model-sum-live không rỗng' : null; }));
    const shown = {}; let first = true;
    for (const id of CHARS) {
      const s = await fullText(o, id); const exp = expectLines(id, TASKS_A);
      if (first && !isOpen(s, id)) { rec(1, 'A1 bấm nhân vật mở được tóm tắt', `bấm nhân vật ${id} không mở g.sum (n=${s ? s.n : '?'}); không đo tiếp được nội dung`); await close(o); return; }
      first = false; shown[id] = s;
      const got = s && s.lines || [];
      rec(1, `A2 ${id}: nội dung đúng (${exp.length} dòng)`, joined(got) === joined(exp) ? null : `cần [${exp.join(' | ')}], thấy [${got.join(' | ')}]`);
      await o.page.keyboard.press('Escape'); await sleep(o, 80);
    }
    const bad = []; const re = /^T-\d+ · .{1,28} · (Mới giao|Đang làm|Chờ duyệt|Đang sửa|Sửa spec|Chờ Capu|Chờ đọc diff)$/u;
    for (const id of CHARS) for (const l of shown[id].lines) { if (l === 'Đang rảnh' || /^\+\d+ việc nữa$/.test(l)) continue; if (!re.test(l)) bad.push(`${id}: "${l}"`); }
    rec(1, 'A3 mỗi dòng việc đúng khuôn "T-xxx · tên ≤ 28 ký tự · trạng thái", tối đa 4 dòng', bad.length ? bad.slice(0, 3).join('; ') : (CHARS.some(id => shown[id].lines.length > 4) ? 'có khối quá 4 dòng' : null));
    // khớp khối sáng (không dot nào đang chạy)
    const lit = await o.page.evaluate(ids => Object.fromEntries(ids.map(id => { const e = document.getElementById(id), sh = e && e.querySelector(':scope > rect, :scope > circle'); return [id, sh ? parseFloat(getComputedStyle(sh).strokeWidth) >= 2.5 : null]; })), CHARS);
    const mism = CHARS.filter(id => !NO_RULE_A.has(id) && lit[id] !== (shown[id].lines[0] !== 'Đang rảnh'));
    rec(1, 'A4 khối sáng (quy tắc A) khi và chỉ khi tóm tắt khác "Đang rảnh"; nd_kr, nd_prod luôn "Đang rảnh" và không sáng', mism.length || NO_RULE_A.size !== [...NO_RULE_A].filter(id => lit[id] === false && shown[id].lines.join() === 'Đang rảnh').length ? 'lệch ở ' + mism.join(', ') + ' (sáng=' + JSON.stringify(lit) + ')' : null);
    const leak = []; for (const id of CHARS) { if (/SECRET/.test(shown[id].html || '') || /SECRET/.test(shown[id].live || '')) leak.push(id); }
    rec(1, 'A5 không rò trường riêng tư (detail, link, ghi chú, defect) vào tóm tắt hay vùng đọc', leak.length ? 'có chữ SECRET ở ' + leak.join(', ') : null);
    // khối không có nhân vật: bấm không mở gì
    const nr = await o.page.evaluate(() => { const e = document.getElementById('nd_rel') || document.getElementById('src_data'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (nr) { await o.page.mouse.click(nr.x, nr.y); await sleep(o, 400); const s = await read(o); rec(1, 'A6 bấm khối không có nhân vật (nd_rel) không mở tóm tắt', s.n === 0 ? null : 'mở tóm tắt của ' + s.block); } else rec(1, 'A6 bấm khối không có nhân vật', 'không thấy #nd_rel');
    // bàn phím mở được
    const k = await fullText(o, 'nd_exec', 'key'); await o.page.keyboard.press('Escape');
    rec(1, 'A7 Enter khi nhân vật có tiêu điểm mở tóm tắt đúng nội dung', isOpen(k, 'nd_exec') && joined(k.lines) === joined(expectLines('nd_exec', TASKS_A)) ? null : 'Enter không mở đúng tóm tắt nd_exec');
    await keyOpen(o, 'nd_spec', ' '); const sp = await waitSum(o, x => isOpen(x, 'nd_spec'), 1500); await o.page.keyboard.press('Escape');
    rec(1, 'A8 Space khi nhân vật có tiêu điểm mở tóm tắt', isOpen(sp, 'nd_spec') ? null : 'Space không mở tóm tắt nd_spec');
    rec(1, 'A9 không lỗi console', errsOf(o));
  } finally { await close(o).catch(() => { }); }
  // dữ liệu thiếu
  const o2 = await open({ data: dash([{ id: 'T-5', state: 'doing', owner: 'product' }, { id: 'T-6', title: null, owner: 'product', state: 'doing' }, { id: 'T-7', title: 'Thiếu trạng thái', owner: 'product' }]) });
  try { const s = await fullText(o2, 'nd_spec'); const want = ['T-5 · (không tên) · Đang làm', 'T-6 · (không tên) · Đang làm'];
    rec(1, 'A10 dữ liệu thiếu (title, state): không ném lỗi, "(không tên)", việc thiếu state không thuộc khối nào', isOpen(s, 'nd_spec') && joined(s.lines) === joined(want) && !o2.errors.length ? null : `thấy [${s && s.lines ? s.lines.join(' | ') : 'không mở'}] ${errsOf(o2) || ''}`); } finally { await close(o2).catch(() => { }); }
}

// ---------- tiêu chí 1 (tiếp): tên thật từ board/ và khối sáng vì dot (ADR-017) ----------
// Tên lấy từ board/T-0xx.md (chụp 2026-11-01); kết quả mong đợi viết tay, không tính bằng oracle.
const REAL = [
  ['nd_spec', 'doing', 'product', [['T-028', 'Spec: bảng Mô hình Eval-Gated 2029 có dot chạy và khối sáng khi xử lý', 'bảng Mô hình Eval-Gated 202…'], ['T-031', 'Spec: nhân vật bot/người trong khối Mô hình sáng và cử động khi khối hoạt động', 'nhân vật bot/người trong kh…'], ['T-035', 'Spec: nới bố cục bảng Mô hình, chế độ phóng to, bot ở Spec/Code Gate nổi trên cùng', 'nới bố cục bảng Mô hình, ch…']]],
  ['nd_exec', 'doing', 'engineering', [['T-029', 'Dashboard: bảng Mô hình Eval-Gated 2029 có dot chạy và khối sáng', 'bảng Mô hình Eval-Gated 202…'], ['T-034', 'Dashboard: nhân vật bot/người trong khối Mô hình sáng và cử động', 'nhân vật bot/người trong kh…'], ['T-036', 'Dashboard: nới bố cục Mô hình, chế độ phóng to, bot ở cổng nổi trên cùng', 'nới bố cục Mô hình, chế độ…']]],
  ['nd_respec', 'spec', 'product', [['T-026', 'App Tơ Hồng responsive width, tối đa 768px', 'App Tơ Hồng responsive widt…'], ['T-030', 'App: Back trình duyệt về trang trước + cài app ra màn hình chính', 'Back trình duyệt về trang t…'], ['T-032', 'Spec sửa: khối Ý định (và khối tích luỹ) sáng khi có việc', 'khối Ý định (và khối tích l…']]],
  ['nd_insight', 'doing', 'insight', [['T-201', 'export_dashboard.py: bỏ detail ở bản public', 'bỏ detail ở bản public'], ['T-202', 'Giờ họp 10:30 với Capu', 'Giờ họp 10:30 với Capu'], ['T-203', 'Một tiền tố rất dài hơn hai mươi bốn ký tự: nội dung', 'Một tiền tố rất dài hơn hai…']]],
];
async function dotRun(label, block, tasks, ev, need, re, waitMs) {
  const o = await open({ data: dash(tasks) });
  try {
    await clickChar(o, block); const s0 = await waitSum(o, x => isOpen(x, block) && x.state === 'done', 3000);
    if (!isOpen(s0, block)) { rec(1, label, 'không mở được tóm tắt để thử'); return; }
    await o.page.evaluate(b => { const e = document.getElementById(b), sh = e.querySelector(':scope > rect, :scope > circle'); window.__B = { s: [], on: true };
      const f = t => { if (!window.__B.on) return; const g = document.querySelector('#fx_s g.sum'), l = g && g.querySelector('[data-part=sum-line]');
        window.__B.s.push({ t, lit: parseFloat(getComputedStyle(sh).strokeWidth) >= 2.5, n: g ? 1 : 0, st: g && g.getAttribute('data-state'), l0: l ? l.textContent : null }); requestAnimationFrame(f); }; requestAnimationFrame(f); }, block);
    send(o, ev); await sleep(o, waitMs); const S = await o.page.evaluate(() => { window.__B.on = false; return window.__B.s; });
    const bad = x => x.n === 0 ? 'tóm tắt đã đóng' : (x.st !== 'done' ? null : (x.lit && x.l0 === 'Đang rảnh' ? 'khối đang sáng mà nói "Đang rảnh"' : (!x.lit && x.l0 !== 'Đang rảnh' ? `khối đã tắt mà còn nói "${x.l0}"` : (x.lit && !re.test(x.l0) ? `khối sáng vì dot nhưng dòng là "${x.l0}"` : null))));
    let worst = null, run0 = null, rb = null;
    for (const x of S) { const b = bad(x); if (b) { if (b !== rb) { run0 = x.t; rb = b; } if (x.t - run0 > 300 && !worst) worst = b; } else { run0 = null; rb = null; } }
    const seen = S.some(x => x.lit); const last = S[S.length - 1];
    rec(1, label, worst || (need && !seen ? 'khối không sáng lần nào nên không thử được (dot không tới?)' : (last && last.l0 !== 'Đang rảnh' ? `hết sáng nhưng vẫn "${last && last.l0}"` : errsOf(o))));
  } finally { await close(o).catch(() => { }); }
}
async function crit1b() {
  const tasks = []; for (const [, st, own, list] of REAL) for (const [id, title] of list) tasks.push(T(id, st, own, { title }));
  const o = await open({ data: dash(tasks) });
  try {
    for (const [blk, st, , list] of REAL) { const s = await fullText(o, blk); const exp = list.map(([id, , short]) => `${id} · ${short} · ${WORD[st]}`);
      rec(1, `N1 ${blk}: tên thật từ board/ bỏ tiền tố "<từ>:" rồi cắt 27 ký tự + "…" (đúng chữ viết tay)`, isOpen(s, blk) && joined(s.lines) === joined(exp) ? null : `thấy [${s && s.lines ? s.lines.join(' | ') : 'không mở'}], cần [${exp.join(' | ')}]`); await o.page.keyboard.press('Escape'); await sleep(o, 80); }
  } finally { await close(o).catch(() => { }); }
  const ttl = 'Spec: bấm vào nhân vật Mô hình để nghe tóm tắt việc đang làm', tt = shortTitle(ttl);
  const acc = (task, own, from) => ({ task, event: 'accepted', from, to: 'done', state: 'done', holder: '-', owner: own });
  await dotRun('B1 nd_kr đang sáng vì dot (nhận insight/spec): tóm tắt là "Vừa nhận T-2 · tên", hết sáng thì "Đang rảnh", không khung nào đèn và lời lệch quá 300ms', 'nd_kr', [T('T-2', 'doing', 'product', { title: ttl })], acc('T-2', 'product', 'spec-critic'), true, new RegExp('^Vừa nhận T-2 · ' + tt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), 13500);
  await dotRun('B2 nd_prod đang sáng vì dot (lên sóng): "Vừa nhận T-9 · tên", hết sáng thì "Đang rảnh"', 'nd_prod', [T('T-9', 'doing', 'engineering', { title: ttl, tier: 'A' })], acc('T-9', 'engineering', 'adversary'), true, /^Vừa nhận T-9 · .+$/, 13500);
  await dotRun('B3 gt_spec (khối nguồn): bất cứ lúc nào đang sáng thì không nói "Đang rảnh" (nếu sáng: "Vừa giao/nhận T-2 · tên"), tắt thì "Đang rảnh"', 'gt_spec', [T('T-2', 'doing', 'product', { title: ttl })], acc('T-2', 'product', 'spec-critic'), false, /^Vừa (giao|nhận) T-2 · .+$/, 13500);
  await dotRun('B4 gt_code (khối nguồn của chuỗi lên sóng): đèn và lời khớp nhau', 'gt_code', [T('T-9', 'doing', 'engineering', { title: ttl, tier: 'A' })], acc('T-9', 'engineering', 'adversary'), false, /^Vừa (giao|nhận) T-9 · .+$/, 13500);
}

// ---------- tiêu chí 2: gõ chữ và tương tác ----------
async function crit2() {
  const full = joined(expectLines('nd_spec', TASKS_A)), N = nchars(expectLines('nd_spec', TASKS_A));
  { // gõ hiện dần
    const o = await open({ data: DATA_A() });
    try { await startRec(o); const ok = await clickChar(o, 'nd_spec'); await sleep(o, 6500); const r = await stopRec(o); const S = r.s.filter(x => x.n >= 1);
      if (!ok || !S.length) { rec(2, 'T0 bấm nhân vật mở được tóm tắt', 'không có g.sum sau khi bấm nd_spec; không đo tiếp được hiệu ứng gõ'); await close(o); return; }
      const typed = x => joined(x.lines).replace(/\n+$/, '');
      const f0 = S.find(x => x.vis); rec(2, `T1 bong bóng hiện trong ≤ ${LATENCY}ms sau khi bấm, và ở khung đầu tiên chưa quá 2 ký tự (bong bóng trước, chữ sau)`,
        !f0 ? 'bg không bao giờ hiện' : (f0.t - r.tc > LATENCY ? `hiện sau ${fmt(f0.t - r.tc, 0)}ms` : (nchars(f0.lines) > 2 ? `khung đầu đã có ${nchars(f0.lines)} ký tự (chữ hiện cùng lúc bong bóng)` : null)));
      const c1 = S.find(x => nchars(x.lines) >= 1), done = S.find(x => x.st === 'done' && joined(x.lines) === full);
      rec(2, `T2 ký tự đầu xuất hiện trong ≤ ${FIRST_CHAR}ms sau khi bấm`, c1 && c1.t - r.tc <= FIRST_CHAR ? null : (c1 ? `sau ${fmt(c1.t - r.tc, 0)}ms` : 'không có ký tự nào'));
      if (!c1 || !done) rec(2, 'T3 gõ xong đúng nội dung', done ? 'không có ký tự nào' : `không bao giờ gõ xong đúng (cuối: "${S.length ? joined(S[S.length - 1].lines).slice(0, 60) : ''}")`);
      else { const cps = (N - 1) / ((done.t - c1.t) / 1000); rec(2, `T3 tốc độ gõ ${fmt(cps, 0)} ký tự/giây (cần ${CPS_MIN} đến ${CPS_MAX}; ${N} ký tự trong ${fmt((done.t - c1.t) / 1000, 2)}s)`, cps >= CPS_MIN && cps <= CPS_MAX ? null : `${fmt(cps, 1)} ký tự/giây`); }
      const typing = S.filter(x => x.st === 'typing');
      rec(2, 'T4 có trạng thái typing thật (chữ gõ dở nhiều khung hình, không hiện hết ngay)', typing.filter(x => nchars(x.lines) > 0 && nchars(x.lines) < N).length >= 10 ? null : `chỉ ${typing.filter(x => nchars(x.lines) > 0 && nchars(x.lines) < N).length} khung hình gõ dở`);
      const notPrefix = S.filter(x => !full.startsWith(typed(x))), nonMono = S.filter((x, i) => i && nchars(x.lines) < nchars(S[i - 1].lines));
      rec(2, 'T5 chữ đã hiện luôn là tiền tố của chữ đầy đủ, dòng gõ lần lượt, không bao giờ giảm', notPrefix.length || nonMono.length ? `${notPrefix.length} khung không phải tiền tố (vd "${notPrefix[0] ? typed(notPrefix[0]).slice(0, 40) : ''}"), ${nonMono.length} khung giảm` : null);
      const invis = S.filter(x => nchars(x.lines) > 0 && x.lv === false).length, extra = S.filter(x => x.nText !== x.lines.length).length;
      rec(2, 'T5b mọi khung có chữ: dòng chữ nhìn thấy thật (opacity > 0,05, fill không trong suốt) và g.sum không có text nào ngoài sum-line', invis || extra ? `${invis} khung chữ không nhìn thấy, ${extra} khung có text lạ` : null);
      const wmin = Math.min(...S.map(x => x.w)), wmax = Math.max(...S.map(x => x.w)), hmin = Math.min(...S.map(x => x.h)), hmax = Math.max(...S.map(x => x.h));
      rec(2, 'T6 kích thước bong bóng không đổi trong lúc gõ (±0,5px)', wmax - wmin <= 0.5 && hmax - hmin <= 0.5 ? null : `rộng ${fmt(wmin)}–${fmt(wmax)}, cao ${fmt(hmin)}–${fmt(hmax)}`);
      const at1 = S.find(x => x.t - c1.t >= 1000); rec(2, 'T7 sau 1 giây gõ đã có khoảng 20 đến 60 ký tự (đang chạy, không ì)', at1 && nchars(at1.lines) >= 20 && nchars(at1.lines) <= 60 ? null : `có ${at1 ? nchars(at1.lines) : '?'} ký tự`);
      rec(2, `T8 khung hình khi gõ trễ < ${FRAME_MAX}ms (đo ${fmt(r.maxGap, 0)}ms)`, r.maxGap < FRAME_MAX ? null : `${fmt(r.maxGap, 0)}ms`);
    } finally { await close(o).catch(() => { }); }
  }
  { // bấm lần hai / bong bóng / bấm lần ba / bấm ngoài / Esc / chuyển nhân vật / không tự tắt
    const o = await open({ data: DATA_A() });
    try {
      await clickChar(o, 'nd_spec'); await sleep(o, 500); let s = await read(o);
      if (!isOpen(s, 'nd_spec') || s.state !== 'typing') { rec(2, 'B0 mở được và đang typing sau 0,5 giây', `n=${s.n}, state=${s.state}`); await close(o); return; }
      await startRec(o); await clickChar(o, 'nd_spec'); const a = await waitSum(o, x => isOpen(x) && x.state === 'done', 600); await sleep(o, 100); const r = await stopRec(o);
      rec(2, `B1 bấm lần hai (vào nhân vật) khi đang gõ: hiện ngay toàn bộ trong ≤ ${LATENCY}ms, vẫn mở`, isOpen(a, 'nd_spec') && joined(a.lines) === full && r.s.find(x => x.st === 'done' && joined(x.lines) === full) && (r.s.find(x => x.st === 'done').t - r.tc <= LATENCY) ? null : `state=${a.state}, ${a.lines ? nchars(a.lines) : 0}/${N} ký tự, ${r.s.find(x => x.st === 'done') ? fmt(r.s.find(x => x.st === 'done').t - r.tc, 0) + 'ms' : 'chưa xong'}`);
      await o.page.waitForTimeout(150); await clickChar(o, 'nd_spec'); await sleep(o, 250); s = await read(o);
      rec(2, 'B2 bấm vào nhân vật lần ba (đã xong): đóng tóm tắt, aria-expanded="false"', s.n === 0 && await o.page.evaluate(() => document.querySelector('g.mch[data-block="nd_spec"]').getAttribute('aria-expanded') === 'false') ? null : `n=${s.n}`);
      // bấm vào bong bóng khi đang gõ
      await clickChar(o, 'nd_spec'); await sleep(o, 450); s = await read(o);
      if (isOpen(s) && s.bg) { await o.page.mouse.click((s.bg.l + s.bg.r) / 2, (s.bg.t + s.bg.b) / 2); const b = await waitSum(o, x => isOpen(x) && x.state === 'done', 600);
        rec(2, 'B3 bấm vào chính bong bóng khi đang gõ: hiện ngay toàn bộ', isOpen(b) && joined(b.lines) === full ? null : `state=${b.state}`);
        await sleep(o, 300); const b2 = await read(o); const bb = b2.bg; await o.page.mouse.click((bb.l + bb.r) / 2, (bb.t + bb.b) / 2); await sleep(o, 300); const b3 = await read(o);
        rec(2, 'B4 bấm vào bong bóng khi đã xong: không đóng, không đổi', isOpen(b3, 'nd_spec') && b3.state === 'done' ? null : `n=${b3.n}`);
      } else rec(2, 'B3 bấm vào chính bong bóng khi đang gõ', 'không mở được để thử');
      // bấm ngoài
      await o.page.mouse.click(4, 4); await sleep(o, 250); s = await read(o);
      rec(2, 'B5 bấm ra ngoài đóng tóm tắt', s.n === 0 ? null : 'còn mở sau khi bấm ngoài (4,4)');
      // Esc + tiêu điểm
      await keyOpen(o, 'nd_exec'); await sleep(o, 300); await o.page.keyboard.press('Escape'); await sleep(o, 250); s = await read(o);
      const foc = await o.page.evaluate(() => { const a = document.activeElement; return a && a.closest && a.closest('g.mch') ? a.closest('g.mch').getAttribute('data-block') : (a && a.tagName); });
      rec(2, 'B6 Esc đóng tóm tắt và tiêu điểm về nhân vật đó', s.n === 0 && foc === 'nd_exec' ? null : `n=${s.n}, tiêu điểm ở ${foc}`);
      // mở nhân vật khác đóng cái cũ: không bao giờ hai cái
      await clickChar(o, 'nd_spec'); await sleep(o, 400); await startRec(o); await clickChar(o, 'nd_exec'); await sleep(o, 500); const r2 = await stopRec(o); s = await read(o);
      rec(2, 'B7 mở nhân vật khác: cái cũ đóng ngay, không khung nào có hai tóm tắt', isOpen(s, 'nd_exec') && r2.maxSum <= 1 && !r2.s.some(x => x.n === 1 && x.block === 'nd_spec' && x.t > r2.tc + 40) ? null : `n=${s.n}, block=${s.block}, tối đa ${r2.maxSum} cái cùng lúc`);
      await o.page.keyboard.press('Escape');
      // không tự tắt
      await clickChar(o, 'nd_intents'); await sleep(o, 12500); s = await read(o);
      rec(2, 'B8 không tự tắt: vẫn mở sau 12 giây', isOpen(s, 'nd_intents') && s.state === 'done' ? null : `n=${s.n}`);
      rec(2, 'B9 không lỗi console', errsOf(o));
    } finally { await close(o).catch(() => { }); }
  }
  { // quan hệ với bong bóng sự kiện
    const o = await open({ data: DATA_L() });
    try {
      await clickChar(o, 'nd_spec'); await sleep(o, 300); const s0 = await read(o);
      if (!isOpen(s0, 'nd_spec')) { rec(2, 'E0 mở được tóm tắt để thử bong bóng sự kiện', 'không mở'); await close(o); return; }
      await startRec(o); send(o, { task: 'T-1', event: 'handoff', from: 'product', to: 'spec-critic', state: 'review', holder: 'spec-critic', owner: 'product' }); await sleep(o, 3300);
      const order = await o.page.evaluate(() => { const b = document.getElementById('fx_b'), s = document.getElementById('fx_s'); return !!(b && s && (b.compareDocumentPosition(s) & 4)); });
      const r = await stopRec(o); let p1 = null; const seen = new Set(r.s.flatMap(x => x.bb || []));
      if (seen.has('nd_spec')) p1 = 'bong bóng sự kiện nd_spec vẫn hiện dưới tóm tắt đang mở'; else if (!order) p1 = '#fx_s không đứng sau #fx_b'; else if (!seen.has('gt_spec')) p1 = 'bong bóng sự kiện của gt_spec không hiện (thấy: ' + [...seen].join(',') + ')';
      rec(2, 'E1 tóm tắt đang mở: bong bóng sự kiện của cùng khối (nd_spec) không được tạo; của khối khác (gt_spec) vẫn hiện; #fx_s đứng sau #fx_b', p1);
      await o.page.keyboard.press('Escape'); await sleep(o, 2300);
      send(o, { task: 'T-9', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' }); await o.page.waitForFunction(() => document.querySelector('#fx_b .bub[data-block="nd_exec"]'), null, { timeout: 2500 }).catch(() => { });
      const had = await o.page.evaluate(() => !!document.querySelector('#fx_b .bub[data-block="nd_exec"]'));
      await keyOpen(o, 'nd_exec'); await sleep(o, 250); const gone = await o.page.evaluate(() => !document.querySelector('#fx_b .bub[data-block="nd_exec"]')); const s2 = await read(o);
      rec(2, 'E2 mở tóm tắt của khối đang có bong bóng sự kiện: bong bóng sự kiện cùng khối bị gỡ ngay', !had ? 'không tạo được bong bóng sự kiện nd_exec để thử' : (isOpen(s2, 'nd_exec') && gone ? null : `tóm tắt mở=${isOpen(s2, 'nd_exec')}, bong bóng sự kiện đã gỡ=${gone}`));
      await o.page.keyboard.press('Escape'); await sleep(o, 2300); await startRec(o);
      for (let i = 0; i < 6; i++) send(o, { task: 'T-' + (200 + i), event: 'handoff', from: i % 2 ? 'product' : 'engineering', to: i % 2 ? 'spec-critic' : 'adversary', state: 'review', holder: i % 2 ? 'spec-critic' : 'adversary', owner: i % 2 ? 'product' : 'engineering' });
      await clickChar(o, 'gt_code'); await sleep(o, 900); const r3 = await stopRec(o);
      rec(2, 'E3 bong bóng sự kiện vẫn ≤ 3 cùng lúc khi có tóm tắt đang mở; tóm tắt không nằm trong #fx_b', r3.maxBub <= 3 && r3.maxSum <= 1 ? null : `tối đa ${r3.maxBub} bong bóng sự kiện, ${r3.maxSum} tóm tắt`);
      rec(2, 'E4 không lỗi console', errsOf(o));
    } finally { await close(o).catch(() => { }); }
  }
}

// ---------- tiêu chí 3: dữ liệu live khi đang mở ----------
function applyEv(tasks, e) { const t = tasks.find(x => x.id === e.task); if (t) { t.state = e.state; if (e.title) t.title = e.title; if (e.owner) t.owner = e.owner; } else tasks.push({ id: e.task, title: e.title || e.task, state: e.state, owner: e.owner || e.holder }); }
async function crit3() {
  const o = await open({ data: DATA_L() });
  const cur = [{ id: 'T-1', title: 'Việc một', state: 'doing', owner: 'product' }, { id: 'T-2', title: 'Việc hai', state: 'doing', owner: 'product' }, { id: 'T-9', title: 'Việc chín', state: 'doing', owner: 'engineering' }];
  try {
    const s0 = await fullText(o, 'nd_spec'); if (!isOpen(s0, 'nd_spec')) { rec(3, 'L0 mở được tóm tắt để thử live', 'không mở'); await close(o); return; }
    await o.page.evaluate(() => { window.__sumEl = document.querySelector('#fx_s g.sum'); });
    rec(3, 'L1 trạng thái ban đầu đúng', joined(s0.lines) === joined(expectLines('nd_spec', cur)) ? null : `thấy [${s0.lines.join(' | ')}]`);
    const step = async (name, evs, wait = UPDATE_MS) => { evs.forEach(e => { applyEv(cur, e); send(o, e); }); const exp = expectLines('nd_spec', cur);
      const t0 = Date.now(); const s = await waitSum(o, x => isOpen(x, 'nd_spec') && joined(x.lines) === joined(exp) && x.state === 'done', wait + 400); const dt = Date.now() - t0;
      const same = await o.page.evaluate(() => document.querySelector('#fx_s g.sum') === window.__sumEl);
      const lv = (await read(o)).live; const geo = s && s.bg ? (s.inside && !s.ownOverlap && s.fontPx.every(f => f >= 9 - 0.05 && f <= 16 + 0.05) ? '' : ' hộp không còn thỏa trọn svg/không đè thân/9-16px') : '';
      rec(3, name, !isOpen(s, 'nd_spec') ? `tóm tắt đã đóng hoặc đổi nhân vật (n=${s.n})` : (joined(s.lines) !== joined(exp) || s.state !== 'done' ? `sau ${wait + 400}ms thấy [${s.lines.join(' | ')}] state=${s.state}, cần [${exp.join(' | ')}] done` : (!same ? 'phần tử g.sum bị gỡ rồi tạo lại' : (lv !== liveText('nd_spec', exp) ? `vùng đọc "${lv}" ≠ "${liveText('nd_spec', exp)}"` : (geo ? geo.trim() : (dt > wait ? `cập nhật sau ${dt}ms > ${wait}ms` : null)))))); };
    await step('L2 việc mới vào khối (T-3 doing): dòng mới hiện ngay đủ, cùng phần tử, vùng đọc cập nhật, trong ≤ 1 giây', [{ task: 'T-3', event: 'started', from: 'product', to: 'product', state: 'doing', holder: 'product', owner: 'product', title: 'Việc mới tinh' }]);
    await step('L3 việc rời khối (T-1 sang review): dòng mất', [{ task: 'T-1', event: 'handoff', from: 'product', to: 'spec-critic', state: 'review', holder: 'spec-critic', owner: 'product' }]);
    await step('L4 việc đổi trạng thái (T-2 sang rework): chữ trạng thái đổi thành "Đang sửa"', [{ task: 'T-2', event: 'rejected', from: 'spec-critic', to: 'product', state: 'rework', holder: 'product', owner: 'product' }]);
    await step('L5 vượt 3 việc: ba dòng + "+2 việc nữa"', [3, 4, 5].map(n => ({ task: 'T-' + n + '0', event: 'started', from: 'product', to: 'product', state: 'doing', holder: 'product', owner: 'product', title: 'Thêm ' + n })));
    await step('L6 khối hết việc: thành "Đang rảnh", vẫn mở (không tự đóng)', cur.filter(t => heldBy.nd_spec(t)).map(t => ({ task: t.id, event: 'handoff', from: 'product', to: 'spec-critic', state: 'review', holder: 'spec-critic', owner: 'product' })));
    await sleep(o, 2500); const s6 = await read(o); rec(3, 'L7 vẫn mở sau 2,5 giây dù khối đã rảnh', isOpen(s6, 'nd_spec') ? null : 'đã đóng');
    await step('L8 rảnh rồi lại có việc: dòng việc hiện lại', [{ task: 'T-70', event: 'started', from: 'product', to: 'product', state: 'new', holder: 'product', owner: 'product', title: 'Việc tới sau' }].map(e => ({ ...e, state: 'doing' })));
    rec(3, 'L9 không lỗi console', errsOf(o));
  } finally { await close(o).catch(() => { }); }
  { // đổi khi đang gõ / sự kiện không liên quan khi đang gõ
    const o2 = await open({ data: DATA_A() });
    try {
      await clickChar(o2, 'nd_spec'); await sleep(o2, 400); await o2.page.evaluate(() => { window.__sumEl = document.querySelector('#fx_s g.sum'); }); const a = await read(o2); const nA = a.lines ? nchars(a.lines) : 0;
      if (!isOpen(a, 'nd_spec') || a.state !== 'typing') { rec(3, 'G0 đang gõ lúc 0,4 giây', `n=${a.n} state=${a.state}`); await close(o2); return; }
      await startRec(o2); send(o2, { task: 'T-109', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' }); await sleep(o2, 500); const r = await stopRec(o2);
      const after = r.s.filter(x => x.t > r.tc - 1e9 && x.n === 1); const typed = after.map(x => nchars(x.lines));
      const full = joined(expectLines('nd_spec', TASKS_A));
      rec(3, 'G1 sự kiện không liên quan (khối khác đổi) khi đang gõ: gõ tiếp, không bắt đầu lại, cùng phần tử', after.length && after.every(x => x.el) && typed[0] >= nA && typed.every((v, i) => !i || v >= typed[i - 1]) && after.every(x => full.startsWith(joined(x.lines).replace(/\n+$/, ''))) && typed[typed.length - 1] > nA ? null : `ký tự: ${typed.slice(0, 3).join(',')}…${typed.slice(-2).join(',')} (trước ${nA}), cùng phần tử=${after.every(x => x.el)}`);
      const e = { task: 'T-102', event: 'handoff', from: 'product', to: 'spec-critic', state: 'review', holder: 'spec-critic', owner: 'product' };
      const tasks2 = TASKS_A.map(t => ({ ...t })); applyEv(tasks2, { task: 'T-109', state: 'review' }); applyEv(tasks2, e);
      await sleep(o2, 600); const mid = await read(o2);
      if (mid.state === 'typing') { send(o2, e); const s = await waitSum(o2, x => isOpen(x, 'nd_spec') && x.state === 'done', UPDATE_MS + 300);
        rec(3, 'G2 nội dung đổi khi đang gõ: hiện ngay đủ nội dung mới (không gõ lại) trong ≤ 1 giây', joined(s.lines) === joined(expectLines('nd_spec', tasks2)) && s.state === 'done' ? null : `state=${s.state}, thấy [${(s.lines || []).join(' | ')}]`); }
      else rec(3, 'G2 nội dung đổi khi đang gõ', 'đã gõ xong trước khi thử (máy quá nhanh/chậm?)');
      rec(3, 'G3 không lỗi console', errsOf(o2));
    } finally { await close(o2).catch(() => { }); }
  }
}

// ---------- tiêu chí 4: truy cập, reduced-motion, cỡ chữ, bố cục ----------
async function geometryRun(o, label, ids = CHARS, dark = false) {
  const bad = [];
  for (const id of ids) {
    await keyOpen(o, id); const s = await waitSum(o, x => isOpen(x, id), 1500);
    if (!isOpen(s, id)) { bad.push(`${id}: không mở`); await o.page.keyboard.press('Escape'); continue; }
    await sleep(o, 330); const t = await read(o); const p = [];
    if (!t.parentOk) p.push('#fx_s không là con cuối của svg hoặc nằm trong #fx_b'); if (t.hasForeign) p.push('có foreignObject/svg/image');
    if (!t.inside) p.push('ra ngoài svg'); if (t.ownOverlap) p.push(`đè thân bot ${t.ownOverlap.map(v => fmt(v)).join('×')}u`); if (t.ownText && t.ownText.length) p.push('che chữ của chính khối: ' + t.ownText.slice(0, 2).join(', ')); if (t.hidden) p.push(t.hidden + ' dòng không nhìn thấy');
    const f = t.fontPx.filter(v => v < 9 - 0.05 || v > 16 + 0.05); if (f.length) p.push('chữ ' + t.fontPx.map(v => fmt(v)).join('/') + 'px');
    if (t.textOutside) p.push('chữ tràn khỏi bong bóng'); if (t.notTop) p.push(`${t.notTop} dòng bị phần tử khác che`);
    if (!t.inVp) p.push(`không nằm trọn khung nhìn (${fmt(t.bg.l, 0)},${fmt(t.bg.t, 0)} → ${fmt(t.bg.r, 0)},${fmt(t.bg.b, 0)} trong ${t.innerW}×${t.innerH})`);
    const cr = contrast(t.txtFill, t.bgFill); if (cr !== null && cr < 4.5) p.push('tương phản ' + fmt(cr, 2)); if (t.scrollX) p.push('trang cuộn ngang scrollX=' + t.scrollX);
    if (p.length) bad.push(`${id}: ${p.join(', ')}`);
    await o.page.keyboard.press('Escape'); await sleep(o, 60);
  }
  const sw = await o.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 0.5); if (!sw && !label.includes('phóng to')) bad.push('trang cuộn ngang');
  return bad;
}
async function crit4() {
  { // a11y cơ bản + bàn phím
    const o = await open({ data: DATA_A() });
    try {
      const at = await o.page.evaluate(ids => ids.map(id => { const g = document.querySelector('#model svg g.mch[data-block="' + id + '"]'); return g ? { id, tab: g.getAttribute('tabindex'), role: g.getAttribute('role'), label: g.getAttribute('aria-label'), exp: g.getAttribute('aria-expanded') } : { id }; }), CHARS);
      const bad = at.filter(a => a.tab !== '0' || a.role !== 'button' || a.label !== NAME[a.id] + ', xem việc đang giữ' || a.exp !== 'false');
      rec(4, 'K1 mỗi nhân vật có tabindex="0", role="button", aria-label="<Tên>, xem việc đang giữ", aria-expanded="false"', bad.length ? `${bad.length}/11 sai, vd ${JSON.stringify(bad[0])}` : null);
      const lv = await o.page.evaluate(() => { const l = document.getElementById('model-sum-live'); if (!l) return 'không có #model-sum-live'; const s = getComputedStyle(l), r = l.getBoundingClientRect(), m = document.getElementById('model');
        if (l.getAttribute('aria-live') !== 'polite') return 'aria-live ≠ polite'; if (l.getAttribute('aria-atomic') !== 'true') return 'aria-atomic ≠ true'; if (s.display === 'none' || s.visibility === 'hidden') return 'bị ẩn bằng display/visibility (trình đọc màn hình bỏ qua)';
        if (!m.contains(l) || l.closest('svg')) return 'không nằm trong #model hoặc nằm trong svg'; if (document.querySelectorAll('#model-sum-live').length !== 1) return 'trùng id'; if (m.querySelectorAll('svg').length !== 1) return '#model có ≠ 1 svg'; return null; });
      rec(4, 'K2 #model-sum-live: HTML trong #model, aria-live=polite, aria-atomic=true, không ẩn kiểu display/visibility, đúng một svg', lv);
      // thứ tự Tab và vòng tiêu điểm
      await o.page.evaluate(() => { const g = document.querySelector('#model svg g.mch[data-block="nd_intents"]'); if (g && g.focus) g.focus(); });
      const seq = []; for (let i = 0; i < 10; i++) { await o.page.keyboard.press('Tab'); seq.push(await o.page.evaluate(() => { const a = document.activeElement, g = a && a.closest && a.closest('g.mch'); return g ? g.getAttribute('data-block') : (a ? a.tagName + (a.id ? '#' + a.id : '') : null); })); }
      rec(4, 'K3 Tab đi qua 11 nhân vật theo thứ tự nd_intents … nd_prod, liền nhau', seq.join() === CHARS.slice(1).join() ? null : `Tab cho: ${seq.join(', ')}`);
      const ol = await o.page.evaluate(() => { const g = document.activeElement; if (!g || !g.closest || !g.closest('g.mch')) return null; const s = getComputedStyle(g); return { st: s.outlineStyle, w: parseFloat(s.outlineWidth) }; });
      rec(4, 'K4 nhân vật có tiêu điểm bàn phím có vòng tiêu điểm nhìn thấy (outline ≥ 2px)', ol && ol.st !== 'none' && ol.w >= 2 ? null : `outline ${JSON.stringify(ol)}`);
      // Enter / Space / aria-expanded
      const y0 = await o.page.evaluate(() => { const g = document.querySelector('#model svg g.mch[data-block="nd_exec"]'); if (g && g.focus) g.focus(); return window.scrollY; });
      const ex = async () => o.page.evaluate(() => document.querySelector('g.mch[data-block="nd_exec"]').getAttribute('aria-expanded')); const steps = [];
      await o.page.keyboard.press(' '); await sleep(o, 200); steps.push([await ex(), (await read(o)).state]);
      await o.page.keyboard.press('Enter'); await sleep(o, 250); steps.push([await ex(), (await read(o)).state]);
      await o.page.keyboard.press(' '); await sleep(o, 250); steps.push([await ex(), (await read(o)).n]);
      const y1 = await o.page.evaluate(() => window.scrollY);
      rec(4, 'K5 Space mở (typing), Enter hiện hết (done), Space đóng; aria-expanded true/true/false; Space không cuộn trang', steps[0][0] === 'true' && steps[0][1] === 'typing' && steps[1][0] === 'true' && steps[1][1] === 'done' && steps[2][0] === 'false' && steps[2][1] === 0 && Math.abs(y1 - y0) <= 2 ? null : `bước: ${JSON.stringify(steps)}, cuộn ${y0}→${y1}`);
      // vùng đọc tức thì khi đang gõ
      await keyOpen(o, 'nd_spec'); await sleep(o, 150); const q = await read(o); const exp = expectLines('nd_spec', TASKS_A);
      rec(4, 'K6 #model-sum-live có NGAY nội dung đầy đủ "<Tên>: dòng. dòng…" khi chữ còn đang gõ; các dòng chữ aria-hidden', q.state === 'typing' && q.live === liveText('nd_spec', exp) && q.ariaHidden ? null : `state=${q.state}, live="${q.live}", ariaHidden=${q.ariaHidden}`);
      await o.page.keyboard.press('Escape'); await sleep(o, 150); rec(4, 'K7 đóng thì #model-sum-live rỗng', (await read(o)).live === '' ? null : 'vùng đọc không rỗng sau khi đóng');
      rec(4, 'K8 không lỗi console', errsOf(o));
    } finally { await close(o).catch(() => { }); }
  }
  { // vùng bấm
    for (const w of [1280, 390]) { const o = await open({ vp: w === 390 ? { width: 390, height: 844 } : { width: 1280, height: 900 }, data: DATA_A() });
      try { const bad = []; for (const id of CHARS) { const c = await centerOf(o, id); if (!c) { bad.push(id + ' không có'); continue; }
          const d = w === 390 ? 20 : Math.min(c.w, c.h) * 0.45; const pts = [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d]];
          const miss = await o.page.evaluate(([c, pts, id]) => pts.filter(([dx, dy]) => { const e = document.elementFromPoint(c.x + dx, c.y + dy), g = e && e.closest && e.closest('g.mch'); return !(g && g.getAttribute('data-block') === id); }).length, [c, pts, id]); if (miss) bad.push(`${id} trượt ${miss}/${pts.length} điểm`); }
        rec(4, `H1 ${w}px vùng bấm quanh thân bot (${w === 390 ? '±20px, tức ≥ 44×44' : '±0,45 cỡ thân'}) thuộc đúng nhân vật`, bad.length ? bad.slice(0, 3).join('; ') : null); } finally { await close(o).catch(() => { }); } }
  }
  { // reduced-motion
    const o = await open({ data: DATA_A(), reduce: true });
    try { await startRec(o); const ok = await clickChar(o, 'nd_spec'); await sleep(o, 1200); const r = await stopRec(o); const S = r.s.filter(x => x.n >= 1); const full = joined(expectLines('nd_spec', TASKS_A)); const s = await read(o);
      const f = S[0]; const partial = S.filter(x => x.st !== 'done' || joined(x.lines) !== full);
      rec(4, 'R1 reduced-motion: hiện ngay đủ chữ trong ≤ 200ms, data-state="done" từ khung đầu, không khung nào có chữ gõ dở', !ok || !f ? 'không mở được' : (f.t - r.tc > LATENCY ? `hiện sau ${fmt(f.t - r.tc, 0)}ms` : (partial.length ? `${partial.length} khung chưa xong (chữ dở/typing)` : null)));
      rec(4, 'R2 reduced-motion: không animation/transition nào trên tóm tắt', s.anims === 0 ? null : `${s.anims} animation đang chạy trong #fx_s`);
      const was = await read(o); await o.page.keyboard.press('Escape'); await sleep(o, 150); rec(4, 'R3 reduced-motion: Esc vẫn đóng', was.n === 1 && (await read(o)).n === 0 ? null : `trước Esc n=${was.n}`);
    } finally { await close(o).catch(() => { }); }
  }
  // cỡ chữ, trọn svg, không đè thân bot, trên cùng, trong khung nhìn
  for (const [w, h] of [[320, 640], [390, 844], [1280, 900], [1920, 1080]]) { const o = await open({ vp: { width: w, height: h }, data: DATA_W() });
    try { const bad = await geometryRun(o, `${w}px`); rec(4, `G1 ${w}px bản thường (dữ liệu xấu nhất: tên 28 ký tự chữ hoa): 11 tóm tắt đều 9-16px, trọn svg, không đè thân bot, không che chữ của chính khối (tên, số đếm, chú thích), trên cùng, trong khung nhìn, tương phản ≥ 4,5`, bad.length ? `${bad.length}/11: ${bad.slice(0, 3).join(' | ')}` : null); } finally { await close(o).catch(() => { }); } }
  for (const [w, h] of [[390, 844], [1280, 900]]) { const o = await open({ vp: { width: w, height: h }, data: DATA_W() });
    try { if (!(await enterZoom(o))) { rec(4, `G2 ${w}px phóng to: vào được chế độ phóng to`, 'không vào được (T-036)'); } else { const bad = await geometryRun(o, `${w}px phóng to`); rec(4, `G2 ${w}px phóng to: 11 tóm tắt đều 9-16px, trọn svg, không đè thân bot, trên cùng, trong khung nhìn`, bad.length ? `${bad.length}/11: ${bad.slice(0, 3).join(' | ')}` : null);
        const dx = await o.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 0.5 && window.scrollX === 0); rec(4, `G2b ${w}px phóng to: trang ngoài không cuộn ngang`, dx ? null : 'trang cuộn ngang'); } } finally { await close(o).catch(() => { }); } }
  { const o = await open({ vp: { width: 320, height: 640 }, data: dash(Array.from({ length: 4 }, (_, i) => T('T-' + (1000 + i), 'done', 'engineering', { title: 'W'.repeat(20), tier: 'B', hours: 1 }))) });
    try { await keyOpen(o, 'nd_capu'); const t = await waitSum(o, x => isOpen(x, 'nd_capu') && x.state === 'done', 8000); await sleep(o, 330); const u = await read(o); const exp = expectLines('nd_capu', [1000, 1001, 1002, 1003].map(n => T('T-' + n, 'done', 'engineering', { title: 'W'.repeat(20), tier: 'B', hours: 1 })));
      const cut = (u.lines || []).every((l, i) => l === exp[i] || (l.includes('…') && l.endsWith(' · Chờ đọc diff') && l.startsWith(exp[i].slice(0, 8))));
      rec(4, 'G4 320px, tên toàn chữ W rộng nhất: vẫn trọn svg, chữ ≥ 9px; nếu vẫn quá rộng ở 9px thì tên bị cắt thêm bằng "…" (không tràn)', !isOpen(t, 'nd_capu') ? 'không mở' : (!u.inside ? 'ra ngoài svg' : (u.fontPx.some(v => v < 9 - 0.05 || v > 16 + 0.05) ? 'chữ ' + u.fontPx.map(v => fmt(v)).join('/') + 'px' : (!cut ? 'nội dung đổi ngoài việc cắt tên: ' + u.lines.join(' | ') : null)))); } finally { await close(o).catch(() => { }); } }
  { const o = await open({ vp: { width: 390, height: 844 }, data: DATA_W(), dark: true }); try { const bad = await geometryRun(o, '390px tối'); rec(4, 'G3 390px chế độ tối: 11 tóm tắt đạt cỡ chữ, bố cục, tương phản ≥ 4,5', bad.length ? `${bad.length}/11: ${bad.slice(0, 3).join(' | ')}` : null); } finally { await close(o).catch(() => { }); } }
  { // đổi bề ngang khi đang mở
    const o = await open({ vp: { width: 1280, height: 900 }, data: DATA_W() });
    try { await keyOpen(o, 'nd_spec'); await waitSum(o, x => isOpen(x, 'nd_spec'), 1500); const bad = [];
      for (const [w, h] of [[390, 844], [1280, 900]]) { await o.page.setViewportSize({ width: w, height: h }); await sleep(o, 700); const t = await read(o);
        if (!isOpen(t, 'nd_spec')) { bad.push(`${w}px: đóng hoặc đổi nhân vật`); continue; } const p = [];
        if (!t.inside) p.push('ra ngoài svg'); if (t.ownOverlap) p.push('đè thân bot'); if (t.fontPx.some(v => v < 9 - 0.05 || v > 16 + 0.05)) p.push('chữ ' + t.fontPx.map(v => fmt(v)).join('/') + 'px'); if (p.length) bad.push(`${w}px: ${p.join(', ')}`); }
      rec(4, 'W1 đổi bề ngang 1280 → 390 → 1280 khi đang mở: vẫn mở cùng nhân vật, bố cục và cỡ chữ vẫn đúng trong 700ms', bad.length ? bad.join('; ') : null); } finally { await close(o).catch(() => { }); }
  }
  { // phóng to: Tab xoay vòng, Esc hai nấc, bấm Phóng to khi đang mở
    const o = await open({ vp: { width: 1280, height: 900 }, data: DATA_A() });
    try { if (!(await enterZoom(o))) { rec(4, 'Z1 vào được chế độ phóng to', 'không vào được'); } else {
        const act = () => o.page.evaluate(() => { const a = document.activeElement, m = document.getElementById('model'); const g = a && a.closest && a.closest('g.mch'); return { id: g ? g.getAttribute('data-block') : (a && a.id) || (a && a.tagName), inside: !!(a && m && m.contains(a)) }; });
        const seq = []; let out = false; for (let i = 0; i < 12; i++) { await o.page.keyboard.press('Tab'); const a = await act(); seq.push(a.id); if (!a.inside) out = true; }
        rec(4, 'Z1 phóng to: Tab xoay vòng nút → 11 nhân vật → nút, không ra ngoài #model', !out && seq.join() === CHARS.concat(['model-zoom']).join() ? null : `Tab cho: ${seq.join(', ')}${out ? ' (ra ngoài #model)' : ''}`);
        await o.page.keyboard.press('Shift+Tab'); const sb = await act(); rec(4, 'Z2 phóng to: Shift+Tab từ nút về nd_prod', sb.id === 'nd_prod' ? null : `Shift+Tab cho ${sb.id}`);
        await keyOpen(o, 'nd_spec'); await sleep(o, 250); const a1 = await read(o); await o.page.keyboard.press('Escape'); await sleep(o, 300); const a2 = await read(o), z1 = await zoomOn(o); await o.page.keyboard.press('Escape'); await sleep(o, 400); const z2 = await zoomOn(o);
        rec(4, 'Z3 phóng to + tóm tắt mở: Esc lần 1 chỉ đóng tóm tắt (phóng to còn), Esc lần 2 đóng phóng to', isOpen(a1, 'nd_spec') && a2.n === 0 && z1 && !z2 ? null : `mở=${a1.n}, sau Esc1: tóm tắt ${a2.n}, phóng to ${z1}; sau Esc2: phóng to ${z2}`);
      } } finally { await close(o).catch(() => { }); }
    const o2 = await open({ vp: { width: 1280, height: 900 }, data: DATA_A() });
    try { await clickChar(o2, 'nd_spec'); await sleep(o2, 300); const a = await read(o2); await o2.page.click('#model-zoom'); await sleep(o2, 600); const b = await read(o2), z = await zoomOn(o2);
      rec(4, 'Z4 bấm "Phóng to" khi tóm tắt đang mở: tóm tắt đóng và phóng to bật (bấm ngoài vẫn thực hiện việc đó)', isOpen(a, 'nd_spec') && b.n === 0 && z ? null : `trước mở=${a.n}, sau: tóm tắt ${b.n}, phóng to ${z}`);
      await o2.page.keyboard.press('Escape'); } finally { await close(o2).catch(() => { }); }
  }
}

// ---------- tiêu chí 5: giữ bất biến, bong bóng sự kiện, console, hiệu năng ----------
function runShell(cmd, argv, env, timeout) {
  return new Promise(res => { const p = cp.spawn(cmd, argv, { env: { ...process.env, ...env }, cwd: HQ }); let out = ''; const to = setTimeout(() => { p.kill('SIGKILL'); res({ code: -1, out: out + '\n(quá ' + timeout / 1000 + 's)' }); }, timeout);
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d); p.on('close', code => { clearTimeout(to); res({ code, out }); }); });
}
async function pool(jobs, n) { const res = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const j = i++; res[j] = await jobs[j](); } })); return res; }
async function crit5() {
  { // bấm không đổi trạng thái nhân vật; bong bóng sự kiện giữ nguyên chữ
    const o = await open({ data: DATA_L() });
    try { const snap = () => o.page.evaluate(() => [...document.querySelectorAll('#model svg g.mch')].map(g => g.getAttribute('data-block') + ':' + g.getAttribute('data-state') + ':' + g.getAttribute('data-anim') + ':' + (+getComputedStyle(g).opacity).toFixed(2)).join(' '));
      const a = await snap(); await clickChar(o, 'nd_capu'); await sleep(o, 400); const open1 = await read(o); const b = await snap(); await o.page.keyboard.press('Escape');
      rec(5, 'V1 bấm nhân vật không đổi data-state/data-anim/opacity của nhân vật nào', !isOpen(open1, 'nd_capu') ? 'không mở được tóm tắt để thử' : (a === b ? null : `trước: ${a.slice(0, 80)} … sau: ${b.slice(0, 80)}`));
      await sleep(o, 200); send(o, { task: 'T-1', event: 'handoff', from: 'product', to: 'spec-critic', state: 'review', holder: 'spec-critic', owner: 'product' });
      const tx = {}; for (let i = 0; i < 70; i++) { await sleep(o, 50); Object.assign(tx, await o.page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#fx_b .bub')].map(b => [b.getAttribute('data-block'), b.querySelector('[data-part=bubble-text]').textContent])))); if (tx.gt_spec && tx.nd_spec) break; }
      rec(5, 'V2 bong bóng sự kiện khi tóm tắt đã đóng: chữ cố định như T-031 (nd_spec "Xong, giao đây!", gt_spec "Đã nhận!")', tx.nd_spec === 'Xong, giao đây!' && tx.gt_spec === 'Đã nhận!' ? null : `thấy ${JSON.stringify(tx)}`);
    } finally { await close(o).catch(() => { }); }
  }
  { // 40 sự kiện khi tóm tắt đang mở
    const o = await open({ data: dash(Array.from({ length: 40 }, (_, i) => T('T-' + (100 + i), 'doing', 'engineering'))) });
    try { await clickChar(o, 'nd_exec'); await sleep(o, 300); const s0 = await read(o);
      if (!isOpen(s0, 'nd_exec')) rec(5, 'P1 40 sự kiện khi tóm tắt đang mở', 'không mở được tóm tắt nd_exec');
      else { await startRec(o); for (let i = 0; i < 40; i++) send(o, { task: 'T-' + (100 + i), event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' });
        await sleep(o, 4000); const r = await stopRec(o); const s = await read(o);
        rec(5, `P1 40 sự kiện cùng lúc khi tóm tắt đang mở: khung hình trễ < ${FRAME_MAX}ms (đo ${fmt(r.maxGap, 0)}ms), ≤ 3 bong bóng sự kiện (đo ${r.maxBub}), ≤ 12 dot (đo ${r.maxDots}), một tóm tắt (đo ${r.maxSum})`, r.maxGap < FRAME_MAX && r.maxBub <= 3 && r.maxDots <= 12 && r.maxSum <= 1 ? null : `trễ ${fmt(r.maxGap, 0)}ms, ${r.maxBub} bong bóng, ${r.maxDots} dot, ${r.maxSum} tóm tắt`);
        rec(5, 'P2 sau 40 sự kiện tóm tắt vẫn mở và đúng nội dung (khối rảnh vì mọi việc sang review)', isOpen(s, 'nd_exec') && joined(s.lines) === 'Đang rảnh' ? null : `n=${s.n}, thấy [${(s.lines || []).join(' | ')}]`); }
      rec(5, 'P3 không lỗi console', errsOf(o)); } finally { await close(o).catch(() => { }); }
  }
  { // chuyến đi qua mọi thứ: mở, hiện hết, đóng, phóng to, đổi... không lỗi
    const o = await open({ data: DATA_A() });
    try { for (const id of CHARS) { await clickChar(o, id); await sleep(o, 150); await clickChar(o, id); await sleep(o, 120); await clickChar(o, id); await sleep(o, 80); }
      if (await o.page.evaluate(() => !!document.getElementById('model-zoom'))) { await enterZoom(o); for (const id of CHARS.slice(0, 4)) { await keyOpen(o, id); await sleep(o, 120); } await o.page.keyboard.press('Escape'); await o.page.keyboard.press('Escape'); await sleep(o, 300); }
      rec(5, 'P4 chuyến đi mở/hiện hết/đóng cả 11 nhân vật, phóng to, Esc: không lỗi console', errsOf(o)); } finally { await close(o).catch(() => { }); }
  }
  if (!NO_INV) {
    const invDir = path.join(HQ, 'eval', 'invariants', 'dashboard', 'model');
    const invs = fs.readdirSync(invDir).filter(f => /^inv-\d+.*\.sh$/.test(f)).sort();
    rec(5, `V0 bất biến vùng dashboard/model (inv-001..022 trở lên) có đủ (${invs.length} file)`, invs.length >= 22 ? null : `chỉ ${invs.length} file`);
    const rs = await pool(invs.map(f => () => runShell('bash', [path.join(invDir, f)], { TOHONG_DASHBOARD_REPO: REPO }, 400000).then(r => ({ f, ...r }))), 2);
    for (const r of rs) { const last = r.out.trim().split('\n').filter(l => /^(PASS|FAIL)/.test(l)).slice(-3).join(' / ') || r.out.trim().split('\n').slice(-2).join(' / ');
      rec(5, `V ${r.f}`, r.code === 0 ? null : `thoát ${r.code}: ${last.slice(0, 300)}`); }
  }
}

// ---------- tiêu chí 6: ảnh đã commit ----------
function crit6() {
  const dir = `docs/screenshots/${TASK}/`; let ls;
  try { ls = cp.execFileSync('git', ['-C', REPO, 'ls-tree', '-r', 'HEAD', '--', dir], { encoding: 'utf8' }).trim().split('\n').filter(Boolean); } catch (e) { rec(6, 'S0 đọc được git HEAD của repo', 'không đọc được git ls-tree: ' + String(e.message).slice(0, 120)); return; }
  const files = Object.fromEntries(ls.map(l => { const [meta, f] = l.split('\t'); return [path.basename(f), meta.split(' ')[2]]; }));
  const miss = SHOT_NAMES.filter(n => !files[n + '.png']); rec(6, `S1 ${dir} đã commit ở HEAD đủ ${SHOT_NAMES.length} ảnh (${SHOT_NAMES.join(', ')})`, miss.length ? 'thiếu ' + miss.join(', ') : null);
  const have = SHOT_NAMES.filter(n => files[n + '.png']); const shas = have.map(n => files[n + '.png']);
  rec(6, 'S2 mỗi ảnh khác nhau (không chụp trùng)', shas.length && new Set(shas).size === shas.length ? null : (shas.length ? 'có ảnh trùng nội dung' : 'không có ảnh nào'));
  const small = have.filter(n => Number(cp.execFileSync('git', ['-C', REPO, 'cat-file', '-s', files[n + '.png']], { encoding: 'utf8' })) < 5000); rec(6, 'S3 ảnh không rỗng (≥ 5 KB mỗi ảnh)', small.length || !have.length ? (have.length ? 'ảnh quá nhỏ: ' + small.join(', ') : 'không có ảnh nào') : null);
  for (const n of ['dang-go-390', 'phong-to-390', 'toi-390']) if (files[n + '.png']) { const buf = cp.execFileSync('git', ['-C', REPO, 'cat-file', 'blob', files[n + '.png']]); const w = buf.readUInt32BE(16); rec(6, `S4 ${n}.png rộng đúng 390px (đo ${w})`, w === 390 ? null : `rộng ${w}px`); }
}

// ---------- chụp ảnh lúc đang gõ dở ----------
async function shots() {
  const dir = path.resolve(typeof SHOTS === 'string' ? SHOTS : path.join(REPO, 'docs', 'screenshots', TASK)); const staged = [];
  const N = nchars(expectLines('nd_spec', TASKS_A));
  const fracOf = o => o.page.evaluate(() => { const g = document.querySelector('#fx_s g.sum'); return g ? [...g.querySelectorAll('[data-part=sum-line]')].reduce((a, l) => a + Array.from(l.textContent).length, 0) : -1; });
  const stateOf = o => o.page.evaluate(() => { const g = document.querySelector('#fx_s g.sum'); return g ? g.getAttribute('data-state') : null; });
  async function untilFrac(o, lo, hi) { const t0 = Date.now(); while (Date.now() - t0 < 8000) { const n = await fracOf(o); if (n >= lo * N && n <= hi * N) return n; if (n > hi * N) return -2; await o.page.waitForTimeout(15); } return -1; }
  const fails = []; const put = async (o, name, buf) => { staged.push([name, buf]); };
  async function typingShot(opt, names) { const o = await open({ vp: opt.vp, data: DATA_A(), dark: opt.dark });
    try { if (opt.zoom && !(await enterZoom(o))) { fails.push(names[0] + ': không vào được phóng to'); return; }
      await keyOpen(o, 'nd_spec'); await o.page.waitForTimeout(60);
      const ranges = names.length > 1 ? [[0.15, 0.35], [0.55, 0.85]] : [[0.15, 0.55]];
      for (let i = 0; i < names.length; i++) { const n0 = await untilFrac(o, ranges[i][0], ranges[i][1]); if (n0 < 0) { fails.push(`${names[i]}: không bắt được lúc đang gõ dở (${n0 === -1 ? 'không có tóm tắt' : 'đã quá'})`); return; }
        const buf = await o.page.screenshot(); const n1 = await fracOf(o), st = await stateOf(o); if (st !== 'typing' || n1 >= N) { fails.push(`${names[i]}: sau khi chụp chữ đã gõ xong (không còn dở)`); return; } await put(o, names[i], buf); } } finally { await close(o).catch(() => { }); } }
  await typingShot({ vp: { width: 1280, height: 900 } }, ['dang-go-1280', 'dang-go-1280-sau']);
  { const o = await open({ vp: { width: 1280, height: 900 }, data: DATA_A() }); try { const s = await fullText(o, 'nd_spec'); if (!isOpen(s, 'nd_spec') || s.state !== 'done') fails.push('xong-1280: không gõ xong được'); else await put(o, 'xong-1280', await o.page.screenshot());
      await o.page.keyboard.press('Escape'); await sleep(o, 120); const r = await fullText(o, 'nd_rework'); if (!isOpen(r, 'nd_rework') || r.lines.join() !== 'Đang rảnh') fails.push('ranh-1280: không có "Đang rảnh"'); else await put(o, 'ranh-1280', await o.page.screenshot()); } finally { await close(o).catch(() => { }); } }
  await typingShot({ vp: { width: 390, height: 844 } }, ['dang-go-390']);
  await typingShot({ vp: { width: 390, height: 844 }, zoom: true }, ['phong-to-390']);
  await typingShot({ vp: { width: 390, height: 844 }, dark: true }, ['toi-390']);
  if (fails.length) { fails.forEach(f => console.log('FAIL ' + f)); console.log('FAIL không ghi ảnh nào (chỉ ghi khi đủ và đều chụp lúc đang gõ dở)'); return false; }
  fs.mkdirSync(dir, { recursive: true }); for (const [n, buf] of staged) { fs.writeFileSync(path.join(dir, n + '.png'), buf); console.log('ảnh ' + n); }
  console.log('PASS đã chụp ảnh vào ' + dir); return true;
}

(async () => {
  browser = await chromium.launch();
  try {
    if (SHOTS) { const ok = await shots(); await browser.close(); process.exit(ok ? 0 : 1); }
    const want = n => !ONLY || ONLY === n;
    if (want(1)) { await crit1(); await crit1b(); }
    if (want(2)) await crit2();
    if (want(3)) await crit3();
    if (want(4)) await crit4();
    if (want(5)) await crit5();
    if (want(6)) crit6();
  } catch (e) { console.log('FAIL lỗi chạy eval: ' + (e && e.stack || e)); await browser.close(); process.exit(1); }
  await browser.close();
  const bad = results.filter(r => r[0] === 'FAIL');
  console.log(bad.length ? `FAIL ${bad.length}/${results.length} kiểm tra đỏ (tiêu chí ${[...new Set(bad.map(r => r[1]))].join(', ')})` : `PASS ${results.length}/${results.length}`);
  process.exit(bad.length ? 1 : 0);
})();
