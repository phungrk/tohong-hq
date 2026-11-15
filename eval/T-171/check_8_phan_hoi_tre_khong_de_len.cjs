#!/usr/bin/env node
/* T-171 tiêu chí 8 (tohong-front): phản hồi TRỄ của lần lấy lại trước không ghi đè kết quả lần sau. Lưu 90 -> 40 (phản hồi match và chi tiết của lần này chậm 2,5s, nội dung theo 40tr),
 * rồi (khi lần chậm còn đang bay) lưu 40 -> 70 (nhanh, nội dung theo 70tr: Alpha 78tr so với 70tr -> 83%, thứ tự Alpha, Beta). Cuối cùng, sau khi phản hồi chậm đã về, thẻ danh sách phải hiện Alpha 83% thứ tự Alpha>Beta
 * và thẻ chi tiết hiện "so với 70tr tiệc cưới"; không được quay về 70%/"so với 40tr" của phản hồi chậm.
 * Chạy từ gốc tohong-hq: node eval/T-171/check_8_phan_hoi_tre_khong_de_len.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async ({ dev, br, bad, newServer, mount, open, goBudget, goChat, dragTo, rowOf, cardText, waitText, openDetail }) => {
  const S = newServer(); const { ctx, pg } = await mount(br, S); await open(dev, pg);
  await openDetail(pg, 'Alpha Hall', 1); await pg.waitForTimeout(600);
  const m0 = S.calls.match, d0 = S.calls.detail;
  S.matchDelays = {}; S.matchDelays[m0] = 2500; S.detailDelays = {}; S.detailDelays[d0] = 2500; // lần lấy lại ĐẦU TIÊN (theo 40tr) chậm; các lần sau nhanh
  await goBudget(pg); await dragTo(pg, 40); let t0 = Date.now(); while (S.venue !== 40 && Date.now() - t0 < 6000) await sleep(100);
  t0 = Date.now(); while (S.calls.match <= m0 && Date.now() - t0 < 5000) await sleep(50); // lần chậm đã bay
  await sleep(1000); // > 800ms debounce tách hai lần lưu
  await dragTo(pg, 70); t0 = Date.now(); while (S.venue !== 70 && Date.now() - t0 < 6000) await sleep(100);
  await goChat(pg); await sleep(5000); // đủ cho phản hồi chậm (2,5s) về sau cùng
  const a = await rowOf(pg, 'Alpha Hall'); const d = await cardText(pg, 1);
  if (a.pct !== '83' || a.order.join() !== 'Alpha,Beta') bad(`thẻ danh sách cuối cùng phải theo 70tr (Alpha 83%, Alpha>Beta), thấy Alpha ${a.pct}% ${a.order.join('>')}: phản hồi trễ của lần 40tr đã ghi đè`);
  if (!/so với 70tr tiệc cưới/.test(d || '')) bad('thẻ chi tiết cuối cùng phải ghi "so với 70tr tiệc cưới", thấy: ' + (d || '').slice(0, 220));
  if (S.calls.match - m0 < 2) bad('khung: phải có hai lần lấy lại (40 rồi 70), thấy ' + (S.calls.match - m0));
  await ctx.close();
});
