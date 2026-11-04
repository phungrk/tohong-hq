// adv-03 (T-055, adversary). Spec T-054 mục 5.1 ("mốc nội dung nền giữ nguyên toạ độ trong màn hình, sai số 1px; lúc vừa mở nền cũng không nhảy"),
// 5.2 (đóng trả đúng mốc), 5.4 (phần tử phủ rộng đúng bằng khung, căn giữa), 7.3 (viewport rộng hơn khung).
// Input phá: máy tính có thanh cuộn cổ điển chiếm chỗ (mặc định Chrome/Edge trên Windows, Linux; macOS khi bật "luôn hiện thanh cuộn").
// Chromium headless của harness ẩn thanh cuộn, nên ở đây giả lập bằng ::-webkit-scrollbar rộng 15px (chỉ đổi thanh cuộn của trình duyệt, không đổi bố cục app).
// Trước T-054 document không bao giờ cuộn nên không có thanh cuộn; nay khoá nền bằng overflow: hidden trên html làm thanh cuộn biến mất khi mở lớp
// và cả khung dịch ngang nửa bề rộng thanh cuộn (7,5px), rồi dịch lại khi đóng.
const A = require('./common.cjs');
const SB = '::-webkit-scrollbar{width:15px;height:15px;background:#ddd}::-webkit-scrollbar-thumb{background:#888}';
const frameBox = (p) => p.evaluate(() => { const r = document.querySelector('.app-frame').getBoundingClientRect(); return { l: r.left, r: r.right, cw: document.documentElement.clientWidth, iw: innerWidth }; });
A.run(async ({ mk }) => {
  for (const W of [1024, 1280]) {
    const S = await mk({ viewport: { width: W, height: 360 } }); const p = S.page;
    await p.addStyleTag({ content: SB }); await A.frames(p, 3);
    // ngăn kéo ở Kế hoạch (trang dài)
    await A.goTab(p, 'Kế hoạch'); await A.jump(p, 300); await A.settle(p);
    const f0 = await frameBox(p);
    A.check(`${W}px: môi trường có thanh cuộn chiếm chỗ (clientWidth ${f0.cw} < innerWidth ${f0.iw})`, f0.cw < f0.iw);
    const m0 = await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Kế hoạch' && b.getBoundingClientRect().width > 2); return b.getBoundingClientRect().left; });
    await A.tap(p, 'Mở menu'); await A.waitBtn(p, 'Đóng menu'); await A.idle(p);
    const f1 = await frameBox(p);
    const m1 = await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Kế hoạch' && b.getBoundingClientRect().width > 2 && b.getAttribute('aria-current') === 'page'); return b ? b.getBoundingClientRect().left : null; });
    A.check(`${W}px: mở ngăn kéo, khung không dịch ngang (mép trái ${f0.l.toFixed(1)} → ${f1.l.toFixed(1)})`, Math.abs(f1.l - f0.l) <= 1);
    A.check(`${W}px: mở ngăn kéo, nút tab nền giữ toạ độ ngang (${m0.toFixed(1)} → ${m1 === null ? '?' : m1.toFixed(1)})`, m1 !== null && Math.abs(m1 - m0) <= 1);
    const dl = await p.evaluate(() => { const c = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '') === 'Đóng menu'); let a = c; while (a && a.parentElement && a.parentElement.getBoundingClientRect().height < innerHeight - 1) a = a.parentElement; return a ? a.parentElement.getBoundingClientRect().left : null; });
    A.check(`${W}px: ngăn kéo bám mép trái khung đang hiện (${dl === null ? '?' : dl.toFixed(1)} so với ${f1.l.toFixed(1)})`, dl !== null && Math.abs(dl - f1.l) <= 1.5);
    await A.tap(p, 'Đóng menu'); await A.waitBtn(p, 'Đóng menu', false); await A.idle(p);
    const f2 = await frameBox(p);
    A.check(`${W}px: đóng ngăn kéo, khung về đúng chỗ (${f2.l.toFixed(1)} so với ${f0.l.toFixed(1)})`, Math.abs(f2.l - f0.l) <= 1);
    // sheet Mời ở Trang chủ (màn thấp 360px để Trang chủ cuộn được)
    await A.goTab(p, 'Trang chủ'); await A.jump(p, 60); await A.settle(p);
    const g0 = await frameBox(p);
    await A.tap(p, 'Mời người ấy / gia đình cùng xem'); await p.getByRole('dialog', { name: 'Mời người ấy hoặc gia đình cùng xem' }).waitFor(); await A.idle(p);
    const g1 = await frameBox(p);
    const sh = await p.evaluate(() => { const d = document.querySelector('[role="dialog"][aria-label="Mời người ấy hoặc gia đình cùng xem"]').getBoundingClientRect(); return { l: d.left, r: d.right }; });
    A.check(`${W}px: mở sheet Mời, khung không dịch ngang (${g0.l.toFixed(1)} → ${g1.l.toFixed(1)}, clientWidth ${g0.cw})`, Math.abs(g1.l - g0.l) <= 1);
    A.check(`${W}px: sheet Mời rộng đúng bằng khung (${sh.l.toFixed(1)}..${sh.r.toFixed(1)} so với ${g1.l.toFixed(1)}..${g1.r.toFixed(1)})`, Math.abs(sh.l - g1.l) <= 1.5 && Math.abs(sh.r - g1.r) <= 1.5);
    await p.goBack(); await A.idle(p);
    await S.ctx.close();
  }
});
