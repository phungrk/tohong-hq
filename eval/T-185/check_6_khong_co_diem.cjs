#!/usr/bin/env node
/* T-185 tiêu chí 6 (H6, giữ T-171 H6): chi tiết 200 với match null (trễ 0,9s): lúc chờ có skeleton; khi về, khối chỉ còn tiêu đề + "Chưa có điểm cho vendor này", hết skeleton, không nút "Thử lại", không %.
 * Chạy từ gốc tohong-hq: node eval/T-185/check_6_khong_co_diem.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async (h) => {
  const { bad, setup, snap, dynText, openBeta } = h;
  const { ctx, pg } = await setup({ delay: 900, none: true });
  await openBeta(pg); await sleep(550); const w = await snap(pg);
  if (!w || !w.skel) bad('lúc chờ phải hiện skeleton');
  await sleep(1200); const f = await snap(pg);
  if (!f) bad('không thấy khối "Phân tích AI"');
  else {
    if (f.skel || f.busy) bad('không điểm thì hết skeleton');
    if (dynText(f.text) !== 'Chưa có điểm cho vendor này') bad('phải hiện đúng "Chưa có điểm cho vendor này", đang thấy: "' + dynText(f.text) + '"');
    if (/\d+%/.test(f.text)) bad('không điểm thì không hiện phần trăm');
  }
  if (await pg.getByRole('button', { name: 'Thử lại' }).count()) bad('không điểm không phải lỗi: không có nút "Thử lại"');
  await ctx.close();
});
