#!/usr/bin/env node
/* T-186 đối kháng 06 (T-185 H2: "Trước mốc ... khối chỉ có chữ tĩnh của H1 (tiêu đề + ba nhãn), không vẽ khối nào"):
 * phản hồi chi tiết 1,2s. Ở các mẫu trước khi skeleton hiện (trước mốc ~150ms), trong khối Phân tích AI không có phần tử nhìn thấy nào (khác chính khối) có nền màu hoặc viền
 * (vd khung câu AI nền --card + ảnh đại diện); chỉ chữ tĩnh. Đồng thời phản hồi 40ms không có câu AI (H3(i), hàng không có câu mẫu): sau khi điểm về không có khung câu,
 * nên trước đó cũng không được có khung câu nào vẽ ra (không nháy khung).
 * Chạy từ gốc tohong-hq: node eval/T-186/adv-06-truoc-moc-khong-ve-khoi.cjs [--repo <tohong-front>] */
const path = require('path');
const { run, sleep } = require(path.join(__dirname, '..', 'T-185', '_lib.cjs'));
const BOXES = `(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const cands = [...document.querySelectorAll('div,span,p,h3,h4')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && /^\\s*phân tích ai/i.test(n.nodeValue || '')));
  const title = cands[cands.length - 1]; if (!title) return null;
  let block = null; for (let a = title.parentElement; a && a !== document.body; a = a.parentElement) { const t = norm(a.innerText); if (['Ngân sách','Phong cách','Lịch trống'].every((n) => t.includes(n)) || /Chưa (cập nhật|có điểm)/.test(t) || /phù hợp/.test(t)) { block = a; break; } }
  if (!block) return null;
  const tr = (c) => /rgba\\(.*, 0\\)|transparent/.test(c);
  const boxes = [...block.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || cs.display === 'none') return false;
    return !tr(cs.backgroundColor) || (parseFloat(cs.borderTopWidth) > 0 && !tr(cs.borderTopColor)) || e.tagName.toLowerCase() === 'svg'; }).length;
  return { boxes, busy: !!block.closest('[aria-busy="true"]') || !!block.querySelector('[aria-busy="true"]'), text: norm(block.innerText) };
})()`;
run(async (h) => {
  const { bad, setup, openBeta } = h;
  for (const [d, why, tag] of [[1200, undefined, 'A'], [40, null, 'B']]) {
    const { ctx, pg } = await setup({ delay: d, why });
    await pg.evaluate((src) => { window.__b = []; const f = new Function('return ' + src); window.__bw = setInterval(() => { const s = f(); if (s) window.__b.push(s); }, 8); }, BOXES);
    await openBeta(pg); await sleep(d === 40 ? 1200 : 400);
    const S = await pg.evaluate(() => { clearInterval(window.__bw); return window.__b; });
    const pre = S.filter((x) => !x.busy && !/phù hợp/i.test(x.text));
    if (!pre.length) { if (tag === 'A') bad(`(${tag}) không lấy được mẫu nào trước mốc`); }
    else if (pre.some((x) => x.boxes > 0)) bad(`(${tag}) trước mốc ~150ms (chưa skeleton, chưa điểm) khối đã vẽ ${Math.max(...pre.map((x) => x.boxes))} phần tử có nền/viền (khung câu AI / ảnh đại diện); H2 chỉ cho chữ tĩnh`);
    await ctx.close();
  }
});
