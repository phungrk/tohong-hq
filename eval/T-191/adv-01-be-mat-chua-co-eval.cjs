'use strict';
/* T-191 adv-01 (adversary, tầng 3): các bề mặt H3 của spec T-187 mà eval tầng 1 chưa chạm.
 * (A) Budget.jsx:61 khoản nhà hàng CHỈ ĐỌC (mục con có vendor, chưa chốt => in it.amt): amt 12.34 => "12,3tr".
 * (B) Thanh trượt, chênh lệch ÂM (dấu "−" của thanh trượt): dự toán ảnh 7.46, Ban đầu 10 (8% của 120,5) => chữ nổi "−2,5tr",
 *     aria-valuetext "7,5 triệu, …, −2,5tr"; dự toán 9.96 (chênh -0,04) => không "−0tr"/"-0tr", aria không "9.96".
 * (C) Trang chủ, tổng/đã chi là CHUỖI từ API ("120.5", "125.74") => "120,5tr", "Vượt 5,2tr"; không nối chuỗi.
 * (D) Khoảng giá biên ở danh sách chat: hai đầu chuỗi cùng chữ ("4.20","4.24") => một số "4,2tr"; số + chuỗi cùng giá trị (4.6,"4.6") => "4,6tr";
 *     số lớn (1440, 1500) => "1440tr–1500tr" (không phân cách nghìn); không có "tr–" mở đầu rỗng.
 * (E) Chữ back trả (chip lý do) in NGUYÊN VĂN, front không định dạng lại: chip "Giá 3.95tr theo gói" giữ nguyên.
 * Chạy: node eval/T-191/adv-01-be-mat-chua-co-eval.cjs [--repo <tohong-front>] */
const E = require('../T-187/_lib.cjs'); const S = E.setup(); const dash = E.dash;
const waitText = (pg, re) => pg.waitForFunction((s) => new RegExp(s, 'i').test(document.body.innerText), re, { timeout: 15000 });
const slider = (pg) => pg.evaluate(() => { const s = document.querySelector('[role="slider"]'); return s ? s.getAttribute('aria-valuetext') : null; });
S.run(async () => {
  /* A. khoản nhà hàng chỉ đọc */
  const ADOC = E.budgetDoc([['venue', 'Tiệc & nhà hàng', 60.5]]);
  ADOC.categories[0].items = [{ id: 'vendor_x1', name: 'Nhà hàng X', amt: 12.34, vendor: 'x1' }];
  let pg = await S.page('__t187b.html', '?v=budget&cat=venue', { budget: ADOC });
  try {
    await waitText(pg, 'Nhà hàng X'); await pg.waitForTimeout(1000);
    const b = dash(await S.bodyText(pg));
    S.has('khoản nhà hàng chỉ đọc', b, ['60,5tr']); S.noDot('khoản nhà hàng chỉ đọc', b);
    if (/12\.34|12\.3\b/.test(b)) S.bad(`khoản nhà hàng chỉ đọc: còn "12.34"/"12.3", thấy "${b.slice(0, 300)}"`);
    const m = b.match(/MỤC CON(.{0,160})/i); if (!m || !/12,3\s*tr/.test(m[1])) S.bad(`khoản nhà hàng chỉ đọc: mục con phải ghi "12,3tr", thấy "${m ? m[1] : b.slice(-300)}"`);
  } catch (e) { S.bad('khoản nhà hàng chỉ đọc: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* B. thanh trượt, chênh âm và chênh gần 0 */
  for (const [a, wantTip, wantAria] of [[7.46, '−2,5tr', '7,5 triệu'], [9.96, null, '10 triệu']]) {
    pg = await S.page('__t187b.html', '?v=budget&cat=photography', { budget: E.budgetDoc([['photography', 'Chụp ảnh', a]]) });
    try {
      await waitText(pg, 'Ban đầu'); await pg.waitForTimeout(1000);
      const b = dash(await S.bodyText(pg)); const vt = String(await slider(pg));
      S.noDot(`thanh trượt ${a}`, b + ' ' + vt);
      if (wantTip) S.has(`thanh trượt ${a}`, b, [wantTip]);
      if (!vt.includes(wantAria) || (wantTip && !vt.includes(wantTip))) S.bad(`thanh trượt ${a}: aria-valuetext "${vt}" (mong có "${wantAria}"${wantTip ? ` và "${wantTip}"` : ''})`);
      const z = (b + ' ' + vt).match(/[−+-]0tr|[−-]0,0|\d\.\d/); if (z) S.bad(`thanh trượt ${a}: "${z[0]}" (mong không dấu cho 0, dấu phẩy), thấy "${vt}"`);
    } catch (e) { S.bad(`thanh trượt ${a}: lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
  /* C. trang chủ, chuỗi từ API */
  pg = await S.page('__t187b.html', '?v=dashboard', { summary: { profile: { bride_name: 'A', groom_name: 'B' }, budget: { total_tr: '120.5', spent_tr: '125.74', over: true } } });
  try {
    await waitText(pg, 'Ngân sách'); await pg.waitForTimeout(1000);
    const b = dash(await S.bodyText(pg)); S.has('trang chủ (chuỗi)', b, ['120,5tr', 'Vượt 5,2tr']); S.noDot('trang chủ (chuỗi)', b);
  } catch (e) { S.bad('trang chủ (chuỗi): lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* D + E. khoảng giá biên và chip back nguyên văn */
  const sc = (n) => ({ totalScore: n, scoreBreakdown: {}, reasons: [] });
  const K1 = E.V('t191_1', 'Kappa Studio', '4.20', '4.24', { match: sc(90) });
  const K2 = E.V('t191_2', 'Lambda Studio', 4.6, '4.6', { match: sc(85) });
  const K3 = E.V('t191_3', 'Rho Studio', 1440, 1500, { match: sc(80) });
  const K4 = E.V('t191_4', 'Tau Studio', 3.5, null, { match: { totalScore: 75, scoreBreakdown: {}, reasons: ['Giá 3.95tr theo gói'] } });
  pg = await S.page('__t187a.html', '?cat=photography', { vendors: { photography: [K1, K2, K3, K4] } });
  try {
    await waitText(pg, 'Tau Studio'); await pg.waitForTimeout(1000);
    const b = dash(await S.bodyText(pg, '#cards'));
    const row = async (n) => { const i = b.indexOf(n + ' Studio'); const rest = ['Kappa', 'Lambda', 'Rho', 'Tau'].map((x) => b.indexOf(x + ' Studio')).filter((j) => j > i).sort((x, y) => x - y)[0]; return i < 0 ? '' : b.slice(i, rest || i + 300); };
    const r1 = await row('Kappa'), r2 = await row('Lambda'), r3 = await row('Rho'), r4 = await row('Tau');
    if (!/4,2tr/.test(r1) || /4,2tr–4,2tr/.test(r1)) S.bad(`Kappa ("4.20","4.24"): mong một số "4,2tr", thấy "${r1.slice(0, 200)}"`);
    if (!/4,6tr/.test(r2) || /4,6tr–4,6tr/.test(r2)) S.bad(`Lambda (4.6,"4.6"): mong một số "4,6tr", thấy "${r2.slice(0, 200)}"`);
    if (!/1440tr–1500tr/.test(r3)) S.bad(`Rho (1440,1500): mong "1440tr–1500tr", thấy "${r3.slice(0, 200)}"`);
    if (!/3,5tr/.test(r4)) S.bad(`Tau (3.5, max null): mong "3,5tr", thấy "${r4.slice(0, 200)}"`);
    if (!b.includes('Giá 3.95tr theo gói')) S.bad(`chip back phải in nguyên văn "Giá 3.95tr theo gói", thấy "${b.slice(0, 400)}"`);
    if (/(^|\s)tr–|NaN|undefined|null/.test(b)) S.bad(`danh sách chat: có đầu rỗng hoặc chữ lỗi, thấy "${b.slice(0, 400)}"`);
    if (/1\.440|1\.500|1,440/.test(b)) S.bad(`danh sách chat: số lớn có phân cách nghìn, thấy "${b.slice(0, 400)}"`);
  } catch (e) { S.bad('danh sách chat biên: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
