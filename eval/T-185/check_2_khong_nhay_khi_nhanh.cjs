#!/usr/bin/env node
/* T-185 tiêu chí 2 (H2): không nháy. (A) phản hồi chi tiết 40ms: không có mẫu nào (lấy mẫu mỗi ~16ms) có skeleton, và không mẫu nào trước khi có điểm hiện số/chữ chờ.
 * (B) phản hồi 1,2s: skeleton xuất hiện sau 100-450ms kể từ lúc khối hiện (mốc ~150ms), trước đó khối chỉ có chữ tĩnh và giữ NGUYÊN chiều cao (không nhảy bố cục khi skeleton hiện);
 * khi điểm về, không có mẫu rỗng (không skeleton, không điểm) xen giữa.
 * Chạy từ gốc tohong-hq: node eval/T-185/check_2_khong_nhay_khi_nhanh.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async (h) => {
  const { bad, setup, watch, stopWatch, dynText, openBeta } = h;
  { // A
    const { ctx, pg } = await setup({ delay: 40 }); await watch(pg); await openBeta(pg); await sleep(1800); const S = (await stopWatch(pg)).filter((x) => x.s);
    if (!S.length) bad('(A) không thấy khối "Phân tích AI"');
    if (S.some((x) => x.s.busy)) bad('(A) phản hồi 40ms mà vẫn hiện skeleton (nháy)');
    const d = S.find((x) => !/\d+% phù hợp/i.test(x.s.text) && dynText(x.s.text)); if (d) bad('(A) trước khi có điểm khối hiện chữ/số: "' + dynText(d.s.text) + '"');
    if (!S.some((x) => /80% phù hợp/i.test(x.s.text))) bad('(A) phản hồi nhanh vẫn phải hiện điểm 80%');
    await ctx.close();
  }
  { // B
    const { ctx, pg } = await setup({ delay: 1200 }); await watch(pg); await openBeta(pg); await sleep(2600); const S = (await stopWatch(pg)).filter((x) => x.s);
    const t0 = S.length ? S[0].t : null, ib = S.findIndex((x) => x.s.busy);
    if (t0 === null) bad('(B) không thấy khối "Phân tích AI"');
    else if (ib < 0) bad('(B) chờ 1,2s mà không hề hiện skeleton');
    else {
      const dt = S[ib].t - t0; if (dt < 100 || dt > 450) bad(`(B) skeleton hiện sau ${Math.round(dt)}ms kể từ lúc khối hiện; cần trong 100-450ms (mốc ~150ms)`);
      const hold = S.slice(0, ib); if (hold.some((x) => dynText(x.s.text))) bad('(B) trước mốc ~150ms khối hiện chữ/số ngoài tiêu đề + nhãn tĩnh');
      if (hold.length && Math.abs(hold[hold.length - 1].s.h - S[ib].s.h) > 2) bad(`(B) chiều cao khối nhảy khi skeleton hiện: ${Math.round(hold[hold.length - 1].s.h)} -> ${Math.round(S[ib].s.h)}px`);
      const iDone = S.findIndex((x, i) => i > ib && !x.s.busy); if (iDone < 0) bad('(B) skeleton không biến mất khi điểm đã về');
      else if (S.slice(iDone).some((x) => !x.s.busy && !/phù hợp/i.test(x.s.text))) bad('(B) có mẫu rỗng (không skeleton, không điểm) sau khi điểm về');
    }
    await ctx.close();
  }
});
