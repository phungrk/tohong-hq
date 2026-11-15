#!/usr/bin/env node
/* T-181 adv-05 (adversary, tầng 3): spec T-177 H2 + inv-001: nhãn khớp số trên thanh ở MỌI bước kéo, không trễ một nhịp (stale) — check_2 chỉ kiểm 3 điểm.
 * Quét bằng phím từ 0 lên 12 rồi xuống 0 trên "Tuần trăng mật" (hạng mục có kéo kèm Dự phòng); sau mỗi phím: nhãn = "… trong khoảng <thanh>tr", thanh 0 -> nhãn cũ.
 * Chạy từ gốc tohong-hq: node eval/T-181/adv-05-quet-thanh-tung-buoc.cjs [--repo <tohong-front>] */
const { run } = require('../T-177/_lib.cjs');
run(async ({ dev, br, bad, openCat, findBtn, sliderVal, dragTo, mkDoc, fmt }) => {
  const { ctx, pg } = await openCat(br, dev, mkDoc([{ id: 'honeymoon', name: 'Tuần trăng mật', allocated_tr: 0 }, { id: 'reserve', name: 'Dự phòng', allocated_tr: 200 }]), 'honeymoon');
  const sl = pg.getByRole('slider', { name: 'Dự toán' }); await sl.focus();
  const check = async (step) => {
    const sv = await sliderVal(pg), b = await findBtn(pg);
    const w = sv > 0 ? `Tìm tuần trăng mật trong khoảng ${fmt(sv)}tr` : 'Tìm tuần trăng mật';
    if (b.text !== w) bad(`${step}: thanh ${sv}, nhãn phải "${w}", thấy "${b.text}"`);
  };
  await check('mở màn');
  for (let i = 0; i < 12; i++) { await pg.keyboard.press('ArrowRight'); await check(`phải #${i + 1}`); }
  for (let i = 0; i < 14; i++) { await pg.keyboard.press('ArrowLeft'); await check(`trái #${i + 1}`); }
  await ctx.close();
});
