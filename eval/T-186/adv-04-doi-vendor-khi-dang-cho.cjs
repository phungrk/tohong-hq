#!/usr/bin/env node
/* T-186 đối kháng 04 (T-185 H1/H7): mở chi tiết Beta (phản hồi trễ 2,5s), khi đang chờ bấm Alpha ở danh sách (phản hồi 150ms).
 * Thẻ Alpha hiện điểm của Alpha (100%), thẻ Beta vẫn chờ (không số, không lấy số của Alpha); khi Beta về: thẻ Beta 80%, thẻ Alpha vẫn 100% (phản hồi cũ không đè thẻ khác); danh sách giữ nguyên.
 * Chạy từ gốc tohong-hq: node eval/T-186/adv-04-doi-vendor-khi-dang-cho.cjs [--repo <tohong-front>] */
const path = require('path');
const { run, sleep } = require(path.join(__dirname, '..', 'T-185', '_lib.cjs'));
const cards = (pg) => pg.evaluate(() => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const kick = [...document.querySelectorAll('div,span,p')].filter((e) => e.children.length === 0 && /^chi tiết vendor$/i.test(norm(e.textContent)));
  return kick.map((k) => { let a = k; while (a && a !== document.body && !/Phân tích AI/i.test(a.innerText)) a = a.parentElement; const t = a ? norm(a.innerText) : '';
    const name = (/(Alpha|Beta) Hall/.exec(t) || [])[1]; const m = /Phân tích AI · (\d+)% phù hợp/i.exec(t); return { name, pct: m ? m[1] : null }; });
});
run(async (h) => {
  const { bad, setup, lists, alpha, openBeta } = h;
  const { ctx, pg } = await setup((n) => (n === 0 ? { delay: 2500 } : { delay: 150 }));
  const before = await lists(pg);
  await openBeta(pg); await sleep(500);
  await pg.getByText('Alpha Hall', { exact: false }).first().click(); await sleep(900);
  let c = await cards(pg); const A = c.find((x) => x.name === 'Alpha'), B = c.find((x) => x.name === 'Beta');
  if (!A || !B) bad('phải có hai thẻ chi tiết Alpha và Beta, đang có: ' + JSON.stringify(c));
  else { if (A.pct !== '100') bad('thẻ Alpha phải hiện 100% (điểm của Alpha), đang: ' + A.pct); if (B.pct) bad('thẻ Beta đang chờ mà đã hiện ' + B.pct + '%'); }
  await sleep(2200); c = await cards(pg); const A2 = c.find((x) => x.name === 'Alpha'), B2 = c.find((x) => x.name === 'Beta');
  if (!B2 || B2.pct !== '80') bad('Beta về phải hiện 80% ở thẻ Beta, đang: ' + (B2 && B2.pct));
  if (!A2 || A2.pct !== '100') bad('thẻ Alpha phải giữ 100% sau khi Beta về, đang: ' + (A2 && A2.pct));
  if (JSON.stringify(await lists(pg)) !== JSON.stringify(before)) bad('danh sách đã in bị đổi');
  if (alpha((await lists(pg))[0]) !== '100') bad('danh sách phải giữ Alpha 100%');
  await ctx.close();
});
