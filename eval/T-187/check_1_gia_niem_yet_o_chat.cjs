#!/usr/bin/env node
/* T-187 tiêu chí 1 (app cặp đôi, khung chat vendor): giá niêm yết ở danh sách, chi tiết, thẻ chọn/bảng so sánh/câu tư vấn dùng dấu phẩy theo khuôn T-167 (1 chữ số, bỏ ",0", hai đầu cùng chữ thì một số, "/bàn" cho nhà hàng).
 * Danh sách ảnh: Alpha 4–4.6 => "4tr–4,6tr"; Beta 3.5 => "3,5tr"; Gamma 12–14 => "12tr–14tr" (không ",0"); Delta "12.34"–"13.8" (chuỗi) => "12,3tr–13,8tr"; Epsilon 3.96–4.25 => "4tr–4,3tr".
 * Nhà hàng: Omega "4tr–4,6tr/bàn"; Sigma 3.9 => "3,9tr/bàn"; Psi 4.2–4.24 => "4,2tr/bàn" (không "4,2tr–4,2tr"). Chi tiết Alpha và Omega cùng chữ. Thẻ chọn vendor "Budget ~12,3tr" theo dự toán 12.34.
 * Bảng so sánh Alpha/Beta/Delta: ô giá "4tr", "3,5tr", "12,3tr"; câu tư vấn "Beta Studio (3,5tr) đáng cân nhắc nhất". Không chữ "d.dtr" nào còn.
 * Chạy: node eval/T-187/check_1_gia_niem_yet_o_chat.cjs [--repo <tohong-front>] */
const E = require('./_lib.cjs'); const S = E.setup();
const LIST = [['Alpha', '4tr–4,6tr'], ['Beta', '3,5tr'], ['Gamma', '12tr–14tr'], ['Delta', '12,3tr–13,8tr'], ['Epsilon', '4tr–4,3tr']];
const HALL = [['Omega', '4tr–4,6tr/bàn'], ['Sigma', '3,9tr/bàn'], ['Psi', '4,2tr/bàn']];
const dash = E.dash;
S.run(async () => {
  /* A. danh sách ảnh + chi tiết + so sánh */
  let pg = await S.page('__t187a.html');
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Alpha Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(500);
    for (const [n, want] of LIST) { const t = dash(await S.rowText(pg, '[data-card="0"]', n + ' Studio')); S.has(`danh sách chat (${n})`, t, [want]); S.noDot(`danh sách chat (${n})`, t); if (/\d,0tr/.test(t)) S.bad(`danh sách chat (${n}): còn ",0": ${t}`); }
    if (/4,2tr–4,2tr/.test(dash(await S.bodyText(pg, '[data-card="0"]')))) S.bad('danh sách chat: hai đầu cùng chữ phải ghi một số');
    await pg.locator('[data-card="0"]').getByText('Alpha Studio', { exact: false }).first().click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(500);
    const d = dash(await S.bodyText(pg, '[data-card="1"]')); S.has('chi tiết Alpha', d, ['4tr–4,6tr']); S.noDot('chi tiết Alpha', d);
    await pg.locator('[data-card="1"]').getByRole('button', { name: 'So sánh' }).first().click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="2"]', { timeout: 5000 });
    await pg.waitForFunction(() => (document.querySelector('[data-card="2"]') || {}).innerText && document.querySelector('[data-card="2"]').innerText.includes('Beta Studio'), null, { timeout: 8000 });
    const pk = dash(await S.bodyText(pg, '[data-card="2"]')); S.noDot('thẻ chọn so sánh', pk);
    for (const [n, want] of [['Beta', '3,5tr'], ['Delta', '12,3tr']]) S.has(`thẻ chọn so sánh (${n})`, dash(await S.rowText(pg, '[data-card="2"]', n + ' Studio')), [want]);
    await pg.locator('[data-card="2"]').getByText('Beta Studio', { exact: false }).first().click({ timeout: 5000 });
    await pg.locator('[data-card="2"]').getByText('Delta Studio', { exact: false }).first().click({ timeout: 5000 });
    await pg.locator('[data-card="2"]').getByRole('button', { name: /So sánh 3 vendor/ }).click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="3"]', { timeout: 5000 }); await pg.waitForTimeout(600);
    const c = dash(await S.bodyText(pg, '[data-card="3"]'));
    S.has('bảng so sánh', c, ['4tr', '3,5tr', '12,3tr', 'Beta Studio (3,5tr) đáng cân nhắc nhất']); S.noDot('bảng so sánh', c);
  } catch (e) { S.bad('luồng ảnh: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* B. nhà hàng: giá theo bàn + chi tiết */
  pg = await S.page('__t187a.html', '?cat=venue');
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Omega Hall'), null, { timeout: 15000 }); await pg.waitForTimeout(500);
    for (const [n, want] of HALL) { const t = dash(await S.rowText(pg, '[data-card="0"]', n + ' Hall')); S.has(`danh sách nhà hàng (${n})`, t, [want]); S.noDot(`danh sách nhà hàng (${n})`, t); }
    if (/4,2tr–4,2tr/.test(dash(await S.bodyText(pg, '[data-card="0"]')))) S.bad('danh sách nhà hàng: Psi 4,2–4,24 phải ghi một số "4,2tr/bàn"');
    await pg.locator('[data-card="0"]').getByText('Omega Hall', { exact: false }).first().click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(500);
    const d = dash(await S.bodyText(pg, '[data-card="1"]')); S.has('chi tiết Omega', d, ['4tr–4,6tr/bàn']); S.noDot('chi tiết Omega', d);
  } catch (e) { S.bad('luồng nhà hàng: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* C. thẻ chọn danh mục: "Budget ~Ntr" theo dự toán lẻ */
  pg = await S.page('__t187a.html', '?v=picker', { budget: E.budgetDoc([['photography', 'Chụp ảnh', 12.34], ['venue', 'Tiệc & nhà hàng', 60], ['jewelry', 'Nhẫn', 7.04], ['attire', 'Trang phục', 1440]]) });
  try {
    await pg.waitForFunction(() => /Budget ~12/.test(document.body.innerText), null, { timeout: 15000 }); await pg.waitForTimeout(400);
    const t = await S.bodyText(pg, '[data-card="0"]');
    S.has('thẻ chọn danh mục', t, ['Budget ~12,3tr', 'Budget ~60tr', 'Budget ~7tr', 'Budget ~1440tr']); S.noDot('thẻ chọn danh mục', t);
  } catch (e) { S.bad('thẻ chọn danh mục: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
