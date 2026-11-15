#!/usr/bin/env node
/* T-171 tiêu chí 5 (tohong-front): đổi số khách 200 -> 300 bằng lệnh ghi hồ sơ cặp đôi của front (api.updateProfile, PATCH /api/couples/<id>; đường onboarding và chỉnh hồ sơ dùng) thì thẻ danh sách
 * và màn chi tiết đang mở trong chat lấy lại điểm: Alpha 30 bàn = 117tr so với 90tr (vượt > 20%) => 70%, dòng phép so "30 bàn = 117tr". Ghi hồ sơ LỖI (500) thì không lấy lại.
 * Số khách đổi bằng chỉnh danh sách khách ở màn Khách mời KHÔNG phải sự kiện (server không chấm điểm theo danh sách đó; INV-005): không kiểm ở đây.
 * Chạy từ gốc tohong-hq: node eval/T-171/check_5_doi_ho_so_so_khach.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async ({ dev, br, bad, newServer, mount, open, rowOf, cardText, waitText, openDetail }) => {
  const S = newServer(); const { ctx, pg } = await mount(br, S); await open(dev, pg);
  await openDetail(pg, 'Alpha Hall', 1);
  const d0 = await cardText(pg, 1);
  if (!/20 bàn = 78tr so với 90tr tiệc cưới/.test(d0 || '')) bad('khởi điểm: chi tiết phải ghi "20 bàn = 78tr so với 90tr tiệc cưới", thấy: ' + (d0 || '').slice(0, 200));
  const m0 = S.calls.match, d0c = S.calls.detail;
  S.patchFail = true;
  await pg.evaluate(() => window.__t171api.updateProfile('t171', { couple: { guest_count: 300 } }).catch(() => {})); await sleep(1500);
  if (S.calls.match !== m0 || S.calls.detail !== d0c) bad('ghi hồ sơ LỖI mà thẻ vẫn gọi lại (match +' + (S.calls.match - m0) + ', chi tiết +' + (S.calls.detail - d0c) + '); không có gì đổi thì không gọi lại');
  S.patchFail = false;
  await pg.evaluate(() => window.__t171api.updateProfile('t171', { couple: { guest_count: 300 } }));
  const d1 = await waitText(pg, 1, /30 bàn = 117tr so với 90tr/, 5000);
  if (!/30 bàn = 117tr so với 90tr tiệc cưới/.test(d1 || '')) bad('sau khi số khách 200 -> 300, màn chi tiết phải ghi "30 bàn = 117tr so với 90tr tiệc cưới", thấy: ' + (d1 || '').slice(0, 220));
  if (/Phân tích AI · 100% phù hợp/i.test(d1 || '')) bad('chi tiết vẫn hiện 100% phù hợp (điểm theo 200 khách)');
  let a = null; const t0 = Date.now(); while (Date.now() - t0 < 4000) { a = await rowOf(pg, 'Alpha Hall'); if (a.pct === '70') break; await sleep(150); }
  if (a.pct !== '70') bad(`thẻ danh sách vẫn hiện Alpha Hall ${a.pct}% sau khi số khách đổi 200 -> 300 (cần 70%)`);
  await ctx.close();
});
