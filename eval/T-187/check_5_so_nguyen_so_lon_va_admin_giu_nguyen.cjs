#!/usr/bin/env node
/* T-187 tiêu chí 5 (khuôn số + phạm vi): (a) số nguyên không bao giờ có ",0" ("1440tr", "12tr" ở danh sách đã lưu, "4tr" từ 3,96); (b) số lớn không phân cách nghìn và không đổi sang tỷ ("1440tr", "1404tr", không "1.440tr", "1 440tr", "1,440tr");
 * (c) không đổi số: nhà hàng chốt Sigma 3.9 x 360 bàn = 1404 (tiền chi nhà hàng làm tròn nguyên như hôm nay) hiện "1404tr"; tổng đã chốt cộng đúng; (d) trang admin GIỮ NGUYÊN dấu chấm ("3.9–4.7tr/bàn", T-164 check_5b vẫn PASS): admin không phải màn của cặp đôi.
 * Dự toán giả: nhà hàng 1440, ảnh 90, tổng 2000, 3600 khách (360 bàn).
 * Chạy: node eval/T-187/check_5_so_nguyen_so_lon_va_admin_giu_nguyen.cjs [--repo <tohong-front>] */
const E = require('./_lib.cjs'); const S = E.setup(); const dash = E.dash; const { spawnSync } = require('child_process'); const path = require('path');
const DOC = E.budgetDoc([['venue', 'Tiệc & nhà hàng', 1440], ['photography', 'Chụp ảnh', 90]], { total_tr: 2000, guests: 3600, mung_tr: 0 });
const SIG = E.mkSaved(E.SIGMA, 3.9, { priceMax: 3.9 });
const SEED = E.savedDocs({ venue: { shortlisted: [SIG], confirmed: SIG }, photography: { shortlisted: [E.mkSaved(E.GAMMA, 12, { priceMax: 14 }), E.mkSaved(E.EPS, 3.96)], confirmed: null } });
const BIG = /\d[ .,]\d{3}\s*tr\b|\d,0\s*tr\b|\d\s*tỷ|\d,0\b/; // phân cách nghìn, ",0", hay đổi sang tỷ
const waitText = (pg, re) => pg.waitForFunction((s) => new RegExp(s, 'i').test(document.body.innerText), re, { timeout: 15000 });
S.run(async () => {
  /* (d) admin giữ dấu chấm: T-164 check_5b (admin liệt kê "3.9–4.7tr/bàn") chạy trên cùng repo. */
  { const r = spawnSync('node', [path.join(__dirname, '..', 'T-164', 'check_5b_nhan_admin.cjs'), '--repo', E.REPO], { encoding: 'utf8' }); const last = String(r.stdout || '').trim().split('\n').pop(); if (r.status !== 0 || last !== 'PASS') S.bad('trang admin phải giữ nguyên dấu chấm (T-164 check_5b): ' + last); }
  let pg = await S.page('__t187b.html', '?v=budget', { budget: DOC, seed: SEED });
  try {
    await waitText(pg, 'Đã phân bổ'); await pg.waitForTimeout(1200);
    const b = dash(await S.bodyText(pg));
    S.has('Ngân sách tổng quan (số lớn)', b, ['1440tr', '90tr', '/ 2000tr', 'Đã chốt vendor 1404tr']); S.noDot('Ngân sách tổng quan (số lớn)', b);
    if (BIG.test(b)) S.bad(`Ngân sách tổng quan: phân cách nghìn / ",0" / tỷ: "${b.match(BIG)[0]}"`);
  } catch (e) { S.bad('Ngân sách tổng quan: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  pg = await S.page('__t187b.html', '?v=budget&cat=venue', { budget: DOC, seed: SEED });
  try {
    await waitText(pg, 'Sigma Hall'); await pg.waitForTimeout(1200);
    const b = dash(await S.bodyText(pg)); S.has('hạng mục nhà hàng', b, ['DỰ TOÁN 1440tr', 'Sigma Hall']); S.noDot('hạng mục nhà hàng', b);
    if (BIG.test(b)) S.bad(`hạng mục nhà hàng: phân cách nghìn / ",0" / tỷ: "${b.match(BIG)[0]}"`);
  } catch (e) { S.bad('hạng mục nhà hàng: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  pg = await S.page('__t187b.html', '', { budget: DOC, seed: SEED });
  try {
    await waitText(pg, 'Vendor đã lưu'); await pg.waitForTimeout(1200);
    const b = dash(await S.bodyText(pg));
    S.has('Vendor đã lưu (số nguyên)', b, ['Gamma Studio 12tr', 'Epsilon Studio 4tr', '3,9tr/bàn', 'Vendor đã lưu 1404tr / 1530tr đã chốt']); S.noDot('Vendor đã lưu (số lớn)', b);
    if (BIG.test(b)) S.bad(`Vendor đã lưu: phân cách nghìn / ",0" / tỷ: "${b.match(BIG)[0]}"`);
  } catch (e) { S.bad('Vendor đã lưu: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
