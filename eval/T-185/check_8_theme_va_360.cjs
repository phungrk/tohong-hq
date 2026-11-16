#!/usr/bin/env node
/* T-185 tiêu chí 8 (H8): skeleton tôn trọng giao diện sáng/tối và 360px. (a) 360px: khối chờ không tràn ngang (scrollWidth <= clientWidth, mọi khối skeleton nằm trong khối, trang không cuộn ngang).
 * (b) màu: khối skeleton có nền nhìn thấy, KHÁC nền khối; đổi bộ token màu của :root sang bảng tối giả (--line-100, --kim-50) thì màu khối skeleton đổi theo đúng token đó (không màu cứng) và vẫn khác nền khối.
 * (Front hiện chưa có chế độ tối; eval mô phỏng bằng đổi token.)
 * Chạy từ gốc tohong-hq: node eval/T-185/check_8_theme_va_360.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async (h) => {
  const { bad, setup, snap, openBeta } = h;
  const { ctx, pg } = await setup({ delay: 7000 }, 360);
  await openBeta(pg); await sleep(900); let s = await snap(pg);
  if (!s || !s.skel) { bad('lúc chờ phải hiện skeleton'); await ctx.close(); return; }
  if (s.scrollW > s.clientW + 1) bad(`khối chờ tràn ngang ở 360px (scrollWidth ${s.scrollW} > ${s.clientW})`);
  if (s.leaves.some((l) => l.left < s.left - 1 || l.right > s.right + 1)) bad('có khối skeleton nằm ngoài khối Phân tích AI ở 360px');
  if (await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) bad('trang cuộn ngang ở 360px khi chờ');
  if (s.leaves.every((l) => l.bg === s.blockBg)) bad('sáng: màu skeleton trùng nền khối, không nhìn thấy');
  await pg.addStyleTag({ content: ':root{--line-100:#2b2b36 !important;--kim-50:#16161d !important}' }); await sleep(200); s = await snap(pg);
  if (!s || !s.skel) bad('sau khi đổi token vẫn phải ở trạng thái chờ');
  else {
    if (!s.leaves.some((l) => l.bg === 'rgb(43, 43, 54)')) bad('tối: màu skeleton phải theo token --line-100 (rgb(43, 43, 54)), đang là ' + [...new Set(s.leaves.map((l) => l.bg))].join(' / '));
    if (s.leaves.every((l) => l.bg === s.blockBg)) bad('tối: màu skeleton trùng nền khối');
    if (s.blockBg !== 'rgb(22, 22, 29)') bad('tối: nền khối phải theo token --kim-50, đang là ' + s.blockBg);
  }
  await ctx.close();
});
