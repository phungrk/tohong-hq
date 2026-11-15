#!/usr/bin/env node
/* T-179 tiêu chí 8 (App thật, spec H5): "Xem thêm" của danh sách CŨ không trộn hàng chấm theo số mới vào danh sách cũ. Server giả có 8 vendor (5 hàng đầu + "Xem thêm 3 vendor").
 * Danh sách 1 (90tr) rồi đổi 40tr, danh sách 2 (40tr): bấm "Xem thêm" ở danh sách 1 thì danh sách 1 vẫn 5 hàng, Alpha 100%, hiện đúng câu
 * "Dự toán đã đổi, không thêm được vendor vào danh sách này. Mở lại Tìm vendor để xem danh sách mới."; bấm "Xem thêm" ở danh sách 2 (số vẫn là số đã lưu) thêm đủ 8 hàng, Alpha 70%, nhãn "Theo dự toán 40tr · 200 khách".
 * Chạy từ gốc tohong-hq: node eval/T-179/check_8_xem_them_danh_sach_cu.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async ({ alpha, dev, br, bad, newServer, openApp, dragTo, lists, body, pressFind, closeChat, manyVendors }) => {
  const S = newServer(); const { ctx, pg } = await openApp(dev, br, S); await manyVendors(pg, S);
  let L = await pressFind(pg, 1); if (L[0].rows !== 5) bad(`khung: danh sách đầu phải 5 hàng, thấy ${L[0].rows}`);
  await closeChat(pg); await dragTo(pg, 40, { settleMs: 2000 }); L = await pressFind(pg, 2);
  const MSG = 'Dự toán đã đổi, không thêm được vendor vào danh sách này. Mở lại Tìm vendor để xem danh sách mới.';
  const more = pg.getByRole('button', { name: /Xem thêm \d+ vendor/ });
  if ((await more.count()) < 2) { bad(`khung: phải có nút "Xem thêm" ở cả hai danh sách, thấy ${await more.count()}`); await ctx.close(); return; }
  await more.nth(0).click(); await sleep(1500); L = await lists(pg); let t = await body(pg);
  if (L[0].rows !== 5 || alpha(L[0]) !== '100' || L[0].label !== 'Theo dự toán 90tr · 200 khách') bad(`danh sách cũ sau "Xem thêm" phải giữ 5 hàng, Alpha 100%, nhãn 90tr; thấy ${L[0].rows} hàng, ${alpha(L[0])}%, ${L[0].label}`);
  if (!t.includes(MSG)) bad('danh sách cũ bấm "Xem thêm" khi số đã đổi phải hiện: ' + MSG);
  if ((await pg.getByRole('button', { name: /Xem thêm \d+ vendor/ }).count()) !== 1) bad('sau câu cố định, nút "Xem thêm" của danh sách cũ phải ẩn (chỉ còn nút của danh sách mới nhất)');
  const more2 = pg.getByRole('button', { name: /Xem thêm \d+ vendor/ }); await more2.last().click(); await sleep(1500); L = await lists(pg);
  if (L[1].rows !== 8 || alpha(L[1]) !== '70' || L[1].label !== 'Theo dự toán 40tr · 200 khách') bad(`danh sách mới nhất "Xem thêm" phải đủ 8 hàng, Alpha 70%, nhãn 40tr; thấy ${L[1].rows} hàng, ${alpha(L[1])}%, ${L[1].label}`);
  if (L[0].rows !== 5) bad('"Xem thêm" của danh sách mới làm danh sách cũ đổi số hàng');
  await ctx.close();
});
