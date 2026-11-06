// T-076 tiêu chí 10: sự kiện sổ cái `merged` (lịch sử và live) không tạo dot, không đổi số trên khối Capu, không lỗi trang. Chạy: cd /home/user/tohong-hq && node eval/T-076/check_10_dashboard_bo_qua_merged.cjs
const L = require('./lib.cjs'); const { T, Q, link, dash, DR } = L; const R = L.reporter();
const hist = (i, task) => ({ seq: 'S-' + i, ledger_id: 'E-' + i, t: L.stamp(1), task, title: '', event: 'merged', from: 'chief-of-staff', to: 'chief-of-staff', round: 0, severity: '', detail: '', link: '', cost: 0, state: 'done', holder: '-' });
const t10 = [T('T-1', { state: 'escalated', owner: 'product' }), T('T-2', { tier: 'B' })], q10 = [Q('T-1', 'escalated', [link('Decision Request', DR('T-1-x.md'))])];
L.dumpCases('check_10', [{ name: 'merged', tasks: t10, queue: q10, expect: { count: 1, order: 'T-1' } }]);
(async () => {
  await L.start();
  const data = dash(t10, q10); data.events = [hist(1, 'T-2')];
  const o = await L.open(data);
  R.ok(await L.nodeCount(o) === '1', 'merged trong lịch sử: số trên khối Capu vẫn 1, thấy ' + await L.nodeCount(o));
  // sự kiện live
  o.sock && o.sock.send(JSON.stringify({ type: 'event', id: 'E-9901', t: L.stamp(0), task: 'T-2', title: '', event: 'merged', from: 'chief-of-staff', to: 'chief-of-staff', state: 'done', holder: '-', owner: 'engineering', round: 0, severity: '', cost: 0 }));
  let maxDots = 0; for (let i = 0; i < 20; i++) { maxDots = Math.max(maxDots, await o.page.$$eval('#fx_f circle', c => c.length)); await o.page.waitForTimeout(100); }
  R.ok(maxDots === 0, 'merged live: không dot nào chạy, thấy tối đa ' + maxDots);
  R.ok(await L.nodeCount(o) === '1', 'merged live: số trên khối Capu vẫn 1, thấy ' + await L.nodeCount(o));
  await L.clickNode(o); R.ok((await L.rows(o)).length === 1, 'modal vẫn 1 dòng');
  R.ok(!o.errors.length, 'không lỗi trang ' + o.errors.join(';'));
  await L.close(); process.exit(R.done());
})().catch(e => { console.log('FAIL ngoại lệ ' + e.message); process.exit(1); });
