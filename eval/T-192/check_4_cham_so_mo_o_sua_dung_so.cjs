#!/usr/bin/env node
/* T-192 tiêu chí 4: chạm số của một hạng mục ở thẻ ngân sách chat mở ô sửa chứa ĐÚNG số đang phân bổ của hạng mục đó (không rỗng, không "undefined"); gõ số mới + Enter thì hàng đó hiện số mới và các hàng khác giữ nguyên.
 * Dự toán giả số nguyên: Chụp ảnh 20, Tiệc & nhà hàng 60, Dự phòng 20, mục tiêu 100. Sửa "Chụp ảnh" thành 25 -> hàng "Chụp ảnh 25tr"; "Tiệc & nhà hàng 60tr" giữ nguyên.
 * (Dự phòng tự bù trừ theo logic cũ của ứng dụng, không đo.)
 * Đỏ trên main: nút chỉ ghi "tr", ô sửa mở ra rỗng/"undefined".
 * Chạy: node eval/T-192/check_4_cham_so_mo_o_sua_dung_so.cjs [--repo <tohong-front>] */
const { E, rows, waitCard } = require('./_mini.cjs'); const S = E.setup();
const CATS = [['photography', 'Chụp ảnh', 20], ['venue', 'Tiệc & nhà hàng', 60], ['reserve', 'Dự phòng', 20]];
S.run(async () => {
  const pg = await S.page('__t187c.html', '', { budget: E.budgetDoc(CATS, { total_tr: 100 }) });
  try {
    await waitCard(pg); await pg.waitForTimeout(800);
    const btn = pg.getByRole('button', { name: /tr$/ });
    await btn.first().click({ timeout: 5000 }); await pg.waitForTimeout(300);
    const v = await pg.evaluate(() => { const i = document.querySelector('input'); return i ? i.value : null; });
    if (v !== '20') S.bad(`ô sửa của "Chụp ảnh": mong giá trị "20", thấy ${JSON.stringify(v)}`);
    await pg.keyboard.press('Control+A'); await pg.keyboard.type('25'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
    const r = await rows(pg, ['Chụp ảnh', 'Tiệc & nhà hàng']);
    if (!r['Chụp ảnh'] || !/^Chụp ảnh\s*25\s?tr$/.test(r['Chụp ảnh'].text)) S.bad(`sau khi sửa: mong "Chụp ảnh 25tr", thấy "${r['Chụp ảnh'] && r['Chụp ảnh'].text}"`);
    if (!r['Tiệc & nhà hàng'] || !/^Tiệc & nhà hàng\s*60\s?tr$/.test(r['Tiệc & nhà hàng'].text)) S.bad(`sau khi sửa Chụp ảnh: hàng "Tiệc & nhà hàng" phải giữ "60tr", thấy "${r['Tiệc & nhà hàng'] && r['Tiệc & nhà hàng'].text}"`);
  } catch (e) { S.bad('chạm số hạng mục: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
