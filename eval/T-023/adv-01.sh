#!/usr/bin/env bash
# Eval đối kháng T-023 (adversary). Chạy trong repo tohong-hq-dashboard (gate.py --cwd <repo dashboard>).
# Cần D3=/đường/dẫn/d3.min.js (CDN bị chặn trong sandbox). Mã thoát 0 = đạt.
#   S1 dashboard.json thiếu khóa model, việc tier rỗng, state lạ, owner ngoài product/engineering → không lỗi console, bể hiện 0
#   S2 390px với 40 việc đang code → không tràn ngang
#   S3 hai dot cùng chạm Code Gate (2 việc), một dot đi ra → Code Gate VẪN giữ màu (còn 1 việc trong cổng)   [tiêu chí 2]
#   S4 dot chạm Code Gate, không có dot đi ra trong 95 giây → Code Gate VẪN giữ màu                         [tiêu chí 2]
#   S5 sự kiện rejected không có state, accepted của việc tier rỗng → không lỗi console
set -e
: "${D3:=/opt/npm-tools/node_modules/d3/dist/d3.min.js}"
export D3
node - <<'EOF'
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const D3 = process.env.D3, INDEX = path.resolve(process.cwd(), 'index.html');
const base = { id: 'T-001', title: 'Việc thử', state: 'doing', holder: 'engineering', owner: 'engineering', reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0, created: '2026-10-30T09:00', updated: '2026-10-31T09:00', hours_since_update: 2, tier: 'A', area: 'front/budget', evals: 2, spec_returns: 0, evals_added: 0 };
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const model = { invariants: { 'hq/dashboard': 1 }, invariants_total: 1, adversarial_evals: 0, regression_evals: 0, insight_reports: 0, last_insight: '', specs: 1 };
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
async function open(browser, data, vp) {
  const page = await browser.newPage({ viewport: vp || { width: 1200, height: 1500 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  let sock; await page.routeWebSocket(/\/ws$/, ws => { sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForTimeout(1500);
  const send = o => sock.send(JSON.stringify({ type: 'event', t: '2026-10-31T10:05', received: Date.now(), ...o }));
  const busy = sel => page.$eval(sel, e => e.classList.contains('busy'));
  return { page, errors, send, busy };
}
const data = (tasks, withModel = true) => ({ generated_at: '2026-10-31T10:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster, ...(withModel ? { model } : {}) });
(async () => {
  const browser = await chromium.launch();
  // S1
  {
    const tasks = [{ ...base, tier: '', area: '' }, { ...base, id: 'T-002', state: 'trang-thai-la' }, { ...base, id: 'T-003', owner: 'insight', state: 'doing' }, { ...base, id: 'T-004', state: 'done', tier: '' }];
    const { page, errors } = await open(browser, data(tasks, false));
    ok((await page.$eval('#krTxt', e => e.textContent)).startsWith('0 bất biến'), 'S1: thiếu model → bể 0');
    ok((await page.$eval('#nd_exec .n', e => e.textContent)) === '1', 'S1: Agent code đếm 1 (state lạ, owner insight không bị đếm)');
    ok(errors.length === 0, 'S1: không lỗi console (' + errors.join('; ') + ')');
    await page.close();
  }
  // S2
  {
    const tasks = Array.from({ length: 40 }, (_, i) => ({ ...base, id: 'T-' + String(100 + i) }));
    const { page, errors } = await open(browser, data(tasks), { width: 390, height: 900 });
    ok(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'S2: 390px, 40 việc, không tràn ngang');
    ok(errors.length === 0, 'S2: không lỗi console (' + errors.join('; ') + ')');
    await page.close();
  }
  // S3 + S5
  {
    const tasks = [{ ...base }, { ...base, id: 'T-002' }, { ...base, id: 'T-003', tier: '' }];
    const { page, errors, send, busy } = await open(browser, data(tasks));
    send({ id: 'E-1', event: 'handoff', from: 'engineering', to: 'adversary', task: 'T-001', state: 'review', holder: 'adversary' });
    send({ id: 'E-2', event: 'handoff', from: 'engineering', to: 'adversary', task: 'T-002', state: 'review', holder: 'adversary' });
    await page.waitForTimeout(2200);
    ok(await busy('#gt_code'), 'S3: Code Gate lên màu khi 2 dot chạm');
    send({ id: 'E-3', event: 'rejected', from: 'adversary', to: 'engineering', task: 'T-001', state: 'rework', holder: 'engineering', severity: 'blocker' });
    await page.waitForTimeout(600);
    ok(await busy('#gt_code'), 'S3: một dot đi ra, còn T-002 trong cổng → Code Gate vẫn giữ màu');
    send({ id: 'E-4', event: 'rejected', from: 'adversary', to: 'engineering', task: 'T-002', severity: 'minor' });
    send({ id: 'E-5', event: 'accepted', from: 'adversary', to: 'chief-of-staff', task: 'T-003', state: 'done', holder: '-' });
    await page.waitForTimeout(2500);
    ok(errors.length === 0, 'S5: rejected không state, accepted tier rỗng → không lỗi console (' + errors.join('; ') + ')');
    await page.close();
  }
  // S4: một việc vào Code Gate rồi nằm đó
  {
    const { page, send, busy } = await open(browser, data([{ ...base }]));
    send({ id: 'E-1', event: 'handoff', from: 'engineering', to: 'adversary', task: 'T-001', state: 'review', holder: 'adversary' });
    await page.waitForTimeout(2200);
    ok(await busy('#gt_code'), 'S4: Code Gate lên màu khi dot chạm');
    await page.waitForTimeout(95000);
    ok(await busy('#gt_code'), 'S4: T-001 chưa ra khỏi Code Gate sau 95 giây → vẫn giữ màu');
    await page.close();
  }
  await browser.close();
  console.log(fails ? `${fails} FAIL` : 'Tất cả PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
EOF
