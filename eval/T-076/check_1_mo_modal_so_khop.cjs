// T-076 tiêu chí 1: chạm/bấm khối Capu mở modal; số dòng = số trên khối. Chạy: cd /home/user/tohong-hq && node eval/T-076/check_1_mo_modal_so_khop.cjs
const L = require('./lib.cjs'); const { T, Q, link, dash, pr, DR } = L; const R = L.reporter();
const tasks = [T('T-72', { state: 'escalated', owner: 'product', holder: 'chief-of-staff', tier: 'B' }), T('T-74', { state: 'escalated', owner: 'product', tier: 'A' }),
  T('T-60', { tier: 'B' }), T('T-61', { tier: 'C' }), T('T-62', { tier: 'A' }), T('T-63', { tier: 'B' })];
const queue = [Q('T-72', 'escalated', [link('Decision Request', DR('T-72-x.md'))]), Q('T-74', 'escalated', [link('Decision Request', DR('T-74-x.md'))]),
  Q('T-60', 'diff-b', [link('PR tohong-front#59', pr('tohong-front', 59), 'open')]), Q('T-61', 'merge-c', [link('PR tohong-back#37', pr('tohong-back', 37), 'open')])];
(async () => {
  await L.start();
  for (const [name, vp, touch] of [['desktop', { width: 1280, height: 900 }, false], ['iphone390', { width: 390, height: 844 }, true]]) {
    const o = await L.open(dash(tasks, queue), vp, { touch });
    R.ok(!(await L.modalOpen(o)), name + ': chưa bấm thì modal không hiện');
    R.ok(await L.nodeCount(o) === '4', name + ': số trên khối Capu = 4 (2 leo thang + 1 bậc B + 1 bậc C; T-62 bậc A và T-63 không có PR mở không đếm), thấy ' + await L.nodeCount(o));
    await L.clickNode(o);
    R.ok(await L.modalOpen(o), name + ': bấm số trên khối Capu thì modal hiện');
    const rs = await L.rows(o);
    R.ok(rs.length === Number(await L.nodeCount(o)) && rs.length === 4, name + ': số dòng = số trên khối (' + rs.length + ')');
    R.ok(rs.map(r => r.task).join() === 'T-72,T-74,T-61,T-60', name + ': thứ tự leo thang trước, rồi bậc C, rồi bậc B, trong nhóm theo số việc tăng dần; thấy ' + rs.map(r => r.task).join());
    R.ok(await o.page.locator('#capu-modal').count() > 0 && await o.page.locator('#capu-modal').getAttribute('role') === 'dialog' && await o.page.locator('#capu-modal').getAttribute('aria-modal') === 'true', name + ': #capu-modal có role=dialog và aria-modal=true');
    R.ok(!o.errors.length, name + ': không lỗi trang ' + o.errors.join(';')); await o.ctx.close();
  }
  // Dữ liệu cũ chưa có capu_queue: vẫn mở được, số dòng vẫn khớp số trên khối (luật cũ cho việc xong bậc B/C < 48h)
  const o = await L.open(dash([T('T-1', { state: 'escalated', owner: 'product' }), T('T-2', { tier: 'B', h: 5 }), T('T-3', { tier: 'B', h: 60 })]));
  await L.clickNode(o); const rs = await L.rows(o);
  R.ok(rs.length === Number(await L.nodeCount(o)) && rs.length === 2, 'thiếu capu_queue: số dòng = số trên khối = 2 (luật cũ), thấy ' + rs.length + '/' + await L.nodeCount(o));
  await o.ctx.close(); await L.close(); process.exit(R.done());
})().catch(e => { console.log('FAIL ngoại lệ ' + e.message); process.exit(1); });
