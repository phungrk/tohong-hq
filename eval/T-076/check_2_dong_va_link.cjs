// T-076 tiêu chí 2: mỗi dòng có mã, tên việc, loại, link đúng chỗ hành động. Chạy: cd /home/user/tohong-hq && node eval/T-076/check_2_dong_va_link.cjs
const L = require('./lib.cjs'); const { T, Q, link, dash, pr, DR, DR_DIR } = L; const R = L.reporter();
const tasks = [T('T-72', { state: 'escalated', owner: 'product', title: 'Hợp đồng style chung' }), T('T-80', { state: 'escalated', owner: 'chief-of-staff', title: 'Việc leo thang chưa có file' }),
  T('T-60', { tier: 'B', title: 'Lọc ngân sách' }), T('T-61', { tier: 'C', title: 'Sửa hợp đồng vendor' }), T('T-64', { tier: 'B', title: 'Hai PR một việc' }), T('T-65', { tier: 'B', title: 'Chưa kiểm được PR' }), T('T-66', { tier: 'B', title: 'Chưa có link PR', h: 3 })];
const queue = [Q('T-72', 'escalated', [link('Decision Request', DR('T-72-r8-khoa-eval.md'))]),
  Q('T-60', 'diff-b', [link('PR tohong-front#59', pr('tohong-front', 59), 'open')]), Q('T-61', 'merge-c', [link('PR tohong-back#37', pr('tohong-back', 37), 'open')]),
  Q('T-64', 'diff-b', [link('PR tohong-front#70', pr('tohong-front', 70), 'open'), link('PR tohong-back#41', pr('tohong-back', 41), 'open')]),
  Q('T-65', 'diff-b', [link('PR tohong-front#71', pr('tohong-front', 71), 'unknown')]), Q('T-66', 'diff-b', [])];
(async () => {
  await L.start();
  for (const [name, vp, touch] of [['desktop', { width: 1280, height: 900 }, false], ['iphone390', { width: 390, height: 844 }, true]]) {
    const o = await L.open(dash(tasks, queue), vp, { touch }); await L.clickNode(o);
    const rs = Object.fromEntries((await L.rows(o)).map(r => [r.task, r]));
    R.ok(Object.keys(rs).length === 7, name + ': 7 dòng, thấy ' + Object.keys(rs).join());
    const has = (id, ...s) => s.every(x => rs[id] && rs[id].text.includes(x));
    R.ok(has('T-72', 'T-72', 'Hợp đồng style chung') && rs['T-72'].kind === 'escalated' && /Leo thang/.test(rs['T-72'].text), name + ': dòng leo thang có mã, tên, loại "Leo thang"');
    R.ok(rs['T-72'] && rs['T-72'].links.length === 1 && rs['T-72'].links[0].href === DR('T-72-r8-khoa-eval.md'), name + ': leo thang trỏ file Decision Request trên GitHub blob/main/inbox/capu');
    R.ok(rs['T-80'] && rs['T-80'].links.length === 1 && rs['T-80'].links[0].href === DR_DIR, name + ': leo thang chưa có file thì trỏ thư mục inbox/capu (không mất dòng, không link rỗng)');
    R.ok(has('T-60', 'Lọc ngân sách') && rs['T-60'].kind === 'diff-b' && /Đọc diff hành vi/.test(rs['T-60'].text) && /bậc B/.test(rs['T-60'].text) && rs['T-60'].links[0].href === pr('tohong-front', 59), name + ': dòng bậc B: loại "Đọc diff hành vi", bậc B, link PR');
    R.ok(has('T-61') && rs['T-61'].kind === 'merge-c' && /Duyệt và tự merge/.test(rs['T-61'].text) && /bậc C/.test(rs['T-61'].text) && rs['T-61'].links[0].href === pr('tohong-back', 37), name + ': dòng bậc C: loại "Duyệt và tự merge", bậc C, link PR');
    R.ok(rs['T-64'] && rs['T-64'].links.map(l => l.href).join() === pr('tohong-front', 70) + ',' + pr('tohong-back', 41), name + ': việc có hai PR mở: một dòng, hai link theo thứ tự dữ liệu');
    R.ok(rs['T-65'] && rs['T-65'].links[0].pr === 'unknown' && /chưa kiểm được/.test(rs['T-65'].text), name + ': PR chưa kiểm được trạng thái vẫn được đếm và ghi "chưa kiểm được"');
    R.ok(rs['T-66'] && rs['T-66'].links.length === 0 && /chưa có link/i.test(rs['T-66'].text), name + ': việc chưa có link PR vẫn hiện, ghi "chưa có link", không có thẻ a rỗng');
    const all = Object.values(rs).flatMap(r => r.links);
    R.ok(all.every(l => /^https:\/\/github\.com\/phungrk\//.test(l.href) && l.target === '_blank' && /noopener/.test(l.rel)), name + ': mọi link là https github.com/phungrk/…, mở tab mới, rel có noopener');
    R.ok(!o.errors.length, name + ': không lỗi trang'); await o.ctx.close();
  }
  await L.close(); process.exit(R.done());
})().catch(e => { console.log('FAIL ngoại lệ ' + e.message); process.exit(1); });
