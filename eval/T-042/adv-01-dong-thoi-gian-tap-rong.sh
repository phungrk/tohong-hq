#!/usr/bin/env bash
# Eval đối kháng T-042 (adversary, 2026-11-02). Spec products/T-041-loc-san-pham.md H1 (Dòng thời gian về việc mặc định của tập mới) và H2 (#tl-sub được lọc; nguyên tắc một con số).
# Input phá: chọn một sản phẩm KHÔNG có việc nào (ví dụ dashboard.json chỉ có việc hq, chọn planner).
# Mong đợi: #tl-title, #tl-sub, #timeline giống hệt trang "Tất cả" trên dữ liệu rỗng (tập lọc của planner), tức không còn tên/ID việc của sản phẩm khác.
# Thấy ở PR #15 (1b658f0): #tl-title về "Dòng thời gian việc" nhưng #tl-sub vẫn giữ "Việc T-202 · engineering → adversary" của hq.
# Hai ca: (a) để Dòng thời gian tự chọn việc mặc định, (b) bấm thẻ một việc hq rồi đổi sang planner.
# Chạy: bash eval/T-042/adv-01-dong-thoi-gian-tap-rong.sh   (repo = $TOHONG_DASHBOARD_REPO, hoặc cwd nếu có index.html). Cần Playwright và d3 cục bộ (D3).
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
const HQ_ONLY = dash([T('T-201', 'doing', 'engineering', 'hq'), T('T-202', 'blocked', 'engineering', 'hq', 30)], [EV(1, 'T-201', 'assigned', 'chief-of-staff', 'engineering'), EV(2, 'T-202', 'assigned', 'chief-of-staff', 'engineering')]);
let browser;
async function open(data) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); const o = { ctx, page, errors: [] };
  page.on('pageerror', e => o.errors.push(String(e)));
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  await page.routeWebSocket(/\/ws$/, ws => ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })));
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1300); return o;
}
const tl = o => o.page.evaluate(() => ['tl-title', 'tl-sub', 'timeline'].map(id => { const e = document.getElementById(id); return e ? e.textContent.trim().replace(/\s+/g, ' ') : null; }));
(async () => {
  browser = await chromium.launch(); const bad = [];
  const ref = await open(dash([], [])); const want = await tl(ref); await ref.ctx.close();
  for (const [label, clickFirst] of [['Dòng thời gian tự chọn việc mặc định', null], ['đã bấm thẻ T-201', 'T-201']]) {
    const o = await open(HQ_ONLY);
    if (!(await o.page.$('#product-filter'))) { console.log('FAIL không có select#product-filter'); process.exit(1); }
    if (clickFirst) { await o.page.locator('#board .tcard', { hasText: clickFirst }).first().click(); await o.page.waitForTimeout(400); }
    await o.page.selectOption('#product-filter', 'planner'); await o.page.waitForTimeout(500);
    const got = await tl(o);
    if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${label}, chọn planner (không có việc nào): Dòng thời gian phải giống "Tất cả" trên dữ liệu rỗng ${JSON.stringify(want)}, thấy ${JSON.stringify(got)}`);
    if (got.join(' ').match(/T-20\d/)) bad.push(`${label}, chọn planner: Dòng thời gian còn hiện việc của hq (${got.join(' | ')})`);
    if (o.errors.length) bad.push(`${label}: lỗi trang ${o.errors[0]}`);
    await o.ctx.close();
  }
  await browser.close();
  if (bad.length) { bad.forEach(b => console.log('FAIL ' + b)); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
EOF
