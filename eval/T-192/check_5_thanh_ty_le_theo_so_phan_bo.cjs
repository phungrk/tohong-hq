#!/usr/bin/env node
/* T-192 tiêu chí 5: thanh tỷ lệ dưới mỗi hạng mục ở thẻ ngân sách chat dài đúng phần của hạng mục trong tổng đã phân bổ (hôm nay cả ba thanh đầy rãnh vì cùng lỗi trường số).
 * Dự toán giả số nguyên: Chụp ảnh 20, Tiệc & nhà hàng 60, Dự phòng 20 (tổng 100) -> 20%, 60%, 20% chiều rộng của rãnh (sai số 2 điểm phần trăm).
 * Rãnh = phần tử cao 5px, nền xám, cắt tràn; thanh = con của nó. Chỉ đo kích thước nhìn thấy.
 * Ca chuỗi (v2): API trả "20", "60", "20" (chuỗi) -> vẫn 20%, 60%, 20% (tổng cộng số, không nối chuỗi "206020").
 * Đỏ trên main: cả ba thanh rộng 100% (NaN thành rộng hết rãnh).
 * Chạy: node eval/T-192/check_5_thanh_ty_le_theo_so_phan_bo.cjs [--repo <tohong-front>] */
const { E, waitCard } = require('./_mini.cjs'); const S = E.setup();
const CATS = [['photography', 'Chụp ảnh', 20], ['venue', 'Tiệc & nhà hàng', 60], ['reserve', 'Dự phòng', 20]];
const widths = (pg) => pg.evaluate(() => [...document.querySelectorAll('div')].filter((e) => getComputedStyle(e).height === '5px' && getComputedStyle(e).overflow === 'hidden' && e.children.length === 1).map((e) => e.children[0].getBoundingClientRect().width / e.getBoundingClientRect().width * 100));
const STR = [['photography', 'Chụp ảnh', '20'], ['venue', 'Tiệc & nhà hàng', '60'], ['reserve', 'Dự phòng', '20']];
S.run(async () => {
  for (const [label, cats] of [['số', CATS], ['chuỗi', STR]]) {
    const pg = await S.page('__t187c.html', '', { budget: E.budgetDoc(cats, { total_tr: 100 }) });
    try {
      await waitCard(pg); await pg.waitForTimeout(800);
      const w = await widths(pg);
      if (w.length !== 3) S.bad(`(${label}) mong 3 thanh tỷ lệ (mỗi hạng mục một), thấy ${w.length}`);
      else [20, 60, 20].forEach((want, i) => { if (!(Math.abs(w[i] - want) <= 2)) S.bad(`(${label}) thanh tỷ lệ hạng mục thứ ${i + 1}: mong ~${want}% rãnh, thấy ${w[i].toFixed(1)}%`); });
    } catch (e) { S.bad(`(${label}) thanh tỷ lệ: lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
});
