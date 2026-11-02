#!/usr/bin/env node
/* Thử đối kháng T-046 (adversary), không đưa vào gate: các ca biên đầu vào. node _tried02.cjs <front> */
const L = require('./_adv_lib.cjs');
const { chromium, server } = L.setup(require('path').resolve(process.argv[2] || ''));
const { check, finish } = L.reporter();
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); const BASE = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  const cases = [
    { n: 'giá là chuỗi "6", 205 khách -> 126', g: 205, v: { priceTotal: '6' }, amt: 126, re: /126\s*tr/ },
    { n: 'số khách 205.5 (không nguyên) -> chưa tính được: thiếu số khách, amt 0', g: 205.5, v: {}, amt: 0, re: /Chưa tính được: thiếu số khách/ },
    { n: 'số khách âm -5 -> thiếu số khách, amt 0', g: -5, v: {}, amt: 0, re: /Chưa tính được: thiếu số khách/ },
    { n: 'giá âm -6 -> vendor chưa có giá, amt 0', g: 205, v: { priceTotal: -6 }, amt: 0, re: /Chưa tính được: vendor chưa có giá/ },
    { n: 'giá là chữ "liên hệ" -> vendor chưa có giá', g: 205, v: { priceTotal: 'liên hệ' }, amt: 0, re: /Chưa tính được: vendor chưa có giá/ },
    { n: 'giá thấp 0 (thiếu), giá cao 15 -> (quan sát) có đoán 7.5/bàn không', g: 205, v: { priceTotal: 0, priceMax: 15 }, amt: 0, re: /Chưa tính được: vendor chưa có giá/ },
    { n: '1 khách -> 1 bàn x 6 = 6', g: 1, v: {}, amt: 6, re: /Số bàn:\s*1(?!\d)/ },
    { n: '10000 khách -> 1000 bàn, không dấu phân cách', g: 10000, v: {}, amt: 6000, re: /Số bàn:\s*1000(?!\d)/ },
  ];
  for (const c of cases) {
    const S = await L.scenario(browser, BASE, { guests: c.g, vendor: L.venueV(c.v) });
    try {
      await L.confirmFirst(S);
      const a = L.venueItemAmt(S); check(`${c.n}: amt lưu = ${c.amt}`, a === c.amt, 'amt=' + a);
      const row = await L.listRow(S); check(`${c.n}: dòng hạng mục`, c.re.test(row) && !/NaN|undefined|Infinity/.test(row), row);
    } catch (e) { check(`${c.n}: thao tác`, false, e.message); }
    await S.ctx.close();
  }
  await browser.close(); server.close(); finish();
})();
