#!/usr/bin/env bash
# Eval đối kháng T-023 lần 2 (adversary). Chạy trong repo tohong-hq-dashboard (gate.py --cwd <repo dashboard>).
# Cần D3=/đường/dẫn/d3.min.js. Mã thoát 0 = đạt. Tất cả về tiêu chí 2: "khối giữ màu từ lúc dot chạm tới lúc dot đi ra".
#   S6 một việc: assigned→product rồi handoff từ product → dot đã rời Spec Writer → Spec Writer HẾT màu, Spec Gate có màu
#      (hiện: assigned bắn 2 dot vào nd_spec, handoff chỉ 1 dot ra → BUSY còn 1)
#   S7 một việc: accepted của spec-critic, assigned→engineering, handoff từ engineering → dot đã rời Agent code → Agent code HẾT màu
#      (hiện: 2 dot p_gate_exec vào nd_exec, 1 dot ra)
#   S8 sự kiện live cho việc KHÔNG có trong tasks (handoff engineering) → Code Gate lên màu; sau một nhịp render (≤20s),
#      sổ cái nói cổng trống → hết màu (không kẹt sáng mãi)
#   S9 insight_reports tăng giữa hai lần tải → 3 dot vào Insight, 2 dot ra; sau khi mọi dot đã chạy xong và thêm một nhịp
#      render → Insight HẾT màu (hiện: không có clearIdle cho nd_insight, BUSY kẹt 1 tới khi tải lại trang)
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
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(typeof data === 'function' ? data() : data) }));
  let sock; await page.routeWebSocket(/\/ws$/, ws => { sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForTimeout(1500);
  const send = o => sock.send(JSON.stringify({ type: 'event', t: '2026-10-31T10:05', received: Date.now(), ...o }));
  const busy = sel => page.$eval(sel, e => e.classList.contains('busy'));
  return { page, errors, send, busy };
}
const data = (tasks, withModel = true) => ({ generated_at: '2026-10-31T10:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster, ...(withModel ? { model } : {}) });
(async () => {
  const browser = await chromium.launch();
  // S6
  {
    const { page, errors, send, busy } = await open(browser, data([{ ...base, id: 'T-010', owner: 'product', holder: 'product', state: 'new' }]));
    send({ id: 'E-1', event: 'assigned', from: 'chief-of-staff', to: 'product', task: 'T-010', state: 'doing', holder: 'product' });
    await page.waitForTimeout(2500);
    ok(await busy('#nd_spec'), 'S6: Spec Writer lên màu khi dot assigned chạm');
    send({ id: 'E-2', event: 'handoff', from: 'product', to: 'spec-critic', task: 'T-010', state: 'review', holder: 'spec-critic' });
    await page.waitForTimeout(2500);
    ok(await busy('#gt_spec'), 'S6: Spec Gate lên màu khi dot handoff chạm');
    ok(!(await busy('#nd_spec')), 'S6: dot đã rời Spec Writer, không còn việc nào ở đó → Spec Writer hết màu');
    ok(errors.length === 0, 'S6: không lỗi console (' + errors.join('; ') + ')');
    await page.close();
  }
  // S7
  {
    const { page, send, busy } = await open(browser, data([{ ...base, id: 'T-011', owner: 'engineering', holder: 'spec-critic', state: 'review' }]));
    send({ id: 'E-1', event: 'accepted', from: 'spec-critic', to: 'chief-of-staff', task: 'T-011', state: 'new', holder: 'chief-of-staff' });
    await page.waitForTimeout(300);
    send({ id: 'E-2', event: 'assigned', from: 'chief-of-staff', to: 'engineering', task: 'T-011', state: 'doing', holder: 'engineering' });
    await page.waitForTimeout(2500);
    ok(await busy('#nd_exec'), 'S7: Agent code lên màu khi dot chạm');
    send({ id: 'E-3', event: 'handoff', from: 'engineering', to: 'adversary', task: 'T-011', state: 'review', holder: 'adversary' });
    await page.waitForTimeout(2500);
    ok(await busy('#gt_code'), 'S7: Code Gate lên màu');
    ok(!(await busy('#nd_exec')), 'S7: dot đã rời Agent code, không còn việc nào ở đó → Agent code hết màu');
    await page.close();
  }
  // S8
  {
    const { page, errors, send, busy } = await open(browser, data([{ ...base, id: 'T-001', state: 'done' }]));
    send({ id: 'E-1', event: 'handoff', from: 'engineering', to: 'adversary', task: 'T-999', state: 'review', holder: 'adversary' });
    await page.waitForTimeout(2500);
    ok(await busy('#gt_code'), 'S8: việc lạ T-999 → Code Gate lên màu khi dot chạm');
    await page.waitForTimeout(20000);
    ok(!(await busy('#gt_code')), 'S8: sau một nhịp render, sổ cái nói Code Gate trống → hết màu (không kẹt)');
    ok(errors.length === 0, 'S8: không lỗi console (' + errors.join('; ') + ')');
    await page.close();
  }
  // S9
  {
    let n = 0; const dyn = () => { n++; return { ...data([{ ...base, state: 'done' }]), model: { ...model, insight_reports: n > 1 ? 1 : 0 } }; };
    const { page, errors, busy } = await open(browser, dyn);
    await page.waitForTimeout(62000);           // load() lần 2 sau 60s: insight_reports 0 → 1
    await page.waitForTimeout(1000);
    ok(n >= 2, 'S9: dashboard.json được tải lại (' + n + ' lần)');
    ok(await busy('#nd_insight'), 'S9: Insight lên màu khi dot nguồn chạm');
    await page.waitForTimeout(19000);           // mọi dot đã chạy xong + một nhịp render 15s
    ok(!(await busy('#nd_insight')), 'S9: mọi dot đã ra khỏi Insight, không việc nào ở đó → Insight hết màu');
    ok(errors.length === 0, 'S9: không lỗi console (' + errors.join('; ') + ')');
    await page.close();
  }
  await browser.close();
  console.log(fails ? `${fails} FAIL` : 'Tất cả PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
EOF
