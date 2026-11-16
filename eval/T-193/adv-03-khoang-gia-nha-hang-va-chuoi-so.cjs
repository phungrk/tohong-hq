#!/usr/bin/env node
/* T-193 đối kháng 3: tổ hợp khoảng giá chưa có trong eval tầng 1 (danh sách chat, nơi KHOẢNG).
 * Spec T-192 H4: đầu trên rỗng -> "Từ 4tr" (nhà hàng có nguồn giá "Từ 4tr/bàn"); cả hai rỗng -> "Chưa có giá" (không "/bàn" thừa);
 * số là chuỗi ("4", "4.5") như số; 0 là giá thật: 0 / null -> "Từ 0tr". Không "tr" trơ, không "NaN".
 * Nhà hàng: Omega Hall 4/null, Sigma Hall ""/null (có price_basis). Ảnh: Alpha Studio "4"/"4.5", Beta Studio 0/null.
 * Chạy: node eval/T-193/adv-03-khoang-gia-nha-hang-va-chuoi-so.cjs [--repo <tohong-front>] */
const path = require('path');
const { E, BARE_TR } = require(path.join(__dirname, '../T-192/_mini.cjs')); const S = E.setup(); const dash = E.dash;
const sc = { totalScore: 90, scoreBreakdown: {}, reasons: [] };
const PB = { category: 'venue', price_source: 'estimated', price_basis: 'legacy_marry', price_as_of: '2026-06', price_label: 'Giá marry.vn · 06/2026', match: sc };
const H = [E.V('a193_h1', 'Omega Hall', 4, null, PB), E.V('a193_h2', 'Sigma Hall', '', null, PB)];
const P = [E.V('a193_p1', 'Alpha Studio', '4', '4.5', { match: sc }), E.V('a193_p2', 'Beta Studio', 0, null, { match: sc })];
for (const v of [...H, ...P]) E.ALL.push(v);
const TOK = /\d[\d,]*\s*tr/;
const exact = (surf, raw, want) => {
  const t = dash(raw || ''), at = t.indexOf(want);
  if (at < 0) return S.bad(`${surf}: mong "${want}", thấy "${t.slice(0, 200)}"`);
  const rest = t.slice(0, at) + ' ' + t.slice(at + want.length);
  if (TOK.test(rest) || BARE_TR.test(rest) || /NaN|undefined|null|\/bàn/.test(rest)) S.bad(`${surf}: ngoài "${want}" còn số tiền/"tr"/"/bàn" lạ, thấy "${t.slice(0, 200)}"`);
};
S.run(async () => {
  for (const [cat, list, want] of [['venue', H, { 'Omega Hall': 'Từ 4tr/bàn', 'Sigma Hall': 'Chưa có giá' }], ['photography', P, { 'Alpha Studio': '4tr–4,5tr', 'Beta Studio': 'Từ 0tr' }]]) {
    const pg = await S.page('__t187a.html', '?cat=' + cat, { vendors: { [cat]: list } });
    try {
      await pg.waitForFunction((n) => document.body.innerText.includes(n), list[1].name, { timeout: 15000 }); await pg.waitForTimeout(600);
      for (const n of Object.keys(want)) exact(`danh sách chat (${n})`, await S.rowText(pg, '[data-card="0"]', n), want[n]);
    } catch (e) { S.bad(`(${cat}) lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
});
