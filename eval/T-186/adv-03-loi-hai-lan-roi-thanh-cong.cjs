#!/usr/bin/env node
/* T-186 đối kháng 03 (T-185 H4/H5): lỗi 500, Thử lại lỗi lần nữa (trễ 500ms), Thử lại lần ba thành công (trễ 500ms, có câu AI).
 * Mỗi lần chờ sau Thử lại: câu lỗi biến mất, có skeleton, không chữ; lỗi lần 2: đúng câu lỗi, không skeleton, nút Thử lại còn bấm được;
 * thành công: 80% phù hợp, câu AI hiện đủ (gõ xong), không caret; đúng 3 lần thử gọi.
 * Chạy từ gốc tohong-hq: node eval/T-186/adv-03-loi-hai-lan-roi-thanh-cong.cjs [--repo <tohong-front>] */
const path = require('path');
const { run, sleep } = require(path.join(__dirname, '..', 'T-185', '_lib.cjs'));
run(async (h) => {
  const { bad, setup, snap, dynText, zones, zonesOk, zonesMsg, openBeta, AI } = h;
  const { ctx, pg, route } = await setup((n) => (n === 0 ? { fail: true } : n === 1 ? { fail: true, delay: 500 } : { delay: 500 }));
  await openBeta(pg); await sleep(1200);
  const ERR = 'Chưa cập nhật được điểm. Thử lại';
  let s = await snap(pg); if (!s || dynText(s.text) !== ERR || s.skel) bad('lỗi lần 1 phải hiện đúng câu lỗi, không skeleton');
  await pg.getByRole('button', { name: 'Thử lại' }).last().click(); await sleep(330); s = await snap(pg);
  if (!s || !s.skel || dynText(s.text)) bad('Thử lại lần 1: lúc chờ phải có skeleton, không chữ (đang: "' + (s ? dynText(s.text) : 'null') + '")');
  else if (!zonesOk(zones(s))) bad('Thử lại lần 1: skeleton thiếu phần: ' + zonesMsg(zones(s)));
  await sleep(900); s = await snap(pg);
  if (!s || dynText(s.text) !== ERR || s.skel || s.busy) bad('lỗi lần 2 phải hiện lại đúng câu lỗi, không skeleton/aria-busy (đang: "' + (s ? dynText(s.text) : 'null') + '")');
  await pg.getByRole('button', { name: 'Thử lại' }).last().click(); await sleep(330); s = await snap(pg);
  if (!s || !s.skel || dynText(s.text)) bad('Thử lại lần 2: lúc chờ phải có skeleton, không chữ');
  await sleep(4500); s = await snap(pg);
  if (!s || s.skel || s.busy || !/80% phù hợp/i.test(s.text)) bad('thành công lần 3 phải hiện 80% phù hợp, hết skeleton');
  else { if (!s.text.includes(AI)) bad('thành công lần 3 phải hiện đủ câu AI'); if (s.text.includes('▌')) bad('còn caret ▌ sau khi gõ xong'); }
  if (route.attempts !== 3) bad('phải đúng 3 lần thử gọi chi tiết, đang là ' + route.attempts);
  await ctx.close();
});
