#!/usr/bin/env node
/* T-171 tiêu chí 10 (tohong-front; quyết định Capu ADR-104, lựa chọn A, H5 v3.1): khoản/mục con cặp đôi tự THÊM, SỬA (số tiền), XOÁ ở màn Ngân sách trong lúc câu báo "Chưa lưu được dự toán" đang hiện
 * được GIỮ và ghi cùng khi lưu lại thành công (ghép theo id khoản với bản server); khoản do lần ghi khác đã lưu (chốt vendor) KHÔNG bị xoá; trường người dùng không đổi (mung_tr) lấy theo server.
 * Khung eval/T-174/adv_khung.cjs (màn Ngân sách thật + VendorProvider như App; server giả lưu NGUYÊN tài liệu). Gồm probe của Spec Gate (ca A).
 * A: lưu lỗi 40 -> Thêm mục con (vẫn lỗi) -> server tốt -> Thử lại: server có khoản mới và allocated 40.
 * B: server có sẵn khoản i_old (5tr) và i_giu (3tr); lưu lỗi 40; người dùng xoá i_old, sửa i_giu thành 9, thêm một mục con; ghi xen: chốt Alpha (vendor_t171_a) lưu được, và server khác đổi mung_tr = 7;
 *    mạng tốt; Thử lại -> server: allocated 40; không còn i_old; i_giu = 9; có khoản mới; còn vendor_t171_a; mung_tr = 7; câu báo mất.
 * Chạy từ gốc tohong-hq: node eval/T-171/check_10_khoan_nguoi_dung_giu_khi_luu_loi.cjs [--repo <tohong-front>] */
const { runAdv } = require('../T-174/adv_khung.cjs');
let CASE = 'A';
runAdv(async ({ pg, D, bad, body, slider, dragTo, waitFor, venue, sleep }) => {
  { // A
    D.putFail = '500'; await dragTo(pg, 40);
    if (!(await waitFor(async () => /Chưa lưu được dự toán/.test(await body())))) { bad('[A] khung: lưu lỗi phải hiện câu báo'); return; }
    const n0 = (venue().items || []).length;
    await pg.getByRole('button', { name: 'Thêm mục con' }).first().click(); await sleep(1500);
    D.putFail = null; await pg.getByRole('button', { name: 'Thử lại' }).first().click(); await sleep(2000);
    const it = venue().items || [];
    if (it.length <= n0) bad(`[A] mục con người dùng thêm lúc có câu báo bị mất sau Thử lại (server items ${n0} -> ${it.length})`);
    if (venue().allocated_tr !== 40) bad(`[A] Thử lại phải lưu 40, server ${venue().allocated_tr}`);
    if (/Chưa lưu được dự toán/.test(await body())) bad('[A] lưu thành công mà câu báo còn');
  }
  { // B
    D.doc.categories.find((c) => c.id === 'venue').items = [{ id: 'i_old', name: 'Cọc cũ', amt: 5 }, { id: 'i_giu', name: 'Giữ lại', amt: 3 }];
    D.doc.categories.find((c) => c.id === 'venue').allocated_tr = 90; D.putFail = null; D.puts.length = 0;
    await pg.reload(); await pg.getByRole('slider', { name: 'Dự toán' }).waitFor({ timeout: 15000 }); await pg.getByText('Cọc cũ').first().waitFor({ timeout: 8000 });
    D.putFail = '500'; await dragTo(pg, 40);
    if (!(await waitFor(async () => /Chưa lưu được dự toán/.test(await body())))) { bad('[B] khung: lưu lỗi phải hiện câu báo'); return; }
    const row = (name) => pg.getByText(name, { exact: true }).first().locator('xpath=ancestor::div[contains(@style,"padding: 7px 0")][1]');
    await row('Cọc cũ').getByRole('button', { name: 'Bỏ' }).click(); await sleep(300);
    const amt = row('Giữ lại').locator('input'); await amt.fill('9'); await amt.press('Enter'); await sleep(300);
    await pg.getByRole('button', { name: 'Thêm mục con' }).first().click(); await sleep(1200);
    D.putFail = null; const p0 = D.puts.length; D.failGetsAfterPut = null;
    await pg.getByRole('button', { name: 'Chốt', exact: true }).first().click(); // ghi xen: syncBudgetItem
    await waitFor(async () => (venue().items || []).some((x) => x.id === 'vendor_t171_a'));
    await sleep(1500); D.doc.mung_tr = 7; // server khác đổi mung_tr
    const retry = pg.getByRole('button', { name: 'Thử lại' }).first();
    if (!(await retry.isVisible().catch(() => false))) { bad(`[B] khung: sau ghi xen câu báo + "Thử lại" phải còn (thanh ${await slider()}; items server ${JSON.stringify((venue().items||[]).map((x)=>x.id))}; câu báo ${/Chưa lưu được/.test(await body())}; puts ${D.puts.length}, gets ${D.gets})`); return; }
    const seen = await body(); if (!/Giữ lại/.test(seen) || /Cọc cũ/.test(seen)) bad('[B] sau khi màn tải lại, màn phải còn giữ thay đổi chưa lưu (có "Giữ lại", không có "Cọc cũ")');
    await retry.click(); await sleep(2000);
    const v = venue(), ids = (v.items || []).map((x) => x.id), gl = (v.items || []).find((x) => x.id === 'i_giu');
    if (v.allocated_tr !== 40) bad(`[B] server phải có 40, thấy ${v.allocated_tr}`);
    if (ids.includes('i_old')) bad('[B] khoản người dùng đã xoá (i_old) phải biến mất khỏi server');
    if (!gl || gl.amt !== 9) bad(`[B] khoản người dùng sửa (i_giu) phải là 9, thấy ${gl && gl.amt}`);
    if (!ids.some((x) => x !== 'i_giu' && x !== 'i_old' && !x.startsWith('vendor_'))) bad('[B] mục con người dùng thêm phải được ghi lên server, items ' + JSON.stringify(ids));
    if (!ids.includes('vendor_t171_a')) bad('[B] khoản vendor đã chốt (do lần ghi khác) không được bị xoá, items ' + JSON.stringify(ids));
    if (D.doc.mung_tr !== 7) bad(`[B] mung_tr người dùng không đổi phải lấy theo server (7), thấy ${D.doc.mung_tr}`);
    if (/Chưa lưu được dự toán/.test(await body())) bad('[B] lưu thành công mà câu báo còn');
  }
});
