#!/usr/bin/env node
// adv-07 (T-078, adversary, Code Gate v2): tóm tắt nhân vật Capu khi khối đang sáng vì dòng VÀ đang có dot bay tới (spec T-076 U11 (i), T-037 mục 1).
// Chuyển động bật (không reduced motion). Dữ liệu: T-1 hq done bậc B 72 giờ, capu_queue decision; T-5 hq doing; T-6 planner doing.
//  (a) lọc hq; live: T-5 leo thang (dot về khối Capu); chạm nhân vật Capu ngay (dot còn bay/ping):
//      tóm tắt = ["T-5 · Việc T-5 · Chờ Capu", "T-1 · Việc T-1 · Chờ quyết"], không "Vừa ..."/"Đang rảnh"; số khối = 2.
//  (b) trang mới, lọc planner; live: T-5 (hq) leo thang -> khối planner 0, tắt, tóm tắt "Đang rảnh" (không dot của hq lọt sang planner).
// Chạy: cd /home/user/tohong-hq && node eval/T-078/adv-07-tom-tat-khi-co-dot.cjs
const L = require('../T-076/lib.cjs');
const P = (id, product, o) => Object.assign(L.T(id, o), { product, area: product + '/x' });
const esc = (o, task, n) => o.sock.send(JSON.stringify({ type: 'event', id: 'E-990' + n, t: L.stamp(0), task, title: 'Việc ' + task,
  event: 'escalated', from: 'engineering', to: 'capu', state: 'escalated', holder: 'capu', owner: 'engineering', round: 0, severity: '', cost: 0 }));
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
  return s && s.lines;
}
(async () => {
  const r = L.reporter(); await L.start();
  const tasks = [P('T-1', 'hq', { h: 72 }), P('T-5', 'hq', { state: 'doing', h: 2 }), P('T-6', 'planner', { state: 'doing', h: 2 })];
  const q = [L.Q('T-1', 'decision', [L.link('Decision Request', L.DR('T-1-x.md'))])];
  let o = await L.open(L.dash(tasks, q));
  try {
    await o.page.selectOption('#product-filter', 'hq'); await o.page.waitForTimeout(500);
    esc(o, 'T-5', 1); await o.page.waitForTimeout(250);
    const busy = await o.page.evaluate(() => { const g = document.getElementById('nd_capu'); return !!g && (g.classList.contains('busy') || g.classList.contains('ping')) || !!document.querySelector('#fx_f *'); });
    const s = await summary(o);
    r.ok(JSON.stringify(s) === JSON.stringify(['T-5 · Việc T-5 · Chờ Capu', 'T-1 · Việc T-1 · Chờ quyết']), `(a) tóm tắt khi có dot (dot/ping thấy=${busy}): ` + JSON.stringify(s));
    r.ok((await L.nodeCount(o)) === '2' && (await lit(o)) === true, '(a) số 2, sáng: ' + (await L.nodeCount(o)));
    r.ok(!o.errors.length, '(a) không lỗi trang ' + o.errors.join(' | '));
  } finally { await o.ctx.close(); }
  o = await L.open(L.dash(tasks, q));
  try {
    await o.page.selectOption('#product-filter', 'planner'); await o.page.waitForTimeout(500);
    esc(o, 'T-5', 2); await o.page.waitForTimeout(250);
    const s = await summary(o);
    r.ok((await L.nodeCount(o)) === '0' && (await lit(o)) === false, '(b) planner: số 0, tắt: ' + (await L.nodeCount(o)));
    r.ok(JSON.stringify(s) === '["Đang rảnh"]', '(b) tóm tắt planner = Đang rảnh: ' + JSON.stringify(s));
    r.ok(!o.errors.length, '(b) không lỗi trang ' + o.errors.join(' | '));
  } finally { await o.ctx.close(); await L.close(); }
  process.exit(r.done());
})().catch(e => { console.log('FAIL ' + e); process.exit(1); });
