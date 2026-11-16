#!/usr/bin/env node
/* T-194 tiêu chí 1: tổng quan màn Ngân sách (đã phân bổ, còn lại, vượt) là số khi có hạng mục allocated_tr rỗng ("", null) hoặc không phải số ("abc").
 * Dự toán giả: Chụp ảnh "", Tiệc & nhà hàng "abc", Nhẫn cưới & trang sức 30, Trang phục "20" (chuỗi số), Dự phòng null. Tổng đã phân bổ = 50.
 * Ca A mục tiêu 100: "Đã phân bổ 50tr / 100tr", "Còn 50tr". Ca B mục tiêu 40: "Vượt 10tr". Ca C mục tiêu 50: "Cân đối".
 * Toàn màn không có "tr" đứng riêng, "abc", "undefined", "NaN", "null". Đỏ trên main 6b9ad94: "abc" làm tổng thành chuỗi, màn ghi "Đã phân bổ tr / 100tr", "Còn tr".
 * Chạy: node eval/T-194/check_1_tong_phan_bo_con_lai_vuot.cjs [--repo <tohong-front>] */
const { E, BARE_TR, BAD_WORD, waitText, MIX } = require('./_b.cjs'); const S = E.setup();
const CASES = [['A mục tiêu 100', 100, ['Đã phân bổ 50tr / 100tr', 'Còn 50tr']], ['B mục tiêu 40', 40, ['Đã phân bổ 50tr / 40tr', 'Vượt 10tr']], ['C mục tiêu 50', 50, ['Đã phân bổ 50tr / 50tr', 'Cân đối']]];
S.run(async () => {
  for (const [label, target, wants] of CASES) {
    const pg = await S.page('__t187b.html', '?v=budget', { budget: E.budgetDoc(MIX, { total_tr: target, mung_tr: 0 }) });
    try {
      await waitText(pg, 'Đã phân bổ'); await pg.waitForTimeout(1200);
      const b = E.dash(await S.bodyText(pg));
      S.has(`tổng quan (${label})`, b, wants);
      if (BARE_TR.test(b)) S.bad(`tổng quan (${label}): còn "tr" đứng riêng (không có số), thấy "${b.slice(0, 260)}"`);
      const w = b.match(BAD_WORD); if (w) S.bad(`tổng quan (${label}): lộ chữ "${w[0]}", thấy "${b.slice(0, 260)}"`);
    } catch (e) { S.bad(`tổng quan (${label}): lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
});
