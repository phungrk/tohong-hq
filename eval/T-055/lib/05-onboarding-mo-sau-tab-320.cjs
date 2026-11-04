// adv-05 (T-055, adversary). Các điểm Chief of Staff yêu cầu soi mà eval tầng 1 chưa chạm:
//  A. Onboarding đang mở (lần đầu, chưa có hồ sơ) là lớp: lăn chuột và phím PageDown/End không làm document cuộn (spec mục "Lớp", 5.1).
//  B. Mở sâu #/ngan-sach/<id> rồi TẢI LẠI: trang con vẫn hiện, document cuộn được, header "Quay lại" dính đầu,
//     không khung con nào ngoài lớp có scrollTop > 0, "Quay lại" về danh sách (mục 1.1, 1.2, 3.1, 4.7).
//  C. Phím Tab khi khối gợi ý cài đang ẩn (UA iPhone, đã kéo lên): focus không rơi vào khối đang ẩn và không vào màn đang ẩn (mục 2.1, 8.5).
//  D. 320px: không cuộn ngang ở trang con (cuộn tới cuối) và khi lớp đang mở (ngăn kéo, sheet Mời, chat AI) sau khi lăn ngang (mục 7.2).
const A = require('./common.cjs');
const HINT_SEL = `[role="region"][aria-label="${A.HINT}"]`;
const innerScrolled = (p) => p.evaluate(() => {
  // Miễn phần tử trong lớp (role=dialog, ngăn kéo, khối quanh nút "Đóng"), như spec 1.2.
  const inLayer = (e) => !!e.closest('[role="dialog"], .drawer, .ov-fixed');
  return [...document.querySelectorAll('body *')].filter((e) => e.scrollTop > 0 && !inLayer(e)).map((e) => e.tagName + '.' + (e.className || '')).slice(0, 3);
});
const hscroll = (p) => p.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, cw: document.documentElement.clientWidth, sx: Math.round(scrollX) }));
A.run(async ({ mk, base }) => {
  // A. Onboarding khoá nền
  { const S = await mk({ viewport: { width: 390, height: 640 } }); const p = S.page;
    await p.evaluate(() => localStorage.removeItem('th_user'));
    await p.goto(base + '/#/ke-hoach'); await p.reload(); await p.getByRole('button', { name: 'Khách mời', exact: true }).first().waitFor();
    await p.waitForTimeout(500); await A.idle(p);
    const range = await p.evaluate(() => document.scrollingElement.scrollHeight - innerHeight);
    A.check(`Onboarding: Kế hoạch dài hơn màn (${range}px) để phép thử có nghĩa`, range > 200);
    await p.mouse.move(195, 30); await p.mouse.wheel(0, 600); const y1 = await A.settle(p);
    await p.mouse.move(195, 400); await p.mouse.wheel(0, 600); const y2 = await A.settle(p);
    await p.keyboard.press('PageDown'); await p.keyboard.press('End'); const y3 = await A.settle(p);
    A.check(`Onboarding mở: lăn trên lớp tối/bảng và PageDown/End không cuộn nền (${y1}, ${y2}, ${y3})`, y1 === 0 && y2 === 0 && y3 === 0);
    A.check('Onboarding: không lỗi JS', S.errors.length === 0, S.errors.slice(0, 2).join(' | '));
    await S.ctx.close(); }
  // B. Mở sâu trang con rồi tải lại
  { const S = await mk({ viewport: { width: 390, height: 640 }, hash: 'ngan-sach/venue' }); const p = S.page;
    await p.waitForFunction(() => location.hash === '#/ngan-sach/venue'); await A.settle(p);
    await p.mouse.move(195, 300); await p.mouse.wheel(0, 250); await A.settle(p);
    await p.reload(); await p.getByRole('button', { name: 'Khách mời', exact: true }).first().waitFor();
    A.check('Tải lại #/ngan-sach/venue: địa chỉ giữ nguyên', await p.waitForFunction(() => location.hash === '#/ngan-sach/venue', null, { timeout: 4000 }).then(() => true, () => false));
    A.check('Tải lại: thấy "Quay lại"', await A.waitBtn(p, 'Quay lại'));
    await p.mouse.move(195, 300); await p.mouse.wheel(0, 400); const y = await A.settle(p);
    A.check(`Tải lại: document cuộn được (${y})`, y > 100);
    const back = await A.btn(p, 'Quay lại'); const top = back ? await back.evaluate((e) => e.getBoundingClientRect().top) : null;
    A.check(`Tải lại: "Quay lại" dính đầu sau khi cuộn (top ${top})`, top !== null && top >= 0 && top < 80);
    const inner = await innerScrolled(p); A.check('Tải lại: không khung con nào ngoài lớp có scrollTop > 0', inner.length === 0, inner.join(', '));
    await A.tap(p, 'Quay lại'); await p.waitForFunction(() => location.hash === '#/ngan-sach'); const yl = await A.settle(p);
    A.check(`Tải lại: "Quay lại" về danh sách chưa từng xem ở đầu (${yl})`, Math.abs(yl) <= 2);
    A.check('Tải lại: không lỗi JS', S.errors.length === 0, S.errors.slice(0, 2).join(' | '));
    await S.ctx.close(); }
  // C. Phím Tab khi khối gợi ý đang ẩn
  { const S = await mk({ viewport: { width: 390, height: 640 }, ua: A.IOS_UA }); const p = S.page;
    await A.goTab(p, 'Kế hoạch'); await A.jump(p, 0);
    const present = await p.evaluate((s) => !!document.querySelector(s), HINT_SEL);
    A.check('Tab: khối gợi ý có mặt (UA iPhone)', present && await A.hintVisible(p));
    await A.jump(p, 150); await A.jump(p, 300);
    A.check('Tab: khối gợi ý đã ẩn sau khi kéo lên', !(await A.hintVisible(p)));
    const bad = [];
    for (let i = 0; i < 70; i++) { await p.keyboard.press('Tab');
      const r = await p.evaluate((s) => { const a = document.activeElement; if (!a || a === document.body) return null;
        if (a.closest(s)) return 'khối gợi ý ẩn: ' + (a.textContent || '').trim().slice(0, 30);
        if (!a.getClientRects().length) return 'phần tử không hiển thị (màn ẩn?): ' + a.tagName + ' ' + (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 30);
        return null; }, HINT_SEL);
      if (r) bad.push(r); }
    A.check('Tab ×70 ở Kế hoạch khi khối ẩn: focus không vào khối ẩn hay màn ẩn', bad.length === 0, [...new Set(bad)].slice(0, 2).join('; '));
    await S.ctx.close(); }
  // D. 320px: trang con và lớp mở không cuộn ngang
  { const S = await mk({ viewport: { width: 320, height: 568 }, hash: 'ngan-sach/venue' }); const p = S.page;
    await p.waitForFunction(() => location.hash === '#/ngan-sach/venue'); await A.settle(p);
    await p.mouse.move(160, 300); await p.mouse.wheel(0, 99999); await A.settle(p); await p.mouse.wheel(300, 0); await A.settle(p);
    let h = await hscroll(p); A.check(`320 trang con cuối trang: không cuộn ngang (sw ${h.sw}/cw ${h.cw}, scrollX ${h.sx})`, h.sw <= h.cw && h.sx === 0);
    await A.goTab(p, 'Kế hoạch'); await A.jump(p, 400);
    for (const [name, tab, open, isOpen, close] of [
      ['ngăn kéo', 'Kế hoạch', 'Mở menu', (q) => A.waitBtn(q, 'Đóng menu'), (q) => A.tap(q, 'Đóng menu')],
      ['sheet Mời', 'Trang chủ', 'Mời người ấy / gia đình cùng xem', (q) => q.getByRole('dialog', { name: 'Mời người ấy hoặc gia đình cùng xem' }).waitFor().then(() => true), (q) => q.goBack()],
      ['chat AI', 'Ngân sách', 'AI', (q) => A.waitBtn(q, 'Đóng'), (q) => A.tap(q, 'Đóng')]]) {
      await A.goTab(p, tab); await A.tap(p, open); const ok = await isOpen(p); await A.idle(p);
      await p.mouse.move(160, 300); await p.mouse.wheel(300, 0); await p.keyboard.press('ArrowRight'); await A.settle(p);
      h = await hscroll(p); A.check(`320 ${name} mở: không cuộn ngang (mở ${ok}, sw ${h.sw}/cw ${h.cw}, scrollX ${h.sx})`, ok && h.sw <= h.cw && h.sx === 0);
      await close(p); await p.waitForTimeout(350); await A.idle(p); }
    A.check('320: không lỗi JS', S.errors.length === 0, S.errors.slice(0, 2).join(' | '));
    await S.ctx.close(); }
});
