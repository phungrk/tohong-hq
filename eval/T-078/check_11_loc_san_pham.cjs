// T-076 (spec v5) tiêu chí 11: khối Capu, đèn và modal lọc theo bộ chọn sản phẩm (quyết định T-041 mục 1).
// Chạy: cd /home/user/tohong-hq && node eval/T-078/check_11_loc_san_pham.cjs   (D3, TOHONG_DASHBOARD_REPO như eval T-076)
const L = require('../T-076/lib.cjs'); const { T, Q, link, dash, DR, pr } = L; const R = L.reporter();
const P = (id, product, o) => Object.assign(T(id, o), { product, area: product ? product + '/x' : '' });
const dr = id => link('Decision Request', DR(id + '-x.md'));
const prl = n => link('PR tohong-front#' + n, pr('tohong-front', n), 'open');
// Tám dòng: hq 3 (T-1 escalated, T-6 blocked, T-3 diff-b), planner 4 (T-2 escalated, T-7 decision, T-4 merge-c, T-9 diff-b), không sản phẩm 1 (T-5 decision)
const tasks = [P('T-1', 'hq', { state: 'escalated', owner: 'product', h: 2 }), P('T-2', 'planner', { state: 'escalated', owner: 'product', h: 2 }),
  P('T-3', 'hq'), P('T-4', 'planner', { tier: 'C' }), P('T-5', '', { h: 90 }), P('T-6', 'hq', { state: 'blocked', owner: 'product', tier: 'A', h: 5 }),
  P('T-7', 'planner', { h: 90 }), P('T-8', 'hq', { state: 'doing' }), P('T-9', 'planner')];
const queue = [Q('T-1', 'escalated', [dr('T-1')], '2026-11-10'), Q('T-2', 'escalated', [dr('T-2')]), Q('T-3', 'diff-b', [prl(3)]), Q('T-4', 'merge-c', [prl(4)]),
  Q('T-5', 'decision', [dr('T-5')], '2026-11-12'), Q('T-6', 'blocked', [link('Decision Request', L.DR_DIR)]), Q('T-7', 'decision', [dr('T-7')], '2026-11-11'), Q('T-9', 'diff-b', [prl(9)])];
const cap = (a, d, b) => `${a} leo thang · ${d} chờ quyết/chặn · ${b} diff hành vi chờ đọc`;
const E = { all: { order: 'T-1,T-2,T-7,T-5,T-6,T-4,T-3,T-9', caption: cap(2, 3, 3), lit: true },
  hq: { order: 'T-1,T-6,T-3', caption: cap(1, 1, 1), lit: true }, planner: { order: 'T-2,T-7,T-4,T-9', caption: cap(1, 1, 2), lit: true } };
// Dữ liệu cũ (không capu_queue): luật cũ cũng lọc theo sản phẩm
const oldTasks = [P('T-11', 'hq', { state: 'escalated', owner: 'product', h: 2 }), P('T-12', 'planner', { h: 3 }), P('T-13', '', { tier: 'C', h: 3 })];
const EO = { all: { order: 'T-11,T-13,T-12', caption: cap(1, 0, 2), lit: true }, hq: { order: 'T-11', caption: cap(1, 0, 0), lit: true }, planner: { order: 'T-12', caption: cap(0, 0, 1), lit: true } };
// Chỉ có việc của hq: lọc planner thì khối 0, tắt, modal rỗng nhưng nói rõ đang lọc
const hqOnly = [P('T-21', 'hq', { state: 'escalated', owner: 'product', h: 2 }), P('T-22', 'planner', { state: 'doing' })], hqQueue = [Q('T-21', 'escalated', [dr('T-21')])];
L.dumpCases('check_11', [
  ...['all', 'hq', 'planner'].map(f => ({ name: 'capu_queue/' + f, tasks, queue, filter: f, expect: { count: E[f].order.split(',').length, order: E[f].order, caption: E[f].caption } })),
  ...['all', 'hq', 'planner'].map(f => ({ name: 'luật cũ/' + f, tasks: oldTasks, queue: null, filter: f, expect: { count: EO[f].order.split(',').length, order: EO[f].order, caption: EO[f].caption } })),
  { name: 'lọc planner, việc chờ thuộc hq', tasks: hqOnly, queue: hqQueue, filter: 'planner', expect: { count: 0, order: '', caption: cap(0, 0, 0) } }]);
const lit = o => o.page.evaluate(() => { const e = document.getElementById('nd_capu'), sh = e && e.querySelector(':scope > rect, :scope > circle'); return sh ? parseFloat(getComputedStyle(sh).strokeWidth) >= 2.5 : null; });
const cap2 = o => o.page.$eval('#nd_capu .cap', e => e.textContent.trim());
const note = o => o.page.$$eval('#capu-modal [data-capu-filter]', es => es.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
const title = o => o.page.evaluate(() => { const d = document.querySelector('#capu-modal [role=dialog]') || document.getElementById('capu-modal'), h = document.getElementById(d.getAttribute('aria-labelledby') || ''); return h ? h.textContent.trim() : null; });
const pick = async (o, f) => { await o.page.selectOption('#product-filter', f); await o.page.waitForTimeout(500); };
async function verify(o, tag, f, e) {
  const n = await L.nodeCount(o), rs = await L.rows(o), order = rs.map(r => r.task).join(',');
  const want = e.order ? e.order.split(',').length : 0;
  R.ok(n === String(want), `${tag}: số trên khối Capu = ${want}, thấy ${n}`);
  R.ok(await cap2(o) === e.caption, `${tag}: chữ phụ "${e.caption}", thấy "${await cap2(o)}"`);
  const l = await lit(o); R.ok(l === (want > 0 && e.lit), `${tag}: đèn khối ${want > 0 && e.lit ? 'sáng' : 'tắt'} (số ${want}), thấy sáng=${l}`);
  R.ok(order === e.order, `${tag}: dòng modal "${e.order}" (số dòng = số trên khối, một việc một dòng), thấy "${order}"`);
  R.ok(new Set(rs.map(r => r.task)).size === rs.length, `${tag}: mỗi việc tối đa một dòng`);
  const t = await title(o); R.ok(t === `Việc chờ anh duyệt (${want})`, `${tag}: tiêu đề "Việc chờ anh duyệt (${want})", thấy ${JSON.stringify(t)}`);
  const nt = await note(o);
  if (f === 'all') R.ok(nt.length === 0, `${tag}: chọn Tất cả thì không có dòng báo đang lọc [data-capu-filter], thấy ${JSON.stringify(nt)}`);
  else R.ok(nt.length === 1 && nt[0] === `Đang lọc theo sản phẩm: ${f}. Chọn "Tất cả" ở bộ chọn Sản phẩm để xem mọi việc chờ anh.`, `${tag}: đúng một dòng báo lọc "Đang lọc theo sản phẩm: ${f}. Chọn "Tất cả" ở bộ chọn Sản phẩm để xem mọi việc chờ anh.", thấy ${JSON.stringify(nt)}`);
  const em = await o.page.$$eval('#capu-modal [data-capu-empty]', es => es.map(x => x.textContent.trim()));
  if (want === 0) R.ok(em.length === 1 && em[0] === 'Không có việc nào chờ anh', `${tag}: rỗng thì có đúng "Không có việc nào chờ anh", thấy ${JSON.stringify(em)}`);
  else R.ok(em.length === 0, `${tag}: có dòng thì không có dòng rỗng`);
}
(async () => {
  await L.start();
  for (const [name, data, EX] of [['capu_queue', dash(tasks, queue), E], ['dữ liệu cũ (không capu_queue)', dash(oldTasks), EO]]) {
    const o = await L.open(data);
    R.ok(await o.page.$eval('#product-filter', s => s.value) === 'all', `${name}: mặc định bộ chọn là Tất cả`);
    for (const f of ['all', 'hq', 'planner', 'all']) {
      await pick(o, f); await L.clickNode(o);
      R.ok(await L.modalOpen(o), `${name}/${f}: bấm số mở modal`);
      await verify(o, `${name}/${f}`, f, EX[f]);
      await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(150);
    }
    // Đổi bộ chọn khi modal đang mở: danh sách cập nhật, modal không đóng
    await pick(o, 'all'); await L.clickNode(o); await pick(o, 'hq');
    R.ok(await L.modalOpen(o), `${name}: đổi bộ chọn khi modal mở thì modal không tự đóng`);
    await verify(o, `${name}/đổi khi đang mở → hq`, 'hq', EX.hq);
    R.ok(!o.errors.length, `${name}: không lỗi trang ${o.errors.join(' | ')}`);
    await o.ctx.close();
  }
  // Lọc planner mà mọi việc chờ thuộc hq: khối 0 và tắt, modal rỗng nhưng ghi rõ đang lọc (để không tưởng là hết việc)
  const o = await L.open(dash(hqOnly, hqQueue)); await pick(o, 'planner'); await L.clickNode(o);
  await verify(o, 'lọc planner, việc chờ thuộc hq', 'planner', { order: '', caption: cap(0, 0, 0), lit: false });
  await pick(o, 'all'); await verify(o, 'quay lại Tất cả', 'all', { order: 'T-21', caption: cap(1, 0, 0), lit: true });
  await L.close(); process.exit(R.done());
})().catch(e => { console.log('FAIL ngoại lệ ' + e.message); process.exit(1); });
