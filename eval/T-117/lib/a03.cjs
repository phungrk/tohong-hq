#!/usr/bin/env node
// T-117 adv-03 (adversary). Đổi đỉnh sheet là đổi chung cho MỌI bước (sheet dùng chung); spec T-115 "Không đổi bước 0, 1, 3a, 3b".
// Kiểm các bước đó không hỏng ở điện thoại 320x568, 360x640, 390x664: dải kéo / đầu sheet nằm trong vùng nhìn thấy (đỉnh >= 0);
// nút hành động chính của bước (Bắt đầu; Tiếp theo; Xem Gu của tôi + Bỏ qua; Vào Tơ Hồng) sau khi cuộn tới nằm trọn trong vùng nhìn thấy, không bị che; không cuộn ngang.
const { open, goStep, probe, main } = require('./adv.cjs');
const STEPS = [[0, [/^Bắt đầu/]], [1, [/^Tiếp theo/]], ['grid', [/^Xem Gu của tôi/, /^Bỏ qua/]], ['result', [/Vào Tơ Hồng/, /Chọn lại ảnh/]]];
main(async (browser, url, bad) => {
  for (const [w, h] of [[320, 568], [360, 640], [390, 664]]) for (const [step, btns] of STEPS) {
    const { ctx, page } = await open(browser, url, w, h); const k = `${w}x${h} bước ${step}`;
    try {
      await goStep(page, step);
      const sheetTop = await page.evaluate((src) => { const re = new RegExp(src), b = [...document.querySelectorAll('button')].find(x => re.test(x.textContent.trim()) && x.getBoundingClientRect().height > 0);
        let n = b; while (n && !(n.parentElement && n.parentElement.classList.contains('ov-fixed'))) n = n.parentElement; return n ? Math.round(n.getBoundingClientRect().top) : null; }, btns[0].source);
      if (sheetTop === null || sheetTop < 0) bad(`${k}: đỉnh sheet ${sheetTop} ngoài vùng nhìn thấy`);
      for (const re of btns) {
        await page.getByRole('button', { name: re }).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
        const p = await probe(page, re);
        if (!p) { bad(`${k}: không thấy nút ${re}`); continue; }
        if (!p.inView || p.covered) bad(`${k}: nút ${re} ngoài vùng nhìn thấy hoặc bị che (${p.top}..${p.bottom}/${p.vh}, che=${p.covered})`);
        if (p.docScrollW > p.innerW) bad(`${k}: cuộn ngang`);
      }
    } catch (e) { bad(`${k}: ${e.message.split('\n')[0]}`); } finally { await ctx.close(); }
  }
});
