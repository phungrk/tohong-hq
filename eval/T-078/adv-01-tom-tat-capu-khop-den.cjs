#!/usr/bin/env node
// adv-01 (T-078, adversary, Code Gate v1): đèn khối Capu (nay theo capu_queue, spec T-076 U1) và tóm tắt khi bấm nhân vật Capu
// (T-037, INV-023 hq/dashboard/model) không được nói hai điều khác nhau.
// INV-023: "khối sáng (bất kỳ quy tắc nào) thì tóm tắt không bao giờ là 'Đang rảnh'".
// Ca: không có việc escalated; capu_queue có (a) decision cho việc done bậc B cập nhật 72 giờ trước,
// (b) blocked "Chờ Capu", (c) diff-b có PR chưa merged cập nhật 72 giờ trước; (d) bộ lọc sản phẩm "planner" trong khi việc escalated thuộc hq
// (quyết định decisions/2026-11-02-t041-pham-vi-loc-san-pham.md mục 1: "một màn hình, một con số", số trên khối mô hình lọc theo sản phẩm).
// Chạy: cd /home/user/tohong-hq && node eval/T-078/adv-01-tom-tat-capu-khop-den.cjs   (cần NODE_PATH từ npm root -g, D3)
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const REPO = path.resolve(process.env.TOHONG_DASHBOARD_REPO || '/home/user/tohong-hq-dashboard');
const INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ (biến D3)'); process.exit(1); }
const GH = 'https://github.com/phungrk/';
const stamp = h => new Date(Date.now() + 7 * 3600e3 - h * 3600e3).toISOString().slice(0, 16);
const T = (id, o = {}) => ({ id, title: 'Việc ' + id, state: o.state || 'done', holder: '-', owner: o.owner || 'engineering', reviewer: 'adversary', rounds: 0, version: 1,
  deadline: '', budget: '', cost: 0, created: '2026-10-30T09:00', updated: stamp(o.h ?? 72), hours_since_update: o.h ?? 72,
  tier: o.tier || 'B', area: o.area || 'hq/dashboard', product: o.product || 'hq', evals: 1, spec_returns: 0, evals_added: 0 });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const dash = (tasks, queue) => ({ generated_at: stamp(0), timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster, capu_queue: queue,
  model: { invariants: { _shared: 1, 'hq/dashboard': 1 }, invariants_total: 2, adversarial_evals: 0, regression_evals: 0, insight_reports: 0, last_insight: '', specs: 1 } });
const DRL = f => ({ label: 'Decision Request', url: `${GH}tohong-hq/blob/main/inbox/capu/${f}`, pr_state: '' });

let browser;
async function open(data, filter) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'light' });
  if (filter) await ctx.addInitScript(f => { try { localStorage.setItem('tohong.productFilter', f); } catch (e) {} }, filter);
  const page = await ctx.newPage(); const o = { ctx, page, errors: [] };
  page.on('pageerror', e => o.errors.push(String(e)));
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  await page.routeWebSocket(/\/ws$/, ws => { ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1500);
  return o;
}
const litOf = o => o.page.evaluate(() => { const e = document.getElementById('nd_capu'), sh = e && e.querySelector(':scope > rect, :scope > circle'); return sh ? parseFloat(getComputedStyle(sh).strokeWidth) >= 2.5 : null; });
async function sumOfCapu(o) {
  const c = await o.page.evaluate(() => { const b = document.querySelector('#model svg g.mch[data-block="nd_capu"] [data-part=body]'); if (!b) return null;
    b.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (!c) return null; await o.page.mouse.click(c.x, c.y);
  const t0 = Date.now(); let s = null;
  while (Date.now() - t0 < 4000) {
    s = await o.page.evaluate(() => { const g = document.querySelector('#fx_s g.sum[data-block="nd_capu"]'); return g ? { st: g.getAttribute('data-state'), lines: [...g.querySelectorAll('[data-part=sum-line]')].map(l => l.textContent) } : null; });
    if (s && s.st === 'done') break; await o.page.waitForTimeout(50);
  }
  return s;
}
(async () => {
  browser = await chromium.launch(); let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const cases = [
    ['a decision, việc done B 72h', [T('T-901')], [{ task: 'T-901', kind: 'decision', decide_by: '2026-11-10', links: [DRL('T-901-x.md')] }], null],
    ['b blocked "Chờ Capu"', [T('T-902', { state: 'blocked', owner: 'product', tier: 'A' })], [{ task: 'T-902', kind: 'blocked', decide_by: '', links: [{ label: 'Decision Request', url: `${GH}tohong-hq/tree/main/inbox/capu`, pr_state: '' }] }], null],
    ['c diff-b có PR chưa merged, việc done B 72h', [T('T-903')], [{ task: 'T-903', kind: 'diff-b', decide_by: '', links: [{ label: 'PR tohong-front#99', url: `${GH}tohong-front/pull/99`, pr_state: 'open' }] }], null],
    ['d bộ lọc planner, việc escalated thuộc hq', [T('T-904', { state: 'escalated', h: 2 }), T('T-905', { state: 'doing', product: 'planner', area: 'planner/front' })], [{ task: 'T-904', kind: 'escalated', decide_by: '2026-11-10', links: [DRL('T-904-x.md')] }], 'planner'],
  ];
  for (const [name, tasks, queue, filter] of cases) {
    const o = await open(dash(tasks, queue), filter);
    try {
      const n = await o.page.$eval('#nd_capu .n', e => e.textContent.trim()), lit = await litOf(o), s = await sumOfCapu(o);
      const line = s && s.lines[0];
      ok(!(lit && line === 'Đang rảnh'), `${name}: khối Capu số ${n}, sáng=${lit}, tóm tắt nhân vật "${line}" (INV-023: sáng thì không "Đang rảnh")`);
      if (filter) { ok(n === '0', `${name}: số trên khối Capu khi lọc ${filter} = ${n} (quyết định T-041 mục 1: lọc theo sản phẩm; spec T-076 v5 U1a)`);
        ok(lit === false && line === 'Đang rảnh', `${name}: khối tắt và tóm tắt "Đang rảnh" (spec v5 U1a/U11), thấy sáng=${lit}, "${line}"`); }
      ok(!o.errors.length, `${name}: không lỗi trang ${o.errors.join(' | ')}`);
    } finally { await o.ctx.close(); }
  }
  await browser.close();
  console.log(fails ? `FAIL ${fails} ý không đạt` : 'PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL ' + e); process.exit(1); });
