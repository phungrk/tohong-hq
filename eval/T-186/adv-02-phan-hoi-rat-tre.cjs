#!/usr/bin/env node
/* T-186 đối kháng 02 (T-185 H1): phản hồi chi tiết rất trễ (6s). Ở 0,4s / 3s / 5,5s: skeleton đủ 4 phần, aria-busy + status "Đang tải…", không chữ/số/caret;
 * skeleton không tắt giữa chừng (lấy mẫu liên tục từ khi hiện tới lúc điểm về); về thì 80% phù hợp, hết skeleton, cả thẻ không còn caret ▌ sau khi gõ xong.
 * Chạy từ gốc tohong-hq: node eval/T-186/adv-02-phan-hoi-rat-tre.cjs [--repo <tohong-front>] */
const path = require('path');
const { run, sleep } = require(path.join(__dirname, '..', 'T-185', '_lib.cjs'));
run(async (h) => {
  const { bad, setup, snap, watch, stopWatch, dynText, zones, zonesOk, zonesMsg, openBeta } = h;
  const { ctx, pg } = await setup({ delay: 6000 }); await openBeta(pg);
  let last = 0;
  for (const at of [400, 3000, 5500]) {
    await sleep(at - last); last = at; const s = await snap(pg);
    if (!s || !s.skel) { bad(`ở ${at}ms phải còn skeleton`); continue; }
    if (!s.busy || !s.status) bad(`ở ${at}ms thiếu aria-busy / role=status "Đang tải…"`);
    if (!zonesOk(zones(s))) bad(`ở ${at}ms skeleton thiếu phần: ` + zonesMsg(zones(s)));
    if (dynText(s.text)) bad(`ở ${at}ms khối hiện chữ: "${dynText(s.text)}"`);
    if (at === 3000) await watch(pg);
  }
  await sleep(1200); const W = (await stopWatch(pg)).filter((x) => x.s);
  const iScore = W.findIndex((x) => /phù hợp/i.test(x.s.text));
  if (iScore < 0) bad('6s: điểm không về'); else if (W.slice(0, iScore).some((x) => !x.s.skel)) bad('skeleton tắt giữa chừng trước khi điểm về');
  await sleep(4000); const f = await snap(pg);
  if (!f || f.skel || f.busy || !/80% phù hợp/i.test(f.text)) bad('về sau 6s phải hiện 80% phù hợp, hết skeleton');
  const caret = await pg.evaluate(() => [...document.querySelectorAll('[data-card]')].slice(-1)[0]?.innerText.includes('▌'));
  if (caret) bad('sau khi gõ xong còn caret ▌ trong thẻ chi tiết');
  await ctx.close();
});
