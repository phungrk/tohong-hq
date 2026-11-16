#!/usr/bin/env node
/* T-186 đối kháng 07 (T-185 H1/H2, quy ước T-061 §2): chi tiết trễ 1,5s. Trước mốc ~150ms (phần giữ chỗ ẩn bằng visibility): trong khối Phân tích AI không có phần tử focus được,
 * không aria-busy / role=status, cây trợ năng của khối chỉ đọc chữ tĩnh (tiêu đề + ba nhãn), không đọc gì của khung câu/skeleton ẩn. Sau mốc: vẫn không focus được gì trong khối.
 * Chạy từ gốc tohong-hq: node eval/T-186/adv-07-truoc-moc-khong-focus-aria.cjs [--repo <tohong-front>] */
const path = require('path');
const { run, sleep } = require(path.join(__dirname, '..', 'T-185', '_lib.cjs'));
const PROBE = () => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const cands = [...document.querySelectorAll('div,span,p')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && /^\s*phân tích ai/i.test(n.nodeValue || '')));
  const title = cands[cands.length - 1]; if (!title) return null;
  let b = title.parentElement; while (b && b !== document.body && !['Ngân sách', 'Phong cách', 'Lịch trống'].every((n) => norm(b.innerText).includes(n))) b = b.parentElement;
  if (!b || b === document.body) return null;
  b.setAttribute('data-adv07', '1');
  const foc = [...b.querySelectorAll('*')].filter((e) => e.tabIndex >= 0 || /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(e.tagName)).length;
  const busy = !!(b.closest('[aria-busy="true"]') || b.querySelector('[aria-busy="true"]') || b.querySelector('[role="status"]'));
  return { foc, busy, skelVisible: [...b.querySelectorAll('.db-skel')].some((e) => getComputedStyle(e).visibility !== 'hidden') };
};
run(async (h) => {
  const { bad, setup, openBeta } = h;
  const { ctx, pg } = await setup({ delay: 1500 });
  await openBeta(pg);
  let p = null; for (let i = 0; i < 40 && !p; i++) { p = await pg.evaluate(PROBE); if (!p) await sleep(5); }
  if (!p) { bad('không thấy khối'); await ctx.close(); return; }
  if (p.skelVisible) bad('tiền đề: mẫu đầu đã qua mốc (skeleton đã hiện), không đo được trước mốc');
  else {
    if (p.busy) bad('trước mốc đã có aria-busy / role=status');
    if (p.foc) bad(`trước mốc có ${p.foc} phần tử focus được trong khối`);
    const snapA = await pg.locator('[data-adv07="1"]').ariaSnapshot().catch(() => null);
    if (snapA !== null) { const t = snapA.replace(/phân tích ai|ngân sách|phong cách|lịch trống/gi, '').replace(/[-:\s"']|text|generic|paragraph/gi, ''); if (t) bad('trước mốc cây trợ năng của khối đọc thêm: ' + snapA.replace(/\s+/g, ' ')); }
  }
  await sleep(500); const q = await pg.evaluate(PROBE);
  if (!q || !q.skelVisible) bad('sau mốc phải có skeleton'); else if (q.foc) bad(`sau mốc có ${q.foc} phần tử focus được trong khối`);
  await ctx.close();
});
