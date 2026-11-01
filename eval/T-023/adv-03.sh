#!/usr/bin/env bash
# Eval đối kháng T-023 (adversary), lần 3. Chạy trong repo tohong-hq-dashboard (gate.py --cwd <repo dashboard>).
# Cần D3=/đường/dẫn/d3.min.js (CDN bị chặn trong sandbox). Mã thoát 0 = đạt.
#   S10 hai việc vào Code Gate, evalplus cho T-001 → Code Gate VẪN giữ màu (T-002 còn trong cổng)   [tiêu chí 2]
#       (evalplus bắn 2 dot cùng rời gt_code: p_gate_kr2 + p_gate_rework, cả hai đều trừ bộ đếm)
#   S11 hai việc vào Spec Gate, spec-critic accepted T-001 → Spec Gate VẪN giữ màu (T-002 còn trong cổng) [tiêu chí 2]
#       (accepted spec gate bắn 2 dot cùng rời gt_spec: p_gate_kr + p_gate_exec)
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
async function open(browser, data) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1500 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  let sock; await page.routeWebSocket(/\/ws$/, ws => { sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForTimeout(1500);
  const send = o => sock.send(JSON.stringify({ type: 'event', t: '2026-10-31T10:05', received: Date.now(), ...o }));
  const busy = sel => page.$eval(sel, e => e.classList.contains('busy'));
  return { page, errors, send, busy };
}
const data = tasks => ({ generated_at: '2026-10-31T10:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster, model });
(async () => {
  const browser = await chromium.launch();
  // S10
  {
    const { page, errors, send, busy } = await open(browser, data([{ ...base }, { ...base, id: 'T-002' }]));
    send({ id: 'E-1', event: 'handoff', from: 'engineering', to: 'adversary', task: 'T-001', state: 'review', holder: 'adversary' });
    send({ id: 'E-2', event: 'handoff', from: 'engineering', to: 'adversary', task: 'T-002', state: 'review', holder: 'adversary' });
    await page.waitForTimeout(2200);
    ok(await busy('#gt_code'), 'S10: Code Gate lên màu khi 2 dot chạm');
    send({ id: 'E-3', event: 'evalplus', from: 'adversary', to: 'engineering', task: 'T-001', state: 'doing', holder: 'engineering', round: 0 });
    await page.waitForTimeout(2500);
    ok(await busy('#gt_code'), 'S10: evalplus T-001 đã ra, T-002 còn trong Code Gate → Code Gate vẫn giữ màu');
    ok(errors.length === 0, 'S10: không lỗi console (' + errors.join('; ') + ')');
    await page.close();
  }
  // S11
  {
    const sp = { ...base, owner: 'product', holder: 'product', reviewer: 'spec-critic' };
    const { page, errors, send, busy } = await open(browser, data([{ ...sp }, { ...sp, id: 'T-002' }]));
    send({ id: 'E-1', event: 'handoff', from: 'product', to: 'spec-critic', task: 'T-001', state: 'review', holder: 'spec-critic' });
    send({ id: 'E-2', event: 'handoff', from: 'product', to: 'spec-critic', task: 'T-002', state: 'review', holder: 'spec-critic' });
    await page.waitForTimeout(3500);
    ok(await busy('#gt_spec'), 'S11: Spec Gate lên màu khi 2 dot chạm');
    send({ id: 'E-3', event: 'accepted', from: 'spec-critic', to: 'chief-of-staff', task: 'T-001', state: 'done', holder: '-' });
    await page.waitForTimeout(2500);
    ok(await busy('#gt_spec'), 'S11: T-001 qua Spec Gate, T-002 còn trong cổng → Spec Gate vẫn giữ màu');
    ok(errors.length === 0, 'S11: không lỗi console (' + errors.join('; ') + ')');
    await page.close();
  }
  await browser.close();
  console.log(fails ? `${fails} FAIL` : 'Tất cả PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
EOF
