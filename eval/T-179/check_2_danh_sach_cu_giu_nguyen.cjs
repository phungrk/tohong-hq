#!/usr/bin/env node
/* T-179 tiêu chí 2 (App thật, spec H2): danh sách cũ ĐÓNG BĂNG. Sau 90 -> 40 -> in danh sách 2 -> 40 -> 70 -> in danh sách 3: danh sách 1 (90tr) và 2 (40tr) giữ NGUYÊN chữ (tên, thứ tự, phần trăm,
 * nhãn "Theo dự toán …"), không hiện "Đang cập nhật điểm…" / "Chưa cập nhật được điểm"; các lần đổi số không gọi match cho danh sách cũ (chỉ +1 mỗi danh sách mới). Mở chi tiết rồi đổi số: thẻ chi tiết đã hiện không đổi.
 * Chạy từ gốc tohong-hq: node eval/T-179/check_2_danh_sach_cu_giu_nguyen.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async ({ dev, br, bad, newServer, openApp, dragTo, lists, pressFind, closeChat, body, same, fixed }) => {
  const S = newServer(); const { ctx, pg } = await openApp(dev, br, S);
  let L = await pressFind(pg, 1); const snap1 = fixed(L); await closeChat(pg);
  await dragTo(pg, 40, { settleMs: 2000 }); L = await pressFind(pg, 2); const snap2 = fixed(L); await closeChat(pg);
  if (!same(snap2.slice(0, 1), snap1)) bad('sau khi in danh sách 2, danh sách 1 đổi nội dung (phải giữ nguyên: Alpha 100%, "Theo dự toán 90tr · 200 khách")');
  const m0 = S.calls.match, d0 = S.calls.detail;
  await dragTo(pg, 70, { settleMs: 2000 });
  await sleep(1000); L = await lists(pg);
  if (!same(fixed(L), snap2)) bad('sau khi đổi dự toán 40 -> 70 (chưa bấm Tìm vendor) các danh sách đang có đổi nội dung (đóng băng)');
  if (S.calls.match !== m0 || S.calls.detail !== d0) bad(`đổi số làm gọi lại điểm cho thẻ cũ (match +${S.calls.match - m0}, chi tiết +${S.calls.detail - d0}); thẻ cũ không được lấy lại điểm`);
  L = await pressFind(pg, 3);
  if (L.length !== 3) bad(`phải có 3 danh sách, thấy ${L.length}`);
  else {
    if (!same(fixed(L).slice(0, 2), snap2)) bad('sau khi in danh sách 3 (70tr), danh sách 1 hoặc 2 đổi nội dung');
    if (L[2].pcts[0] !== '83' || L[2].label !== 'Theo dự toán 70tr · 200 khách') bad(`danh sách 3 phải Alpha 83% và "Theo dự toán 70tr · 200 khách", thấy ${L[2].pcts[0]}% ${L[2].label}`);
  }
  const t = await body(pg); if (/Đang cập nhật điểm|Chưa cập nhật được điểm/.test(t)) bad('thấy "Đang cập nhật điểm…" hoặc "Chưa cập nhật được điểm": thẻ cũ không còn trạng thái lấy lại điểm');
  if (S.calls.match - m0 !== 1) bad(`từ 40 -> 70 chỉ in thêm 1 danh sách, phải +1 lần match, thấy +${S.calls.match - m0}`);
  await ctx.close();
});
