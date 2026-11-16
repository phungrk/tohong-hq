#!/usr/bin/env node
/* T-187 tiêu chí 3 (app cặp đôi, số tiền dự toán / chênh lệch / tổng): mọi số tiền lẻ ở màn Ngân sách, "Vendor đã lưu", thẻ ngân sách trong chat và trang chủ dùng dấu phẩy theo khuôn T-167; số nguyên không ",0"; 1440 không phân cách nghìn.
 * Dự toán giả: mục tiêu 120.5, tiền mừng 3.5; hạng mục: ảnh 12.34, nhà hàng 60, trang sức 3.4, dự phòng 30 (tổng đã phân bổ 105.74). Đã chốt ảnh Alpha: lưu lúc 4.1, giá 4.1–4.5 (trung bình 4.3).
 * Tổng quan: "Đã phân bổ 105,7tr / 120,5tr", "Còn 14,8tr", "Tiền mừng dự kiến +3,5tr → thực ~102,2tr", "Đã chốt vendor 4,3tr", hàng hạng mục "12,3tr" "3,4tr" "60tr" "30tr", hàng ảnh "Chụp ảnh 12,3tr Alpha Studio 4,1tr" (giá lúc lưu).
 * Hạng mục ảnh (12.34): "Dự toán 12,3tr", "Ngân sách cưới 120,5tr", tooltip thanh trượt "+2,3tr" (so với Ban đầu 10tr), "Tìm … trong khoảng 12,3tr", vendor Nu 4.6 => "Còn dư 7,7tr", Alpha 4.1 => "Còn dư 8,2tr", sheet "Dự toán: 12,3tr · -7,7tr".
 * Hạng mục trang sức (3.4, vendor 4.6): "Vượt 1,2tr so với dự toán" (hôm nay in "1.1999999999999997tr"), sheet "Dự toán: 3,4tr · +1,2tr".
 * "Vendor đã lưu": "4,3tr / 75,7tr đã chốt" (tổng dự toán các hạng mục vendor 60 + 12.34 + 3.4); thẻ chat "Phân bổ 120,5tr", "+3,5tr"; trang chủ "120,5tr" và "Vượt 5,2tr" (tổng 120.5, đã chi 125.74).
 * Ca nửa đúng và số âm (H1: làm tròn TRỊ TUYỆT ĐỐI |x| tới 1 chữ số, rồi đặt dấu; kết quả 0 thì "0" không dấu): dự toán 8, vendor lưu lúc 4.25 => sheet "Dự toán: 8tr · -3,8tr" VÀ hàng cùng màn "Còn dư 3,8tr" (cùng một chênh lệch, cùng một số); vendor 7.96 => sheet "Dự toán: 8tr · 0tr" (không "-0tr"), hàng "Còn dư 0tr"; vendor 8.04 => sheet "Dự toán: 8tr · 0tr" (không "+0tr"), hàng "Vượt 0tr so với dự toán"; dự toán 1.15 => "1,2tr" (không "1,1" của toFixed); dự toán 2.25 => "2,3tr" (không "2,2" của Intl nửa-chẵn).
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
  /* G. nửa đúng, số âm, kết quả làm tròn bằng 0 (H1). Dự toán nguyên 8: chênh lệch -3,75 / -0,04 / +0,04 đều đúng nhị phân hoặc gần 0. */
  const GCATS = [['photography', 'Chụp ảnh', 8], ['jewelry', 'Nhẫn cưới & trang sức', 1.15], ['reserve', 'Dự phòng', 2.25]];
  const GDOC = E.budgetDoc(GCATS);
  const mk = (id, name, price) => E.mkSaved(E.V(id, name, price, price), price);
  const P425 = mk('t187_g1', 'Pho Bon Hai', 4.25), P796 = mk('t187_g2', 'Pho Bay Chin', 7.96), P804 = mk('t187_g3', 'Pho Tam Linh', 8.04);
  const GSEED = E.savedDocs({ photography: { shortlisted: [P425, P796, P804], confirmed: null } });
  pg = await S.page('__t187b.html', '?v=budget&cat=photography', { budget: GDOC, seed: GSEED });
  try {
    await waitText(pg, 'Pho Bon Hai'); await pg.waitForTimeout(1200);
    let b = dash(await S.bodyText(pg));
    S.has('nửa đúng: hàng cùng màn', b, ['DỰ TOÁN 8tr', 'Còn dư 3,8tr', 'Còn dư 0tr', 'Vượt 0tr so với dự toán']); S.noDot('nửa đúng: hạng mục ảnh', b);
    if (/-0tr|\+0tr|−0tr|Còn dư -|Còn dư 3,7tr/.test(b)) S.bad(`nửa đúng: hàng có "-0tr"/"+0tr"/"Còn dư 3,7tr", thấy "${b.slice(0, 300)}"`);
    for (const [name, want, deny] of [['Pho Bon Hai', 'Dự toán: 8tr · -3,8tr', /3,7tr|-3\.\d/], ['Pho Bay Chin', 'Dự toán: 8tr · 0tr', /-0tr|−0tr|\+0tr/], ['Pho Tam Linh', 'Dự toán: 8tr · 0tr', /-0tr|−0tr|\+0tr/]]) {
      await pg.getByText(name, { exact: false }).first().click({ timeout: 5000 }); await pg.waitForTimeout(800);
      b = dash(await S.bodyText(pg)); S.has('sheet ' + name, b, [want]); S.noDot('sheet ' + name, b);
      const d = b.match(deny); if (d) S.bad(`sheet ${name}: sai dấu hoặc làm tròn "${d[0]}" (mong "${want}"), thấy "${b.slice(0, 300)}"`);
      await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
      if (/Dự toán: 8tr/.test(dash(await S.bodyText(pg)))) { await pg.mouse.click(5, 5).catch(() => {}); await pg.waitForTimeout(500); }
    }
  } catch (e) { S.bad('nửa đúng: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  pg = await S.page('__t187b.html', '?v=budget', { budget: GDOC });
  try {
    await waitText(pg, 'Đã phân bổ'); await pg.waitForTimeout(1200);
    const b = dash(await S.bodyText(pg)); S.has('nửa đúng: tổng quan', b, ['1,2tr', '2,3tr', '8tr']); S.noDot('nửa đúng: tổng quan', b);
    if (/1,1tr|2,2tr/.test(b)) S.bad(`nửa đúng: làm tròn nửa sai ("1,1tr" của toFixed hoặc "2,2tr" của nửa-chẵn), thấy "${b.slice(0, 300)}"`);
  } catch (e) { S.bad('nửa đúng tổng quan: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  pg = await S.page('__t187b.html', '?v=budget&cat=jewelry', { budget: GDOC });
  try {
    await waitText(pg, 'DỰ TOÁN'); await pg.waitForTimeout(1000);
    const b = dash(await S.bodyText(pg)); S.has('nửa đúng: hạng mục 1.15', b, ['DỰ TOÁN 1,2tr']); S.noDot('nửa đúng: hạng mục 1.15', b);
  } catch (e) { S.bad('nửa đúng 1.15: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
