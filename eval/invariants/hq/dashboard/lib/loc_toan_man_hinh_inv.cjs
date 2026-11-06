#!/usr/bin/env node
// Thư viện đo INV-007 hq/dashboard: lọc sản phẩm là lọc toàn màn hình, kể cả khối Capu (nguồn: T-076 spec v5, INV-P5 của Product;
// qua Spec Gate 2026-11-06, spec-critic). Rút nguyên tiêu chí 1 của T-041 (eval/T-041/loc-san-pham.cjs, quyết định
// decisions/2026-11-02-t041-pham-vi-loc-san-pham.md mục 1, 3) và chạy thêm một lượt với dữ liệu có `capu_queue`.
// Bản cố định, không phụ thuộc eval của việc (eval/T-041/*.cjs có thể đổi; file này thì không).
//   node loc_toan_man_hinh_inv.cjs --repo <repo-dashboard>
// Cách kiểm là so sánh vi sai: màn hình sau khi lọc P trên dữ liệu hỗn hợp phải GIỐNG HỆT màn hình "Tất cả" trên dữ liệu chỉ có việc
// (và sự kiện) của P. Lượt hai: cả hai bên cùng mang nguyên `capu_queue` của dữ liệu hỗn hợp (dashboard.json không lọc capu_queue;
// phần tử của việc không có trong dữ liệu trang thì không có dòng, T-076 U1), nên số/chữ phụ/đèn khối Capu khi lọc P phải bằng bản chỉ có P.
// Áp dụng từ khi trang có select#product-filter (T-041 vào); trước đó in PASS "chưa áp dụng". Mã thoát 0 = đạt.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const REPO = path.resolve(flag('--repo') || '.');
const INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt biến môi trường D3=/đường/dẫn/d3.min.js'); process.exit(1); }
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO + ' (đặt TOHONG_DASHBOARD_REPO)'); process.exit(1); }
if (!/id="product-filter"/.test(fs.readFileSync(INDEX, 'utf8'))) { console.log('PASS chưa áp dụng: trang chưa có select#product-filter (T-041)'); process.exit(0); }

const KEY = 'tohong.productFilter';
// Dấu thời gian tương đối so với giờ chạy eval (dashboard đọc +07:00), để "đứng yên quá 24 giờ", "7 ngày qua" không phụ thuộc ngày chạy.
const stamp = h => new Date(Date.now() + 7 * 3600e3 - h * 3600e3).toISOString().slice(0, 16);
// Bản đối chiếu của ánh xạ vùng -> sản phẩm (ADR-011, quyết định 2026-11-02): CHỈ dùng để dựng dữ liệu giả có sẵn trường `product` như export_dashboard.py sẽ xuất.
// Dashboard không được tự suy từ `area`: có ca cố tình lệch (T-306) và ca thiếu trường (T-308) để chứng minh.
const prodOf = a => { const h = (a || '').split('/')[0]; return h === 'planner' || h === 'front' || h === 'back' ? 'planner' : h === 'hq' || h === 'dashboard' ? 'hq' : ''; };
const T = (id, state, owner, area, o = {}) => { const t = { id, title: 'Việc ' + id, state, holder: o.holder || owner, owner, reviewer: 'adversary', rounds: o.rounds || 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-10-30T09:00', updated: stamp(o.h === undefined ? 2 : o.h), hours_since_update: o.h === undefined ? 2 : o.h, tier: o.tier || 'A', area, product: o.product !== undefined ? o.product : prodOf(area), evals: 1, spec_returns: o.sr || 0, evals_added: o.ea || 0 };
  if (o.noprod) delete t.product; return t; };
// Dữ liệu hỗn hợp. planner: vùng mới và vùng cũ front/*; hq: vùng mới và vùng cũ dashboard/*; còn lại: không sản phẩm.
const PL = [T('T-101', 'doing', 'engineering', 'planner/front/vendor-list'), T('T-102', 'review', 'engineering', 'planner/front/budget', { holder: 'adversary' }),
  T('T-103', 'spec', 'product', 'planner/api', { h: 3, sr: 1 }), T('T-104', 'done', 'engineering', 'planner/front', { tier: 'B', h: 5, holder: '-' }),
  T('T-105', 'blocked', 'engineering', 'planner/front/vendor-list', { h: 30 }),
  T('T-305', 'doing', 'engineering', 'front/layout'),                         // vùng cũ front/* -> planner
  T('T-306', 'doing', 'engineering', 'dashboard/model', { product: 'planner' })]; // area lệch trường product: dashboard theo trường product
const HQ = [T('T-201', 'doing', 'engineering', 'hq/dashboard'), T('T-202', 'escalated', 'product', 'hq/dashboard/model', { holder: 'capu' }),
  T('T-203', 'rework', 'engineering', 'hq/dashboard', { rounds: 1, ea: 2 }), T('T-204', 'new', 'product', 'hq/dashboard'),
  T('T-205', 'done', 'engineering', 'hq/dashboard', { h: 5, holder: '-' }), T('T-206', 'doing', 'engineering', 'hq/dashboard/model', { h: 4 }),
  T('T-301', 'doing', 'engineering', 'dashboard/model'),                      // vùng cũ dashboard/* -> hq
  T('T-307', 'done', 'engineering', 'dashboard/model', { h: 6, holder: '-' })];
const OTHER = [T('T-302', 'doing', 'engineering', ''), T('T-303', 'doing', 'engineering', 'hqx/dashboard'),
  T('T-304', 'review', 'engineering', 'planner-x/front', { holder: 'adversary' }),
  T('T-308', 'doing', 'engineering', 'hq/dashboard', { noprod: true })];        // thiếu trường product -> không sản phẩm
const MIXED = [...PL, ...HQ, ...OTHER];
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const EV = (i, task, event, from, to, o = {}) => ({ seq: 'S-' + i, ledger_id: 'E-' + i, t: '2026-10-31T10:0' + i, task, title: '', event, from, to, round: 0, severity: o.sev || '', detail: '', link: '', cost: o.cost || 0, state: '', holder: '' });
const EVENTS = [EV(1, 'T-101', 'assigned', 'chief-of-staff', 'engineering', { cost: 1 }), EV(2, 'T-201', 'assigned', 'chief-of-staff', 'engineering', { cost: 2 }), EV(3, 'T-102', 'handoff', 'engineering', 'adversary'),
  EV(4, 'T-301', 'rejected', 'adversary', 'engineering', { sev: 'minor' }), EV(5, 'T-305', 'rejected', 'adversary', 'engineering', { sev: 'minor' }), EV(6, 'T-302', 'assigned', 'chief-of-staff', 'engineering'),
  EV(7, '', 'board_edited_directly', 'engineering', ''), EV(8, 'T-205', 'accepted', 'adversary', 'chief-of-staff'), EV(9, 'T-307', 'rejected', 'adversary', 'engineering', { sev: 'minor' })];
let WITH_Q = false;
const Q = (task, kind) => ({ task, kind, decide_by: '', links: [] });
// Hàng chờ Capu trải cả hai sản phẩm và việc không sản phẩm; sắp theo mã việc như D1.
const CQ = [Q('T-104', 'diff-b'), Q('T-105', 'blocked'), Q('T-202', 'escalated'), Q('T-205', 'decision'), Q('T-302', 'decision'), Q('T-306', 'merge-c'), Q('T-308', 'decision')];
const dash = (tasks, invariants, o = {}) => { const inv = invariants || { 'hq/dashboard/model': 1 }; const ids = new Set(tasks.map(t => t.id));
  const events = (o.events || EVENTS).filter(e => !o.only || ids.has(e.task));
  return { generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events, roster, ...(WITH_Q ? { capu_queue: CQ } : {}),
    model: { invariants: inv, invariants_total: Object.values(inv).reduce((a, b) => a + b, 0), adversarial_evals: 3, regression_evals: 2, insight_reports: 4, last_insight: '2026-10-30-weekly.md', specs: 7 } }; };
// Dữ liệu tham chiếu của sản phẩm P: chỉ việc có product = P và chỉ sự kiện của các việc đó.
const only = (P) => dash(P === 'planner' ? PL : HQ, undefined, { only: true });

let browser;
async function open(data, opt = {}) {
  const ctx = await browser.newContext({ viewport: opt.vp || { width: 1280, height: 900 }, reducedMotion: 'no-preference', colorScheme: 'light' });
  const page = await ctx.newPage(); const o = { ctx, page, errors: [], sock: null };
  page.on('pageerror', e => o.errors.push(String(e)));
  if (opt.init) await page.addInitScript(opt.init);
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  await page.routeWebSocket(/\/ws$/, ws => { o.sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  o.send = m => o.sock.send(JSON.stringify(m));
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1500);
  return o;
}
class NoSelect extends Error { }
const pick = async (o, v) => { if (!(await o.page.$('#product-filter'))) throw new NoSelect('không có <select id="product-filter">'); await o.page.selectOption('#product-filter', v, { timeout: 3000 }); await o.page.waitForTimeout(500); };
// Bảng việc có bảy cột (new, doing, review, rework, blocked, escalated, done); việc ở trạng thái spec không có thẻ trên bảng, chỉ đếm trong các khối mô hình.
const ON_BOARD = ['new', 'doing', 'review', 'rework', 'blocked', 'escalated', 'done'];
const onBoard = ts => ts.filter(t => ON_BOARD.includes(t.state)).map(t => t.id).sort().join();
// Mọi thứ hiển thị phụ thuộc danh sách việc/sự kiện. Số giờ (thay đổi theo giây) được chuẩn hoá để so sánh hai trang mở cách nhau vài giây.
const snap = o => o.page.evaluate(() => {
  const txt = s => { const e = document.querySelector(s); return e ? e.textContent.trim().replace(/\s+/g, ' ') : null; };
  const nh = x => x == null ? x : x.replace(/\d+(\.\d)? giờ/g, '# giờ').replace(/\b\d+\.\d\b/g, '#');
  const cols = [...document.querySelectorAll('#board .col')].map(c => ({ head: [...c.querySelectorAll('.colh span')].map(s => s.textContent.trim()).join('|'),
    cards: [...c.querySelectorAll('.tcard')].map(k => nh(k.textContent.trim().replace(/\s+/g, ' '))) }));
  const kpi = {}; for (const k of ['k-wip', 'k-capu', 'k-stuck', 'k-done', 'k-fpy']) kpi[k] = txt('#' + k);
  const filtered = { takeaway: txt('#takeaway'), alerts: nh(txt('#alerts tbody')), tlTitle: txt('#tl-title'), tlSub: txt('#tl-sub'), timeline: txt('#timeline tbody'), feed: txt('#feed tbody'), relTxt: txt('#relTxt'), resTxt: txt('#resTxt'), flowLive: txt('#flow-live'),
    flow: [...document.querySelectorAll('#flow .run-edge')].map(e => e.getAttribute('data-from') + '>' + e.getAttribute('data-to')).sort().join() + '|' + [...document.querySelectorAll('#flow svg > g:first-of-type > path')].map(p => p.getAttribute('stroke') + p.getAttribute('stroke-width')).sort().join() + '|' + [...document.querySelectorAll('#flow .run-badge text')].map(t => t.textContent).sort().join() };
  const whole = { team: nh(txt('#team tbody')), hiring: txt('#k-hiring'), insCap: txt('#insCap') };
  const blk = {}; for (const id of ['nd_intents', 'nd_spec', 'nd_respec', 'nd_exec', 'nd_rework', 'nd_capu']) { blk[id] = txt('#' + id + ' .n'); blk[id + '.cap'] = txt('#' + id + ' .cap'); }
  blk.sgateQ = txt('#sgateQ'); blk.gateQ = txt('#gateQ');
  const kr = { krTxt: txt('#krTxt'), lbl: txt('#nd_kr .lbl') };
  return { cols, kpi, blk, filtered, whole, kr };
});
const ids = s => s.cols.flatMap(c => c.cards.map(k => (/T-\d+/.exec(k) || [''])[0]));
const same = (a, b, what) => { const x = JSON.stringify(a), y = JSON.stringify(b); return x === y ? null : `${what} khác nhau:\n    lọc    = ${x}\n    chuẩn  = ${y}`; };
// Đèn khối đếm được: sáng khi và chỉ khi số hiển thị > 0 (inv-009), đọc tại thời điểm gọi.
const lampOf = o => o.page.evaluate(() => { const num = x => { const m = /(\d+)/.exec(x || ''); return m ? +m[1] : NaN; }; const out = {};
  for (const id of ['nd_intents', 'nd_spec', 'nd_respec', 'nd_exec', 'nd_rework', 'nd_capu', 'gt_spec', 'gt_code']) {
    const g = document.getElementById(id), r = g && g.querySelector(':scope > rect, :scope > circle'); if (!r) { out[id] = null; continue; }
    let n = id === 'gt_spec' ? num((document.getElementById('sgateQ') || {}).textContent) : id === 'gt_code' ? num((document.getElementById('gateQ') || {}).textContent) : num((g.querySelector('.n') || {}).textContent);
    if (id === 'nd_exec') { const w = /(\d+)\s*chờ/.exec((g.querySelector('.cap') || {}).textContent || ''); n += w ? +w[1] : 0; }
    out[id] = [n, parseFloat(getComputedStyle(r).strokeWidth) >= 2.5]; } return out; });
const lampBad = (lamp, tag) => Object.entries(lamp).filter(([, v]) => v && !((v[0] > 0) === v[1])).map(([id, v]) => `${tag}: ${id} có số đếm ${v[0]} mà ${v[1] ? 'sáng' : 'không sáng'} (đèn phải khớp số đã lọc)`);
// Chữ ký hình học của mô hình: toạ độ/kích thước khối, đường, cổng, khung, vị trí chữ. Bỏ: chữ nội dung, dot (#fx_f), nhân vật (.mch), và hàng biểu tượng người/robot cùng chữ "+N" (mọi thứ trong g_*: số lượng theo số đếm).
const shape = o => o.page.evaluate(() => {
  const svg = document.querySelector('#model svg'); const out = []; const o0 = svg.getBoundingClientRect(); // toạ độ tính từ góc svg: bảng việc phía trên đổi cao khi lọc, mô hình trôi theo là bình thường
  const A = ['x', 'y', 'width', 'height', 'rx', 'r', 'cx', 'cy', 'd', 'points', 'transform', 'viewBox', 'x1', 'y1', 'x2', 'y2'];
  svg.querySelectorAll('*').forEach(e => { if (e.closest('#fx_f') || e.closest('.mch') || e.matches('use.ic') || e.closest('[id^="g_"]')) return;
    const at = {}; for (const a of A) if (e.hasAttribute(a)) at[a] = e.getAttribute(a);
    const cs = getComputedStyle(e), r = e.getBoundingClientRect(), nobox = !['rect', 'circle', 'ellipse', 'path', 'polygon', 'polyline', 'line', 'use', 'image'].includes(e.tagName.toLowerCase()) || !!e.closest('defs, marker, clipPath, mask, symbol');
    out.push([e.tagName.toLowerCase(), e.id || '', at, cs.display, cs.visibility, nobox ? '' : [r.x - o0.x, r.y - o0.y, r.width, r.height].map(v => Math.round(v * 2) / 2).join(',')]); });
  const r = svg.getBoundingClientRect(); return { svg: [r.width, r.height].map(Math.round).join('x'), n: out.length, out };
});

const CHECKS = {
  // C1: bộ chọn; lọc toàn màn hình theo trường product (vùng cũ thuộc đúng sản phẩm); việc không sản phẩm chỉ ở Tất cả
  1: async () => {
    const bad = [];
    const o = await open(dash(MIXED)); const sel = await o.page.$('#product-filter');
    if (!sel) { await o.ctx.close(); return ['không có <select id="product-filter">']; }
    const opts = await o.page.$$eval('#product-filter option', os => os.map(x => [x.value, x.textContent.trim()]));
    if (JSON.stringify(opts) !== JSON.stringify([['all', 'Tất cả'], ['planner', 'planner'], ['hq', 'hq']])) bad.push('các lựa chọn phải là đúng [all:Tất cả, planner:planner, hq:hq] theo thứ tự, thấy ' + JSON.stringify(opts));
    const base = await snap(o);
    if (ids(base).sort().join() !== onBoard(MIXED)) bad.push('mặc định Tất cả phải hiện đủ mọi việc, kể cả việc không sản phẩm (vùng rỗng, hqx, planner-x, thiếu trường product); thấy ' + ids(base).join());
    for (const p of ['planner', 'hq']) {
      const mine = (p === 'planner' ? PL : HQ);
      const ref = await open(only(p)); const want = await snap(ref); await ref.ctx.close();
      await pick(o, p); const got = await snap(o);
      bad.push(...lampBad(await lampOf(o), `lọc ${p}`));
      const idsGot = ids(got).sort().join(), idsWant = onBoard(mine);
      if (idsGot !== idsWant) bad.push(`lọc ${p}: thẻ trên bảng phải là ${idsWant}, thấy ${idsGot} (vùng cũ front/*, dashboard/* thuộc đúng sản phẩm theo trường product; việc không sản phẩm không hiện)`);
      for (const k of ['cols', 'kpi', 'blk', 'filtered']) { const e = same(got[k], want[k], `lọc ${p}: ${k}`); if (e) bad.push(e); }
      const w = same(got.whole, base.whole, `lọc ${p}: Đội ngũ, Cần tuyển, báo cáo insight (không lọc)`); if (w) bad.push(w);
    }
    await pick(o, 'all'); const back = await snap(o);
    const e = same(back, base, 'quay lại Tất cả không cần tải lại trang'); if (e) bad.push(e);
    if (o.errors.length) bad.push('lỗi trang: ' + o.errors[0]);
    await o.ctx.close();
    // Dòng thời gian đặt lại về việc mặc định của tập mới mỗi khi đổi bộ chọn
    const o2 = await open(dash(MIXED)); const b2 = await snap(o2);
    const card = o2.page.locator('#board .tcard', { hasText: 'T-101' }).first(); await card.click(); await o2.page.waitForTimeout(500);
    if (!/T-101/.test((await snap(o2)).filtered.tlTitle || '')) bad.push('bấm thẻ T-101 phải mở Dòng thời gian T-101 (ở Tất cả)');
    await pick(o2, 'hq'); const hqT = (await snap(o2)).filtered.tlTitle;
    const refHq = await open(only('hq')); const hqWant = (await snap(refHq)).filtered.tlTitle; await refHq.ctx.close();
    if (hqT !== hqWant) bad.push(`đổi sang hq: Dòng thời gian phải về việc mặc định của hq (${hqWant}), thấy ${hqT}`);
    await pick(o2, 'all'); const allT = (await snap(o2)).filtered.tlTitle;
    if (allT !== b2.filtered.tlTitle) bad.push(`quay lại Tất cả: Dòng thời gian phải về việc mặc định (${b2.filtered.tlTitle}), thấy ${allT}`);
    await o2.ctx.close();
    return bad;
  },
};

(async () => {
  browser = await chromium.launch(); let fails = 0;
  for (const [tag, q] of [['không capu_queue', false], ['có capu_queue', true]]) {
    WITH_Q = q;
    let bad; try { bad = await CHECKS[1](); } catch (e) { bad = [e instanceof NoSelect ? e.message : 'lỗi khi chạy: ' + String(e).split('\n')[0]]; }
    if (bad.length) { fails++; bad.forEach(b => console.log(`FAIL ${tag}: ${b}`)); } else console.log(`PASS ${tag}: lọc P giống hệt màn hình chỉ có việc của P (gồm số, chữ phụ, đèn khối Capu)`);
  }
  await browser.close(); console.log(fails ? 'FAIL ' + fails + ' lượt đỏ' : 'PASS'); process.exit(fails ? 1 : 0);
})();
