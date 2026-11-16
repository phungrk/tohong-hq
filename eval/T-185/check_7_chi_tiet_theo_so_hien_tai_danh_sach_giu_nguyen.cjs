#!/usr/bin/env node
/* T-185 tiêu chí 7 (H7, giữ T-179 H4): danh sách đã in còn "Alpha 100%" (dự toán 90). Server đổi sang dự toán 40 (danh sách không biết, không có sự kiện đổi số trong app). Bấm Alpha, chi tiết trễ 1,2s:
 * lúc chờ khối không hiện số nào (không 100% của hàng); hàng Alpha trong danh sách vẫn 100%; khi về chi tiết hiện "70% phù hợp" và "so với 40tr"; danh sách vẫn 100% (không bị skeleton, không đổi).
 * Chạy từ gốc tohong-hq: node eval/T-185/check_7_chi_tiet_theo_so_hien_tai_danh_sach_giu_nguyen.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async (h) => {
  const { bad, setup, snap, dynText, lists, alpha } = h;
  const { S, ctx, pg } = await setup({ delay: 1200 });
  if (alpha((await lists(pg))[0]) !== '100') bad('tiền đề: danh sách phải in Alpha 100% (dự toán 90)');
  S.venue = 40;
  await pg.getByText('Alpha Hall', { exact: false }).first().click(); await sleep(700); const w = await snap(pg);
  if (!w || !w.skel) bad('lúc chờ phải hiện skeleton'); else if (dynText(w.text)) bad('lúc chờ khối hiện số/chữ ngoài chữ tĩnh: "' + dynText(w.text) + '"');
  if (alpha((await lists(pg))[0]) !== '100') bad('lúc chờ, danh sách cũ phải giữ Alpha 100%');
  await sleep(1400); const f = await snap(pg);
  if (!f || f.skel || f.busy || !/70% phù hợp/i.test(f.text)) bad('chi tiết về phải hiện "70% phù hợp" theo dự toán 40 hiện tại');
  else if (!/so với 40tr/.test(f.text)) bad('dòng phép so phải là "so với 40tr"');
  if (alpha((await lists(pg))[0]) !== '100') bad('sau khi chi tiết về, danh sách cũ vẫn phải là Alpha 100%');
  await ctx.close();
});
