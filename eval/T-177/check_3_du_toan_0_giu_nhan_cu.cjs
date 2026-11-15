#!/usr/bin/env node
/* T-177 tiêu chí 3 (tohong-front): dự toán 0 (hoặc chưa phân bổ, hoặc nhỏ đến mức làm tròn 1 chữ số thành 0) thì nút giữ đúng "Tìm <hạng mục>", KHÔNG có "trong khoảng", "0tr".
 * Ca: allocated_tr 0; thiếu trường allocated_tr; 0,04; kéo thanh từ 90 xuống 0 -> nhãn cũ; kéo lên lại 5 -> "trong khoảng 5tr".
 * Chạy từ gốc tohong-hq: node eval/T-177/check_3_du_toan_0_giu_nhan_cu.cjs [--repo <tohong-front>] */
const { run } = require('./_lib.cjs');
run(async ({ dev, br, bad, openCat, findBtn, dragTo, mkDoc, sleep }) => {
  const OLD = 'Tìm nhà hàng tiệc cưới';
  const ok = (t) => t === OLD;
  for (const [label, v] of [['0', 0], ['thiếu trường', undefined], ['0,04', 0.04]]) {
    const c = { id: 'venue', name: 'Nhà hàng tiệc cưới' }; if (v !== undefined) c.allocated_tr = v;
    const { ctx, pg } = await openCat(br, dev, mkDoc([c, { id: 'reserve', name: 'Dự phòng', allocated_tr: 100 }]), 'venue');
    const b = await findBtn(pg); if (b.n !== 1 || !ok(b.text)) bad(`dự toán ${label}: nhãn phải giữ đúng "${OLD}", thấy "${b.text}"`);
    await ctx.close();
  }
  const { ctx, pg } = await openCat(br, dev, mkDoc([{ id: 'venue', name: 'Nhà hàng tiệc cưới', allocated_tr: 90 }, { id: 'reserve', name: 'Dự phòng', allocated_tr: 110 }]), 'venue');
  await dragTo(pg, 0); await sleep(100); let b = await findBtn(pg);
  if (!ok(b.text)) bad(`kéo thanh về 0: nhãn phải về "${OLD}", thấy "${b.text}"`);
  await dragTo(pg, 5); await sleep(100); b = await findBtn(pg);
  if (b.text !== `${OLD} trong khoảng 5tr`) bad(`kéo thanh lên 5: nhãn phải là "${OLD} trong khoảng 5tr", thấy "${b.text}"`);
  await ctx.close();
});
