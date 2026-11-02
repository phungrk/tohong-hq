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
const dash = (tasks, invariants, o = {}) => { const inv = invariants || { 'hq/dashboard/model': 1 }; const ids = new Set(tasks.map(t => t.id));
  const events = (o.events || EVENTS).filter(e => !o.only || ids.has(e.task));
  return { generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events, roster,
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
  // C2: Knowledge Reservoir: cây bất biến có nhãn, không chồng nhau; chữ ở khối bể theo bộ lọc
  2: async () => {
    const bad = [];
    const read = o => o.page.evaluate(() => {
      const svg = document.querySelector('#model svg'), sr = svg.getBoundingClientRect(), sc = sr.width / (svg.viewBox.baseVal.width || 1000);
      const blk = document.querySelector('#nd_kr'), br = blk.querySelector('rect').getBoundingClientRect();
      const rows = [...blk.querySelectorAll('[data-kr-scope]')].map(e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); const n = /(\d+)\D*$/.exec(e.textContent);
        return { scope: e.getAttribute('data-kr-scope'), n: n ? +n[1] : NaN, text: e.textContent.trim(), top: r.top / sc, bottom: r.bottom / sc, fs: parseFloat(cs.fontSize), shown: r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0,
          inside: r.left >= br.left - 1 && r.right <= br.right + 1 && r.top >= br.top - 1 && r.bottom <= br.bottom + 1 }; });
      const t = id => ((document.getElementById(id) || {}).textContent || '').trim();
      return { rows, krTxt: t('krTxt'), lbl: ((document.querySelector('#nd_kr .lbl') || {}).textContent || '').trim(), insCap: t('insCap') };
    });
    const inv = { '_shared': 2, 'planner/front/vendor-list': 3, 'planner/front': 1, 'planner/api': 1, 'hq/dashboard/model': 5, 'hq/dashboard': 1, 'dashboard/model': 4 };
    const total = Object.values(inv).reduce((a, b) => a + b, 0), nums = s => (s.match(/\d+/g) || []).map(Number);
    const LABEL = { '_shared': '_shared', planner: 'planner', hq: 'hq', khac: 'khác' };
    for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const tag = vp.width + 'px';
      const o = await open(dash(MIXED, inv), { vp }); let r = await read(o);
      const by = {}; for (const x of r.rows) { if (by[x.scope]) bad.push(`${tag}: scope "${x.scope}" xuất hiện hai lần`); by[x.scope] = x; }
      const want = { '_shared': 2, planner: 5, hq: 6, khac: 4 };
      if (Object.keys(by).sort().join() !== Object.keys(want).sort().join()) bad.push(`${tag}: các dòng phải là ${Object.keys(want).sort().join()} (khac = vùng không có tiền tố sản phẩm), thấy ${Object.keys(by).sort().join()}`);
      for (const [k, v] of Object.entries(want)) if (by[k]) {
        if (by[k].n !== v) bad.push(`${tag}: dòng ${k} phải là ${v}, thấy "${by[k].text}"`);
        if (!by[k].text.includes(LABEL[k])) bad.push(`${tag}: dòng ${k} phải chứa tên nhánh "${LABEL[k]}" cùng số, thấy "${by[k].text}"`);
        if (!by[k].shown) bad.push(`${tag}: dòng ${k} không hiện`);
        if (!by[k].inside) bad.push(`${tag}: dòng ${k} nằm ngoài khung khối Knowledge Reservoir`);
      }
      const sorted = r.rows.slice().sort((a, b) => a.top - b.top);
      for (let i = 1; i < sorted.length; i++) if (sorted[i].top - sorted[i - 1].top < sorted[i - 1].fs - 0.5) bad.push(`${tag}: dòng ${sorted[i - 1].scope} và ${sorted[i].scope} chồng nhau/không phải hai dòng (cách ${(sorted[i].top - sorted[i - 1].top).toFixed(1)} < cỡ chữ ${sorted[i - 1].fs})`);
      const sum = r.rows.reduce((a, x) => a + (x.n || 0), 0);
      if (sum !== total) bad.push(`${tag}: tổng các dòng ${sum} phải bằng model.invariants_total ${total}`);
      const base = { krTxt: r.krTxt, lbl: r.lbl, insCap: r.insCap, rows: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.n])) };
      if (nums(r.krTxt)[0] !== total) bad.push(`${tag}: số bất biến ở tiêu đề khối (Tất cả) phải là ${total}, thấy "${r.krTxt}"`);
      if (r.lbl !== '7 vùng · 7 spec trong bể') bad.push(`${tag}: Tất cả: chữ dưới tên khối bể phải là "7 vùng · 7 spec trong bể", thấy "${r.lbl}"`);
      // lọc: các dòng cây KHÔNG đổi; số ở tiêu đề = _shared + sản phẩm; số eval đối kháng, hồi quy và chữ insight giữ nguyên; chữ dưới tên khối = "<số vùng của _shared + sản phẩm> vùng trong bể"
      for (const [p, n, z] of [['planner', 2 + 5, 1 + 3], ['hq', 2 + 6, 1 + 2]]) {
        await pick(o, p); r = await read(o);
        const got = Object.fromEntries(r.rows.map(x => [x.scope, x.n]));
        if (JSON.stringify(got) !== JSON.stringify(base.rows)) bad.push(`${tag}: lọc ${p}, các dòng của cây phải giữ nguyên, thấy ${JSON.stringify(got)}`);
        if (nums(r.krTxt)[0] !== n) bad.push(`${tag}: lọc ${p}, số bất biến ở tiêu đề khối phải là _shared + ${p} = ${n}, thấy "${r.krTxt}"`);
        if (JSON.stringify(nums(r.krTxt).slice(1)) !== JSON.stringify(nums(base.krTxt).slice(1))) bad.push(`${tag}: lọc ${p}, số eval đối kháng và hồi quy (không có theo sản phẩm) phải giữ nguyên "${base.krTxt}", thấy "${r.krTxt}"`);
        if (r.lbl !== `${z} vùng trong bể`) bad.push(`${tag}: lọc ${p}, chữ dưới tên khối bể phải đúng "${z} vùng trong bể", thấy "${r.lbl}"`);
        if (r.insCap !== base.insCap) bad.push(`${tag}: lọc ${p}, chữ khối Insight không lọc theo sản phẩm, phải là "${base.insCap}", thấy "${r.insCap}"`);
      }
      await pick(o, 'all'); r = await read(o);
      if (r.krTxt !== base.krTxt || r.lbl !== base.lbl) bad.push(`${tag}: quay lại Tất cả, chữ khối bể phải về "${base.krTxt}" / "${base.lbl}", thấy "${r.krTxt}" / "${r.lbl}"`);
      await o.ctx.close();
    }
    // không có vùng cũ: không có dòng khac; sản phẩm không có bất biến vẫn có dòng, số 0
    const o2 = await open(dash(MIXED, { '_shared': 2, 'hq/dashboard': 3 })); const r2 = await read(o2); await o2.ctx.close();
    const m = Object.fromEntries(r2.rows.map(x => [x.scope, x.n]));
    if (JSON.stringify(Object.entries(m).sort()) !== JSON.stringify(Object.entries({ '_shared': 2, planner: 0, hq: 3 }).sort()))
      bad.push('không có vùng cũ và planner chưa có bất biến: phải có đúng ba dòng _shared=2, planner=0, hq=3, thấy ' + JSON.stringify(m));
    return bad;
  },
  // C3: đổi bộ lọc không đổi toạ độ/kích thước khối, đường, cổng trong #model; chỉ chữ số/đèn/biểu tượng đổi
  3: async () => {
    const bad = [];
    // BIG: 10 việc hq đang code (> 8) để hàng biểu tượng sinh chữ "+N": chữ này không được tính là đổi hình
    const BIG = [T('T-501', 'doing', 'engineering', 'planner/front'), ...Array.from({ length: 10 }, (_, i) => T('T-6' + String(i).padStart(2, '0'), 'doing', 'engineering', 'hq/dashboard')), T('T-701', 'escalated', 'product', 'hq/dashboard', { holder: 'capu' })];
    for (const [name, data] of [['hỗn hợp', dash(MIXED)], ['nhiều việc một khối', dash(BIG)]]) for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const tag = `${vp.width}px, dữ liệu ${name}`;
      const o = await open(data, { vp }); const s0 = await shape(o), c0 = await snap(o);
      if (!(s0.n > 40)) bad.push(`${tag}: không đọc được mô hình (${s0.n} phần tử)`);
      let moved = false;
      for (const p of ['planner', 'hq', 'all']) {
        await pick(o, p); const s = await shape(o), c = await snap(o);
        const e = same(s, s0, `${tag}: hình mô hình khi chọn ${p}`);
        if (e) { const i = s.out.findIndex((x, k) => JSON.stringify(x) !== JSON.stringify(s0.out[k])); bad.push(e.split('\n')[0] + (i >= 0 ? ` (phần tử đầu tiên khác: lọc ${JSON.stringify(s.out[i]).slice(0, 160)} so với chuẩn ${JSON.stringify(s0.out[i]).slice(0, 160)})` : ` (số phần tử ${s.n} so với ${s0.n})`)); }
        if (p !== 'all' && JSON.stringify(c.blk) !== JSON.stringify(c0.blk)) moved = true;
      }
      if (!moved) bad.push(`${tag}: lọc planner/hq nhưng số đếm trên khối không đổi`);
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
  // C5: dot, nhân vật, hoạt động live theo sản phẩm; đèn và nhân vật vẫn khớp nhau khi đang lọc (inv-009, inv-010)
  5: async () => {
    const bad = [];
    // planner chỉ có việc của Product (không có việc nào ở Agent code/cổng); hq có một việc đang code. Khi lọc planner, khối Agent code phải tối.
    const LIVE = [T('T-401', 'new', 'product', 'planner/front'), T('T-402', 'doing', 'engineering', 'dashboard/model')];   // T-402 vùng cũ -> hq
    const seq = { n: 0 };
    const ev = (task, event, from, to, state, holder) => ({ type: 'event', id: 'E-99' + (++seq.n), t: stamp(0), task, title: '', event, from, to, round: 0, severity: '', cost: 0, state, holder });
    const SAMPLE = `new Promise(res => { const out = { dots: 0, chips: 0, lit: {}, ch: {} }; const t0 = performance.now();
      const tick = () => { const svg = document.querySelector('#model svg');
        out.dots = Math.max(out.dots, document.querySelectorAll('#fx_f circle').length);
        out.chips = Math.max(out.chips, document.querySelectorAll('#activity .act-chip').length);
        for (const id of ['nd_intents', 'nd_exec', 'gt_spec']) { const g = document.getElementById(id), r = g && g.querySelector(':scope > rect, :scope > circle'); if (r) out.lit[id] = Math.max(out.lit[id] || 0, parseFloat(getComputedStyle(r).strokeWidth) || 0); }
        if (performance.now() - t0 < 2800) setTimeout(tick, 40); else res(out); };
      tick(); })`;
    const chars = o => o.page.evaluate(() => [...document.querySelectorAll('#model svg g.mch[data-block]')].map(g => { const b = g.getAttribute('data-block'), blk = document.getElementById(b), r = blk && blk.querySelector(':scope > rect, :scope > circle');
      return [b, g.getAttribute('data-state'), r ? parseFloat(getComputedStyle(r).strokeWidth) >= 2.5 : null]; }));
    let sawChars = false;
    // [bộ lọc, việc phát sự kiện, có dot không, có chip hoạt động không]
    for (const [filter, task, dots] of [['planner', 'T-402', false], ['hq', 'T-401', false], ['planner', 'T-401', true], ['hq', 'T-402', true]]) {
      const tag = `lọc ${filter}, sự kiện live của ${task} (${task === 'T-401' ? 'planner' : 'hq'})`;
      const o = await open(dash(LIVE), { init: `try{localStorage.setItem(${JSON.stringify(KEY)},${JSON.stringify(filter)})}catch(e){}` });
      if (!o.sock) { bad.push(tag + ': kênh live giả không kết nối'); await o.ctx.close(); continue; }
      const mine = task === 'T-401' ? 'product' : 'engineering';
      if (task === 'T-401') o.send(ev(task, 'assigned', 'chief-of-staff', 'product', 'doing', 'product')); else o.send(ev(task, 'assigned', 'chief-of-staff', 'engineering', 'doing', 'engineering'));
      o.send({ type: 'activity', agent: mine, action: 'Viết code', task, at: Date.now() });
      const r = await o.page.evaluate(SAMPLE);
      if (dots && !(r.dots > 0)) bad.push(`${tag}: dot của việc thuộc sản phẩm đang chọn phải chạy, không thấy dot nào`);
      if (!dots && r.dots > 0) bad.push(`${tag}: dot của việc thuộc sản phẩm KHÁC không được chạy, thấy ${r.dots} dot`);
      if (dots && !(r.chips > 0)) bad.push(`${tag}: hoạt động live của việc thuộc sản phẩm đang chọn phải hiện (#activity), không thấy`);
      if (!dots && r.chips > 0) bad.push(`${tag}: hoạt động live của việc thuộc sản phẩm KHÁC không được hiện (#activity), thấy ${r.chips}`);
      if (!dots) { bad.push(...lampBad(await lampOf(o), tag)); for (const id of ['nd_exec', 'gt_spec']) if (filter === 'planner' && r.lit[id] >= 2.5) bad.push(`${tag}: khối ${id} không có việc nào của planner mà đã sáng vì dot/hoạt động của hq`); }
      const cs = await chars(o);
      if (cs.length) { sawChars = true; for (const [b, st, lit] of cs) if (['work', 'wait'].includes(st) !== (lit === true) && ['work', 'wait', 'idle'].includes(st)) bad.push(`${tag}: nhân vật ở ${b} trạng thái ${st} mà khối ${lit ? 'sáng' : 'không sáng'} (inv-010: nhân vật khớp đèn kể cả khi đang lọc)`); }
      if (o.errors.length) bad.push(tag + ': lỗi trang ' + o.errors[0]);
      await o.ctx.close();
    }
    if (!sawChars) console.log('INFO C5 trang chưa có nhân vật trong mô hình (g.mch[data-block]): bỏ phần kiểm nhân vật; inv-010 cũng "chưa áp dụng" ở bản này');
    return bad;
  },
};

(async () => {
  browser = await chromium.launch(); let fails = 0;
  const list = ONLY ? [ONLY] : [1, 2, 3, 4, 5];
  for (const n of list) {
    if (!CHECKS[n]) { console.log('FAIL tiêu chí ' + n + ' không tồn tại (1..5; tiêu chí 6 là python3 eval/T-041/export-product.py)'); fails++; continue; }
    let bad; try { bad = await CHECKS[n](); } catch (e) { bad = [e instanceof NoSelect ? e.message : 'lỗi khi chạy eval: ' + String(e).split('\n')[0]]; }
    if (bad.length) { fails++; bad.forEach(b => console.log(`FAIL C${n} ${b}`)); } else console.log(`PASS C${n}`);
  }
  await browser.close(); console.log(fails ? 'FAIL ' + fails + ' tiêu chí đỏ' : 'PASS'); process.exit(fails ? 1 : 0);
})();
