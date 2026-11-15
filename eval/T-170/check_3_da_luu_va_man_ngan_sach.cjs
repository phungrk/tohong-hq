#!/usr/bin/env node
/* T-170 tiêu chí 3 (app cặp đôi, đã lưu + Ngân sách): danh sách đã lưu (ScreenVendorShortlist) và màn Ngân sách (ScreenBudget: hàng vendor đã lưu + sheet chi tiết vendor) vẫn hiện giá, KHÔNG hiện nhãn nguồn giá.
 * Mốc mã main 0221a5c: Vendors.jsx:45-46; Budget.jsx:220 (sheet, giá không đổi), :223 (sheet, giá đã đổi), :442-443 (hàng).
 * Giữ: vendor đã lưu lúc 10tr mà giá hiện tại 12tr vẫn hiện "giá đã cập nhật" ở hàng và câu "Bạn đã lưu lúc 10tr. Giá hiện tại trên Tơ Hồng: 12–14tr" ở sheet, nhưng không còn nhãn và không còn dấu "·" treo ngay sau đó; venue vẫn "/bàn".
 * Chạy: node eval/T-170/check_3_da_luu_va_man_ngan_sach.cjs [--repo <tohong-front>] */
const E = require('./_lib.cjs'); const S = E.setup();
const ALL = E.VENDORS.concat([E.DELTA, E.EPSILON, E.THETA]);
const SAVED = ALL.map((v) => (v === E.THETA ? E.mkSaved(v, 10) : E.mkSaved(v)));
const dangling = /(giá đã cập nhật(?:\s*\([^)]*\))?|Giá hiện tại trên Tơ Hồng:\s*[\d.,]+(?:\s*[–-]\s*[\d.,]+)?tr(?:\/bàn)?)\s*·(\s|$)/;
S.run(async () => {
  const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
  /* A. danh sách đã lưu */
  let pg = await S.page('__t170b.html', '', { seed: E.savedDoc('photography', SAVED) });
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Alpha Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(1200);
    for (const n of names) { const v = ALL.find((x) => x.name.startsWith(n)); const t = await S.rowText(pg, '#root', n + ' Studio'); S.checkRow('danh sách đã lưu', v.name, t, n === 'Theta' ? { ...v, priceMin: 10 } : v); if (t && dangling.test(t)) S.bad(`danh sách đã lưu: ${n} còn dấu "·" treo: ${t.slice(0, 200)}`); }
    const z = await S.rowText(pg, '#root', 'Theta Studio');
    if (!z || !z.includes('giá đã cập nhật') || !/12tr/.test(z)) S.bad('danh sách đã lưu: vendor lưu 10tr, giá hiện tại 12tr phải còn "giá đã cập nhật (12tr…)", thấy: ' + z);
  } catch (e) { S.bad('danh sách đã lưu: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* B. Ngân sách, hạng mục ảnh: hàng, rồi sheet chi tiết của vendor không đổi giá (Alpha, Zeta cũ không nhãn) và đã đổi giá (Theta) */
  for (const n of ['Alpha', 'Zeta', 'Theta']) {
    pg = await S.page('__t170b.html', '?v=budget', { seed: E.savedDoc('photography', SAVED) });
    try {
      await pg.waitForFunction(() => document.body.innerText.includes('Alpha Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(1200);
      if (n === 'Alpha') for (const m of names) { const v = ALL.find((x) => x.name.startsWith(m)); const t = await S.rowText(pg, '#root', m + ' Studio'); S.checkRow('màn Ngân sách (hàng)', v.name, t, m === 'Theta' ? { ...v, priceMin: 10 } : v); if (t && dangling.test(t)) S.bad(`màn Ngân sách: hàng ${m} còn dấu "·" treo: ${t.slice(0, 200)}`); }
      if (n === 'Alpha') { const t = await S.rowText(pg, '#root', 'Theta Studio'); if (!t || !t.includes('giá đã cập nhật')) S.bad('màn Ngân sách: hàng Theta (lưu 10tr, nay 12tr) phải còn "giá đã cập nhật", thấy: ' + t); }
      await pg.getByText(n + ' Studio', { exact: false }).first().click({ timeout: 5000 }); await pg.waitForTimeout(800);
      const b = await S.bodyText(pg);
      const f = b.match(E.FORBID); if (f) S.bad(`màn Ngân sách (sheet ${n}): còn nhãn nguồn giá "${f[0]}"`);
      if (dangling.test(b)) S.bad(`màn Ngân sách (sheet ${n}): còn dấu "·" treo sau giá`);
      if (n === 'Theta' && !/Bạn đã lưu lúc 10tr\. Giá hiện tại trên Tơ Hồng: 12\s*[–-]\s*14tr/.test(b)) S.bad('màn Ngân sách (sheet Theta): phải còn câu "Bạn đã lưu lúc 10tr. Giá hiện tại trên Tơ Hồng: 12–14tr", thấy: ' + (b.match(/Bạn đã lưu[^]{0,120}/) || ['(không có)'])[0]);
      if (n !== 'Theta') { const p = n === 'Alpha' ? 11 : 16; if (!b.includes(`${p}tr`)) S.bad(`màn Ngân sách (sheet ${n}): mất giá ${p}tr`); }
    } catch (e) { S.bad(`màn Ngân sách (${n}): lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
  /* C. venue đã lưu: "/bàn" còn, nhãn mất, ở danh sách đã lưu và hàng Ngân sách */
  const sv = E.savedDoc('venue', [E.mkSaved(E.OMEGA, 4)]);
  for (const [surf, q] of [['danh sách đã lưu', ''], ['màn Ngân sách', '?v=budget&cat=venue']]) {
    pg = await S.page('__t170b.html', q, { seed: sv });
    try {
      await pg.waitForFunction(() => document.body.innerText.includes('Omega Hall'), null, { timeout: 15000 }); await pg.waitForTimeout(1200);
      const t = await S.rowText(pg, '#root', 'Omega Hall');
      if (!t || !/4tr\/bàn|4tr\s*[–-]\s*[\d.]+tr\/bàn/.test(t)) S.bad(`venue ${surf}: giá phải còn ghi theo bàn ("4tr/bàn"), thấy: ${String(t).slice(0, 160)}`);
      if (t && E.FORBID.test(t)) S.bad(`venue ${surf}: còn nhãn nguồn giá: ${t.match(E.FORBID)[0]}`);
    } catch (e) { S.bad(`venue ${surf}: lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
});
