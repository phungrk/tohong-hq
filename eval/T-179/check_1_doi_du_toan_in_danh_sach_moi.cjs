#!/usr/bin/env node
/* T-179 tiêu chí 1 (tohong-front, App thật, spec products/T-179 H1): mở Tìm nhà hàng tiệc cưới (dự toán 90tr, 200 khách) -> một danh sách (Alpha 100%, Alpha > Beta, "Theo dự toán 90tr · 200 khách");
 * đóng chat, kéo thanh Dự toán 90 -> 40 (tự lưu), bấm Tìm nhà hàng tiệc cưới lại, KHÔNG tải lại trang: hiện HAI danh sách; danh sách mới ở cuối: Alpha 70%, Beta > Alpha, "Theo dự toán 40tr · 200 khách".
 * Cũng kiểm: không tự in khi chỉ đổi số (chưa bấm thì không gọi /api/vendors/match thêm); mỗi danh sách mới đúng một lần gọi match.
 * Chạy từ gốc tohong-hq: node eval/T-179/check_1_doi_du_toan_in_danh_sach_moi.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async ({ dev, br, bad, newServer, openApp, dragTo, lists, pressFind, closeChat, body }) => {
  const S = newServer(); const { ctx, pg } = await openApp(dev, br, S);
  await pg.evaluate(() => { window.__noReload = 1; });
  let L = await pressFind(pg, 1);
  if (L.length !== 1) bad(`lần mở đầu phải có đúng 1 danh sách, thấy ${L.length}`);
  else {
    if (L[0].pcts[0] !== '100' || L[0].names.join() !== 'Alpha,Beta') bad(`danh sách đầu (dự toán 90tr) phải Alpha 100% rồi Beta, thấy ${L[0].names} ${L[0].pcts}`);
    if (L[0].label !== 'Theo dự toán 90tr · 200 khách') bad(`danh sách đầu phải ghi "Theo dự toán 90tr · 200 khách", thấy ${L[0].label}`);
  }
  await closeChat(pg);
  const m0 = S.calls.match; await dragTo(pg, 40, { settleMs: 2000 });
  if (S.venue !== 40) bad('khung: kéo thanh không lưu được 40');
  await sleep(800); if (S.calls.match !== m0) bad(`đổi dự toán chưa bấm Tìm vendor mà đã gọi match (+${S.calls.match - m0}); danh sách mới chỉ in khi bấm`);
  L = await pressFind(pg, 2);
  if (L.length !== 2) bad(`sau đổi 90 -> 40 rồi bấm Tìm vendor phải có 2 danh sách, thấy ${L.length}`);
  else {
    if (L[1].pcts[0] !== '70' || L[1].names.join() !== 'Beta,Alpha') bad(`danh sách mới (40tr) phải Beta rồi Alpha 70%, thấy ${L[1].names} ${L[1].pcts}`);
    if (L[1].label !== 'Theo dự toán 40tr · 200 khách') bad(`danh sách mới phải ghi "Theo dự toán 40tr · 200 khách", thấy ${L[1].label}`);
  }
  if (S.calls.match - m0 !== 1) bad(`danh sách mới phải tốn đúng 1 lần gọi match, thấy +${S.calls.match - m0}`);
  const reloaded = !(await pg.evaluate(() => window.__noReload === 1)); if (reloaded) bad('trang bị tải lại (không được tải lại trang)');
  await ctx.close();
});
