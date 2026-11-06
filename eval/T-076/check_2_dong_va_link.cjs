// T-076 tiêu chí 2: mỗi dòng có mã, tên, loại, hạn quyết, link đúng chỗ hành động. Chạy: cd /home/user/tohong-hq && node eval/T-076/check_2_dong_va_link.cjs
const L = require('./lib.cjs'); const { T, Q, link, dash, pr, DR, DR_DIR } = L; const R = L.reporter();
const tasks = [T('T-72', { state: 'escalated', owner: 'product', title: 'Hợp đồng style chung' }), T('T-80', { state: 'escalated', owner: 'chief-of-staff', title: 'Việc leo thang chưa có file' }),
  T('T-70', { tier: 'C', title: 'Nguồn ảnh vendor' }), T('T-16', { state: 'blocked', title: 'Deploy admin' }), T('T-17', { state: 'blocked', title: 'Chặn chờ Capu không DR' }),
  T('T-60', { tier: 'B', title: 'Lọc ngân sách' }), T('T-61', { tier: 'C', title: 'Sửa hợp đồng vendor' }), T('T-64', { tier: 'B', title: 'Hai PR một việc' }), T('T-66', { tier: 'B', title: 'Chưa có link PR', h: 3 }),
  T('T-81', { tier: 'C', title: 'Quyết và PR mở' })];
const queue = [Q('T-72', 'escalated', [link('Decision Request', DR('T-72-r8-khoa-eval.md'))], '2026-11-10'),
  Q('T-70', 'decision', [link('Decision Request', DR('T-70-nguon.md'))], '2026-11-10'), Q('T-16', 'decision', [link('Decision Request', DR('T-16-deploy-admin.md'))], '2026-10-31'), Q('T-17', 'blocked', [link('Decision Request', DR_DIR)]),
  Q('T-60', 'diff-b', [link('PR tohong-front#59', pr('tohong-front', 59), 'open')]), Q('T-61', 'merge-c', [link('PR tohong-back#37', pr('tohong-back', 37), 'open')]),
  Q('T-64', 'diff-b', [link('PR tohong-front#70', pr('tohong-front', 70), 'open'), link('PR tohong-back#41', pr('tohong-back', 41), 'open')]), Q('T-66', 'diff-b', []),
  Q('T-81', 'decision', [link('Decision Request', DR('T-81-x.md')), link('PR tohong-back#50', pr('tohong-back', 50), 'open')], '2026-11-12')];
L.dumpCases('check_2', [{ name: 'chính', tasks, queue, expect: { count: 10, order: 'T-72,T-80,T-16,T-70,T-81,T-17,T-61,T-60,T-64,T-66' } }]);
(async () => {
  await L.start();
  for (const [name, vp, touch] of [['desktop', { width: 1280, height: 900 }, false], ['iphone390', { width: 390, height: 844 }, true]]) {
    const o = await L.open(dash(tasks, queue), vp, { touch }); await L.clickNode(o);
    const rs = Object.fromEntries((await L.rows(o)).map(r => [r.task, r])); const g = id => rs[id] || { text: '', links: [], kind: '', decide: '' };
    R.ok(Object.keys(rs).length === 10, name + ': 10 dòng, thấy ' + Object.keys(rs).join());
    R.ok(['T-72', 'Hợp đồng style chung'].every(x => g('T-72').text.includes(x)) && g('T-72').kind === 'escalated' && /Leo thang/.test(g('T-72').text), name + ': dòng leo thang có mã, tên, loại "Leo thang"');
    R.ok(g('T-72').links.length === 1 && g('T-72').links[0].href === DR('T-72-r8-khoa-eval.md') && g('T-72').decide === '2026-11-10' && g('T-72').text.includes('2026-11-10'), name + ': leo thang trỏ file Decision Request blob/main/inbox/capu và ghi hạn quyết 2026-11-10');
    R.ok(g('T-80').links.length === 1 && g('T-80').links[0].href === DR_DIR, name + ': leo thang chưa có file thì trỏ thư mục inbox/capu');
    R.ok(g('T-70').kind === 'decision' && /Quyết định chờ anh/.test(g('T-70').text) && g('T-70').links[0].href === DR('T-70-nguon.md') && g('T-70').decide === '2026-11-10', name + ': việc đã xong có Decision Request chưa quyết: loại "Quyết định chờ anh", link file, hạn');
    R.ok(g('T-16').kind === 'decision' && /Quyết định chờ anh/.test(g('T-16').text) && g('T-16').links[0].href === DR('T-16-deploy-admin.md') && g('T-16').decide === '2026-10-31', name + ': việc vừa bị chặn chờ Capu vừa có DR chưa quyết: loại "Quyết định chờ anh", link file, hạn');
    R.ok(g('T-17').kind === 'blocked' && /Bị chặn - chờ anh làm/.test(g('T-17').text) && g('T-17').links[0].href === DR_DIR, name + ': việc bị chặn chờ Capu không có DR: loại "Bị chặn - chờ anh làm", link thư mục');
    R.ok(g('T-60').kind === 'diff-b' && /Đọc diff hành vi/.test(g('T-60').text) && /bậc B/.test(g('T-60').text) && g('T-60').links[0].href === pr('tohong-front', 59) && g('T-60').decide === '', name + ': dòng bậc B: "Đọc diff hành vi", bậc B, link PR, không có hạn');
    R.ok(g('T-61').kind === 'merge-c' && /Duyệt và tự merge/.test(g('T-61').text) && /bậc C/.test(g('T-61').text) && g('T-61').links[0].href === pr('tohong-back', 37), name + ': dòng bậc C: "Duyệt và tự merge", bậc C, link PR');
    R.ok(g('T-64').links.map(l => l.href).join() === pr('tohong-front', 70) + ',' + pr('tohong-back', 41), name + ': việc có hai PR mở: một dòng, hai link theo thứ tự dữ liệu');
    R.ok(g('T-81').links.map(l => l.href).join() === DR('T-81-x.md') + ',' + pr('tohong-back', 50), name + ': việc có Decision Request và PR mở: một dòng, link DR trước rồi PR');
    R.ok(g('T-66').links.length === 0 && /chưa có link/i.test(g('T-66').text) && !/chưa kiểm được/.test(g('T-66').text), name + ': việc chưa có link PR vẫn hiện, ghi "chưa có link", không có thẻ a rỗng');
    const all = Object.values(rs).flatMap(r => r.links);
    R.ok(all.length > 0 && all.every(l => /^https:\/\/github\.com\/phungrk\//.test(l.href) && l.target === '_blank' && /noopener/.test(l.rel)), name + ': mọi link là https github.com/phungrk/…, mở tab mới, rel có noopener');
    R.ok(!o.errors.length, name + ': không lỗi trang'); await o.ctx.close();
  }
  await L.close(); process.exit(R.done());
})().catch(e => { console.log('FAIL ngoại lệ ' + e.message); process.exit(1); });
