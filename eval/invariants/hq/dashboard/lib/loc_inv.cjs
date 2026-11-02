#!/usr/bin/env node
// Thư viện đo bất biến bộ lọc sản phẩm của dashboard (nguồn: T-041, spec products/T-041-loc-san-pham.md v2, qua Spec Gate 2026-11-02, spec-critic).
// Bản cố định, không phụ thuộc eval của việc (eval/T-041/loc-san-pham.cjs có thể đổi; file này thì không).
//   node loc_inv.cjs --repo <repo-dashboard> --check <all-complete|kr-sum|shape-stable>
// Áp dụng từ khi trang có select#product-filter (T-041 vào); trước đó in PASS "chưa áp dụng".
// Dữ liệu dashboard.json, kênh live (WebSocket) và d3 đều giả/cục bộ. Mã thoát 0 = đạt.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), CHECK = arg('--check'), INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO + ' (đặt TOHONG_DASHBOARD_REPO)'); process.exit(1); }
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js'); process.exit(1); }

const KEY = 'tohong.productFilter';
const stamp = h => new Date(Date.now() + 7 * 3600e3 - h * 3600e3).toISOString().slice(0, 16);
// Việc giả: trường product là nguồn duy nhất; area cố tình lệch ở vài ca để bắt cài đặt tự suy từ area.
const T = (id, state, owner, area, product) => { const t = { id, title: 'Việc ' + id, state, holder: state === 'done' ? '-' : owner, owner, reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-10-30T09:00', updated: stamp(2), hours_since_update: 2, tier: 'A', area, evals: 1, spec_returns: 0, evals_added: 0 };
  if (product !== undefined) t.product = product; return t; };
const TASKS = [
  T('T-101', 'doing', 'engineering', 'planner/front', 'planner'), T('T-102', 'review', 'engineering', 'front/layout', 'planner'),
  T('T-103', 'done', 'engineering', 'dashboard/model', 'planner'),          // area nói hq, product nói planner: theo product
  T('T-104', 'blocked', 'engineering', 'planner/api', 'planner'),
  T('T-201', 'doing', 'engineering', 'hq/dashboard', 'hq'), T('T-202', 'escalated', 'product', 'dashboard/model', 'hq'),
  T('T-203', 'rework', 'engineering', 'front/x', 'hq'),                    // area nói planner, product nói hq: theo product
  T('T-204', 'new', 'product', 'hq/dashboard/model', 'hq'), T('T-205', 'done', 'engineering', 'hq', 'hq'),
  T('T-301', 'doing', 'engineering', '', ''), T('T-302', 'new', 'product', 'hqx/dashboard', ''), T('T-303', 'review', 'engineering', 'planner-x/a', ''),
  T('T-304', 'doing', 'engineering', 'hq/dashboard'),                      // thiếu trường product: không sản phẩm
  T('T-305', 'escalated', 'product', 'planner/front'),                     // thiếu trường product: không sản phẩm
  T('T-306', 'spec', 'product', 'planner/front', 'planner')];              // trạng thái spec: không có thẻ trên bảng
const ON_BOARD = ['new', 'doing', 'review', 'rework', 'blocked', 'escalated', 'done'];
const boardOf = f => TASKS.filter(t => ON_BOARD.includes(t.state) && f(t)).map(t => t.id).sort().join();
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const EV = (i, task, event, from, to) => ({ seq: 'S-' + i, ledger_id: 'E-' + i, t: '2026-10-31T10:0' + i, task, title: '', event, from, to, round: 0, severity: '', detail: '', link: '', cost: 0, state: '', holder: '' });
const EVENTS = [EV(1, 'T-101', 'assigned', 'chief-of-staff', 'engineering'), EV(2, 'T-201', 'assigned', 'chief-of-staff', 'engineering'), EV(3, 'T-301', 'assigned', 'chief-of-staff', 'engineering'), EV(4, '', 'board_edited_directly', 'engineering', '')];
const dash = (inv) => { inv = inv || { '_shared': 2, 'hq/dashboard/model': 3 };
  return { generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks: TASKS, events: EVENTS, roster,
    model: { invariants: inv, invariants_total: Object.values(inv).reduce((a, b) => a + b, 0), adversarial_evals: 3, regression_evals: 2, insight_reports: 4, last_insight: '2026-10-30-weekly.md', specs: 7 } }; };

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
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1200);
  return o;
}
const has = o => o.page.$('#product-filter').then(Boolean);
const options = o => o.page.$$eval('#product-filter option', os => os.map(x => x.value));
const pick = async (o, v) => { await o.page.selectOption('#product-filter', v, { timeout: 3000 }); await o.page.waitForTimeout(400); };
const value = o => o.page.$eval('#product-filter', s => s.value);
const board = o => o.page.evaluate(() => [...document.querySelectorAll('#board .tcard')].map(k => (/T-\d+/.exec(k.textContent) || [''])[0]).sort().join());
const setKey = v => `try{localStorage.setItem(${JSON.stringify(KEY)},${JSON.stringify(v)})}catch(e){}`;

// Chữ ký hình học của #model: toạ độ/kích thước khối, đường, cổng, khung, vị trí chữ (tính từ góc svg).
// Bỏ: nội dung chữ, dot (#fx_f), bong bóng/tóm tắt (#fx_b, #fx_s), nhân vật (.mch), hàng biểu tượng việc (use.ic, g_*, chữ "+N").
const shape = o => o.page.evaluate(() => {
  const svg = document.querySelector('#model svg'), o0 = svg.getBoundingClientRect(), out = [];
  const A = ['x', 'y', 'width', 'height', 'rx', 'r', 'cx', 'cy', 'd', 'points', 'transform', 'viewBox', 'x1', 'y1', 'x2', 'y2'];
  svg.querySelectorAll('*').forEach(e => {
    if (e.closest('#fx_f, #fx_b, #fx_s, .mch') || e.matches('use.ic') || e.closest('[id^="g_"]')) return;
    const at = {}; for (const a of A) if (e.hasAttribute(a)) at[a] = e.getAttribute(a);
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    const nobox = !['rect', 'circle', 'ellipse', 'path', 'polygon', 'polyline', 'line', 'use', 'image'].includes(e.tagName.toLowerCase()) || !!e.closest('defs, marker, clipPath, mask, symbol');
    out.push([e.tagName.toLowerCase(), e.id || '', at, cs.display, cs.visibility, nobox ? '' : [r.x - o0.x, r.y - o0.y, r.width, r.height].map(v => Math.round(v * 2) / 2).join(',')]); });
  return { svg: [o0.width, o0.height].map(Math.round).join('x'), n: out.length, out };
});

const CHECKS = {
  // INV-hq/dashboard-001: "Tất cả" (mặc định và mọi giá trị lạ/lỗi của localStorage) luôn hiện đủ mọi việc ở bảy cột, kể cả việc không sản phẩm;
  // chọn một sản phẩm P thì bảng là đúng các việc có trường product = P (không suy từ area).
  'all-complete': async () => {
    const bad = [], ALL = boardOf(() => true);
    for (const [label, init] of [['localStorage trống', null], ['giá trị lạ "zzz"', setKey('zzz')], ['giá trị rỗng', setKey('')], ['sai hoa thường "HQ"', setKey('HQ')],
      ['localStorage bị cấm', 'Storage.prototype.getItem=function(){throw new Error("denied")};Storage.prototype.setItem=function(){throw new Error("denied")}']]) {
      const o = await open(dash(), { init });
      if (!(await has(o))) { await o.ctx.close(); return null; }
      const v = await value(o), b = await board(o);
      if (v !== 'all') bad.push(`${label}: bộ chọn phải là all, thấy ${v}`);
      if (b !== ALL) bad.push(`${label}: Tất cả phải có đủ ${ALL}, thấy ${b}`);
      if (o.errors.length) bad.push(`${label}: lỗi trang ${o.errors[0]}`);
      await o.ctx.close();
    }
    const o = await open(dash());
    for (const p of (await options(o)).filter(v => v !== 'all')) {
      await pick(o, p); const b = await board(o), want = boardOf(t => t.product === p);
      if (b !== want) bad.push(`chọn ${p}: bảng phải đúng các việc có product="${p}" (${want}), thấy ${b}`);
    }
    await pick(o, 'all'); const back = await board(o);
    if (back !== ALL) bad.push(`quay lại Tất cả phải có đủ ${ALL}, thấy ${back}`);
    await o.ctx.close();
    return bad;
  },
  // INV-hq/dashboard-002: tổng các dòng cây bất biến (data-kr-scope trong #nd_kr) bằng model.invariants_total, mỗi nhánh đúng một dòng,
  // có dòng _shared, với mọi bộ bể (kể cả sản phẩm lạ, vùng cũ, bể chỉ có _shared) và ở mọi lựa chọn của bộ chọn.
  'kr-sum': async () => {
    const bad = [];
    const BEDS = [{ '_shared': 2, 'hq/dashboard/model': 31 }, { '_shared': 2, 'planner/front': 4, 'planner': 1, 'hq': 2, 'hq/dashboard': 3, 'dashboard/model': 5, 'shop/x': 7, 'front': 1 }, { '_shared': 1 }];
    const rows = o => o.page.evaluate(() => [...document.querySelectorAll('#nd_kr [data-kr-scope]')].map(e => { const m = /(\d+)\D*$/.exec(e.textContent); return [e.getAttribute('data-kr-scope'), m ? +m[1] : NaN]; }));
    for (const bed of BEDS) for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const total = Object.values(bed).reduce((a, b) => a + b, 0), tag = `${vp.width}px, bể ${JSON.stringify(bed)}`;
      const o = await open(dash(bed), { vp });
      if (!(await has(o))) { await o.ctx.close(); return null; }
      for (const p of await options(o)) {
        await pick(o, p); const r = await rows(o), sum = r.reduce((a, [, n]) => a + n, 0), scopes = r.map(([s]) => s);
        if (sum !== total) bad.push(`${tag}, chọn ${p}: tổng các dòng cây ${sum} phải bằng invariants_total ${total} (${JSON.stringify(r)})`);
        if (new Set(scopes).size !== scopes.length) bad.push(`${tag}, chọn ${p}: có nhánh xuất hiện hai lần ${scopes.join()}`);
        if (!scopes.includes('_shared')) bad.push(`${tag}, chọn ${p}: thiếu dòng _shared`);
      }
      if (o.errors.length) bad.push(`${tag}: lỗi trang ${o.errors[0]}`);
      await o.ctx.close();
    }
    return bad;
  },
  // INV-hq/dashboard-003: đổi bộ lọc sản phẩm không đổi toạ độ/kích thước khối, đường, cổng, khung, vị trí chữ trong #model (1280 và 390px).
  'shape-stable': async () => {
    const bad = [];
    for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const o = await open(dash({ '_shared': 2, 'planner/front': 3, 'hq/dashboard/model': 5, 'dashboard/model': 1 }), { vp });
      if (!(await has(o))) { await o.ctx.close(); return null; }
      const s0 = await shape(o);
      if (!(s0.n > 40)) bad.push(`${vp.width}px: không đọc được mô hình (${s0.n} phần tử)`);
      for (const p of [...(await options(o)).filter(v => v !== 'all'), 'all']) {
        await pick(o, p); const s = await shape(o);
        if (JSON.stringify(s) !== JSON.stringify(s0)) { const i = s.out.findIndex((x, k) => JSON.stringify(x) !== JSON.stringify(s0.out[k]));
          bad.push(`${vp.width}px, chọn ${p}: hình mô hình đổi` + (i >= 0 ? ` (phần tử đầu tiên khác: ${JSON.stringify(s.out[i]).slice(0, 160)} so với ${JSON.stringify(s0.out[i]).slice(0, 160)})` : ` (svg ${s.svg}/${s.n} phần tử so với ${s0.svg}/${s0.n})`)); }
      }
      if (o.errors.length) bad.push(`${vp.width}px: lỗi trang ${o.errors[0]}`);
      await o.ctx.close();
    }
    return bad;
  },
};

(async () => {
  if (!CHECKS[CHECK]) { console.log('FAIL --check phải là một trong ' + Object.keys(CHECKS).join(', ')); process.exit(1); }
  browser = await chromium.launch(); let bad;
  try { bad = await CHECKS[CHECK](); } catch (e) { bad = ['lỗi khi chạy: ' + String(e).split('\n')[0]]; }
  await browser.close();
  if (bad === null) { console.log(`PASS ${CHECK}: chưa áp dụng (trang chưa có select#product-filter, T-041 chưa vào)`); process.exit(0); }
  if (bad.length) { bad.slice(0, 12).forEach(b => console.log(`FAIL ${CHECK}: ${b}`)); process.exit(1); }
  console.log(`PASS ${CHECK}`); process.exit(0);
})();
