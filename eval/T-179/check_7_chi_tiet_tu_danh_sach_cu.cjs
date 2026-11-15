#!/usr/bin/env node
/* T-179 tiêu chí 7 (App thật, spec H4): thẻ chi tiết mở từ một hàng của danh sách CŨ (90tr, Alpha 100%) sau khi dự toán đã lưu 40tr chấm theo số đã lưu hiện tại (dòng phép so "20 bàn = 78tr so với 40tr tiệc cưới", "70% phù hợp"),
 * không theo số của danh sách cũ; danh sách cũ giữ nguyên (Alpha 100%, "Theo dự toán 90tr"); thẻ chi tiết đã hiện ĐÓNG BĂNG: đổi tiếp 70tr và bấm Tìm vendor thì chi tiết cũ vẫn "so với 40tr" (không có chữ "so với 70tr" trong thẻ chi tiết).
 * Chạy từ gốc tohong-hq: node eval/T-179/check_7_chi_tiet_tu_danh_sach_cu.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async ({ dev, br, bad, newServer, openApp, dragTo, lists, body, pressFind, closeChat, fixed, same }) => {
  const S = newServer(); const { ctx, pg } = await openApp(dev, br, S);
  const L1 = await pressFind(pg, 1); const s1 = fixed(L1); await closeChat(pg);
  await dragTo(pg, 40, { settleMs: 2000 }); await pressFind(pg, 2);
  await pg.getByText('Alpha Hall', { exact: false }).first().click(); // hàng Alpha của danh sách đầu (cũ)
  await pg.waitForFunction(() => /\d+ bàn = [\d,]+tr so với \d+tr/.test(document.body.innerText), null, { timeout: 8000 }); await sleep(1000);
  const re = /\d+ bàn = [\d,]+tr so với \d+tr/g; let t = await body(pg); let m = t.match(re) || [];
  if (m.length !== 1 || !/20 bàn = 78tr so với 40tr/.test(m[0])) bad(`chi tiết mở từ danh sách cũ phải ghi "20 bàn = 78tr so với 40tr", thấy ${JSON.stringify(m)}`);
  if (!/70% phù hợp/.test(t)) bad('chi tiết mở từ danh sách cũ phải "70% phù hợp" (số đã lưu hiện tại)');
  const L = await lists(pg); if (!same(fixed(L).slice(0, 1), s1)) bad('mở chi tiết từ danh sách cũ làm danh sách cũ đổi nội dung');
  await closeChat(pg); await dragTo(pg, 70, { settleMs: 2000 }); await pressFind(pg, 3);
  t = await body(pg); m = t.match(re) || [];
  if (m.length !== 1 || !/so với 40tr/.test(m[0])) bad(`thẻ chi tiết đã hiện phải đóng băng "so với 40tr" sau khi đổi 70tr, thấy ${JSON.stringify(m)}`);
  await ctx.close();
});
