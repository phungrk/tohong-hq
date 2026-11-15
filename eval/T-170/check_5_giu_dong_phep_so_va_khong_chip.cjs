#!/usr/bin/env node
/* T-170 tiêu chí 5 (app cặp đôi): sau khi bỏ nhãn nguồn giá, (a) dòng phép so T-167 vẫn in NGUYÊN VĂN dưới thanh "Ngân sách" của chi tiết, đúng một lần, kể cả tiền tố "Giá ước tính: " (ADR-099 giữ nguyên);
 * (b) hàng rào phía front: front không tự sinh chip khẳng định ngân sách ("Trong ngân sách", "Rẻ hơn …") cho vendor giá ước tính ở danh sách chat và chi tiết dù điểm ngân sách = 1. LƯU Ý: chip lấy từ match.reasons của back, API giả ở đây trả reasons [] nên vế này gần như luôn xanh; tính chất thật (back không sinh chip cho giá ước tính) do inv-003 tầng 2 giữ;
 * (c) ngoài dòng phép so, chi tiết không còn chữ nhãn nguồn giá nào (đây là chỗ nhãn từng nằm ngay đầu chi tiết, VendorChatCards.jsx:617, nên đỏ trên main).
 * Chạy: node eval/T-170/check_5_giu_dong_phep_so_va_khong_chip.cjs [--repo <tohong-front>] */
const E = require('./_lib.cjs'); const S = E.setup();
const T_OMEGA = 'Giá ước tính: ≈ 4,3tr/bàn × 20 bàn = 86tr so với 90tr tiệc cưới';
const T_SIGMA = 'Giá ước tính: Chưa có số khách nên chưa tính được tổng tiệc (giá ≈ 3,9tr/bàn)';
const CHIP = /Trong ngân sách|Rẻ hơn/i;
const withBudget = (v, b) => ({ ...v, match: { totalScore: 70, scoreBreakdown: { budget: b, style: 0.5, availability: 1 }, reasons: [] } });
S.run(async () => {
  const vendors = { venue: [withBudget(E.OMEGA, 1), withBudget(E.SIGMA, 1)], photography: E.VENDORS.map((v) => withBudget(v, 1)) };
  const opts = { vendors, basis: { [E.OMEGA.id]: T_OMEGA, [E.SIGMA.id]: T_SIGMA } };
  for (const [name, text, price] of [['Omega Hall', T_OMEGA, '4tr'], ['Sigma Hall', T_SIGMA, '3.9tr']]) {
    const pg = await S.page('__t170a.html', '?cat=venue', opts);
    try {
      await pg.waitForFunction(() => document.body.innerText.includes('Omega Hall'), null, { timeout: 15000 });
      const list = await S.bodyText(pg, '[data-card="0"]');
      if (CHIP.test(list)) S.bad(`${name}: danh sách có chip khẳng định ngân sách cho giá ước tính: ${list.match(CHIP)[0]}`);
      if (E.FORBID.test(list)) S.bad(`${name}: danh sách còn nhãn nguồn giá: ${list.match(E.FORBID)[0]}`);
      await pg.locator('[data-card="0"]').getByText(name, { exact: false }).first().click({ timeout: 5000 });
      await pg.waitForSelector('[data-card="1"]', { timeout: 5000 }); await pg.waitForTimeout(700);
      await S.checkDangle(`${name} chi tiết`, pg, '[data-card="1"]'); await S.checkDangle(`${name} danh sách`, pg, '[data-card="0"]');
      const d = await S.bodyText(pg, '[data-card="1"]');
      const n = d.split(text).length - 1;
      if (n !== 1) S.bad(`${name}: dòng phép so phải in nguyên văn đúng một lần ("${text}"), thấy ${n} lần`);
      if (!d.includes(price)) S.bad(`${name}: chi tiết mất giá ${price}`);
      const rest = d.split(text).join(' ');
      if (E.FORBID.test(rest)) S.bad(`${name}: ngoài dòng phép so, chi tiết còn nhãn nguồn giá "${rest.match(E.FORBID)[0]}"`);
      if (CHIP.test(d)) S.bad(`${name}: chi tiết có chip khẳng định ngân sách cho giá ước tính: ${d.match(CHIP)[0]}`);
    } catch (e) { S.bad(`${name}: lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
  const pg = await S.page('__t170a.html', '', opts);
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Alpha Studio'), null, { timeout: 15000 });
    const list = await S.bodyText(pg, '[data-card="0"]');
    if (CHIP.test(list)) S.bad('danh sách ảnh (giá ước tính, điểm ngân sách 1): có chip khẳng định ngân sách: ' + list.match(CHIP)[0]);
  } catch (e) { S.bad('danh sách ảnh: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
