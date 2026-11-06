#!/usr/bin/env node
// adv-05 (T-078, adversary, Code Gate v2): cập nhật live khi đang lọc theo sản phẩm, modal mở (spec T-076 U1, U1a, U1b, U10, U11, U12).
// Dữ liệu: T-1 hq escalated (capu_queue), T-2 planner done diff-b (capu_queue), T-3 hq doing, T-4 planner doing.
// Lọc hq, mở modal:
//  (1) ban đầu: số 1 (T-1), có đúng một [data-capu-filter] chữ hq;
//  (2) live: T-4 (planner) leo thang -> hq vẫn 1 dòng, số 1, không có T-4;
//  (3) live: T-3 (hq) leo thang -> thêm T-3, số 2 = số dòng, modal vẫn mở, dòng báo lọc vẫn một;
//  (4) live: T-99 (chỉ có qua kênh live, sản phẩm "") leo thang -> hq không đổi (2);
//  (5) đổi sang planner khi modal mở -> T-4 escalated + T-2 diff-b, số 2, chữ báo lọc planner;
//  (6) đổi sang Tất cả -> T-1, T-3, T-4, T-99, T-2 (5 dòng), không có [data-capu-filter];
//  (7) đóng modal, lọc hq, chạm nhân vật Capu: tóm tắt là đúng 2 dòng việc T-1, T-3 (không "Đang rảnh", không "Vừa ...");
//  (8) không lỗi trang.
// Chạy: cd /home/user/tohong-hq && node eval/T-078/adv-05-live-khi-dang-loc.cjs   (cần NODE_PATH từ npm root -g, D3)
const L = require('../T-076/lib.cjs');
const P = (id, product, o) => Object.assign(L.T(id, o), { product, area: product ? product + '/x' : '' });
let evN = 0;
const esc = (o, task) => o.sock && o.sock.send(JSON.stringify({ type: 'event', id: 'E-98' + String(++evN).padStart(2, '0'), t: L.stamp(0), task, title: 'Việc ' + task,
  event: 'escalated', from: 'engineering', to: 'capu', state: 'escalated', holder: 'capu', owner: 'engineering', round: 0, severity: '', cost: 0 }));
const filt = o => o.page.$$eval('#capu-modal [data-capu-filter]', es => es.map(e => e.textContent.trim()));
const title = o => o.page.$eval('#capu-title', e => e.textContent.trim()).catch(() => '');
const pick = async (o, f) => { await o.page.selectOption('#product-filter', f); await o.page.waitForTimeout(600); };
const msg = p => `Đang lọc theo sản phẩm: ${p}. Chọn "Tất cả" ở bộ chọn Sản phẩm để xem mọi việc chờ anh.`;
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
  const tasks = [P('T-1', 'hq', { state: 'escalated', owner: 'product', h: 2 }), P('T-2', 'planner', { h: 72 }), P('T-3', 'hq', { state: 'doing', h: 2 }), P('T-4', 'planner', { state: 'doing', h: 2 })];
  const q = [L.Q('T-1', 'escalated', [L.link('Decision Request', L.DR('T-1-x.md'))], '2026-11-10'), L.Q('T-2', 'diff-b', [L.link('PR tohong-front#7', L.pr('tohong-front', 7), 'open')])];
  const o = await L.open(L.dash(tasks, q));
  const ids = async () => (await L.rows(o)).map(x => x.task + ':' + x.kind);
  try {
    await pick(o, 'hq'); await L.clickNode(o);
    r.ok(await L.modalOpen(o), 'mở modal khi lọc hq');
    let rs = await ids(), f = await filt(o);
    r.ok(JSON.stringify(rs) === '["T-1:escalated"]' && (await L.nodeCount(o)) === '1', '(1) hq ban đầu chỉ T-1, số 1: ' + JSON.stringify(rs));
    r.ok(f.length === 1 && f[0] === msg('hq'), '(1) đúng một dòng báo lọc hq: ' + JSON.stringify(f));
    esc(o, 'T-4'); await o.page.waitForTimeout(900);
    rs = await ids();
    r.ok(JSON.stringify(rs) === '["T-1:escalated"]' && (await L.nodeCount(o)) === '1', '(2) planner leo thang live không vào hq: ' + JSON.stringify(rs) + ' số ' + (await L.nodeCount(o)));
    esc(o, 'T-3'); await o.page.waitForTimeout(900);
    rs = await ids(); f = await filt(o);
    r.ok(JSON.stringify(rs) === '["T-1:escalated","T-3:escalated"]' && (await L.nodeCount(o)) === '2', '(3) hq leo thang live vào hq: ' + JSON.stringify(rs) + ' số ' + (await L.nodeCount(o)));
    r.ok(await L.modalOpen(o) && f.length === 1 && (await title(o)) === 'Việc chờ anh duyệt (2)', '(3) modal vẫn mở, tiêu đề (2), một dòng báo lọc: ' + (await title(o)));
    esc(o, 'T-99'); await o.page.waitForTimeout(900);
    rs = await ids();
    r.ok(rs.length === 2 && !rs.some(x => x.startsWith('T-99')) && (await L.nodeCount(o)) === '2', '(4) việc chỉ có qua live (sản phẩm "") không vào hq: ' + JSON.stringify(rs));
    await pick(o, 'planner');
    rs = await ids(); f = await filt(o);
    r.ok(await L.modalOpen(o), '(5) đổi bộ chọn không đóng modal');
    r.ok(JSON.stringify(rs) === '["T-4:escalated","T-2:diff-b"]' && (await L.nodeCount(o)) === '2' && (await title(o)) === 'Việc chờ anh duyệt (2)', '(5) planner: T-4, T-2, số 2: ' + JSON.stringify(rs));
    r.ok(f.length === 1 && f[0] === msg('planner'), '(5) dòng báo lọc planner: ' + JSON.stringify(f));
    await pick(o, 'all');
    rs = await ids(); f = await filt(o);
    r.ok(JSON.stringify(rs) === '["T-1:escalated","T-3:escalated","T-4:escalated","T-99:escalated","T-2:diff-b"]' && (await L.nodeCount(o)) === '5', '(6) Tất cả đủ 5 dòng: ' + JSON.stringify(rs) + ' số ' + (await L.nodeCount(o)));
    r.ok(f.length === 0, '(6) Tất cả không có dòng báo lọc: ' + JSON.stringify(f));
    await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(300);
    await pick(o, 'hq');
    const s = await summary(o);
    r.ok(JSON.stringify(s) === JSON.stringify(['T-1 · Việc T-1 · Chờ Capu', 'T-3 · Việc T-3 · Chờ Capu']), '(7) tóm tắt nhân vật Capu khi lọc hq sau live = T-1, T-3: ' + JSON.stringify(s));
    r.ok(!o.errors.length, '(8) không lỗi trang ' + o.errors.join(' | '));
  } finally { await o.ctx.close(); await L.close(); }
  process.exit(r.done());
})().catch(e => { console.log('FAIL ' + e); process.exit(1); });
