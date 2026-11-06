// T-076 tiêu chí 5: không có việc chờ thì modal ghi rõ. Chạy: cd /home/user/tohong-hq && node eval/T-076/check_5_rong.cjs
const L = require('./lib.cjs'); const { T, Q, link, dash, pr, DR } = L; const R = L.reporter();
const emptyTasks = [T('T-1', { tier: 'B', h: 3 }), T('T-2', { tier: 'C', h: 5 }), T('T-3', { tier: 'A', h: 2 }), T('T-4', { state: 'doing', tier: 'B' })];
const oneTasks = [T('T-5', { state: 'escalated', owner: 'product' })], oneQueue = [Q('T-5', 'escalated', [link('Decision Request', DR('T-5-x.md'))])];
L.dumpCases('check_5', [{ name: 'rỗng', tasks: emptyTasks, queue: [], expect: { count: 0, order: '' } }, { name: 'một việc', tasks: oneTasks, queue: oneQueue, expect: { count: 1, order: 'T-5' } }]);
(async () => {
  await L.start();
  // Có việc xong bậc B nhưng PR đã merge (capu_queue rỗng) + việc bậc A + việc đang làm: không việc nào chờ Capu
  const o = await L.open(dash(emptyTasks, []));
  R.ok(await L.nodeCount(o) === '0', 'số trên khối = 0 dù có việc bậc B/C vừa xong (PR đã merge), thấy ' + await L.nodeCount(o));
  await L.clickNode(o); R.ok(await L.modalOpen(o), 'khối ở 0 vẫn mở được modal');
  R.ok((await L.rows(o)).length === 0, 'không có dòng việc nào');
  const e = await o.page.$eval('#capu-modal [data-capu-empty]', x => x.textContent.trim()).catch(() => null);
  R.ok(e === 'Không có việc nào chờ anh', 'có đúng dòng "Không có việc nào chờ anh" (data-capu-empty), thấy ' + JSON.stringify(e));
  await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(200); R.ok(!(await L.modalOpen(o)), 'Esc đóng modal rỗng');
  // Có việc thì dòng rỗng không được hiện
  const o2 = await L.open(dash(oneTasks, oneQueue));
  await L.clickNode(o2); R.ok((await o2.page.locator('#capu-modal [data-capu-empty]').count()) === 0, 'có việc chờ thì không có dòng "Không có việc nào chờ anh"');
  await L.close(); process.exit(R.done());
})().catch(e => { console.log('FAIL ngoại lệ ' + e.message); process.exit(1); });
