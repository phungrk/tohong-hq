'use strict';
/* T-191 adv-02 (adversary, tầng 3): đầu vào hỏng/thiếu và số lớn lẻ (spec T-187 H1 "Giá trị thiếu ... không thêm chữ undefined/NaN/null"; "không phân cách nghìn").
 * Danh sách chat: priceMin "abc" / "" / null (max 5), giá 1404.96 (=> "1405tr", không "1.405", không "1404,96"), giá 0.04–0.04 (=> "0tr", không "-0", không "0,0").
 * Vendor đã lưu: priceTotal null và "abc" => không lộ "NaN"/"undefined"/"null".
 * Chạy: node eval/T-191/adv-02-dau-vao-hong-va-so-lon.cjs [--repo <tohong-front>] */
const E = require('../T-187/_lib.cjs'); const S = E.setup(); const dash = E.dash;
const waitText = (pg, re) => pg.waitForFunction((s) => new RegExp(s, 'i').test(document.body.innerText), re, { timeout: 15000 });
const BAD = /NaN|undefined|\bnull\b|Infinity/;
S.run(async () => {
  const sc = (n) => ({ totalScore: n, scoreBreakdown: {}, reasons: [] });
  const L = [
    E.V('t191_a', 'Abc Studio', 'abc', 5, { match: sc(90) }),
    E.V('t191_b', 'Blank Studio', '', 5, { match: sc(85) }),
    E.V('t191_c', 'Nil Studio', null, 5, { match: sc(80) }),
    E.V('t191_d', 'Big Studio', 1404.96, 1404.96, { match: sc(75) }),
    E.V('t191_e', 'Tiny Studio', 0.04, 0.04, { match: sc(70) }),
  ];
  let pg = await S.page('__t187a.html', '?cat=photography', { vendors: { photography: L } });
  try {
    await waitText(pg, 'Tiny Studio'); await pg.waitForTimeout(1000);
    const b = dash(await S.bodyText(pg, '#cards'));
    const u = b.match(BAD); if (u) S.bad(`danh sách chat: lộ "${u[0]}", thấy "${b.slice(0, 400)}"`);
    if (!/1405tr/.test(b) || /1\.405|1404,96|1405,0/.test(b)) S.bad(`Big Studio 1404.96: mong "1405tr", thấy "${b.slice(0, 400)}"`);
    const t = b.slice(b.indexOf('Tiny Studio'));
    if (!/\b0tr\b/.test(t) || /-0tr|0,0tr|0\.04/.test(t)) S.bad(`Tiny Studio 0.04: mong "0tr", thấy "${t.slice(0, 200)}"`);
    S.noDot('danh sách chat (đầu vào hỏng)', b);
    if (process.env.T191_SHOW) console.log(b);
  } catch (e) { S.bad('danh sách chat (đầu vào hỏng): lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  const SEED = E.savedDocs({ photography: { shortlisted: [E.mkSaved(L[2], null, { priceTotal: null }), E.mkSaved(L[0], 'abc')], confirmed: null } });
  pg = await S.page('__t187b.html', '', { seed: SEED });
  try {
    await waitText(pg, 'Vendor đã lưu'); await pg.waitForTimeout(1200);
    const b = dash(await S.bodyText(pg));
    const u = b.match(BAD); if (u) S.bad(`Vendor đã lưu: lộ "${u[0]}", thấy "${b.slice(0, 400)}"`);
  } catch (e) { S.bad('Vendor đã lưu (đầu vào hỏng): lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
