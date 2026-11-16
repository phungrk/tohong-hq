#!/usr/bin/env node
/* T-192 tiêu chí 3: khoảng giá vendor ở khung chat (thẻ danh sách VÀ thẻ chi tiết) khi đầu dưới (priceMin) rỗng: không "tr–", không "tr" trơ, không "0tr–" bịa.
 * Toàn số nguyên (không phụ thuộc dấu chấm/phẩy). Vendor (tên mượn của eval T-187 để dùng chung bộ tách hàng):
 *   Alpha priceMin "" , priceMax 5  -> "5tr"      (đầu rỗng: chỉ ghi đầu còn lại)
 *   Beta  priceMin null, priceMax 6 -> "6tr"      (null như rỗng; không "0tr–6tr")
 *   Gamma priceMin bỏ khuyết, priceMax 7 -> "7tr"
 *   Delta priceMin "" , priceMax ""  -> "Chưa có giá" (cả hai rỗng; chữ có sẵn ở Budget.jsx)
 *   Epsilon 4–5 (bình thường) -> "4tr–5tr" (không đổi)
 * Nhà hàng (venue) đầu dưới rỗng, có nguồn giá: Omega priceMin "" , priceMax 5 -> "5tr/bàn".
 * Chi tiết của Alpha (đầu rỗng): có "5tr", không "tr–", không "tr" trơ.
 * Đỏ trên main: Alpha ra "tr–5tr", Beta "0tr–6tr", Delta "tr".
 * Chạy: node eval/T-192/check_3_khoang_gia_dau_rong.cjs [--repo <tohong-front>] */
const { E, BARE_TR } = require('./_mini.cjs'); const S = E.setup(); const dash = E.dash;
const sc = (n) => ({ totalScore: n, scoreBreakdown: {}, reasons: [] });
const mk = (id, name, a, b, x) => E.V(id, name, a, b, { match: sc(90), ...(x || {}) });
const L = [mk('t192_1', 'Alpha Studio', '', 5), mk('t192_2', 'Beta Studio', null, 6), mk('t192_3', 'Gamma Studio', undefined, 7), mk('t192_4', 'Delta Studio', '', ''), mk('t192_5', 'Epsilon Studio', 4, 5)];
const H = [mk('t192_9', 'Omega Hall', '', 5, { category: 'venue', price_source: 'estimated', price_basis: 'legacy_marry', price_as_of: '2026-06', price_label: 'Giá marry.vn · 06/2026' })];
for (const v of [...L, ...H]) E.ALL.push(v);   // để máy chủ giả trả được thẻ chi tiết
const WANT = { Alpha: /5tr/, Beta: /6tr/, Gamma: /7tr/, Delta: /Chưa có giá/, Epsilon: /4tr–5tr/ };
const junk = (t) => (/tr–/.test(t.replace(/\d+tr–/g, '')) || /0tr–/.test(t) || BARE_TR.test(t) || /NaN|undefined|null/.test(t));
S.run(async () => {
  let pg = await S.page('__t187a.html', '?cat=photography', { vendors: { photography: L } });
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Alpha Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(600);
    for (const n of Object.keys(WANT)) {
      const t = dash(await S.rowText(pg, '[data-card="0"]', n + ' Studio'));
      if (!WANT[n].test(t)) S.bad(`danh sách chat (${n}): mong khớp ${WANT[n]}, thấy "${t.slice(0, 200)}"`);
      if (n !== 'Epsilon' && junk(t)) S.bad(`danh sách chat (${n}): khoảng giá lỗi ("tr–", "0tr–" hoặc "tr" trơ), thấy "${t.slice(0, 200)}"`);
    }
    await pg.locator('[data-card="0"]').getByText('Alpha Studio', { exact: false }).first().click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(600);
    const d = dash(await S.bodyText(pg, '[data-card="1"]'));
    if (!/5tr/.test(d)) S.bad(`chi tiết Alpha (đầu dưới rỗng): mong có "5tr", thấy "${d.slice(0, 300)}"`);
    if (junk(d)) S.bad(`chi tiết Alpha (đầu dưới rỗng): khoảng giá lỗi ("tr–", "0tr–" hoặc "tr" trơ), thấy "${d.slice(0, 300)}"`);
  } catch (e) { S.bad('khoảng giá đầu rỗng (ảnh): lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  pg = await S.page('__t187a.html', '?cat=venue', { vendors: { venue: H } });
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Omega Hall'), null, { timeout: 15000 }); await pg.waitForTimeout(600);
    const t = dash(await S.rowText(pg, '[data-card="0"]', 'Omega Hall'));
    if (!/5tr\/bàn/.test(t) || junk(t)) S.bad(`danh sách nhà hàng (đầu dưới rỗng): mong "5tr/bàn", không "tr–", thấy "${t.slice(0, 200)}"`);
  } catch (e) { S.bad('khoảng giá đầu rỗng (nhà hàng): lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
