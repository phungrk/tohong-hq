#!/usr/bin/env node
/* T-187 tiêu chí 4 (app cặp đôi): số tiền API trả dạng CHUỖI thập phân ("12.34", cột numeric của Postgres) đọc đúng như số: hiện dấu phẩy, 1 chữ số, không "NaN"/"undefined", không nối chuỗi.
 * Giá vendor là chuỗi: priceMin "3.5" priceMax "4.6" (danh sách, chi tiết), giá lúc lưu "3.5" và giá hiện tại "4.2"/"4.24" (câu "Bạn đã lưu lúc 3,5tr. Giá hiện tại trên Tơ Hồng: 4,2tr"), danh sách đã lưu.
 * Dự toán là chuỗi: allocated_tr "12.34", total_tr "120.5": "DỰ TOÁN 12,3tr", "NGÂN SÁCH CƯỚI 120,5tr", thẻ chọn "Budget ~12,3tr". Chuỗi nguyên "12" => "12tr"; chuỗi "14.0" => "14tr".
 * Chạy: node eval/T-187/check_4_dau_vao_chuoi_tu_api.cjs [--repo <tohong-front>] */
const E = require('./_lib.cjs'); const S = E.setup(); const dash = E.dash;
const SA = E.V('t187_1', 'Alpha Studio', '3.5', '4.6', { match: { totalScore: 90, scoreBreakdown: {}, reasons: [] } });
const SB = E.V('t187_2', 'Beta Studio', '12', '14.0', { match: { totalScore: 80, scoreBreakdown: {}, reasons: [] } });   // "12" và "14.0" (chuỗi) 
const LIVE = { 't187_12': { priceMin: '4.2', priceMax: '4.24' } };                                                        // Nu: lưu "3.5" -> nay "4.2"–"4.24"
const SEED = E.savedDocs({ photography: { shortlisted: [E.mkSaved(E.NU, '3.5')], confirmed: null } });
const STR_DOC = E.budgetDoc([['photography', 'Chụp ảnh', '12.34'], ['venue', 'Tiệc & nhà hàng', '60']], { total_tr: '120.5', mung_tr: '3.5' });
S.run(async () => {
  let pg = await S.page('__t187a.html', '', { vendors: { photography: [SA, SB] } });
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Alpha Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(500);
    const t = dash(await S.rowText(pg, '[data-card="0"]', 'Alpha Studio')); S.has('danh sách (chuỗi)', t, ['3,5tr–4,6tr']); S.noDot('danh sách (chuỗi)', t);
    const u = dash(await S.rowText(pg, '[data-card="0"]', 'Beta Studio')); S.has('danh sách (chuỗi nguyên "12" và "14.0")', u, ['12tr–14tr']); S.noDot('danh sách (chuỗi nguyên)', u);
    await pg.locator('[data-card="0"]').getByText('Alpha Studio', { exact: false }).first().click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(500);
    const d = dash(await S.bodyText(pg, '[data-card="1"]')); S.has('chi tiết (chuỗi)', d, ['3,5tr–4,6tr']); S.noDot('chi tiết (chuỗi)', d);
  } catch (e) { S.bad('danh sách/chi tiết: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  pg = await S.page('__t187b.html', '?v=budget&cat=photography', { seed: SEED, live: LIVE, budget: STR_DOC });
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Nu Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(1200);
    let b = dash(await S.bodyText(pg)); S.has('Ngân sách hạng mục (chuỗi)', b, ['DỰ TOÁN 12,3tr', 'NGÂN SÁCH CƯỚI 120,5tr', 'Nu Studio 3,5tr']); S.noDot('Ngân sách hạng mục (chuỗi)', b);
    await pg.getByText('Nu Studio', { exact: false }).first().click({ timeout: 5000 }); await pg.waitForTimeout(800);
    b = dash(await S.bodyText(pg)); S.has('sheet (chuỗi)', b, ['Bạn đã lưu lúc 3,5tr. Giá hiện tại trên Tơ Hồng: 4,2tr']); S.noDot('sheet (chuỗi)', b);
  } catch (e) { S.bad('đã lưu/sheet (chuỗi): lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  pg = await S.page('__t187b.html', '', { seed: SEED, live: LIVE, budget: STR_DOC });
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Nu Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(1200);
    const t = dash(await S.rowText(pg, '#root', 'Nu Studio')); S.has('đã lưu (chuỗi)', t, ['3,5tr', 'giá đã cập nhật (4,2tr)']); S.noDot('đã lưu (chuỗi)', t);
  } catch (e) { S.bad('danh sách đã lưu (chuỗi): lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  pg = await S.page('__t187a.html', '?v=picker', { budget: STR_DOC });
  try {
    await pg.waitForFunction(() => /Budget ~12/.test(document.body.innerText), null, { timeout: 15000 });
    const t = await S.bodyText(pg, '[data-card="0"]'); S.has('thẻ chọn (chuỗi)', t, ['Budget ~12,3tr', 'Budget ~60tr']); S.noDot('thẻ chọn (chuỗi)', t);
  } catch (e) { S.bad('thẻ chọn (chuỗi): lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
