#!/usr/bin/env node
/* T-187 tiêu chí 2 (app cặp đôi, vendor đã lưu): danh sách "Vendor đã lưu", hàng vendor ở màn Ngân sách và câu "Bạn đã lưu lúc … Giá hiện tại trên Tơ Hồng: …" dùng dấu phẩy theo khuôn T-167.
 * Đã lưu (giá lúc lưu -> giá hiện tại): Nu 4.6 -> 4.25–4.8; Xi 5 -> "12.34"–"13.8" (chuỗi); Mu 20 -> 25–27; Beta 3.5 không đổi; nhà hàng Psi 3.5 -> 4.2–4.24 (/bàn).
 * Mong đợi: câu sheet "Bạn đã lưu lúc 4,6tr. Giá hiện tại trên Tơ Hồng: 4,3–4,8tr"; "…lúc 5tr. …: 12,3–13,8tr"; "…lúc 20tr. …: 25–27tr" (nguyên: không ",0"); nhà hàng "Bạn đã lưu lúc 3,5tr. Giá hiện tại trên Tơ Hồng: 4,2tr/bàn" (hai đầu cùng chữ: một số, đúng ví dụ Capu).
 * Hàng đã lưu: "giá đã cập nhật (4,3tr–4,8tr)"; giá lúc lưu "4,6tr"; nhà hàng "3,5tr/bàn" và "(4,2tr/bàn)". Giá chính của sheet "4,6tr".
 * Chạy: node eval/T-187/check_2_da_luu_va_cau_ban_da_luu.cjs [--repo <tohong-front>] */
const E = require('./_lib.cjs'); const S = E.setup();
const DANGLE = /Giá hiện tại trên Tơ Hồng:\s*[\d.,]+(?:\s*[–-]\s*[\d.,]+)?tr(?:\/bàn)?\s*·(\s|$)/;
const dash = E.dash;
const SAVED = [E.mkSaved(E.NU, 4.6), E.mkSaved(E.XI, 5), E.mkSaved(E.MU, 20), E.mkSaved(E.BETA)];
const SEED = E.savedDocs({ photography: { shortlisted: SAVED, confirmed: null }, venue: { shortlisted: [E.mkSaved(E.PSI, 3.5)], confirmed: null } });
const ROW = { Nu: ['4,6tr', 'giá đã cập nhật (4,3tr–4,8tr)'], Xi: ['5tr', 'giá đã cập nhật (12,3tr–13,8tr)'], Mu: ['20tr', 'giá đã cập nhật (25tr–27tr)'], Beta: ['3,5tr'] };
const SHEET = { Nu: 'Bạn đã lưu lúc 4,6tr. Giá hiện tại trên Tơ Hồng: 4,3–4,8tr', Xi: 'Bạn đã lưu lúc 5tr. Giá hiện tại trên Tơ Hồng: 12,3–13,8tr', Mu: 'Bạn đã lưu lúc 20tr. Giá hiện tại trên Tơ Hồng: 25–27tr' };
S.run(async () => {
  /* A. danh sách đã lưu */
  let pg = await S.page('__t187b.html', '', { seed: SEED });
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Nu Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(1200);
    for (const [n, wants] of Object.entries(ROW)) { const t = dash(await S.rowText(pg, '#root', n + ' Studio')); S.has(`danh sách đã lưu (${n})`, t, wants); S.noDot(`danh sách đã lưu (${n})`, t); }
    if (/giá đã cập nhật/.test(await S.rowText(pg, '#root', 'Beta Studio'))) S.bad('danh sách đã lưu: Beta giá không đổi, không được ghi "giá đã cập nhật"');
    const v = dash(await S.rowText(pg, '#root', 'Psi Hall')); S.has('danh sách đã lưu (nhà hàng Psi)', v, ['3,5tr/bàn', 'giá đã cập nhật (4,2tr/bàn)']); S.noDot('danh sách đã lưu (nhà hàng Psi)', v);
  } catch (e) { S.bad('danh sách đã lưu: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* B. màn Ngân sách, hạng mục ảnh: hàng, rồi sheet chi tiết */
  for (const n of ['Nu', 'Xi', 'Mu']) {
    pg = await S.page('__t187b.html', '?v=budget&cat=photography', { seed: SEED });
    try {
      await pg.waitForFunction(() => document.body.innerText.includes('Nu Studio'), null, { timeout: 15000 }); await pg.waitForTimeout(1200);
      if (n === 'Nu') for (const [m, wants] of Object.entries(ROW)) { const t = dash(await S.rowText(pg, '#root', m + ' Studio')); S.has(`màn Ngân sách (hàng ${m})`, t, [wants[0]]); S.noDot(`màn Ngân sách (hàng ${m})`, t); }
      await pg.getByText(n + ' Studio', { exact: false }).first().click({ timeout: 5000 }); await pg.waitForTimeout(800);
      const b = dash(await S.bodyText(pg)); S.has(`màn Ngân sách (sheet ${n})`, b, [dash(SHEET[n])]); S.noDot(`màn Ngân sách (sheet ${n})`, b);
      if (DANGLE.test(b)) S.bad(`màn Ngân sách (sheet ${n}): dấu "·" treo sau câu giá`);
      if (n === 'Nu') S.has('màn Ngân sách (sheet Nu)', b, ['4,6tr']);
    } catch (e) { S.bad(`màn Ngân sách (${n}): lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
  /* C. nhà hàng: hàng + sheet */
  pg = await S.page('__t187b.html', '?v=budget&cat=venue', { seed: SEED });
  try {
    await pg.waitForFunction(() => document.body.innerText.includes('Psi Hall'), null, { timeout: 15000 }); await pg.waitForTimeout(1200);
    const t = dash(await S.rowText(pg, '#root', 'Psi Hall')); S.has('màn Ngân sách (hàng nhà hàng Psi)', t, ['3,5tr/bàn']); S.noDot('màn Ngân sách (hàng nhà hàng Psi)', t);
    await pg.getByText('Psi Hall', { exact: false }).first().click({ timeout: 5000 }); await pg.waitForTimeout(800);
    const b = dash(await S.bodyText(pg)); S.has('màn Ngân sách (sheet Psi)', b, ['Bạn đã lưu lúc 3,5tr. Giá hiện tại trên Tơ Hồng: 4,2tr/bàn']); S.noDot('màn Ngân sách (sheet Psi)', b);
    if (DANGLE.test(b)) S.bad('màn Ngân sách (sheet Psi): dấu "·" treo sau câu giá');
  } catch (e) { S.bad('màn Ngân sách (nhà hàng): lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
