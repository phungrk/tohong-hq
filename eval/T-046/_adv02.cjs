#!/usr/bin/env node
/*
 * adv-02 (T-046, tầng 3): mục 1 + 2 spec T-045, "chỉ làm tròn MỘT lần, ở bước cuối, không làm tròn giá hay số bàn trung gian".
 * Giá theo nghìn đồng (3 chữ số thập phân, nhập được qua sửa vendor của admin) làm điểm giữa khoảng có 4 chữ số thập phân.
 *   a 390 khách, khoảng 3.000-3.025tr/bàn -> giữa 3.0125 -> 39 bàn -> 117,4875 -> 117tr (không phải 118)
 *   b 30 khách, giá 4.1666tr/bàn -> 3 bàn -> 12,4998 -> 12tr (không phải 13)
 *   c 150 khách, 4.1tr/bàn -> 62tr (đối chứng, ca adv-01)
 * Đáp án tính bằng số nguyên trên đúng chữ số thập phân của giá (độc lập với mã nguồn).
 */
const L = require('./_adv_lib.cjs');
const { chromium, server } = L.setup(require('path').resolve(process.argv[2] || ''));
const { check, finish } = L.reporter();
// giá cho bằng chuỗi thập phân -> (tử số nguyên, mẫu 10^k); tiền = bàn * (lo+hi)/2, nửa lên.
const dec = (s) => { const [i, f = ''] = s.split('.'); return { n: BigInt(i + f), d: 10n ** BigInt(f.length) }; };
const exact = (tables, lo, hi) => { const a = dec(lo), b = dec(hi || lo); const d = a.d > b.d ? a.d : b.d;
  const sum = a.n * (d / a.d) + b.n * (d / b.d); const num = BigInt(tables) * sum, den = 2n * d; return Number((2n * num + den) / (2n * den)); };
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); const BASE = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  const cases = [
    { n: 'a 390 khách, khoảng 3.000-3.025tr/bàn -> 117,4875 -> 117tr', g: 390, lo: '3.000', hi: '3.025', tables: 39 },
    { n: 'b 30 khách, 4.1666tr/bàn -> 12,4998 -> 12tr', g: 30, lo: '4.1666', tables: 3 },
    { n: 'c 150 khách, 4.1tr/bàn -> 62tr (đối chứng)', g: 150, lo: '4.1', tables: 15 },
  ];
  for (const c of cases) {
    const want = exact(c.tables, c.lo, c.hi);
    const v = { priceTotal: Number(c.lo) }; if (c.hi) v.priceMax = Number(c.hi);
    const S = await L.scenario(browser, BASE, { guests: c.g, vendor: L.venueV(v) });
    try {
      await L.confirmFirst(S); await S.page.waitForTimeout(1500);
      check(`${c.n}: khoản vendor lưu ở máy chủ = ${want}`, L.venueItemAmt(S) === want, 'amt=' + L.venueItemAmt(S));
      const row = await L.listRow(S);
      check(`${c.n}: dòng hạng mục hiện ${want}tr`, new RegExp(`(^|[^\\d.,])${want}\\s*tr`).test(row), row);
    } catch (e) { check(`${c.n}: thao tác không thực hiện được`, false, e.message); }
    await S.ctx.close();
  }
  await browser.close(); server.close(); finish();
})().catch((e) => { console.log('FAIL eval lỗi: ' + e.message); process.exit(2); });
