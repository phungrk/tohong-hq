#!/usr/bin/env node
/* T-179 tiêu chí 3 (App thật, spec H1 "so với lần trước"): chỉ so với danh sách GẦN NHẤT của hạng mục. Số không đổi thì không in trùng và không gọi match: bấm Tìm vendor nhiều lần không đổi số; kéo 90 -> 95 -> 90 (hai lần lưu, về đúng số cũ);
 * rồi 90 -> 40 in danh sách 2; rồi 40 -> 90 (bằng số của danh sách 1 nhưng khác danh sách gần nhất là 2) vẫn in danh sách 3; bấm lại không đổi thì không in.
 * Chạy từ gốc tohong-hq: node eval/T-179/check_3_khong_in_trung.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async ({ alpha, dev, br, bad, newServer, openApp, dragTo, lists, pressFind, pressFindQuiet, closeChat }) => {
  const S = newServer(); const { ctx, pg } = await openApp(dev, br, S);
  let L = await pressFind(pg, 1); await closeChat(pg);
  const quiet = async (why) => { const m = S.calls.match; const d = S.calls.detail; const x = await pressFindQuiet(pg); await closeChat(pg); if (x.length !== L.length) bad(`${why}: không đổi số mà số danh sách ${L.length} -> ${x.length}`); if (S.calls.match !== m || S.calls.detail !== d) bad(`${why}: không đổi số mà vẫn gọi lại điểm (match +${S.calls.match - m}, chi tiết +${S.calls.detail - d})`); };
  await quiet('bấm Tìm vendor lần 2'); await quiet('bấm Tìm vendor lần 3');
  await dragTo(pg, 95, { settleMs: 1800 }); await dragTo(pg, 90, { settleMs: 1800 });
  if (S.venue !== 90 || S.calls.put < 2) bad(`khung: kéo 90 -> 95 -> 90 phải lưu hai lần (put=${S.calls.put}, venue=${S.venue})`);
  await quiet('đã đổi 95 rồi về 90 (đúng số của danh sách gần nhất)');
  await dragTo(pg, 40, { settleMs: 1800 }); L = await pressFind(pg, 2); await closeChat(pg);
  if (L.length !== 2) bad(`90 -> 40 phải in danh sách 2, thấy ${L.length}`);
  await quiet('bấm lại khi số vẫn 40');
  await dragTo(pg, 90, { settleMs: 1800 }); L = await pressFind(pg, 3);
  if (L.length !== 3) bad(`40 -> 90 phải in danh sách 3 (khác danh sách gần nhất dù bằng danh sách 1), thấy ${L.length}`);
  else if (L[2].label !== 'Theo dự toán 90tr · 200 khách' || alpha(L[2]) !== '100') bad(`danh sách 3 phải Alpha 100% "Theo dự toán 90tr · 200 khách", thấy ${alpha(L[2])}% ${L[2].label}`);
  await closeChat(pg); await quiet('bấm lại khi số vẫn 90 sau danh sách 3');
  await ctx.close();
});
