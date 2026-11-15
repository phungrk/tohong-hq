#!/usr/bin/env node
/* T-177 tiêu chí 5 (tohong-front): ở khung 360px nhãn dài nhất không tràn: nút nằm trong khung (0..360), không có thanh cuộn ngang trang, nội dung nút (chữ, biểu tượng) không vượt hộp nút, chữ xuống dòng chứ không bị cắt "...".
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
    if (b.scrollW > b.clientW + 1) bad(`[${id}] nội dung nút rộng hơn nút (${b.scrollW} > ${b.clientW})`);
    if (b.clipped) bad(`[${id}] chữ/biểu tượng trong nút vượt hộp nút`);
    if (b.docW > 360) bad(`[${id}] trang có cuộn ngang (rộng ${b.docW} > 360)`);
    await ctx.close();
  }
});
