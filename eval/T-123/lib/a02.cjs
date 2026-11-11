#!/usr/bin/env node
// T-123 adv-02 (adversary). Spec T-122 Chốt 6: "mọi điểm của footer có alpha >= 0.95 ... KHÔNG BAO GIỜ cho chạm xuyên xuống nội dung".
// Eval 1/3/5 của T-122 quét hàng cách 4px (đỉnh+1, +5, +9, +13...) nên bỏ sót hàng giữa. Ở đây quét TỪNG HÀNG 1px từ đỉnh footer tới đỉnh nút chính + 2:
// alpha của hàng = nhỏ nhất trên ba cột (lề trái+3, giữa, lề phải-3), đo như check.cjs (ảnh ẩn nội dung, tô tím / không tô).
// Hàng nào alpha >= 0.95 thì mọi điểm (cách 12px ngang, toàn bề ngang sheet) phải trả phần tử thuộc footer, không thuộc vùng nội dung.
// Bước 2 ở 375x632, 390x650, 393x662, 390x664 và bước 3a ở 390x650, 320x568; trạng thái chưa cuộn (MỜ) và cuộn hết (ĐẶC).
const { run, open, install, shot, alphaAt } = require('../../T-122/lib.cjs');
const REPO = process.env.TOHONG_FRONT_REPO || process.cwd();
const fails = []; const bad = m => fails.push(m);
run(REPO, async (browser, url) => {
  for (const [W, H, step] of [[375, 632, 2], [390, 650, 2], [393, 662, 2], [390, 664, 2], [390, 650, 'grid'], [320, 568, 'grid']]) {
    const { ctx, page } = await open(browser, url, W, H, step);
    try {
      await install(page, step);
      for (const [tag, y] of [['chưa cuộn', 0], ['cuộn hết', 1e5]]) {
        await page.evaluate(y => window.__m.scrollTo(y), y); await page.waitForTimeout(500);
        const g = await page.evaluate(() => window.__m.geo());
        await page.evaluate(() => window.__m.hide(true)); await page.waitForTimeout(250); await shot(page, 'h');
        await page.evaluate(() => window.__m.probe(true)); await page.waitForTimeout(250); await shot(page, 'q');
        await page.evaluate(() => window.__m.probe(false)); await page.evaluate(() => window.__m.hide(false)); await page.waitForTimeout(250);
        const cols = [g.sheet.left + 3, (g.sheet.left + g.sheet.right) / 2, g.sheet.right - 3], paperY = g.scroller.top - 6;
        const ys = []; for (let yy = Math.ceil(g.footer.top); yy <= g.prim.top + 2; yy++) ys.push(yy);
        const prof = await Promise.all(cols.map(cx => alphaAt(page, cx, ys, paperY)));
        const solid = ys.filter((_, i) => Math.min(...prof.map(p => p[i])) >= 0.95);
        const hits = solid.length ? await page.evaluate(([ys, a, b]) => window.__m.scan(ys, a, b), [solid, g.sheet.left, g.sheet.right]) : [];
        if (hits.length) { const rows = [...new Set(hits.map(h => h[1] - Math.round(g.footer.top)))]; bad(`${W}x${H} bước ${step} ${tag}: ${hits.length} điểm ở hàng đặc (alpha >= 0.95) chạm xuyên xuống nội dung, hàng đỉnh footer +${rows.join(',+')}px (vd ${JSON.stringify(hits[0])})`); }
      }
    } catch (e) { bad(`${W}x${H} bước ${step}: ${e.message.split('\n')[0]}`); } finally { await ctx.close(); }
  }
}).then(() => { if (fails.length) { console.log('FAIL ' + fails.join(' | ')); process.exit(1); } console.log('PASS'); process.exit(0); })
  .catch(e => { console.log('FAIL (lỗi chạy) ' + e.message); process.exit(2); });
