#!/usr/bin/env node
/* T-192 tiêu chí 1: thẻ ngân sách trong chat, MỖI hạng mục hiện số tiền đã phân bổ của chính nó, không còn "tr" trơ.
 * Dự toán giả toàn số nguyên (không phụ thuộc dấu chấm/phẩy): Chụp ảnh 20, Tiệc & nhà hàng 60, Nhẫn cưới & trang sức 0, Dự phòng 20, tiền mừng 5, mục tiêu 100.
 * Mong: hàng "Chụp ảnh" = "Chụp ảnh 20tr"; "Tiệc & nhà hàng 60tr"; "Nhẫn cưới & trang sức 0tr" (0 vẫn ghi "0tr"); "Dự phòng 20tr". Không hàng nào có "tr" trơ, "undefined", "NaN".
 * Đỏ trên main: mọi hàng chỉ ghi "tr".
 * Chạy: node eval/T-192/check_1_moi_hang_muc_co_so_tien.cjs [--repo <tohong-front>] */
const { E, rows, BARE_TR, waitCard } = require('./_mini.cjs'); const S = E.setup();
const CATS = [['photography', 'Chụp ảnh', 20], ['venue', 'Tiệc & nhà hàng', 60], ['jewelry', 'Nhẫn cưới & trang sức', 0], ['reserve', 'Dự phòng', 20]];
S.run(async () => {
  const pg = await S.page('__t187c.html', '', { budget: E.budgetDoc(CATS, { total_tr: 100, mung_tr: 5 }) });
  try {
    await waitCard(pg); await pg.waitForTimeout(800);
    const r = await rows(pg, CATS.map((c) => c[1]));
    for (const [, name, n] of CATS) {
      const x = r[name];
      if (!x) { S.bad(`thẻ ngân sách chat: không thấy hàng "${name}"`); continue; }
      if (BARE_TR.test(x.text) || /undefined|NaN|null/.test(x.text)) S.bad(`hàng "${name}": số tiền trống hoặc lỗi, hàng ghi "${x.text}" (mong "${name} ${n}tr")`);
      else if (!new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*' + n + '\\s?tr$').test(x.text)) S.bad(`hàng "${name}": mong "${name} ${n}tr", thấy "${x.text}"`);
    }
  } catch (e) { S.bad('thẻ ngân sách chat: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
