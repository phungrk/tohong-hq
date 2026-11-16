#!/usr/bin/env node
/* T-192 tiêu chí 3 (v2): chữ khoảng giá khi một đầu rỗng, đúng NGUYÊN CHỮ (không chỉ có số). "Rỗng" = "", null hoặc bỏ khuyết; 0 là số thật.
 * Nơi có KHOẢNG (đầu dưới + đầu trên): chat danh sách, chat chi tiết, câu "giá đã cập nhật (…)" ở màn Vendors:
 *   đầu dưới rỗng, đầu trên có -> "Đến 5tr" (nhà hàng "Đến 5tr/bàn") · đầu trên rỗng, đầu dưới có -> "Từ 4tr" · cả hai rỗng -> "Chưa có giá" · đủ hai đầu -> "4tr–5tr" · 0 giữ "0tr–5tr".
 * Nơi chỉ có MỘT giá (thẻ chọn so sánh, bảng so sánh, dòng vendor đã lưu ở màn Vendors): có giá -> "4tr" như hôm nay (KHÔNG thêm "Từ"); rỗng -> "Chưa có giá"; không "tr" trơ.
 * So khớp: ô giá phải có đúng chữ mong đợi và phần chữ còn lại của hàng không còn số tiền hay "tr" nào khác (bắt "Từ 5tr", "5tr", "≤ 5tr" ở ca đầu dưới rỗng).
 * Vendor (ảnh): Alpha ""/5 · Beta null/6 · Gamma bỏ khuyết/7 · Delta ""/"" · Epsilon 4/5 · Nu 4/"" · Xi 4/null · Mu 0/5 · Nhà hàng Omega ""/5.
 * Đỏ trên main 8751e87: Alpha "tr–5tr", Beta "0tr–6tr", Delta "tr", Nu "4tr" (thiếu "Từ"), thẻ chọn/so sánh/Vendors của giá rỗng ghi "tr".
 * Chạy: node eval/T-192/check_3_khoang_gia_dau_rong.cjs [--repo <tohong-front>] */
const { E, BARE_TR } = require('./_mini.cjs'); const S = E.setup(); const dash = E.dash;
const sc = (n) => ({ totalScore: n, scoreBreakdown: {}, reasons: [] });
const mk = (id, name, a, b, x) => E.V(id, name, a, b, { match: sc(90), ...(x || {}) });
const L = [mk('t192_1', 'Alpha Studio', '', 5), mk('t192_2', 'Beta Studio', null, 6), mk('t192_3', 'Gamma Studio', undefined, 7), mk('t192_4', 'Delta Studio', '', ''),
  mk('t192_5', 'Epsilon Studio', 4, 5)];
const L2 = [mk('t192_6', 'Nu Studio', 4, ''), mk('t192_7', 'Xi Studio', 4, null), mk('t192_8', 'Mu Studio', 0, 5)];   // danh sách chat chỉ hiện 5 vendor đầu, nên chia hai trang
const H = [mk('t192_9', 'Omega Hall', '', 5, { category: 'venue', price_source: 'estimated', price_basis: 'legacy_marry', price_as_of: '2026-06', price_label: 'Giá marry.vn · 06/2026' })];
for (const v of [...L, ...L2, ...H]) E.ALL.push(v);   // để máy chủ giả trả được thẻ chi tiết và giá hiện tại
const TOK = /\d[\d,]*\s*tr/;                    // một số tiền: "5tr", "4,5tr"
/* chữ `want` có mặt đúng nguyên văn, và ngoài nó hàng không còn số tiền hay "tr" trơ nào */
const exact = (surf, raw, want) => {
  const t = dash(raw), at = t.indexOf(want);
  if (at < 0) return S.bad(`${surf}: mong đúng chữ "${want}", thấy "${t.slice(0, 220)}"`);
  const rest = t.slice(0, at) + ' ' + t.slice(at + want.length);
  if (TOK.test(rest) || BARE_TR.test(rest) || /NaN|undefined|null/.test(rest)) S.bad(`${surf}: ngoài "${want}" còn số tiền hoặc "tr" lạ (vd "Từ 5tr", "5tr" trơ, "tr–"), thấy "${t.slice(0, 220)}"`);
};
const WANT = { Alpha: 'Đến 5tr', Beta: 'Đến 6tr', Gamma: 'Đến 7tr', Delta: 'Chưa có giá', Epsilon: '4tr–5tr', Nu: 'Từ 4tr', Xi: 'Từ 4tr', Mu: '0tr–5tr' };
/* Giá MỘT số ở thẻ chọn / bảng so sánh (priceTotal): Alpha ""→ Chưa có giá; Beta null→ Chưa có giá; Delta ""→ Chưa có giá; Epsilon 4 → "4tr" (không "Từ"). */
const ONE = { Beta: 'Chưa có giá', Delta: 'Chưa có giá', Epsilon: '4tr' };
S.run(async () => {
  /* A. chat: danh sách + chi tiết + thẻ chọn + bảng so sánh (ảnh) */
  let pg = await S.page('__t187a.html', '?cat=photography', { vendors: { photography: L } });
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Alpha Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(600);
    for (const n of ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']) exact(`danh sách chat (${n})`, await S.rowText(pg, '[data-card="0"]', n + ' Studio'), WANT[n]);
    await pg.locator('[data-card="0"]').getByText('Alpha Studio', { exact: false }).first().click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(600);
    const d = dash(await S.bodyText(pg, '[data-card="1"]'));
    if (!d.includes('Đến 5tr')) S.bad(`chi tiết Alpha (đầu dưới rỗng): mong có "Đến 5tr", thấy "${d.slice(0, 300)}"`);
    const dr = d.replace('Đến 5tr', ' ');
    if (/(?<![\p{L}\p{N}])5\s?tr/u.test(dr) || BARE_TR.test(dr) || /tr–|0tr–|Từ\s*\d/.test(dr)) S.bad(`chi tiết Alpha: còn khoảng giá sai ("5tr" không có "Đến", "Từ 5tr", "tr–"), thấy "${d.slice(0, 300)}"`);
    /* thẻ chọn so sánh */
    await pg.locator('[data-card="1"]').getByText('So sánh', { exact: false }).first().click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="2"]', { timeout: 5000 }); await pg.waitForFunction(() => document.querySelector('[data-card="2"]').innerText.includes('Epsilon Studio'), null, { timeout: 8000 }); await pg.waitForTimeout(500);
    for (const n of Object.keys(ONE)) exact(`thẻ chọn so sánh (${n})`, await S.rowText(pg, '[data-card="2"]', n + ' Studio'), ONE[n]);
    /* bảng so sánh: Alpha (neo, giá rỗng) + Delta (rỗng) + Epsilon (4) */
    await pg.locator('[data-card="2"]').getByText('Delta Studio', { exact: false }).first().click(); await pg.locator('[data-card="2"]').getByText('Epsilon Studio', { exact: false }).first().click();
    await pg.locator('[data-card="2"]').getByRole('button', { name: /So sánh \d vendor/ }).click({ timeout: 5000 });
    await pg.waitForSelector('[data-card="3"]', { timeout: 5000 }); await pg.waitForTimeout(800);
    if (process.env.T192_DBG) console.log(await S.bodyText(pg, '[data-card="3"]'));
    const row = await pg.evaluate(() => { const c = document.querySelector('[data-card="3"]'); const lab = [...c.querySelectorAll('*')].find((e) => e.children.length === 0 && (e.innerText || '').trim().toLowerCase() === 'giá'); let el = lab; while (el && el.parentElement && el.parentElement !== c && (el.innerText || '').replace(/\s+/g, ' ').length < 12) el = el.parentElement; return el ? el.innerText.replace(/\s+/g, ' ') : null; });
    if (!row) S.bad('bảng so sánh: không thấy hàng "Giá"');
    else { const r = dash(row); if ((r.match(/Chưa có giá/g) || []).length < 2 || !/(^|[^\d,])4tr(?!\d)/.test(r) || BARE_TR.test(r.replace(/Chưa có giá/g, '')) || /Từ|Đến/.test(r)) S.bad(`bảng so sánh, hàng Giá (neo Alpha rỗng, Delta rỗng, Epsilon 4): mong 2 lần "Chưa có giá" và "4tr", không "Từ"/"Đến"/"tr" trơ, thấy "${r.slice(0, 200)}"`); }
  } catch (e) { S.bad('khoảng giá (ảnh, chat): lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* A2. chat danh sách: một đầu trên rỗng/null, và số 0 */
  pg = await S.page('__t187a.html', '?cat=photography', { vendors: { photography: L2 } });
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Nu Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(600);
    for (const n of ['Nu', 'Xi', 'Mu']) exact(`danh sách chat (${n})`, await S.rowText(pg, '[data-card="0"]', n + ' Studio'), WANT[n]);
  } catch (e) { S.bad('khoảng giá (chat, đầu trên rỗng): lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* B. nhà hàng: đầu dưới rỗng, có nguồn giá */
  pg = await S.page('__t187a.html', '?cat=venue', { vendors: { venue: H } });
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Omega Hall'), null, { timeout: 15000 }); await pg.waitForTimeout(600);
    exact('danh sách nhà hàng (đầu dưới rỗng)', await S.rowText(pg, '[data-card="0"]', 'Omega Hall'), 'Đến 5tr/bàn');
  } catch (e) { S.bad('khoảng giá (nhà hàng): lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* C. màn Vendors (đã lưu). Giá lúc lưu -> giá hiện tại (E.ALL): Alpha 4 -> ""/5 ; Delta "" -> ""/"" ; Nu 4 -> 4/"" ; Epsilon 4 -> 4/5 */
  const SEED = E.savedDocs({ photography: { shortlisted: [E.mkSaved(L[0], 4), E.mkSaved(L[3], ''), E.mkSaved(L2[0], 4), E.mkSaved(L[4], 4)], confirmed: null } });
  pg = await S.page('__t187b.html', '', { seed: SEED });
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Alpha Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(1200);
    const a = dash(await S.rowText(pg, '#root', 'Alpha Studio'));
    if (!a.includes('4tr') || !a.includes('giá đã cập nhật (Đến 5tr)')) S.bad(`Vendors (Alpha lưu 4tr, nay đầu dưới rỗng): mong "4tr" và "giá đã cập nhật (Đến 5tr)", thấy "${a.slice(0, 220)}"`);
    if (BARE_TR.test(a) || /tr–|Từ\s*\d/.test(a)) S.bad(`Vendors (Alpha): còn "tr" trơ / "tr–" / "Từ 5tr", thấy "${a.slice(0, 220)}"`);
    const dl = dash(await S.rowText(pg, '#root', 'Delta Studio')); exact('Vendors (Delta lưu không giá)', dl, 'Chưa có giá');
    const z = dash(await S.rowText(pg, '#root', 'Nu Studio'));
    if (!/(^|[^\d,])4tr(?!\d)/.test(z) || /Từ\s*\d|Đến|giá đã cập nhật/.test(z)) S.bad(`Vendors (Nu: một giá 4tr, giá hiện tại 4/rỗng, không đổi): mong "4tr", không "Từ"/"giá đã cập nhật", thấy "${z.slice(0, 220)}"`);
    const ep = dash(await S.rowText(pg, '#root', 'Epsilon Studio'));
    if (!/(^|[^\d,])4tr(?!\d)/.test(ep) || /Từ\s*\d|Đến/.test(ep)) S.bad(`Vendors (Epsilon một giá 4tr): mong "4tr", không "Từ"/"Đến", thấy "${ep.slice(0, 220)}"`);
  } catch (e) { S.bad('khoảng giá (Vendors): lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
