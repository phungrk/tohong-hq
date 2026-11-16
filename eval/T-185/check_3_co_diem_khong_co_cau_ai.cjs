#!/usr/bin/env node
/* T-185 tiêu chí 3 (H3): phản hồi 2xx CÓ điểm nhưng KHÔNG có câu AI (whyThisVendor vắng): ba thanh, phần trăm, dòng phép so hiện THẬT ngay; phần câu AI KHÔNG skeleton, không "▌", không chữ chờ, không gõ chữ;
 * trạng thái ổn định (hai lần chụp cách 1s giống nhau). (Quy tắc cho trường hợp câu AI về SAU điểm: thanh thật, chỉ câu AI là skeleton tới khi về; hiện tại back trả chung một phản hồi nên không dựng được trong eval.)
 * Chạy từ gốc tohong-hq: node eval/T-185/check_3_co_diem_khong_co_cau_ai.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async (h) => {
  const { bad, setup, snap, openBeta } = h;
  const { ctx, pg } = await setup({ delay: 500, why: null });
  await openBeta(pg); await sleep(1700); const a = await snap(pg); await sleep(1000); const b = await snap(pg);
  if (!a) bad('không thấy khối "Phân tích AI"');
  else {
    if (a.busy) bad('có điểm mà không có câu AI: không được còn skeleton ở đâu cả');
    if (!/80% phù hợp/i.test(a.text)) bad('phải hiện "Phân tích AI · 80% phù hợp"');
    if (!/Ngân sách\s*100%/.test(a.text) || !/Phong cách\s*50%/.test(a.text) || !/Lịch trống\s*100%/.test(a.text)) bad('ba thanh phải hiện số thật: Ngân sách 100%, Phong cách 50%, Lịch trống 100%');
    if (!/so với 90tr/.test(a.text)) bad('dòng phép so phải hiện ("… so với 90tr tiệc cưới")');
    if (/▌|Đang cập nhật|Đang tải/.test(a.text)) bad('không chữ chờ / caret khi không có câu AI');
    if (b && a.text !== b.text) bad('khối không ổn định giữa hai lần chụp');
  }
  await ctx.close();
});
