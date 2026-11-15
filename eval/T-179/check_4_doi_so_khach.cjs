#!/usr/bin/env node
/* T-179 tiêu chí 4 (App thật, spec H1/H3): số khách đổi (dự toán đã lưu ghi 300 khách, ví dụ do ghi hồ sơ hoặc action chat) cũng tính là "số đổi": bấm Tìm vendor in danh sách mới ghi "Theo dự toán 90tr · 300 khách",
 * Alpha 70% (30 bàn = 117tr vượt 90tr), Beta > Alpha; danh sách 1 vẫn "Theo dự toán 90tr · 200 khách" Alpha 100%; bấm lại không đổi thì không in.
 * (Server giả đổi số khách trực tiếp; front phải đọc số đã lưu lúc bấm, không suy luận. Không dựng đường chat vì luồng chat thường làm luồng vendor bắt đầu lại.)
 * Chạy từ gốc tohong-hq: node eval/T-179/check_4_doi_so_khach.cjs [--repo <tohong-front>] */
const { run } = require('./_lib.cjs');
run(async ({ alpha, dev, br, bad, newServer, openApp, lists, pressFind, pressFindQuiet, closeChat, fixed, same }) => {
  const S = newServer(); const { ctx, pg } = await openApp(dev, br, S);
  let L = await pressFind(pg, 1); const s1 = fixed(L); await closeChat(pg);
  S.guests = 300; L = await pressFind(pg, 2);
  if (L.length !== 2) bad(`đổi số khách 200 -> 300 rồi bấm Tìm vendor phải có 2 danh sách, thấy ${L.length}`);
  else {
    if (L[1].label !== 'Theo dự toán 90tr · 300 khách') bad(`danh sách mới phải ghi "Theo dự toán 90tr · 300 khách", thấy ${L[1].label}`);
    if (alpha(L[1]) !== '70' || L[1].names.join() !== 'Beta,Alpha') bad(`danh sách mới (300 khách) phải Beta rồi Alpha 70%, thấy ${L[1].names} ${L[1].pcts}`);
    if (!same(fixed(L).slice(0, 1), s1)) bad('danh sách 1 đổi nội dung (phải giữ "200 khách", Alpha 100%)');
  }
  await closeChat(pg); const m = S.calls.match; const x = await pressFindQuiet(pg);
  if (x.length !== 2 || S.calls.match !== m) bad(`số khách không đổi mà bấm lại vẫn in/gọi (danh sách ${x.length}, match +${S.calls.match - m})`);
  await ctx.close();
});
