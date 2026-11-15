#!/usr/bin/env node
/* T-174 adversary 10 (tohong-front, spec T-171 v3.1 H5): nhiều lần màn tải lại liên tiếp lúc còn câu báo, khoản xuất hiện rồi bị server xoá.
 * Input: lưu 90 -> 40 lỗi 500; mạng tốt; Chốt Alpha (khoản vendor_t171_a xuất hiện, tải lại #1) -> bỏ chốt (server xoá khoản, tải lại #2) -> Thử lại.
 * Mong đợi: server 40, KHÔNG có vendor_t171_a (bỏ chốt là ý người dùng, server đã xoá; không hồi sinh), câu báo mất. Rồi ca 2: lỗi lại 40 -> 35, Chốt lại (tải lại #3),
 * người dùng sửa tên khoản Alpha vừa xuất hiện, Thử lại: server 35, có vendor_t171_a với tên người dùng sửa, đúng MỘT khoản vendor_t171_a.
 * Chạy từ gốc tohong-hq: node eval/T-174/adv-10-chot-bo-chot-nhieu-lan-tai-lai-luc-loi.cjs [--repo <tohong-front>] */
const { runAdv } = require('./adv_khung.cjs');
runAdv(async ({ pg, D, bad, body, dragTo, waitFor, venue, sleep }) => {
  const banner = async () => /Chưa lưu được dự toán/.test(await body());
  const chot = () => pg.getByRole('button', { name: 'Chốt', exact: true }).first().click();
  const has = () => (venue().items || []).some((x) => x.id === 'vendor_t171_a');
  D.putFail = '500'; await dragTo(pg, 40);
  if (!(await waitFor(banner))) { bad('khung: lưu lỗi phải hiện câu báo'); return; }
  D.putFail = null;
  await chot(); await waitFor(async () => has()); await sleep(1500);
  await chot(); await waitFor(async () => !has()); await sleep(1500); // bỏ chốt
  if (!(await banner())) bad('sau hai lần tải lại câu báo phải còn (40 chưa lưu)');
  const r = pg.getByRole('button', { name: 'Thử lại' }).first(); if (await r.isVisible().catch(() => false)) { await r.click(); await sleep(2000); }
  if (venue().allocated_tr !== 40) bad(`[1] server phải 40, thấy ${venue().allocated_tr}`);
  if (has()) bad('[1] khoản Alpha đã bỏ chốt (server đã xoá) bị hồi sinh khi Thử lại');
  if (await banner()) bad('[1] lưu thành công mà câu báo còn');
  // ca 2
  D.putFail = '500'; await dragTo(pg, 35); if (!(await waitFor(banner))) { bad('[2] khung: lưu lỗi phải hiện câu báo'); return; }
  D.putFail = null; await chot(); await waitFor(async () => has()); await sleep(1500);
  const row = pg.locator('div[style*="padding: 7px 0"]').filter({ hasText: 'Alpha Hall' }).first();
  if (!(await row.isVisible().catch(() => false))) { bad('[2] khoản Alpha phải hiện sau tải lại ghép'); return; }
  D.putFail = '500';
  await row.getByText('Alpha Hall', { exact: true }).click(); await pg.keyboard.press('Control+A'); await pg.keyboard.type('Alpha cọc'); await pg.keyboard.press('Enter'); await sleep(1500);
  D.putFail = null; const r2 = pg.getByRole('button', { name: 'Thử lại' }).first(); if (await r2.isVisible().catch(() => false)) { await r2.click(); await sleep(2000); }
  const items = (venue().items || []).filter((x) => x.id === 'vendor_t171_a');
  if (venue().allocated_tr !== 35) bad(`[2] server phải 35, thấy ${venue().allocated_tr}`);
  if (items.length !== 1) bad(`[2] phải đúng một khoản vendor_t171_a, thấy ${items.length}`);
  else if (items[0].name !== 'Alpha cọc') bad(`[2] tên người dùng sửa phải giữ ("Alpha cọc"), thấy "${items[0].name}"`);
});
