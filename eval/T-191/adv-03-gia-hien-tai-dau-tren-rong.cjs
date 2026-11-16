'use strict';
/* T-191 adv-03 (adversary, tầng 3): câu "Bạn đã lưu lúc … Giá hiện tại trên Tơ Hồng: …" và "giá đã cập nhật (…)" khi đầu trên của giá hiện tại
 * là chuỗi rỗng "" (Postgres/API trả rỗng) hoặc chuỗi cùng chữ với đầu dưới. Spec T-187 H2: "Cùng luật hai đầu cùng chữ thì một số"; H1 giá trị thiếu không lộ chữ lạ.
 * Nu lưu lúc 3.5, hiện tại {priceMin: 4.25, priceMax: ""} => "Bạn đã lưu lúc 3,5tr. Giá hiện tại trên Tơ Hồng: 4,3tr" (không "4,3–tr", không "4,3–0tr"); hàng "giá đã cập nhật (4,3tr)".
 * Mu lưu lúc 20, hiện tại {priceMin: "4.20", priceMax: "4.24"} => "…: 4,2tr"; hàng "giá đã cập nhật (4,2tr)".
 * Chạy: node eval/T-191/adv-03-gia-hien-tai-dau-tren-rong.cjs [--repo <tohong-front>] */
const E = require('../T-187/_lib.cjs'); const S = E.setup(); const dash = E.dash;
const SEED = E.savedDocs({ photography: { shortlisted: [E.mkSaved(E.NU, 3.5), E.mkSaved(E.MU, 20)], confirmed: null } });
const LIVE = { [E.NU.id]: { priceMin: 4.25, priceMax: '' }, [E.MU.id]: { priceMin: '4.20', priceMax: '4.24' } };
const CASES = { Nu: ['Bạn đã lưu lúc 3,5tr. Giá hiện tại trên Tơ Hồng: 4,3tr', 'giá đã cập nhật (4,3tr)'], Mu: ['Bạn đã lưu lúc 20tr. Giá hiện tại trên Tơ Hồng: 4,2tr', 'giá đã cập nhật (4,2tr)'] };
const JUNK = /–tr|–0tr|4,3–4,3|4,2–4,2|4,2tr–4,2tr|NaN|undefined|\bnull\b/;
S.run(async () => {
  let pg = await S.page('__t187b.html', '', { seed: SEED, live: LIVE });
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Mu Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(1500);
    for (const [n, w] of Object.entries(CASES)) { const t = dash(await S.rowText(pg, '#root', n + ' Studio')); S.has(`đã lưu (${n})`, t, [w[1]]); const j = t.match(JUNK); if (j) S.bad(`đã lưu (${n}): "${j[0]}", thấy "${t}"`); }
  } catch (e) { S.bad('đã lưu: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  for (const [n, w] of Object.entries(CASES)) {
    pg = await S.page('__t187b.html', '?v=budget&cat=photography', { seed: SEED, live: LIVE });
    try {
      await pg.waitForFunction(() => document.body.innerText.includes('Mu Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(1200);
      await pg.getByText(n + ' Studio', { exact: false }).first().click({ timeout: 5000 }); await pg.waitForTimeout(800);
      const b = dash(await S.bodyText(pg)); S.has(`sheet ${n}`, b, [w[0]]); S.noDot(`sheet ${n}`, b);
      const m = b.match(/Giá hiện tại trên Tơ Hồng:[^.]{0,40}/); const j = m && m[0].match(JUNK); if (j) S.bad(`sheet ${n}: "${j[0]}", thấy "${m[0]}"`);
    } catch (e) { S.bad(`sheet ${n}: lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
});
