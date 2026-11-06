// T-076 tiêu chí 1: chạm/bấm khối Capu mở modal; số dòng = số trên khối; thứ tự; gộp trùng theo mã việc. Chạy: cd /home/user/tohong-hq && node eval/T-076/check_1_mo_modal_so_khop.cjs
const L = require('./lib.cjs'); const { T, Q, link, dash, pr, DR } = L; const R = L.reporter();
const tasks = [T('T-72', { state: 'escalated', owner: 'product', tier: 'B' }), T('T-74', { state: 'escalated', owner: 'product', tier: 'A' }),
  T('T-60', { tier: 'B' }), T('T-61', { tier: 'C' }), T('T-62', { tier: 'A' }), T('T-63', { tier: 'B' }),
  T('T-70', { tier: 'C' }), T('T-16', { state: 'blocked', owner: 'engineering', tier: 'B' }), T('T-64', { tier: 'B' })];
const queue = [Q('T-72', 'escalated', [link('Decision Request', DR('T-72-x.md'))], '2026-11-10'), Q('T-74', 'escalated', [link('Decision Request', DR('T-74-x.md'))], '2026-11-10'),
  Q('T-70', 'decision', [link('Decision Request', DR('T-70-x.md'))], '2026-11-10'), Q('T-16', 'blocked', [link('Decision Request', DR('T-16-x.md'))], '2026-10-31'),
  Q('T-60', 'diff-b', [link('PR tohong-front#59', pr('tohong-front', 59), 'open')]), Q('T-61', 'merge-c', [link('PR tohong-back#37', pr('tohong-back', 37), 'open')]),
  Q('T-64', 'decision', [link('Decision Request', DR('T-64-x.md')), link('PR tohong-back#40', pr('tohong-back', 40), 'open')], '2026-11-11')];
(async () => {
  await L.start();
  for (const [name, vp, touch] of [['desktop', { width: 1280, height: 900 }, false], ['iphone390', { width: 390, height: 844 }, true]]) {
    const o = await L.open(dash(tasks, queue), vp, { touch });
    R.ok(!(await L.modalOpen(o)), name + ': chưa bấm thì modal không hiện');
    R.ok(await L.nodeCount(o) === '7', name + ': số trên khối Capu = 7 (2 leo thang, 3 quyết/chặn, 1 bậc C, 1 bậc B; T-62 bậc A và T-63 không có PR mở không đếm; T-64 có DR và PR mở chỉ một dòng), thấy ' + await L.nodeCount(o));
    await L.clickNode(o);
    R.ok(await L.modalOpen(o), name + ': bấm số trên khối Capu thì modal hiện');
    const rs = await L.rows(o);
    R.ok(rs.length === Number(await L.nodeCount(o)) && rs.length === 7, name + ': số dòng = số trên khối (' + rs.length + ')');
    R.ok(rs.map(r => r.task).join() === 'T-72,T-74,T-64,T-70,T-16,T-61,T-60', name + ': thứ tự escalated, quyết, bị chặn, bậc C, bậc B; trong nhóm theo số việc: T-64 và T-70 cùng nhóm "decision" theo số tăng dần phải là T-64,T-70; thấy ' + rs.map(r => r.task).join());
    R.ok(rs.filter(r => r.task === 'T-64').length === 1, name + ': một việc có cả Decision Request và PR mở chỉ một dòng');
    R.ok(await o.page.locator('#capu-modal').count() > 0 && await o.page.locator('#capu-modal').getAttribute('role') === 'dialog' && await o.page.locator('#capu-modal').getAttribute('aria-modal') === 'true', name + ': #capu-modal có role=dialog và aria-modal=true');
    R.ok(!o.errors.length, name + ': không lỗi trang ' + o.errors.join(';')); await o.ctx.close();
  }
  // Dữ liệu cũ chưa có capu_queue: vẫn mở được, số dòng vẫn khớp số trên khối (luật cũ: leo thang + bậc B/C xong < 48h)
  const o = await L.open(dash([T('T-1', { state: 'escalated', owner: 'product' }), T('T-2', { tier: 'B', h: 5 }), T('T-3', { tier: 'B', h: 60 })]));
  await L.clickNode(o); const rs = await L.rows(o);
  R.ok(rs.length === Number(await L.nodeCount(o)) && rs.length === 2, 'thiếu capu_queue: số dòng = số trên khối = 2 (luật cũ), thấy ' + rs.length + '/' + await L.nodeCount(o));
  await o.ctx.close(); await L.close(); process.exit(R.done());
})().catch(e => { console.log('FAIL ngoại lệ ' + e.message); process.exit(1); });
