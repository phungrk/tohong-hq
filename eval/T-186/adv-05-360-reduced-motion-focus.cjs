#!/usr/bin/env node
/* T-186 đối kháng 05 (T-185 H1/H8): 360px + prefers-reduced-motion: lúc chờ skeleton đủ 4 phần, nằm trong khối, không tràn ngang, không pulse (animation none);
 * không phần tử focus được nào nằm trong vùng aria-busy (skeleton không focus được).
 * Chạy từ gốc tohong-hq: node eval/T-186/adv-05-360-reduced-motion-focus.cjs [--repo <tohong-front>] */
const path = require('path');
const { run, sleep } = require(path.join(__dirname, '..', 'T-185', '_lib.cjs'));
run(async (h) => {
  const { bad, setup, snap, zones, zonesOk, zonesMsg, openBeta } = h;
  const { ctx, pg } = await setup({ delay: 5000 }, 360);
  await pg.emulateMedia({ reducedMotion: 'reduce' });
  await openBeta(pg); await sleep(800); const s = await snap(pg);
  if (!s || !s.skel) { bad('360px: lúc chờ phải có skeleton'); await ctx.close(); return; }
  if (!zonesOk(zones(s))) bad('360px: skeleton thiếu phần: ' + zonesMsg(zones(s)));
  if (s.scrollW > s.clientW + 1) bad('360px: khối tràn ngang');
  if (s.leaves.some((l) => l.left < s.left - 1 || l.right > s.right + 1)) bad('360px: skeleton nằm ngoài khối');
  const r = await pg.evaluate(() => {
    const busy = [...document.querySelectorAll('[aria-busy="true"]')].filter((e) => /Phân tích AI/i.test(e.innerText));
    const foc = busy.flatMap((b) => [...b.querySelectorAll('a,button,input,select,textarea,[tabindex]')].filter((e) => e.tabIndex >= 0));
    const anim = busy.flatMap((b) => [...b.querySelectorAll('.db-skel, *')].filter((e) => e.children.length === 0 && getComputedStyle(e).animationName !== 'none').map((e) => getComputedStyle(e).animationName));
    return { n: busy.length, foc: foc.length, anim };
  });
  if (!r.n) bad('không thấy vùng aria-busy chứa khối');
  if (r.foc) bad(`có ${r.foc} phần tử focus được trong vùng chờ`);
  if (r.anim.length) bad('reduced-motion mà skeleton vẫn có animation: ' + [...new Set(r.anim)].join(','));
  await ctx.close();
});
