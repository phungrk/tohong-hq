#!/usr/bin/env node
/* T-177 tiêu chí 4 (tohong-front): bấm nút (cả khi nhãn có "trong khoảng" lẫn khi dự toán 0) mở tìm vendor đúng hạng mục: đúng một lần gọi mở tìm với id hạng mục đang xem;
 * bấm không gửi thêm lệnh ghi dự toán và không gọi POST nào. Ca: photography 12,5 (có khoảng), photography 0 (nhãn cũ), venue 90.
 * Chạy từ gốc tohong-hq: node eval/T-177/check_4_bam_mo_tim_vendor.cjs [--repo <tohong-front>] */
const { run } = require('./_lib.cjs');
run(async ({ dev, br, bad, openCat, mkDoc, sleep }) => {
  for (const [id, name, amt] of [['photography', 'Chụp ảnh + quay phim', 12.5], ['photography', 'Chụp ảnh + quay phim', 0], ['venue', 'Nhà hàng tiệc cưới', 90]]) {
    const { ctx, pg, S } = await openCat(br, dev, mkDoc([{ id, name, allocated_tr: amt }, { id: 'reserve', name: 'Dự phòng', allocated_tr: 100 }]), id);
    const puts0 = S.puts.length, posts0 = S.posts;
    await pg.locator('button', { hasText: /^\s*Tìm\s/ }).click(); await sleep(1200);
    const opened = await pg.evaluate(() => window.__opened);
    if (opened.length !== 1 || opened[0] !== id) bad(`[${id} ${amt}tr] bấm nút phải mở tìm vendor đúng một lần với "${id}", thấy ${JSON.stringify(opened)}`);
    if (S.puts.length !== puts0) bad(`[${id} ${amt}tr] bấm nút không được ghi dự toán (PUT ${S.puts.length - puts0} lần)`);
    if (S.posts !== posts0) bad(`[${id} ${amt}tr] bấm nút không được gọi POST (${S.posts - posts0} lần)`);
    await ctx.close();
  }
});
