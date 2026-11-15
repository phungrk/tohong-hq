#!/usr/bin/env node
/* T-177 tiêu chí 5 (tohong-front): ở khung 360px nhãn dài nhất không tràn và KHÔNG BỊ CẮT: nút trong khung (0..360), không cuộn ngang trang; nút và mọi phần tử con có chữ không có nội dung rộng/cao hơn hộp của nó (bắt ellipsis, line-clamp, overflow:hidden trên span con); từng dòng chữ (đo bằng Range) nằm trọn trong hộp hiện được của mọi tổ tiên tới nút; tên dài thì chữ trải >= 2 dòng (xuống dòng thật, không nhồi một dòng).
 * Ca: tên dài "Nhẫn cưới + trang sức + quà tặng hai họ rất dài" với 1440tr; và "Tuần trăng mật" 1440tr. Tên giữ chữ thường.
 * Chạy từ gốc tohong-hq: node eval/T-177/check_5_khong_tran_360px.cjs [--repo <tohong-front>] */
const { run } = require('./_lib.cjs');
run(async ({ dev, br, bad, openCat, findBtn, mkDoc }) => {
  for (const [id, name] of [['jewelry', 'Nhẫn cưới + trang sức + quà tặng hai họ rất dài'], ['honeymoon', 'Tuần trăng mật']]) {
    const { ctx, pg } = await openCat(br, dev, mkDoc([{ id, name, allocated_tr: 1440 }, { id: 'reserve', name: 'Dự phòng', allocated_tr: 10 }]), id);
    const b = await findBtn(pg), want = `Tìm ${name.toLowerCase()} trong khoảng 1440tr`;
    if (b.n !== 1) { bad(`[${id}] cần đúng một nút "Tìm", thấy ${b.n}`); await ctx.close(); continue; }
    if (b.text !== want) bad(`[${id}] nhãn phải là "${want}" (tên giữ chữ thường, không cắt), thấy "${b.text}"`);
    if (b.right > 360.5 || b.left < -0.5) bad(`[${id}] nút tràn khung 360px (trái ${b.left}, phải ${b.right})`);
    if (b.cut.length) bad(`[${id}] chữ bị cắt/tràn trong nút: ${b.cut.join('; ')}`);
    if (id === 'jewelry' && b.lines < 2) bad(`[${id}] tên dài phải xuống dòng (>= 2 dòng), thấy ${b.lines} dòng`);
    if (b.docW > 360) bad(`[${id}] trang có cuộn ngang (rộng ${b.docW} > 360)`);
    await ctx.close();
  }
});
