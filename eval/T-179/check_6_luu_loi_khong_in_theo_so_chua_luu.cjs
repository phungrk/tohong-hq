#!/usr/bin/env node
/* T-179 tiêu chí 6 (App thật, spec H6 + H1): lưu dự toán LỖI (500) sau khi kéo 90 -> 40: màn Ngân sách hiện "Chưa lưu được dự toán" + "Thử lại"; bấm Tìm vendor dùng số ĐÃ LƯU (90tr) nên không in danh sách mới,
 * không gọi match, danh sách 1 giữ nguyên (Alpha 100%, "Theo dự toán 90tr"); câu báo còn nguyên sau khi đóng chat. Server tốt lại, bấm "Thử lại" lưu được 40, bấm Tìm vendor in danh sách 2 ghi "Theo dự toán 40tr".
 * Chạy từ gốc tohong-hq: node eval/T-179/check_6_luu_loi_khong_in_theo_so_chua_luu.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async ({ dev, br, bad, newServer, openApp, dragTo, lists, body, pressFind, pressFindQuiet, closeChat, fixed, same }) => {
  const S = newServer(); const { ctx, pg } = await openApp(dev, br, S);
  const L1 = await pressFind(pg, 1); const s1 = fixed(L1); await closeChat(pg);
  S.putFail = 500; await dragTo(pg, 40, { settleMs: 2500 });
  if (!/Chưa lưu được dự toán/.test(await body(pg))) bad('khung: lưu lỗi mà màn Ngân sách không hiện "Chưa lưu được dự toán"');
  const m = S.calls.match; const L = await pressFindQuiet(pg, 2000);
  if (L.length !== 1 || S.calls.match !== m) bad(`lưu lỗi: số đã lưu vẫn 90 nên không được in danh sách mới (danh sách ${L.length}, match +${S.calls.match - m})`);
  if (!same(fixed(L), s1)) bad('lưu lỗi: danh sách 1 đổi nội dung');
  await closeChat(pg); if (!/Chưa lưu được dự toán/.test(await body(pg))) bad('câu "Chưa lưu được dự toán" biến mất sau khi mở/đóng chat');
  S.putFail = null; await pg.getByRole('button', { name: 'Thử lại' }).first().click(); await sleep(1500);
  if (S.venue !== 40) bad('khung: "Thử lại" không lưu được 40');
  const L2 = await pressFind(pg, 2);
  if (L2.length !== 2 || L2[1].label !== 'Theo dự toán 40tr · 200 khách') bad(`sau Thử lại thành công phải in danh sách 2 "Theo dự toán 40tr · 200 khách", thấy ${L2.length} danh sách ${L2[1] && L2[1].label}`);
  await ctx.close();
});
