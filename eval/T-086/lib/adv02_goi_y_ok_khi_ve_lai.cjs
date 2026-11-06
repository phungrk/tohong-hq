// T-086 adv-02 (adversary, Code Gate v1, 2026-11-06). Spec T-081 D-I5, D-I6, D-I9 + Q1.
// Input: modal đang mở rồi trang vẽ lại do kênh live: (a) sự kiện không đổi dòng (gợi ý không nhân đôi),
// (b) T-80 đang `decision` có Issue trong queue chuyển `escalated` qua live (dòng thành escalated, links lấy từ queue có Issue → có gợi ý),
// (c) T-72 escalated có Issue chuyển `done` qua live (dòng biến mất cùng gợi ý), (d) T-79 escalated mới chỉ có ở live, chưa có trong queue (không link issue, không gợi ý).
// Mong đợi: mỗi dòng escalated có link issue có đúng 1 [data-capu-ok-hint], mọi dòng khác 0; số trên khối = số dòng.
// Chạy: bash eval/T-086/adv-02-goi-y-ok-khi-ve-lai.sh (cần NODE_PATH, D3, TOHONG_DASHBOARD_REPO tuỳ chọn)
const L = require('../../T-076/lib.cjs'); const { T, Q, link, dash, DR, DR_DIR } = L; const R = L.reporter();
const IS = n => `https://github.com/phungrk/tohong-hq/issues/${n}`, IL = n => link('Issue #' + n, IS(n));
const tasks = [T('T-72', { state: 'escalated', owner: 'product', title: 'Leo thang có issue' }), T('T-73', { state: 'escalated', owner: 'product', title: 'Leo thang có issue 2' }),
  T('T-80', { state: 'blocked', owner: 'engineering', title: 'Quyết định có issue' })];
const queue = [Q('T-72', 'escalated', [link('Decision Request', DR('T-72-a.md')), IL(16)]), Q('T-73', 'escalated', [link('Decision Request', DR_DIR), IL(17)]),
  Q('T-80', 'decision', [link('Decision Request', DR('T-80-b.md')), IL(30)])];
const evt = (id, task, state, owner) => JSON.stringify({ type: 'event', id, t: L.stamp(0), task, title: 'Việc ' + task, event: state === 'escalated' ? 'escalated' : 'note', from: 'chief-of-staff', to: 'chief-of-staff', state, holder: 'chief-of-staff', owner, round: 0, severity: '', cost: 0 });
const snap = async o => o.page.$$eval('#capu-modal [data-capu-row]', rs => rs.map(r => ({ task: r.getAttribute('data-task'), kind: r.getAttribute('data-kind'),
  hint: r.querySelectorAll('[data-capu-ok-hint]').length, iss: r.querySelectorAll('a[href*="/issues/"]').length })));
const check = async (o, name, expect) => {
  const s = await snap(o); const by = Object.fromEntries(s.map(r => [r.task, r]));
  R.ok(JSON.stringify(Object.keys(by).sort()) === JSON.stringify(Object.keys(expect).sort()), name + ': tập dòng ' + Object.keys(expect).sort() + ', thấy ' + Object.keys(by).sort());
  for (const [t, [kind, hint, iss]] of Object.entries(expect)) { const r = by[t] || {}; R.ok(r.kind === kind && r.hint === hint && r.iss === iss, `${name}: ${t} kind=${kind} gợi ý=${hint} link issue=${iss}; thấy ${JSON.stringify(r)}`); }
  R.ok(s.every(r => r.hint === ((r.kind === 'escalated' && r.iss > 0) ? 1 : 0)), name + ': gợi ý đúng 1 ở escalated có issue, 0 ở dòng khác');
  const n = await L.nodeCount(o); R.ok(String(s.length) === n, name + ': số trên khối (' + n + ') = số dòng (' + s.length + ')');
};
(async () => {
  await L.start();
  const o = await L.open(dash(tasks, queue), { width: 1280, height: 900 }); await L.clickNode(o);
  R.ok(await L.modalOpen(o), 'modal mở');
  await check(o, 'ban đầu', { 'T-72': ['escalated', 1, 1], 'T-73': ['escalated', 1, 1], 'T-80': ['decision', 0, 1] });
  o.sock.send(evt('E-9801', 'T-73', 'escalated', 'product')); await o.page.waitForTimeout(500);
  await check(o, '(a) live không đổi dòng', { 'T-72': ['escalated', 1, 1], 'T-73': ['escalated', 1, 1], 'T-80': ['decision', 0, 1] });
  o.sock.send(evt('E-9802', 'T-80', 'escalated', 'engineering')); await o.page.waitForTimeout(500);
  await check(o, '(b) decision có issue lên escalated', { 'T-72': ['escalated', 1, 1], 'T-73': ['escalated', 1, 1], 'T-80': ['escalated', 1, 1] });
  o.sock.send(evt('E-9803', 'T-72', 'done', 'product')); await o.page.waitForTimeout(500);
  await check(o, '(c) escalated có issue sang done', { 'T-73': ['escalated', 1, 1], 'T-80': ['escalated', 1, 1] });
  o.sock.send(evt('E-9804', 'T-79', 'escalated', 'product')); await o.page.waitForTimeout(500);
  await check(o, '(d) escalated mới chỉ có ở live', { 'T-73': ['escalated', 1, 1], 'T-80': ['escalated', 1, 1], 'T-79': ['escalated', 0, 0] });
  R.ok(await L.modalOpen(o), 'modal vẫn mở sau các lần vẽ lại');
  R.ok(!o.errors.length, 'không lỗi trang: ' + o.errors.join('|'));
  await o.ctx.close(); await L.close(); process.exit(R.done());
})().catch(e => { console.log('FAIL ngoại lệ ' + e.message); process.exit(1); });
