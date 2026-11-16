#!/usr/bin/env node
/* T-192 tiêu chí 2: số từng hạng mục ở thẻ ngân sách chat theo khuôn T-187 H1 (làm tròn một lần tới 1 chữ số, dấu phẩy, bỏ ",0", không phân cách nghìn), kể cả khi API trả CHUỖI.
 * Đo CHỈ ở hàng hạng mục (không đo tiêu đề "Phân bổ …" hay chữ khác).
 * Dự toán giả: ảnh 12.34 -> "12,3tr"; nhà hàng "3.4" (chuỗi) -> "3,4tr"; trang sức 1.15 -> "1,2tr"; trang phục 2.25 -> "2,3tr"; dự phòng 30 -> "30tr"; thiệp 1440 -> "1440tr".
 * Số mong đợi tính độc lập bằng ref() của eval/T-187/_lib.cjs (Math.round(x*10)/10).
 * Đỏ trên main: mọi hàng chỉ ghi "tr". Sau T-187 (#85) mà chưa sửa trường số: vẫn đỏ ở đúng hàng này.
 * Chạy: node eval/T-192/check_2_so_hang_muc_theo_khuon_t187.cjs [--repo <tohong-front>] */
const { E, rows, BARE_TR, waitCard } = require('./_mini.cjs'); const S = E.setup();
const CATS = [['photography', 'Chụp ảnh', 12.34], ['venue', 'Tiệc & nhà hàng', '3.4'], ['jewelry', 'Nhẫn cưới & trang sức', 1.15], ['attire', 'Trang phục', 2.25], ['reserve', 'Dự phòng', 30], ['stationery', 'Thiệp', 1440]];
S.run(async () => {
  const pg = await S.page('__t187c.html', '', { budget: E.budgetDoc(CATS) });
  try {
    await waitCard(pg); await pg.waitForTimeout(800);
    const r = await rows(pg, CATS.map((c) => c[1]));
    for (const [, name, v] of CATS) {
      const x = r[name], want = E.tr(v);
      if (!x) { S.bad(`thẻ ngân sách chat: không thấy hàng "${name}"`); continue; }
      const t = x.btn;
      if (t !== want) S.bad(`hàng "${name}" (API ${JSON.stringify(v)}): mong số tiền "${want}", thấy "${t}" (hàng: "${x.text}")`);
      if (BARE_TR.test(x.text) || E.DOT_MONEY.test(x.text) || /\d[.,]\d{3,}|undefined|NaN/.test(x.text)) S.bad(`hàng "${name}": số lỗi (trơ/dấu chấm/dài), hàng ghi "${x.text}"`);
    }
  } catch (e) { S.bad('thẻ ngân sách chat (khuôn số): lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
