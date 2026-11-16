#!/usr/bin/env node
/* T-186 đối kháng 01 (T-185 H1/H2): phản hồi chi tiết 140ms và 160ms (quanh mốc ~150ms). Lấy mẫu ~16ms:
 * mọi mẫu trước khi có điểm không có chữ/số ngoài chữ tĩnh; aria-busy chỉ đi cùng skeleton (không có busy mà không skeleton, không skeleton mà không busy);
 * sau khi điểm đã hiện thì không mẫu nào quay lại skeleton/busy; mọi mẫu trước khi có điểm cùng chiều cao (±2px); cuối cùng 80% phù hợp.
 * Chạy từ gốc tohong-hq: node eval/T-186/adv-01-quanh-moc-150.cjs [--repo <tohong-front>] */
const path = require('path');
const { run, sleep } = require(path.join(__dirname, '..', 'T-185', '_lib.cjs'));
run(async (h) => {
  const { bad, setup, watch, stopWatch, dynText, openBeta } = h;
  for (const d of [140, 160]) {
    const { ctx, pg } = await setup({ delay: d }); await watch(pg); await openBeta(pg); await sleep(1500); const S = (await stopWatch(pg)).filter((x) => x.s);
    if (!S.length) { bad(`(${d}ms) không thấy khối "Phân tích AI"`); await ctx.close(); continue; }
    const iScore = S.findIndex((x) => /\d+% phù hợp/i.test(x.s.text));
    if (iScore < 0) bad(`(${d}ms) không hiện điểm`);
    const pre = iScore < 0 ? S : S.slice(0, iScore);
    const t = pre.find((x) => dynText(x.s.text)); if (t) bad(`(${d}ms) trước khi có điểm khối hiện chữ/số: "${dynText(t.s.text)}"`);
    if (pre.some((x) => x.s.busy && !x.s.skel)) bad(`(${d}ms) có aria-busy mà không có skeleton`);
    if (pre.some((x) => x.s.skel && !x.s.busy)) bad(`(${d}ms) có skeleton mà không có aria-busy`);
    if (pre.length) { const hs = pre.map((x) => x.s.h); if (Math.max(...hs) - Math.min(...hs) > 2) bad(`(${d}ms) chiều cao khối nhảy trước khi có điểm: ${Math.round(Math.min(...hs))}-${Math.round(Math.max(...hs))}px`); }
    if (iScore >= 0 && S.slice(iScore).some((x) => x.s.skel || x.s.busy)) bad(`(${d}ms) điểm đã hiện rồi lại thấy skeleton/aria-busy`);
    if (iScore >= 0 && S.slice(iScore).some((x) => !/80% phù hợp/i.test(x.s.text))) bad(`(${d}ms) sau khi có điểm có mẫu không còn "80% phù hợp"`);
    await ctx.close();
  }
});
