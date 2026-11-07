#!/usr/bin/env node
// Thư viện đo bất biến cột Xong của Kanban (nguồn: T-089, spec products/T-089-kanban-xong-10-gan-nhat.md v1, qua Spec Gate 2026-11-07, spec-critic;
// quyết định decisions/2026-11-07-adr-031-cot-xong-gioi-han.md). Bản cố định, không phụ thuộc eval/T-089/done-kanban.cjs.
//   node xong_inv.cjs --repo <repo-dashboard> --check <done-cap|all-complete-many>
// Dữ liệu dashboard.json, kênh live (WebSocket) và d3 đều giả/cục bộ. Chỉ đọc DOM nhìn thấy. Mã thoát 0 = đạt.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), CHECK = arg('--check'), INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO + ' (đặt TOHONG_DASHBOARD_REPO)'); process.exit(1); }
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js'); process.exit(1); }

const LIMIT = 10, KEY = 'tohong.productFilter';
const stamp = h => new Date(Date.now() + 7 * 3600e3 - h * 3600e3).toISOString().slice(0, 16);
const num = id => +id.slice(2);
const OPEN = ['new', 'doing', 'review', 'rework', 'blocked', 'escalated'];
const LABEL = { 'Mới': 'new', 'Đang làm': 'doing', 'Chờ review': 'review', 'Rework': 'rework', 'Bị chặn': 'blocked', 'Chờ Capu': 'escalated', 'Xong': 'done' };
const T = (id, state, product, h) => { const t = { id, title: 'Việc ' + id, state, holder: state === 'done' ? '-' : 'engineering', owner: state === 'blocked' || state === 'escalated' ? 'product' : 'engineering',
  reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0, created: '2026-10-30T09:00', updated: stamp(h), hours_since_update: h, tier: 'A',
  area: product ? product + '/x' : 'hq/dashboard', evals: 1, spec_returns: 0, evals_added: 0 }; if (product !== null) t.product = product; return t; };
// Bộ dữ liệu tất định: nDone việc xong, sản phẩm xoay vòng (hq, planner, rỗng, thiếu trường), id lệch thứ tự updated, có ca cùng phút.
const PRODS = ['hq', 'planner', '', null];
function data(nDone, nOpen) {
  const t = [];
  for (let i = 0; i < nDone; i++) t.push(T('T-' + (2000 + ((i * 37) % 997)), 'done', PRODS[i % 4], 2 + (i % 5 === 3 ? 1 : (i * 13) % 41)));
  for (let i = 0; i < nOpen; i++) t.push(T('T-' + (3000 + i), OPEN[i % 6], PRODS[i % 4], 1 + i % 3));
  return t;
}
const inF = (x, f) => f === 'all' || x.product === f;
const order = (tasks, f) => tasks.filter(x => x.state === 'done' && inF(x, f)).sort((a, b) => a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : num(b.id) - num(a.id)).map(x => x.id);
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const dash = (tasks, events) => ({ generated_at: stamp(0), timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: events || [], roster,
  model: { invariants: { _shared: 1, 'hq/dashboard': 1 }, invariants_total: 2, adversarial_evals: 0, regression_evals: 0, insight_reports: 1, last_insight: '', specs: 1 } });

let browser, fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } };
async function open(d, vp, init) {
  const ctx = await browser.newContext({ viewport: vp || { width: 1280, height: 900 }, reducedMotion: 'no-preference', colorScheme: 'light' });
  const page = await ctx.newPage(); const o = { ctx, page, errors: [] };
  page.on('pageerror', e => o.errors.push(String(e)));
  if (init) await page.addInitScript(init);
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(d) }));
  await page.routeWebSocket(/\/ws$/, ws => { ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1200);
  return o;
}
const read = o => o.page.evaluate(() => ({ kdone: (document.getElementById('k-done') || {}).textContent, tl: (document.getElementById('tl-title') || {}).textContent,
  cols: [...document.querySelectorAll('#board .col')].map(c => { const sp = c.querySelectorAll('.colh span');
    return { label: sp[0] && sp[0].textContent.trim(), count: sp[1] && sp[1].textContent.trim(), ids: [...c.querySelectorAll('.tcard')].map(k => (/T-\d+/.exec(k.textContent) || [''])[0]) }; }) }));
const pick = async (o, f) => { await o.page.selectOption('#product-filter', f); await o.page.waitForTimeout(400); };
const more = async o => { const loc = o.page.locator('#done-more'); if (!(await loc.count())) return false; await loc.first().scrollIntoViewIfNeeded(); await loc.first().click(); await o.page.waitForTimeout(300); return true; };

// Kiểm một trạng thái: sáu cột mở đủ thẻ và đếm đúng; cột Xong = min(tổng, lim) việc mới nhất theo updated (hoà: id lớn trước), đếm cột và KPI = tổng.
async function expectBoard(o, tasks, f, lim, tag) {
  const r = await read(o), want = order(tasks, f), total = want.length;
  for (const c of r.cols) {
    const st = LABEL[c.label];
    if (st === 'done') {
      ok(c.ids.join() === want.slice(0, Math.min(total, lim)).join(), `${tag}: cột Xong phải là ${Math.min(total, lim)} việc mới nhất [${want.slice(0, lim).join(' ')}], thấy [${c.ids.join(' ')}]`);
      ok(c.count === String(total), `${tag}: số đầu cột Xong phải là tổng ${total}, thấy ${c.count}`);
    } else if (st) {
      const w = tasks.filter(x => x.state === st && inF(x, f)).map(x => x.id).sort();
      ok(c.ids.slice().sort().join() === w.join() && c.count === String(w.length), `${tag}: cột ${c.label} phải đủ ${w.length} thẻ, thấy ${c.ids.length} (đếm ${c.count})`);
    }
  }
  ok(r.kdone === String(total), `${tag}: KPI Đã xong phải là tổng ${total}, thấy ${r.kdone}`);
}

const CHECKS = {
  // INV (T-089): cột Xong ngắn, số đếm là tổng, mở thêm được tới hết; việc xong đang ẩn vẫn mở được Dòng thời gian qua Feed.
  'done-cap': async () => {
    for (const [n, vp] of [[0, null], [7, null], [10, null], [11, null], [37, null], [37, { width: 390, height: 844 }]]) {
      const tasks = data(n, 14), tag0 = `${n} việc xong/${vp ? 390 : 1280}`, o = await open(dash(tasks), vp);
      for (const f of ['all', 'hq', 'planner']) {
        await pick(o, f); await expectBoard(o, tasks, f, LIMIT, `${tag0}/${f}/mặc định`);
        let lim = LIMIT, guard = 0; while (await more(o) && guard++ < 20) { lim += LIMIT; await expectBoard(o, tasks, f, lim, `${tag0}/${f}/xem thêm → ${lim}`); }
        const shown = (await read(o)).cols.find(c => LABEL[c.label] === 'done');
        ok(shown && shown.ids.length === order(tasks, f).length, `${tag0}/${f}: bấm Xem thêm tới hết phải thấy đủ ${order(tasks, f).length} việc xong, thấy ${shown && shown.ids.length}`);
      }
      ok(o.errors.length === 0, `${tag0}: lỗi trang ${o.errors[0] || ''}`); await o.ctx.close();
    }
    // việc xong đang ẩn vẫn tới được Dòng thời gian
    const tasks = data(37, 6), hid = order(tasks, 'all')[LIMIT + 4];
    const ev = { seq: 9001, id: 'E-9001', t: stamp(0.1), task: hid, title: 'Việc ' + hid, event: 'accepted', from: 'adversary', to: 'chief-of-staff', state: 'done', holder: '-', owner: 'engineering', round: 0, severity: '', cost: 0 };
    for (const vp of [null, { width: 390, height: 844 }]) {
      const o = await open(dash(tasks, [ev]), vp);
      const row = o.page.locator('#feed tbody tr', { hasText: hid }).first(); await row.scrollIntoViewIfNeeded(); await row.click(); await o.page.waitForTimeout(400);
      const r = await read(o);
      ok(r.tl === 'Dòng thời gian · ' + hid, `${vp ? 390 : 1280}: bấm hàng Feed của việc xong đang ẩn ${hid} phải mở Dòng thời gian của nó, thấy "${r.tl}"`);
      ok(await o.page.locator('#timeline tbody tr').count() >= 1, `${vp ? 390 : 1280}: Dòng thời gian của ${hid} có dòng sự kiện`);
      await o.ctx.close();
    }
  },
  // INV-001 hq/dashboard, ca hơn 10 việc xong (ADR-031): "Tất cả" (mặc định và mọi giá trị lạ của localStorage) đủ thẻ ở sáu cột đầu, kể cả việc không sản phẩm;
  // cột Xong là min(tổng, giới hạn) việc mới nhất, đếm là tổng; chọn P thì đúng việc có product = P.
  'all-complete-many': async () => {
    const tasks = data(29, 18), setKey = v => `try{localStorage.setItem(${JSON.stringify(KEY)},${JSON.stringify(v)})}catch(e){}`;
    for (const [label, init] of [['localStorage trống', null], ['giá trị lạ "zzz"', setKey('zzz')], ['giá trị rỗng', setKey('')], ['sai hoa thường "HQ"', setKey('HQ')]]) {
      const o = await open(dash(tasks), null, init);
      await expectBoard(o, tasks, 'all', LIMIT, `Tất cả/${label}`);
      for (const f of ['hq', 'planner', 'all']) { await pick(o, f); await expectBoard(o, tasks, f, LIMIT, `${label}/chọn ${f}`); }
      ok(o.errors.length === 0, `${label}: lỗi trang ${o.errors[0] || ''}`); await o.ctx.close();
    }
  },
};
(async () => {
  if (!CHECKS[CHECK]) { console.log('FAIL --check phải là ' + Object.keys(CHECKS).join('|')); process.exit(1); }
  browser = await chromium.launch();
  try { await CHECKS[CHECK](); } catch (e) { fails++; console.log('FAIL lỗi chạy: ' + String(e).split('\n')[0]); }
  await browser.close();
  console.log(fails ? `FAIL ${CHECK}: ${fails} ý không đạt` : `PASS ${CHECK}`); process.exit(fails ? 1 : 0);
})();
