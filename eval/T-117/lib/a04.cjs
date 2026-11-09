#!/usr/bin/env node
// T-117 adv-04 (adversary). Bàn phím ảo + lớp con trong sheet ở điện thoại.
// (a) Bước 1 (bước có ô nhập tên; bước 2 không có ô nhập chữ): 390x664 và 360x640, focus ô tên đầu rồi thu viewport còn 300px cao
//     (mô phỏng bàn phím Android thu layout viewport; Chromium không có bàn phím thật), cuộn ô vào tầm nhìn như trình duyệt làm:
//     ô tên đang nhập nằm trọn trong vùng nhìn thấy và không bị footer/nút che.
// (b) Bước 2: mở lịch "Ngày cưới dự kiến" ở 320x568, 360x640, 390x664: nút Chọn và Huỷ của lịch trong vùng nhìn thấy, không bị che.
const { open, goStep, probe, main } = require('./adv.cjs');
main(async (browser, url, bad) => {
  for (const [w, h] of [[390, 664], [360, 640]]) {
    const { ctx, page } = await open(browser, url, w, h); const k = `${w}x${h} bàn phím bước 1`;
    try {
      await goStep(page, 1);
      await page.evaluate(() => { const i = [...document.querySelectorAll('input')].find(e => { const o = e.closest('.ov-fixed'); return o && /BƯỚC 1 \/ 3/.test(o.textContent); }); if (i) i.setAttribute('data-adv117', '1'); });
      const inp = page.locator('[data-adv117]'); await inp.scrollIntoViewIfNeeded(); await inp.click(); await inp.type('Lan');
      await page.setViewportSize({ width: w, height: 300 }); await page.waitForTimeout(400);
      await inp.evaluate(e => e.scrollIntoView({ block: 'nearest' })); await page.waitForTimeout(200);
      const r = await inp.evaluate(e => { const b = e.getBoundingClientRect(), t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { top: Math.round(b.top), bottom: Math.round(b.bottom), ih: innerHeight, covered: !(t && (t === e || e.contains(t))), focused: document.activeElement === e }; });
      if (!r.focused) bad(`${k}: mất focus ô tên khi bàn phím mở`);
      if (r.top < 0 || r.bottom > r.ih || r.covered) bad(`${k}: ô tên ngoài vùng nhìn thấy hoặc bị che (${r.top}..${r.bottom}/${r.ih}, che=${r.covered})`);
    } catch (e) { bad(`${k}: ${e.message.split('\n')[0]}`); } finally { await ctx.close(); }
  }
  for (const [w, h] of [[320, 568], [360, 640], [390, 664]]) {
    const { ctx, page } = await open(browser, url, w, h); const k = `${w}x${h} lịch bước 2`;
    try {
      await goStep(page, 2);
      await page.getByRole('button', { name: /dd\/mm\/yyyy|\d{2}\/\d{2}\/\d{4}/ }).first().click(); await page.waitForTimeout(400);
      for (const re of [/^Chọn$/, /^Huỷ$/]) {
        const p = await probe(page, re);
        if (!p) { bad(`${k}: không thấy nút ${re}`); continue; }
        if (!p.inView || p.covered) bad(`${k}: nút ${re} của lịch ngoài vùng nhìn thấy hoặc bị che (${p.top}..${p.bottom}/${p.vh})`);
      }
    } catch (e) { bad(`${k}: ${e.message.split('\n')[0]}`); } finally { await ctx.close(); }
  }
});
