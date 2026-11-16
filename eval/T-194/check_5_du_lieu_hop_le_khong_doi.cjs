#!/usr/bin/env node
/* T-194 tiêu chí 5 (chỉ số bảo vệ): dự toán hợp lệ không đổi chữ. Số nguyên và số lẻ: 20, 60, 3.4, 12.34, 0 (mục tiêu 120.5).
 * Mong: "Đã phân bổ 95,7tr / 120,5tr" (20+60+3.4+12.34 = 95,74), "Còn 24,8tr"; hàng "20tr", "60tr", "3,4tr", "12,3tr"; hạng mục 0 hợp lệ ghi "0tr". Số 0 thật không bị coi là lỗi.
 * Eval này xanh trên main 6b9ad94 và phải còn xanh sau khi sửa.
 * Chạy: node eval/T-194/check_5_du_lieu_hop_le_khong_doi.cjs [--repo <tohong-front>] */
const { E, waitText, listRow } = require('./_b.cjs'); const S = E.setup();
const CATS = [['photography', 'Chụp ảnh', 20], ['venue', 'Tiệc & nhà hàng', 60], ['jewelry', 'Nhẫn cưới & trang sức', 3.4], ['attire', 'Trang phục', 12.34], ['reserve', 'Dự phòng', 0]];
const WANT = { 'Chụp ảnh': '20tr', 'Tiệc & nhà hàng': '60tr', 'Nhẫn cưới & trang sức': '3,4tr', 'Trang phục': '12,3tr', 'Dự phòng': '0tr' };
S.run(async () => {
  const pg = await S.page('__t187b.html', '?v=budget', { budget: E.budgetDoc(CATS, { total_tr: 120.5, mung_tr: 0 }) });
  try {
    await waitText(pg, 'Đã phân bổ'); await pg.waitForTimeout(1200);
    const b = E.dash(await S.bodyText(pg));
    S.has('tổng quan hợp lệ', b, ['Đã phân bổ 95,7tr / 120,5tr', 'Còn 24,8tr']);
    for (const [, name] of CATS) { const r = await listRow(pg, name); if (!r || r.amt !== WANT[name]) S.bad(`hàng "${name}": mong "${WANT[name]}", thấy "${r ? r.text : null}"`); }
  } catch (e) { S.bad('dữ liệu hợp lệ: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
