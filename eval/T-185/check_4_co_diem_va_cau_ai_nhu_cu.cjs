#!/usr/bin/env node
/* T-185 tiêu chí 4 (H4): phản hồi có điểm + câu AI hiện như trước T-185: "80% phù hợp", Ngân sách 100% / Phong cách 50% / Lịch trống 100%, dòng phép so "so với 90tr", câu AI được GÕ DẦN (Typewriter: có lúc chỉ hiện một phần đầu câu), kết thúc đủ câu;
 * trong lúc gõ không còn skeleton. Giữ nguyên hành vi hôm nay.
 * Chạy từ gốc tohong-hq: node eval/T-185/check_4_co_diem_va_cau_ai_nhu_cu.cjs [--repo <tohong-front>] */
const { run, sleep, AI } = require('./_lib.cjs');
run(async (h) => {
  const { bad, setup, watch, stopWatch, openBeta } = h;
  const { ctx, pg } = await setup({ delay: 500 });
  await watch(pg); await openBeta(pg); await sleep(4500); const S = (await stopWatch(pg)).filter((x) => x.s);
  const last = S[S.length - 1] && S[S.length - 1].s;
  if (!last) bad('không thấy khối "Phân tích AI"');
  else {
    if (!/80% phù hợp/i.test(last.text)) bad('phải hiện "Phân tích AI · 80% phù hợp"');
    if (!/Ngân sách\s*100%/.test(last.text) || !/Phong cách\s*50%/.test(last.text) || !/Lịch trống\s*100%/.test(last.text)) bad('ba thanh phải hiện số thật');
    if (!/so với 90tr/.test(last.text)) bad('dòng phép so phải hiện');
    if (!last.text.includes(AI)) bad('kết thúc phải hiện đủ câu AI');
    const head = AI.slice(0, 12);
    if (!S.some((x) => x.s.text.includes(head) && !x.s.text.includes(AI))) bad('câu AI phải được gõ dần (có lúc chỉ hiện một phần đầu câu)');
    if (S.some((x) => /80% phù hợp/i.test(x.s.text) && (x.s.skel || x.s.busy))) bad('đã có điểm thì không được còn skeleton');
  }
  await ctx.close();
});
