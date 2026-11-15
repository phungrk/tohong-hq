#!/usr/bin/env node
/* T-174 adversary 06 (tohong-front, spec T-171 v3.1 H5 + ADR-104 A: khoản người dùng tự "xoá thì bỏ khoản cùng id"): biến thể của adv-03.
 * Input: lưu 90 -> 40 lỗi 500; mạng tốt; bấm "Chốt" Alpha (syncBudgetItem ghi khoản vendor_t171_a, màn tải lại và ghép: khoản hiện, câu báo còn);
 * người dùng XOÁ khoản Alpha Hall vừa hiện (nút Bỏ ở hàng mục con) trong lúc câu báo còn; lần lưu kế làm câu báo còn (500), rồi server tốt, bấm "Thử lại".
 * Mong đợi: server có 40 và KHÔNG còn vendor_t171_a (người dùng đã xoá trên màn trong lúc có câu báo); màn không hiện lại khoản đó.
 * Ghi chú mức: không mất dữ liệu; lỗi là thao tác xoá của người dùng bị hoàn tác (khoản hiện lại). Engineering đã nêu trong bàn giao v2.
 * Chạy từ gốc tohong-hq: node eval/T-174/adv-06-xoa-khoan-ghi-xen-luc-loi.cjs [--repo <tohong-front>] */
const { runAdv } = require('./adv_khung.cjs');
runAdv(async ({ pg, D, bad, body, dragTo, waitFor, venue, sleep }) => {
  D.putFail = '500'; await dragTo(pg, 40);
  if (!(await waitFor(async () => /Chưa lưu được dự toán/.test(await body())))) { bad('khung: lưu lỗi phải hiện câu báo'); return; }
  D.putFail = null;
  await pg.getByRole('button', { name: 'Chốt', exact: true }).first().click();
  await waitFor(async () => (venue().items || []).some((it) => it.id === 'vendor_t171_a')); await sleep(1500);
  if (!/Chưa lưu được dự toán/.test(await body())) { bad('khung: sau ghi xen + tải lại, câu báo phải còn (H5)'); return; }
  const row = pg.locator('div[style*="padding: 7px 0"]').filter({ hasText: 'Alpha Hall' }).first();
  if (!(await row.isVisible().catch(() => false))) { bad('khung: khoản Alpha Hall phải hiện trên màn sau khi tải lại ghép'); return; }
  D.putFail = '500';
  await row.getByRole('button', { name: 'Bỏ' }).click(); await sleep(1500);
  D.putFail = null;
  const retry = pg.getByRole('button', { name: 'Thử lại' }).first();
  if (await retry.isVisible().catch(() => false)) { await retry.click(); await sleep(2000); }
  const ids = (venue().items || []).map((x) => x.id);
  if (venue().allocated_tr !== 40) bad(`server phải có 40, thấy ${venue().allocated_tr}`);
  if (ids.includes('vendor_t171_a')) bad(`khoản người dùng đã xoá lúc có câu báo (vendor_t171_a) bị ghi lại lên server: items ${JSON.stringify(ids)} (H5: "xoá thì bỏ khoản cùng id")`);
  const shown = await pg.locator('div[style*="padding: 7px 0"]').filter({ hasText: 'Alpha Hall' }).count();
  if (shown) bad('khoản Alpha Hall người dùng đã xoá hiện lại trên màn sau khi lưu thành công');
});
