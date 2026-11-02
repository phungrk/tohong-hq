#!/usr/bin/env bash
# Eval đối kháng T-042 (adversary, 2026-11-02, Code Gate lần 2). Spec products/T-041-loc-san-pham.md: Định nghĩa (việc chỉ đến qua live là ""; việc đã có giữ product khi live đổi trạng thái),
# H1 (Dòng thời gian về mặc định của tập), H2 (nguyên tắc một con số; dot; hoạt động live), INV-P1 (Tất cả luôn đủ).
# Input: tập lọc planner RỖNG (dashboard.json chỉ có việc hq), rồi kênh live gửi: (1) sự kiện có state cho việc mới T-999 chưa có trong dashboard.json,
# (2) sự kiện có state cho việc hq T-201, (3) sự kiện không có task, (4) hoạt động có task T-201 và hoạt động không có task.
# Mong đợi: ở planner, bảng, KPI, Cảnh báo, Dòng thời gian (#tl-title, #tl-sub, #timeline), Feed, #activity giống hệt "Tất cả" trên dữ liệu rỗng; không dot; không lỗi trang.
# Rồi chọn "Tất cả": T-999 (chỉ có qua live) và T-201 có thẻ trên bảng; quay lại planner: lại giống dữ liệu rỗng.
# Chạy: bash eval/T-042/adv-03-tap-rong-roi-co-viec-live.sh   (repo = $TOHONG_DASHBOARD_REPO). Cần Playwright và d3 cục bộ (D3).
set -u
REPO="${TOHONG_DASHBOARD_REPO:-}"
[ -z "$REPO" ] && { [ -f "$PWD/index.html" ] && REPO="$PWD" || REPO=/home/claude/tohong-hq-dashboard; }
[ -f "$REPO/index.html" ] || { echo "FAIL không thấy index.html trong $REPO (đặt TOHONG_DASHBOARD_REPO)"; exit 1; }
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
export D3="${D3:-/opt/npm-tools/node_modules/d3/dist/d3.min.js}"
export ADV_REPO="$REPO"
exec node - <<'EOF'
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const INDEX = path.join(process.env.ADV_REPO, 'index.html'), D3 = process.env.D3;
if (!fs.existsSync(D3)) { console.log('FAIL thiếu d3.min.js cục bộ (D3)'); process.exit(1); }
const stamp = h => new Date(Date.now() + 7 * 3600e3 - h * 3600e3).toISOString().slice(0, 16);
const T = (id, state, owner, product, h = 2) => ({ id, title: 'Việc ' + id, state, holder: owner, owner, reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-10-30T09:00', updated: stamp(h), hours_since_update: h, tier: 'A', area: product + '/dashboard', product, evals: 1, spec_returns: 0, evals_added: 0 });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const EV = (i, task, event, from, to) => ({ seq: 'S-' + i, ledger_id: 'E-' + i, t: '2026-10-31T10:0' + i, task, title: '', event, from, to, round: 0, severity: '', detail: '', link: '', cost: 0, state: '', holder: '' });
const dash = (tasks, events) => ({ generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events, roster,
  model: { invariants: { _shared: 2, 'hq/dashboard': 3 }, invariants_total: 5, adversarial_evals: 0, regression_evals: 0, insight_reports: 0, last_insight: '', specs: 1 } });
const HQ_ONLY = dash([T('T-201', 'doing', 'engineering', 'hq'), T('T-202', 'review', 'engineering', 'hq', 5)], [EV(1, 'T-201', 'assigned', 'chief-of-staff', 'engineering'), EV(2, 'T-202', 'handoff', 'engineering', 'adversary')]);
let browser;
async function open(data, init) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' }); const page = await ctx.newPage(); const o = { ctx, page, errors: [], sock: null };
  page.on('pageerror', e => o.errors.push(String(e)));
  if (init) await page.addInitScript(init);
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  await page.routeWebSocket(/\/ws$/, ws => { o.sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  o.send = m => o.sock.send(JSON.stringify(m));
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1300); return o;
}
const snap = o => o.page.evaluate(() => {
  const txt = s => { const e = document.querySelector(s); return e ? e.textContent.trim().replace(/\s+/g, ' ') : null; };
  const nh = x => x == null ? x : x.replace(/\d+(\.\d)? giờ/g, '# giờ').replace(/\b\d+\.\d\b/g, '#').replace(/\d+ (giây|phút) trước/g, '# trước');
  const out = { cards: [...document.querySelectorAll('#board .tcard')].map(k => nh(k.textContent.trim().replace(/\s+/g, ' '))).sort() };
  for (const s of ['#k-wip', '#k-capu', '#k-stuck', '#k-done', '#k-fpy', '#alerts tbody', '#tl-title', '#tl-sub', '#timeline tbody', '#feed tbody', '#activity', '#flow-live']) out[s] = nh(txt(s));
  return out;
});
const dotsFor = (o, ms) => o.page.evaluate(ms => new Promise(res => { let n = 0; const t0 = performance.now();
  const tick = () => { n = Math.max(n, document.querySelectorAll('#fx_f circle').length); if (performance.now() - t0 < ms) setTimeout(tick, 40); else res(n); }; tick(); }), ms);
const diff = (a, b) => Object.keys(b).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map(k => `${k}: thấy ${JSON.stringify(a[k])}, phải ${JSON.stringify(b[k])}`);
(async () => {
  browser = await chromium.launch(); const bad = [];
  const ref = await open(dash([], [])); const want = await snap(ref); await ref.ctx.close();
  for (const how of ['localStorage', 'select']) {
    const tag = `planner rỗng (${how})`;
    const o = await open(HQ_ONLY, how === 'localStorage' ? `try{localStorage.setItem('tohong.productFilter','planner')}catch(e){}` : null);
    if (!(await o.page.$('#product-filter'))) { console.log('FAIL không có select#product-filter'); process.exit(1); }
    if (how === 'select') { await o.page.selectOption('#product-filter', 'planner'); await o.page.waitForTimeout(500); }
    if (!o.sock) { bad.push(tag + ': kênh live giả không kết nối'); await o.ctx.close(); continue; }
    const t = stamp(0);
    o.send({ type: 'event', id: 'E-991', t, task: 'T-999', title: 'Việc chỉ có qua live', event: 'assigned', from: 'chief-of-staff', to: 'engineering', round: 0, severity: '', cost: 0, state: 'doing', holder: 'engineering', owner: 'engineering', reviewer: 'adversary' });
    o.send({ type: 'event', id: 'E-992', t, task: 'T-201', title: '', event: 'handoff', from: 'engineering', to: 'adversary', round: 0, severity: '', cost: 0, state: 'review', holder: 'adversary' });
    o.send({ type: 'event', id: 'E-993', t, task: '', title: '', event: 'board_edited_directly', from: 'engineering', to: '', round: 0, severity: '', cost: 0 });
    o.send({ type: 'activity', agent: 'engineering', action: 'Viết code', task: 'T-201', at: Date.now() });
    o.send({ type: 'activity', agent: 'insight', action: 'Đọc dữ liệu', at: Date.now() });
    const dots = await dotsFor(o, 2500);
    const got = await snap(o);
    diff(got, want).forEach(d => bad.push(`${tag}, sau live: phải giống "Tất cả" trên dữ liệu rỗng; ${d}`));
    if (dots > 0) bad.push(`${tag}: live của việc không thuộc planner không được chạy dot, thấy ${dots}`);
    if (JSON.stringify(got).match(/T-20\d|T-999/)) bad.push(`${tag}: còn hiện việc ngoài planner`);
    await o.page.selectOption('#product-filter', 'all'); await o.page.waitForTimeout(500);
    const all = await snap(o); const ids = all.cards.map(c => (/T-\d+/.exec(c) || [''])[0]);
    for (const id of ['T-201', 'T-202', 'T-999']) if (!ids.includes(id)) bad.push(`${tag}, chọn lại Tất cả: thiếu thẻ ${id} (INV-P1 Tất cả luôn đủ, kể cả việc chỉ có qua live)`);
    if (!/T-\d+/.test(all['#tl-title'] || '')) bad.push(`${tag}, chọn lại Tất cả: Dòng thời gian phải về một việc mặc định, thấy ${all['#tl-title']}`);
    await o.page.selectOption('#product-filter', 'planner'); await o.page.waitForTimeout(500);
    diff(await snap(o), want).forEach(d => bad.push(`${tag}, Tất cả rồi quay lại planner: ${d}`));
    if (o.errors.length) bad.push(`${tag}: lỗi trang ${o.errors[0]}`);
    await o.ctx.close();
  }
  await browser.close();
  if (bad.length) { bad.forEach(b => console.log('FAIL ' + b)); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
EOF
