#!/usr/bin/env node
// adv-06 (T-078, adversary, Code Gate v2): phần tử capu_queue mồ côi và sản phẩm lạ (spec T-076 U1, U1a, U1b).
// Dữ liệu: T-1 hq decision; T-2 product "HQ" (sai hoa thường) decision; T-3 product thiếu hẳn, diff-b; T-404 có trong capu_queue nhưng không có trong tasks (mồ côi).
//  (1) Tất cả: T-1, T-2, T-3 (3 dòng), không có T-404; số 3; chữ phụ "0 leo thang · 2 chờ quyết/chặn · 1 diff hành vi chờ đọc".
//  (2) hq: chỉ T-1 (sản phẩm lạ/thiếu không tự suy), số 1; (3) planner: 0 dòng, số 0, modal có [data-capu-empty] và [data-capu-filter].
//  (4) không lỗi trang.
// Chạy: cd /home/user/tohong-hq && node eval/T-078/adv-06-mo-coi-va-san-pham-la.cjs
const L = require('../T-076/lib.cjs');
const P = (id, product, o) => { const t = Object.assign(L.T(id, o), { product, area: 'hq/dashboard' }); if (product === undefined) delete t.product; return t; };
const pick = async (o, f) => { await o.page.selectOption('#product-filter', f); await o.page.waitForTimeout(600); };
(async () => {
  const r = L.reporter(); await L.start();
  const dr = id => L.link('Decision Request', L.DR(id + '-x.md'));
  const tasks = [P('T-1', 'hq', { h: 72 }), P('T-2', 'HQ', { h: 72 }), P('T-3', undefined, { h: 72 })];
  const q = [L.Q('T-1', 'decision', [dr('T-1')]), L.Q('T-2', 'decision', [dr('T-2')]), L.Q('T-3', 'diff-b', [L.link('PR tohong-front#3', L.pr('tohong-front', 3), 'open')]), L.Q('T-404', 'decision', [dr('T-404')])];
  const o = await L.open(L.dash(tasks, q));
  const ids = async () => (await L.rows(o)).map(x => x.task);
  try {
    await L.clickNode(o);
    let rs = await ids();
    const cap = await o.page.$eval('#nd_capu .cap', e => e.textContent.trim()).catch(() => '');
    r.ok(JSON.stringify(rs) === '["T-1","T-2","T-3"]' && (await L.nodeCount(o)) === '3', '(1) Tất cả: T-1, T-2, T-3, không mồ côi: ' + JSON.stringify(rs) + ' số ' + (await L.nodeCount(o)));
    r.ok(cap === '0 leo thang · 2 chờ quyết/chặn · 1 diff hành vi chờ đọc', '(1) chữ phụ: ' + cap);
    await pick(o, 'hq'); rs = await ids();
    r.ok(JSON.stringify(rs) === '["T-1"]' && (await L.nodeCount(o)) === '1', '(2) hq chỉ T-1: ' + JSON.stringify(rs));
    await pick(o, 'planner'); rs = await ids();
    const em = await o.page.$$eval('#capu-modal [data-capu-empty]', es => es.map(e => e.textContent.trim()));
    const fl = await o.page.$$eval('#capu-modal [data-capu-filter]', es => es.length);
    r.ok(rs.length === 0 && (await L.nodeCount(o)) === '0' && em.length === 1 && em[0] === 'Không có việc nào chờ anh' && fl === 1, '(3) planner rỗng + báo lọc: ' + JSON.stringify({ rs, em, fl }));
    r.ok(!o.errors.length, '(4) không lỗi trang ' + o.errors.join(' | '));
  } finally { await o.ctx.close(); await L.close(); }
  process.exit(r.done());
})().catch(e => { console.log('FAIL ' + e); process.exit(1); });
