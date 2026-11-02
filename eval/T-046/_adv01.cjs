#!/usr/bin/env node
/*
 * adv-01 (T-046, tầng 3): mục 1 của spec T-045, "làm tròn về triệu nguyên (0,5 trở lên làm tròn lên)".
 * Ca biên tiền chi rơi đúng x,5 triệu với giá một chữ số thập phân (dữ liệu vendor thật có giá 4.1tr/bàn: marry_8a598c176efc).
 *   a 150 khách, 4.1tr/bàn -> 15 bàn -> 61,5 -> 62tr
 *   b 250 khách, 2.3tr/bàn -> 25 bàn -> 57,5 -> 58tr
 *   c 205 khách, 3.9tr/bàn -> 21 bàn -> 81,9 -> 82tr (đối chứng, đã có ở TC1)
 * Đo: thân PUT ngân sách (amt khoản vendor) và dòng hạng mục ở danh sách Ngân sách.
 * Chạy: bash /home/user/tohong-hq/eval/T-046/adv-01.sh [thư-mục-tohong-front]  (mặc định: thư mục hiện tại, như gate.py --cwd)
 */
const L = require('./_adv_lib.cjs');
const { chromium, server } = L.setup(require('path').resolve(process.argv[2] || ''));
const { check, finish } = L.reporter();
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); const BASE = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  const cases = [
    { n: 'a 150 khách, 4.1tr/bàn -> 15 bàn -> 61,5 -> 62tr', g: 150, p: 4.1, tables: 15 },
    { n: 'b 250 khách, 2.3tr/bàn -> 25 bàn -> 57,5 -> 58tr', g: 250, p: 2.3, tables: 25 },
    { n: 'c 205 khách, 3.9tr/bàn -> 21 bàn -> 82tr (đối chứng)', g: 205, p: 3.9, tables: 21 },
  ];
  for (const c of cases) {
    const want = L.halfUpTenths(c.tables, Math.round(c.p * 10));
    const S = await L.scenario(browser, BASE, { guests: c.g, vendor: L.venueV({ priceTotal: c.p }) });
    try {
      await L.confirmFirst(S); await S.page.waitForTimeout(1500);
      check(`${c.n}: khoản vendor lưu ở máy chủ = ${want}`, L.venueItemAmt(S) === want, 'amt=' + L.venueItemAmt(S));
      const row = await L.listRow(S);
      check(`${c.n}: dòng hạng mục hiện ${want}tr`, new RegExp(`(^|[^\\d.,])${want}\\s*tr`).test(row), row);
      check(`${c.n}: dòng "Số bàn: ${c.tables}"`, new RegExp(`Số bàn:\\s*${c.tables}(?!\\d)`).test(row), row);
    } catch (e) { check(`${c.n}: thao tác không thực hiện được`, false, e.message); }
    await S.ctx.close();
  }
  await browser.close(); server.close(); finish();
})().catch((e) => { console.log('FAIL eval lỗi: ' + e.message); process.exit(2); });
