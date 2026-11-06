#!/usr/bin/env node
// adv-02 (T-078, adversary, Code Gate v1): cập nhật live khi modal Capu đang mở (spec T-076 U1, U4, U10).
// Ca: capu_queue có T-1 escalated (DR file) và T-2 diff-b (PR). Mở modal, rồi qua kênh live:
//  (1) T-1 rời escalated sang doing -> dòng T-1 biến mất (không hạ xuống decision), số = 1, modal vẫn mở;
//  (2) T-3 (chưa có trong capu_queue) leo thang -> thêm dòng T-3 loại escalated, link tới thư mục inbox/capu, đứng đầu; số = 2;
//  (3) T-2 rời done sang rework -> dòng T-2 biến mất; số = 1; (4) Tab không thoát modal khi chỉ còn link + nút X; (5) không lỗi trang.
// Chạy: cd /home/user/tohong-hq && node eval/T-078/adv-02-live-khi-modal-mo.cjs   (cần NODE_PATH từ npm root -g, D3)
const L = require('../T-076/lib.cjs');
let evN = 0;
const ev = (o, task, state, owner) => o.sock && o.sock.send(JSON.stringify({ type: 'event', id: 'E-97' + String(++evN).padStart(2, '0'), t: L.stamp(0), task, title: 'Việc ' + task,
  event: state === 'escalated' ? 'escalated' : 'started', from: owner, to: state === 'escalated' ? 'capu' : owner, state, holder: state === 'escalated' ? 'capu' : owner, owner, round: 0, severity: '', cost: 0 }));
(async () => {
  const r = L.reporter(); await L.start();
  const tasks = [L.T('T-1', { state: 'escalated', h: 2 }), L.T('T-2', { state: 'done', h: 2 }), L.T('T-3', { state: 'doing', h: 2 })];
  const q = [L.Q('T-1', 'escalated', [L.link('Decision Request', L.DR('T-1-x.md'))], '2026-11-10'), L.Q('T-2', 'diff-b', [L.link('PR tohong-front#7', L.pr('tohong-front', 7), 'open')])];
  const o = await L.open(L.dash(tasks, q));
  try {
    await L.clickNode(o);
    r.ok(await L.modalOpen(o), 'mở modal'); r.ok((await L.nodeCount(o)) === '2', 'số ban đầu 2');
    ev(o, 'T-1', 'doing', 'engineering'); await o.page.waitForTimeout(800);
    let rs = await L.rows(o);
    r.ok(!rs.some(x => x.task === 'T-1'), '(1) T-1 rời escalated thì không còn dòng: ' + JSON.stringify(rs.map(x => x.task + ':' + x.kind)));
    r.ok((await L.nodeCount(o)) === String(rs.length) && rs.length === 1, '(1) số = số dòng = 1: số ' + (await L.nodeCount(o)));
    r.ok(await L.modalOpen(o), '(1) modal không tự đóng');
    ev(o, 'T-3', 'escalated', 'engineering'); await o.page.waitForTimeout(800);
    rs = await L.rows(o);
    const t3 = rs.find(x => x.task === 'T-3');
    r.ok(t3 && t3.kind === 'escalated' && rs[0].task === 'T-3', '(2) T-3 leo thang live -> dòng escalated đứng đầu: ' + JSON.stringify(rs.map(x => x.task + ':' + x.kind)));
    r.ok(t3 && t3.links.length === 1 && t3.links[0].href === L.DR_DIR && /noopener/.test(t3.links[0].rel) && t3.links[0].target === '_blank', '(2) link T-3 = thư mục inbox/capu, tab mới, noopener');
    r.ok((await L.nodeCount(o)) === '2', '(2) số = 2: ' + (await L.nodeCount(o)));
    ev(o, 'T-2', 'rework', 'engineering'); await o.page.waitForTimeout(800);
    rs = await L.rows(o);
    r.ok(!rs.some(x => x.task === 'T-2') && rs.length === 1 && (await L.nodeCount(o)) === '1', '(3) T-2 rời done thì bỏ dòng; số 1: ' + JSON.stringify(rs.map(x => x.task)));
    let inside = true;
    for (let i = 0; i < 5; i++) { await o.page.keyboard.press('Tab'); inside = inside && await o.page.evaluate(() => document.getElementById('capu-modal').contains(document.activeElement)); }
    for (let i = 0; i < 3; i++) { await o.page.keyboard.press('Shift+Tab'); inside = inside && await o.page.evaluate(() => document.getElementById('capu-modal').contains(document.activeElement)); }
    r.ok(inside, '(4) Tab/Shift+Tab giữ focus trong modal sau khi danh sách đổi');
    r.ok(!o.errors.length, '(5) không lỗi trang ' + o.errors.join(' | '));
  } finally { await o.ctx.close(); await L.close(); }
  process.exit(r.done());
})().catch(e => { console.log('FAIL ' + e); process.exit(1); });
