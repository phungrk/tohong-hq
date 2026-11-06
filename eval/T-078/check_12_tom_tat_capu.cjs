// T-076 (spec v5) tiêu chí 12: tóm tắt khi bấm nhân vật Capu (T-037) đếm đúng tập việc của khối Capu (đã lọc theo sản phẩm), khớp đèn.
// Chạy: cd /home/user/tohong-hq && node eval/T-078/check_12_tom_tat_capu.cjs
const L = require('../T-076/lib.cjs'); const { T, Q, link, dash, DR, pr } = L; const R = L.reporter();
const P = (id, product, o) => Object.assign(T(id, o), { product, area: product ? product + '/x' : '' });
const dr = id => link('Decision Request', DR(id + '-x.md'));
const prl = n => link('PR tohong-front#' + n, pr('tohong-front', n), 'open');
const cases = [
  { name: 'a decision (việc done bậc B 72 giờ)', tasks: [P('T-901', 'hq', { h: 72 })], queue: [Q('T-901', 'decision', [dr('T-901')])], filter: 'all', lit: true, lines: ['T-901 · Việc T-901 · Chờ quyết'] },
  { name: 'b blocked "Chờ Capu"', tasks: [P('T-902', 'hq', { state: 'blocked', owner: 'product', tier: 'A', h: 5 })], queue: [Q('T-902', 'blocked', [link('Decision Request', L.DR_DIR)])], filter: 'all', lit: true, lines: ['T-902 · Việc T-902 · Chờ Capu làm'] },
  { name: 'c diff-b có PR chưa merged (72 giờ)', tasks: [P('T-903', 'hq', { h: 72 })], queue: [Q('T-903', 'diff-b', [prl(99)])], filter: 'all', lit: true, lines: ['T-903 · Việc T-903 · Chờ đọc diff'] },
  { name: 'd lọc planner, việc escalated thuộc hq', tasks: [P('T-904', 'hq', { state: 'escalated', owner: 'product', h: 2 }), P('T-905', 'planner', { state: 'doing', owner: 'engineering' })], queue: [Q('T-904', 'escalated', [dr('T-904')], '2026-11-10')], filter: 'planner', lit: false, lines: ['Đang rảnh'] },
  { name: 'e năm dòng, tất cả: escalated trước rồi số việc tăng dần, tối đa 3 dòng + "+n việc nữa"', filter: 'all', lit: true,
    tasks: [P('T-910', 'hq', { state: 'escalated', owner: 'product', h: 2 }), P('T-95', 'planner', { h: 80 }), P('T-96', 'hq', { tier: 'C', h: 80 }), P('T-9', 'planner', { h: 80 }), P('T-100', 'hq', { state: 'blocked', owner: 'product', tier: 'A', h: 5 })],
    queue: [Q('T-910', 'escalated', [dr('T-910')]), Q('T-95', 'decision', [dr('T-95')]), Q('T-96', 'merge-c', [prl(96)]), Q('T-9', 'diff-b', [prl(9)]), Q('T-100', 'blocked', [link('Decision Request', L.DR_DIR)])],
    lines: ['T-910 · Việc T-910 · Chờ Capu', 'T-9 · Việc T-9 · Chờ đọc diff', 'T-95 · Việc T-95 · Chờ quyết', '+2 việc nữa'] },
  { name: 'f cùng dữ liệu, lọc hq: chỉ T-910, T-96, T-100', filter: 'hq', lit: true, same: 'e', lines: ['T-910 · Việc T-910 · Chờ Capu', 'T-96 · Việc T-96 · Chờ đọc diff', 'T-100 · Việc T-100 · Chờ Capu làm'] },
  { name: 'g dữ liệu cũ (không capu_queue), lọc hq', tasks: [P('T-931', 'hq', { state: 'escalated', owner: 'product', h: 2 }), P('T-932', 'planner', { h: 3 })], queue: undefined, filter: 'hq', lit: true, lines: ['T-931 · Việc T-931 · Chờ Capu'] },
];
for (const c of cases) if (c.same) { const s = cases.find(x => x.name.startsWith(c.same + ' ')); c.tasks = s.tasks; c.queue = s.queue; }
L.dumpCases('check_12', cases.map(c => ({ name: c.name, tasks: c.tasks, queue: c.queue === undefined ? null : c.queue, filter: c.filter, expect: { order: null, lines: c.lines } })));
const lit = o => o.page.evaluate(() => { const e = document.getElementById('nd_capu'), sh = e && e.querySelector(':scope > rect, :scope > circle'); return sh ? parseFloat(getComputedStyle(sh).strokeWidth) >= 2.5 : null; });
async function summary(o) {
  const c = await o.page.evaluate(() => { const b = document.querySelector('#model svg g.mch[data-block="nd_capu"] [data-part=body]'); if (!b) return null;
    b.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (!c) return null; await o.page.mouse.click(c.x, c.y);
  const t0 = Date.now(); let s = null;
  while (Date.now() - t0 < 5000) {
    s = await o.page.evaluate(() => { const g = document.querySelector('#fx_s g.sum[data-block="nd_capu"]'); return g ? { st: g.getAttribute('data-state'), lines: [...g.querySelectorAll('[data-part=sum-line]')].map(l => l.textContent) } : null; });
    if (s && s.st === 'done') break; await o.page.waitForTimeout(50);
  }
  return s;
}
(async () => {
  await L.start();
  for (const c of cases) {
    const o = await L.open(c.queue === undefined ? dash(c.tasks) : dash(c.tasks, c.queue));
    try {
      await o.page.selectOption('#product-filter', c.filter); await o.page.waitForTimeout(500);
      const n = await L.nodeCount(o), l = await lit(o), s = await summary(o);
      const got = s && s.lines, held = c.lines[0] === 'Đang rảnh' ? 0 : c.lines.length === 4 ? 3 + Number(/\d+/.exec(c.lines[3])[0]) : c.lines.length;
      R.ok(l === c.lit, `${c.name}: đèn khối Capu ${c.lit ? 'sáng' : 'tắt'}, số ${n}, thấy sáng=${l}`);
      R.ok(n === String(held), `${c.name}: số trên khối = số việc tóm tắt đếm (${held}), thấy ${n}`);
      R.ok(JSON.stringify(got) === JSON.stringify(c.lines), `${c.name}: tóm tắt ${JSON.stringify(c.lines)}, thấy ${JSON.stringify(got)}`);
      R.ok(!(l && got && got[0] === 'Đang rảnh') && !(got && /^Vừa (nhận|giao)/.test(got[0])), `${c.name}: khối sáng vì capu_queue thì tóm tắt không phải "Đang rảnh" hay "Vừa nhận/giao"`);
      R.ok(!o.errors.length, `${c.name}: không lỗi trang ${o.errors.join(' | ')}`);
    } finally { await o.ctx.close(); }
  }
  await L.close(); process.exit(R.done());
})().catch(e => { console.log('FAIL ngoại lệ ' + e.message); process.exit(1); });
