#!/usr/bin/env node
/* T-174 adversary 03 (tohong-front, spec T-171 H5 + "Không làm: không đổi nội dung dữ liệu ghi lên server"): nút "Thử lại" của câu "Chưa lưu được dự toán"
 * KHÔNG được xoá khoản do một lần ghi khác (chốt vendor, VendorCtx.syncBudgetItem) đã ghi thành công lên server trong lúc chờ.
 * Input: kéo 90 -> 40, tự lưu lỗi 500; mạng chập chờn: bấm "Chốt" Alpha Hall (GET + PUT của syncBudgetItem qua được) nhưng lần tải lại màn sau đó ĐỨT mạng
 * (đúng hoàn cảnh có câu báo); mạng tốt lại, người dùng bấm "Thử lại".
 * Mong đợi: server có 40 (bản người dùng chỉnh) VÀ vẫn còn khoản vendor_t171_a (Alpha Hall, đã chốt). Đỏ khi "Thử lại" ghi cả tài liệu từ bản trên màn (items cũ) và xoá khoản đã chốt.
 * Chạy từ gốc tohong-hq: node eval/T-174/adv-03-thu-lai-khong-de-khoan-ghi-xen.cjs [--repo <tohong-front>] */
const { runAdv } = require('./adv_khung.cjs');
runAdv(async ({ pg, D, bad, body, slider, dragTo, waitFor, venue, sleep }) => {
  D.putFail = '500';
  await dragTo(pg, 40);
  if (!(await waitFor(async () => /Chưa lưu được dự toán/.test(await body())))) { bad('khung: lưu lỗi phải hiện "Chưa lưu được dự toán"'); return; }
  D.putFail = null; const p0 = D.puts.length;
  // syncBudgetItem: GET (qua) -> PUT (qua) -> onBudgetSync -> màn GET lại (đứt)
  D.failGetsAfterPut = p0;
  await pg.getByRole('button', { name: 'Chốt', exact: true }).first().click();
  await waitFor(async () => (venue().items || []).some((it) => it.id === 'vendor_t171_a'));
  await sleep(1500);
  if (!(venue().items || []).some((it) => it.id === 'vendor_t171_a')) { bad('khung: chốt vendor phải ghi khoản vendor_t171_a lên server'); return; }
  D.failGetsAfterPut = null; // mạng tốt lại
  const retry = pg.getByRole('button', { name: 'Thử lại' }).first();
  if (!(await retry.isVisible().catch(() => false))) { bad(`khung: sau khi tải lại hỏng, câu báo + "Thử lại" phải còn (thanh ${await slider()})`); return; }
  await retry.click(); await sleep(1500);
  const v = venue(), items = (v.items || []).map((it) => it.id);
  if (!items.includes('vendor_t171_a')) bad(`"Thử lại" đè mất khoản vendor đã chốt (vendor_t171_a) do syncBudgetItem ghi xen: server items ${JSON.stringify(items)}, allocated ${v.allocated_tr}`);
  if (v.allocated_tr !== 40) bad(`"Thử lại" phải lưu số người dùng chỉnh (40), server ${v.allocated_tr}`);
});
