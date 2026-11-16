#!/usr/bin/env node
/* T-185 tiêu chí 5 (H5, giữ T-171 H2): chi tiết lỗi 500 -> khối chỉ còn tiêu đề + "Chưa cập nhật được điểm. Thử lại" (không skeleton, không số). Bấm "Thử lại" (lần 2 trễ 1,2s): khối lại vào chờ
 * (câu lỗi biến mất, sau ~150ms hiện skeleton đủ bốn phần, không chữ/số), điểm về thì hiện 80% và skeleton mất. Đúng 2 lần thử (cụm yêu cầu cách nhau >= 300ms) gọi chi tiết.
 * Chạy từ gốc tohong-hq: node eval/T-185/check_5_loi_va_thu_lai.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async (h) => {
  const { bad, setup, snap, dynText, zones, zonesOk, zonesMsg, openBeta } = h;
  const { ctx, pg, route } = await setup((n) => (n === 0 ? { fail: true } : { delay: 1200 }));
  await openBeta(pg); await sleep(1500); const e = await snap(pg);
  if (!e) bad('không thấy khối "Phân tích AI"');
  else {
    if (e.busy) bad('lỗi thì không được còn skeleton');
    if (dynText(e.text) !== 'Chưa cập nhật được điểm. Thử lại') bad('lỗi phải hiện đúng "Chưa cập nhật được điểm. Thử lại", đang thấy: "' + dynText(e.text) + '"');
  }
  await pg.getByRole('button', { name: 'Thử lại' }).first().click(); await sleep(600); const w = await snap(pg);
  if (!w || !w.busy) bad('bấm Thử lại: sau ~600ms phải hiện skeleton');
  else { if (!zonesOk(zones(w))) bad('skeleton sau Thử lại thiếu phần: ' + zonesMsg(zones(w))); if (dynText(w.text)) bad('sau Thử lại lúc chờ còn chữ: "' + dynText(w.text) + '"'); }
  await sleep(1500); const f = await snap(pg);
  if (!f || f.busy || !/80% phù hợp/i.test(f.text)) bad('Thử lại thành công phải hiện 80% phù hợp và hết skeleton');
  if (route.attempts !== 2) bad('phải đúng 2 lần thử gọi chi tiết (mở + Thử lại), đang là ' + route.attempts);
  await ctx.close();
});
