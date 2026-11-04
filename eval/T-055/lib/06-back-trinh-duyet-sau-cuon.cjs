// adv-06 (T-055, adversary). Spec T-054 mục 4.1/4.2 (±2px, khung hình đầu đã đúng chỗ) với nút Back/Forward CỦA TRÌNH DUYỆT
// (không qua history.back của trang, nên không đi qua lớp bọc history.* của docScroll.js) ngay sau khi lăn chuột.
// Độ trễ từ 16ms trở lên: lần lăn đã áp lên trang cũ trước khi rời. Dưới 16ms (cùng khung hình) lần lăn chưa áp lên trang cũ
// và trình duyệt áp nó lên trang mới như người dùng cuộn trang mới: không thuộc phạm vi app, không đo ở đây.
const A = require('./common.cjs');
A.run(async ({ mk }) => {
  for (const ms of [16, 60, 250]) {
    const S = await mk({ viewport: { width: 390, height: 640 } }); const p = S.page;
    await A.goTab(p, 'Kế hoạch'); await A.jump(p, 250); await A.settle(p); await A.goTab(p, 'Khách mời'); await A.jump(p, 100); await A.settle(p);
    await p.evaluate(() => { window.__tr = []; const f = () => { __tr.push([location.hash, Math.round(scrollY)]); requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await p.mouse.move(195, 300); await p.mouse.wheel(0, 800); await p.waitForTimeout(ms); await p.goBack();
    await p.waitForFunction(() => location.hash === '#/ke-hoach'); const k = await A.settle(p);
    const tr = await p.evaluate(() => __tr.slice());
    const leave = (tr.filter((t) => t[0] === '#/khach-moi').pop() || [])[1];
    const kh = tr.filter((t) => t[0] === '#/ke-hoach').map((t) => t[1]);
    A.check(`trễ ${ms}ms, Back trình duyệt: Kế hoạch mọi khung hình ở 250 (thấy ${[...new Set(kh)].join(',')}; ổn định ${k})`, kh.length > 0 && kh.every((y) => Math.abs(y - 250) <= 2) && Math.abs(k - 250) <= 2);
    await p.evaluate(() => { __tr.length = 0; }); await p.goForward(); await p.waitForFunction(() => location.hash === '#/khach-moi'); const f = await A.settle(p);
    const kf = (await p.evaluate(() => __tr.slice())).filter((t) => t[0] === '#/khach-moi').map((t) => t[1]);
    A.check(`trễ ${ms}ms, Forward trình duyệt: Khách mời về vị trí lúc rời ${leave} ở mọi khung hình (thấy ${[...new Set(kf)].join(',')}; ổn định ${f})`, leave > 100 && kf.length > 0 && kf.every((y) => Math.abs(y - leave) <= 2) && Math.abs(f - leave) <= 2);
    await S.ctx.close();
  }
});
