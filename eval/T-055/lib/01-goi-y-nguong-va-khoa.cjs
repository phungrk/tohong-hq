// adv-01 (T-055, adversary). Spec T-054 mục 8.2/8.3 (ghi chú M3) và 5.1 với khối gợi ý đang chiếm chỗ (ghi chú M4).
// M3: lên 5, xuống 2, lên 5 (mốc là chỗ đổi hướng) thì khối vẫn hiện; thêm 3px nữa (8px từ mốc) thì ẩn. Đối xứng khi đang ẩn.
// M4: UA iPhone, khối đang hiện và chiếm chỗ ở cuối trang; mở ngăn kéo / chat AI thì scrollY không bị kẹp, lăn không trôi, đóng về đúng chỗ và khối về đúng trạng thái.
const A = require('./common.cjs');
A.run(async ({ mk }) => {
  { const S = await mk({ viewport: { width: 390, height: 360 }, ua: A.IOS_UA }); const p = S.page;
    await A.goTab(p, 'Kế hoạch'); await A.jump(p, 0);
    A.check('M3: đầu trang khối hiện', await A.hintVisible(p));
    const a = await A.jump(p, 5), b = await A.jump(p, 3), c = await A.jump(p, 8);
    A.check(`M3: 0→${a}→${b}→${c} (chưa lần nào tăng liên tục ≥ 8px): khối vẫn hiện`, await A.hintVisible(p));
    const d = await A.jump(p, 11); A.check(`M3: →${d} (tăng 8px từ mốc ${b}): khối ẩn`, !(await A.hintVisible(p)));
    await A.jump(p, 300); A.check('M3: cuộn tới 300: khối ẩn', !(await A.hintVisible(p)));
    await A.jump(p, 295); await A.jump(p, 297); const e = await A.jump(p, 292);
    A.check(`M3 đối xứng: 300→295→297→${e}: khối vẫn ẩn`, !(await A.hintVisible(p)));
    await A.jump(p, 289); A.check('M3 đối xứng: giảm 8px từ mốc 297: khối hiện', await A.hintVisible(p));
    await S.ctx.close(); }
  for (const [name, open, closeBtn, openBtn] of [['ngăn kéo', 'Mở menu', 'Đóng menu', 'Đóng menu'], ['chat AI', 'AI', 'Đóng', 'Đóng']]) {
    const S = await mk({ viewport: { width: 390, height: 640 }, ua: A.IOS_UA }); const p = S.page;
    await A.goTab(p, 'Ngân sách');
    await p.mouse.move(195, 300); await p.mouse.wheel(0, 99999); await A.settle(p); await p.mouse.wheel(0, -20); const y0 = await A.settle(p);
    const max = await p.evaluate(() => document.scrollingElement.scrollHeight - innerHeight);
    const vis = await A.hintVisible(p); const m0 = await A.leafPoint(p, 'Dự phòng phát sinh');
    A.check(`M4 ${name}: chuẩn bị ở cuối trang, khối hiện (scrollY ${y0}/${max})`, vis && y0 > 0 && max - y0 <= 30);
    await A.tap(p, open); await A.waitBtn(p, openBtn); await A.idle(p);
    const y1 = await A.settle(p); A.check(`M4 ${name}: mở lớp, scrollY không bị kẹp (${y1} so với ${y0})`, Math.abs(y1 - y0) <= 1);
    await p.mouse.wheel(0, 300); const y2 = await A.settle(p); A.check(`M4 ${name}: lăn khi lớp mở, nền đứng yên (${y2})`, Math.abs(y2 - y0) <= 1);
    await A.tap(p, closeBtn); await A.waitBtn(p, closeBtn, false); await A.idle(p);
    const y3 = await A.settle(p); const m3 = await A.leafPoint(p, 'Dự phòng phát sinh');
    A.check(`M4 ${name}: đóng lớp về đúng chỗ (${y3}), mốc nền giữ toạ độ`, Math.abs(y3 - y0) <= 1 && (!m0 || (m3 && Math.abs(m3.top - m0.top) <= 1)));
    A.check(`M4 ${name}: đóng lớp, khối về trạng thái hiện như trước`, await A.hintVisible(p));
    await S.ctx.close(); }
});
