#!/usr/bin/env node
/* T-194 tiêu chí 2: hàng hạng mục ở tổng quan và trang chi tiết hạng mục ghi số khi allocated_tr rỗng/không phải số.
 * Cùng dự toán giả như check_1 (mục tiêu 100). Tổng quan: "Chụp ảnh" 0tr, "Tiệc & nhà hàng" 0tr (từ "abc"), "Nhẫn cưới & trang sức" 30tr, "Trang phục" 20tr, "Dự phòng" 0tr; không hàng nào chỉ "tr".
 * Trang chi tiết hạng mục "Tiệc & nhà hàng" (allocated "abc"): thẻ "DỰ TOÁN 0tr", thanh trượt "Dự toán" aria-valuenow = 0, aria-valuetext không có "tr" trơ / "abc" / NaN; không "tr" đứng riêng trên trang.
 * Đỏ trên main 6b9ad94: hàng "Tiệc & nhà hàng" ghi "abc tr"/"tr".
 * Chạy: node eval/T-194/check_2_hang_hang_muc_va_trang_hang_muc.cjs [--repo <tohong-front>] */
const { E, BARE_TR, BAD_WORD, waitText, listRow, MIX } = require('./_b.cjs'); const S = E.setup();
const WANT = { 'Chụp ảnh': '0tr', 'Tiệc & nhà hàng': '0tr', 'Nhẫn cưới & trang sức': '30tr', 'Trang phục': '20tr', 'Dự phòng': '0tr' };
S.run(async () => {
  const doc = E.budgetDoc(MIX, { total_tr: 100, mung_tr: 0 });
  let pg = await S.page('__t187b.html', '?v=budget', { budget: doc });
  try {
    await waitText(pg, 'Đã phân bổ'); await pg.waitForTimeout(1200);
    for (const [, name] of MIX) {
      const r = await listRow(pg, name);
      if (!r) { S.bad(`tổng quan: không thấy hàng "${name}"`); continue; }
      if (r.amt !== WANT[name]) S.bad(`tổng quan: hàng "${name}" mong "${WANT[name]}", thấy "${r.text}"`);
      if (BARE_TR.test(r.text) || BAD_WORD.test(r.text)) S.bad(`tổng quan: hàng "${name}" lộ "tr" trơ hoặc chữ lỗi: "${r.text}"`);
    }
  } catch (e) { S.bad('tổng quan: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  pg = await S.page('__t187b.html', '?v=budget&cat=venue', { budget: doc });
  try {
    const sl = pg.getByRole('slider', { name: 'Dự toán' }); await sl.waitFor({ timeout: 15000 }); await pg.waitForTimeout(1000);
    const b = E.dash(await S.bodyText(pg));
    S.has('trang hạng mục "abc"', b, ['DỰ TOÁN 0tr']);
    if (BARE_TR.test(b)) S.bad(`trang hạng mục "abc": còn "tr" đứng riêng, thấy "${b.slice(0, 260)}"`);
    const w = b.match(BAD_WORD); if (w) S.bad(`trang hạng mục "abc": lộ chữ "${w[0]}"`);
    const now = await sl.getAttribute('aria-valuenow'), txt = (await sl.getAttribute('aria-valuetext')) || '';
    if (Number(now) !== 0) S.bad(`trang hạng mục "abc": thanh trượt aria-valuenow "${now}" (mong 0)`);
    if (BARE_TR.test(txt) || BAD_WORD.test(txt)) S.bad(`trang hạng mục "abc": thanh trượt đọc "${txt}"`);
  } catch (e) { S.bad('trang hạng mục "abc": lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
