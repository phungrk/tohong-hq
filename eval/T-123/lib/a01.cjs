#!/usr/bin/env node
// T-123 adv-01 (adversary). Phần tử đang được focus trong vùng nội dung onboarding không bị footer che sau khi trình duyệt cuộn nó vào tầm nhìn.
// (a) Bước 1, bàn phím ảo để lại 480..545px (Android máy dài: 412x839->520, 390x844->500, 390x664->480; trên ngưỡng "màn rất thấp" 480 của spec T-122 hành vi 7):
//     focus ô tên CUỐI (chú rể), gõ chữ, thu viewport như adv-04 T-117, cuộn ô vào tầm nhìn như trình duyệt làm (scrollIntoView nearest):
//     ô đang nhập không bị footer/nút che (elementFromPoint tại tâm trả về chính ô).
// (b) Bước 2 ở 390x650, 375x632, 393x662 (chưa cuộn): focus() từng nút của mục Số khách (trình duyệt tự cuộn tới): tâm nút không bị footer che.
// Trước PR (footer nằm ngoài vùng cuộn) cả hai đều xanh; footer đè lên vùng cuộn mà vùng cuộn không chừa chỗ khi cuộn-vào-tầm-nhìn thì đỏ.
const { open, goStep, main } = require('../../T-117/lib/adv.cjs');
const cover = (page, sel) => page.locator(sel).evaluate(e => { const b = e.getBoundingClientRect(), t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { top: Math.round(b.top), bottom: Math.round(b.bottom), ih: innerHeight, covered: !(t && (t === e || e.contains(t))), by: t ? (t.textContent || '').trim().slice(0, 24) : '', focused: document.activeElement === e }; });
main(async (browser, url, bad) => {
  for (const [w, h, kb] of [[412, 839, 520], [390, 844, 500], [390, 664, 480]]) {
    const { ctx, page } = await open(browser, url, w, h); const k = `${w}x${h}->${w}x${kb} bàn phím bước 1`;
    try {
      await goStep(page, 1);
      await page.evaluate(() => { const ins = [...document.querySelectorAll('.ov-fixed input')].filter(e => e.getBoundingClientRect().height > 0); ins[ins.length - 1].setAttribute('data-adv123', '1'); });
      const inp = page.locator('[data-adv123]'); await inp.scrollIntoViewIfNeeded(); await inp.click(); await inp.type('Lan');
      await page.setViewportSize({ width: w, height: kb }); await page.waitForTimeout(400);
      await inp.evaluate(e => e.scrollIntoView({ block: 'nearest' })); await page.waitForTimeout(300);
      const r = await cover(page, '[data-adv123]');
      if (!r.focused) bad(`${k}: mất focus ô tên`);
      if (r.top < 0 || r.bottom > r.ih || r.covered) bad(`${k}: ô tên đang nhập bị che hoặc ngoài vùng nhìn (${r.top}..${r.bottom}/${r.ih}, che bởi "${r.by}")`);
    } catch (e) { bad(`${k}: ${e.message.split('\n')[0]}`); } finally { await ctx.close(); }
  }
  for (const [w, h] of [[390, 650], [375, 632], [393, 662]]) {
    const { ctx, page } = await open(browser, url, w, h); const k = `${w}x${h} bước 2 focus Số khách`;
    try {
      await goStep(page, 2);
      const n = await page.evaluate(() => { const lab = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /^Số khách/i.test(e.textContent.trim())); let s = lab; while (s && s.querySelectorAll('button').length < 3) s = s.parentElement; const bs = [...s.querySelectorAll('button')]; bs.forEach((b, i) => b.setAttribute('data-adv123g', String(i))); return bs.length; });
      if (!n) { bad(`${k}: không thấy nút Số khách`); continue; }
      for (let i = 0; i < n; i++) {
        await page.locator(`[data-adv123g="${i}"]`).evaluate(e => e.focus()); await page.waitForTimeout(150);
        const r = await cover(page, `[data-adv123g="${i}"]`);
        if (r.covered || r.bottom > r.ih) { const t = await page.locator(`[data-adv123g="${i}"]`).textContent(); bad(`${k}: nút "${t.trim()}" đang focus bị che (${r.top}..${r.bottom}, che bởi "${r.by}")`); }
      }
    } catch (e) { bad(`${k}: ${e.message.split('\n')[0]}`); } finally { await ctx.close(); }
  }
});
