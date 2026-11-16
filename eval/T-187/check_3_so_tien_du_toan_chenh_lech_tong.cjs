#!/usr/bin/env node
/* T-187 tiêu chí 3 (app cặp đôi, số tiền dự toán / chênh lệch / tổng): mọi số tiền lẻ ở màn Ngân sách, "Vendor đã lưu", thẻ ngân sách trong chat và trang chủ dùng dấu phẩy theo khuôn T-167; số nguyên không ",0"; 1440 không phân cách nghìn.
 * Dự toán giả: mục tiêu 120.5, tiền mừng 3.5; hạng mục: ảnh 12.34, nhà hàng 60, trang sức 3.4, dự phòng 30 (tổng đã phân bổ 105.74). Đã chốt ảnh Alpha: lưu lúc 4.1, giá 4.1–4.5 (trung bình 4.3).
 * Tổng quan: "Đã phân bổ 105,7tr / 120,5tr", "Còn 14,8tr", "Tiền mừng dự kiến +3,5tr → thực ~102,2tr", "Đã chốt vendor 4,3tr", hàng hạng mục "12,3tr" "3,4tr" "60tr" "30tr", hàng ảnh "Chụp ảnh 12,3tr Alpha Studio 4,1tr" (giá lúc lưu).
 * Hạng mục ảnh (12.34): "Dự toán 12,3tr", "Ngân sách cưới 120,5tr", tooltip thanh trượt "+2,3tr" (so với Ban đầu 10tr), "Tìm … trong khoảng 12,3tr", vendor Nu 4.6 => "Còn dư 7,7tr", Alpha 4.1 => "Còn dư 8,2tr", sheet "Dự toán: 12,3tr · -7,7tr".
 * Hạng mục trang sức (3.4, vendor 4.6): "Vượt 1,2tr so với dự toán" (hôm nay in "1.1999999999999997tr"), sheet "Dự toán: 3,4tr · +1,2tr".
 * "Vendor đã lưu": "4,3tr / 75,7tr đã chốt" (tổng dự toán các hạng mục vendor 60 + 12.34 + 3.4); thẻ chat "Phân bổ 120,5tr", "+3,5tr"; trang chủ "120,5tr" và "Vượt 5,2tr" (tổng 120.5, đã chi 125.74).
 * Số thật không đổi: mọi số hiện ra bằng số mong đợi tính từ giá trị gốc (ref), không lệch quá 0,05.
 * Chạy: node eval/T-187/check_3_so_tien_du_toan_chenh_lech_tong.cjs [--repo <tohong-front>] */
const E = require('./_lib.cjs'); const S = E.setup(); const { tr, ref } = E;
const CATS = [['photography', 'Chụp ảnh', 12.34], ['venue', 'Tiệc & nhà hàng', 60], ['jewelry', 'Nhẫn cưới & trang sức', 3.4], ['reserve', 'Dự phòng', 30]];
const DOC = E.budgetDoc(CATS);   // total_tr 120.5, mung_tr 3.5, guests 100
const TOTAL = CATS.reduce((s, c) => s + c[2], 0);
const ALPHA_SAVED = E.mkSaved(E.ALPHA, 4.1, { priceMax: 4.5 });        // chốt: giá lúc lưu 4,1; tổng đã chốt tính theo trung bình (4.1+4.5)/2 = 4.3
const NU_SAVED = E.mkSaved(E.NU, 4.6);
const SEED = E.savedDocs({ photography: { shortlisted: [ALPHA_SAVED, NU_SAVED], confirmed: ALPHA_SAVED }, jewelry: { shortlisted: [NU_SAVED], confirmed: null } });
const dash = E.dash;
const waitText = (pg, re) => pg.waitForFunction((s) => new RegExp(s, 'i').test(document.body.innerText), re, { timeout: 15000 });
S.run(async () => {
  /* A. Ngân sách, tổng quan */
  let pg = await S.page('__t187b.html', '?v=budget', { budget: DOC, seed: SEED });
  try {
    await waitText(pg, 'Đã phân bổ'); await pg.waitForTimeout(1200);
    const b = dash(await S.bodyText(pg));
    S.has('Ngân sách (tổng quan)', b, [`Đã phân bổ ${ref(TOTAL)}tr / ${ref(DOC.total_tr)}tr`, `Còn ${tr(DOC.total_tr - TOTAL)}`, `Tiền mừng dự kiến +${tr(DOC.mung_tr)} → thực ~${tr(TOTAL - DOC.mung_tr)}`, 'Đã chốt vendor 4,3tr', '12,3tr', '3,4tr', '60tr', '30tr']);
    S.has('Ngân sách (tổng quan, hàng ảnh đã chốt)', b, ['Chụp ảnh 12,3tr Alpha Studio 4,1tr']);
    S.noDot('Ngân sách (tổng quan)', b);
  } catch (e) { S.bad('Ngân sách tổng quan: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* B. hạng mục ảnh: dự toán 12.34, vendor 4.6 dưới dự toán */
  pg = await S.page('__t187b.html', '?v=budget&cat=photography', { budget: DOC, seed: SEED });
  try {
    await waitText(pg, 'Nu Studio'); await pg.waitForTimeout(1200);
    let b = dash(await S.bodyText(pg));
    S.has('hạng mục ảnh', b, ['DỰ TOÁN 12,3tr', 'NGÂN SÁCH CƯỚI 120,5tr', '+2,3tr', 'Ban đầu 10tr', 'trong khoảng 12,3tr', 'Còn dư 7,7tr', 'Còn dư 8,2tr']); S.noDot('hạng mục ảnh', b);
    const vt = await pg.evaluate(() => (document.querySelector('[role="slider"]') || {}).getAttribute && document.querySelector('[role="slider"]').getAttribute('aria-valuetext'));
    if (!vt || !vt.includes('12,3 triệu') || /\d\.\d/.test(vt)) S.bad(`hạng mục ảnh: thanh trượt đọc "${vt}" (mong "12,3 triệu, …, +2,3tr")`);
    await pg.getByText('Nu Studio', { exact: false }).first().click({ timeout: 5000 }); await pg.waitForTimeout(800);
    b = dash(await S.bodyText(pg)); S.has('sheet ảnh', b, ['Dự toán: 12,3tr · -7,7tr']); S.noDot('sheet ảnh', b);
  } catch (e) { S.bad('hạng mục ảnh: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* C. hạng mục trang sức: dự toán 3.4, vendor 4.6 vượt */
  pg = await S.page('__t187b.html', '?v=budget&cat=jewelry', { budget: DOC, seed: SEED });
  try {
    await waitText(pg, 'Nu Studio'); await pg.waitForTimeout(1200);
    let b = dash(await S.bodyText(pg)); S.has('hạng mục trang sức', b, ['DỰ TOÁN 3,4tr', 'Vượt 1,2tr so với dự toán']); S.noDot('hạng mục trang sức', b);
    await pg.getByText('Nu Studio', { exact: false }).first().click({ timeout: 5000 }); await pg.waitForTimeout(800);
    b = dash(await S.bodyText(pg)); S.has('sheet trang sức', b, ['Dự toán: 3,4tr · +1,2tr']); S.noDot('sheet trang sức', b);
  } catch (e) { S.bad('hạng mục trang sức: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* D. Vendor đã lưu */
  pg = await S.page('__t187b.html', '', { budget: DOC, seed: SEED });
  try {
    await waitText(pg, 'Vendor đã lưu'); await pg.waitForTimeout(1200);
    const vt = [60, 12.34, 3.4].reduce((s, x) => s + x, 0);
    const b = dash(await S.bodyText(pg)); S.has('Vendor đã lưu', b, [`4,3tr / ${ref(vt)}tr đã chốt`, '12,3tr', '3,4tr']); S.noDot('Vendor đã lưu', b);
  } catch (e) { S.bad('Vendor đã lưu: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* E. thẻ ngân sách trong chat */
  pg = await S.page('__t187c.html', '', { budget: DOC });
  try {
    await waitText(pg, 'Phân bổ'); await pg.waitForTimeout(800);
    const b = dash(await S.bodyText(pg)); S.has('thẻ ngân sách chat', b, ['Phân bổ 120,5tr', '+3,5tr']); S.noDot('thẻ ngân sách chat', b);
  } catch (e) { S.bad('thẻ ngân sách chat: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* F. trang chủ */
  pg = await S.page('__t187b.html', '?v=dashboard', { summary: { profile: { bride_name: 'A', groom_name: 'B' }, budget: { total_tr: 120.5, spent_tr: 125.74, over: true } } });
  try {
    await waitText(pg, 'Ngân sách'); await pg.waitForTimeout(1000);
    const b = dash(await S.bodyText(pg)); S.has('trang chủ', b, ['120,5tr', 'Vượt 5,2tr']); S.noDot('trang chủ', b);
  } catch (e) { S.bad('trang chủ: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
