#!/usr/bin/env node
// Bất biến rút từ T-122 v2 (Chốt 6, qua Spec Gate 2026-11-11, spec-critic; defect T-122-D1).
// Footer Onboarding (bước 2/3 và bước 3a chọn ảnh): mọi điểm của footer từ mép trên của chữ/nút đầu tiên trong footer trở xuống
// (gồm dòng gợi ý, lề hai bên nút, khe giữa hai nút, đệm đáy; toàn bề ngang sheet, lưới 12x4px) KHÔNG BAO GIỜ trả về phần tử của vùng nội dung cuộn,
// ở mọi vị trí cuộn (đầu, giữa, cuối); hai nút của footer nhận chạm tại tâm của chính chúng.
// Lý do: chạm vào chỗ trông đặc mà đổi lựa chọn nằm khuất phía sau (gu ảnh, số khách) là đổi dữ liệu người dùng mà họ không biết.
// Không ràng buộc dải phía trên chữ/nút đầu tiên của footer (dải mờ được phép cho chạm xuyên theo T-122).
// Dùng: node inv_cham.cjs --repo <tohong-front>   In PASS / FAIL <lý do>; thoát 0/1; 2 = không chạy được.
const fs = require('fs'), path = require('path');
const { run, open, install } = require('./lib.cjs');
const a = process.argv.slice(2), arg = n => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : null; };
const REPO = arg('--repo') || process.env.TOHONG_FRONT_REPO || process.cwd();
if (!fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo trỏ tới tohong-front'); process.exit(2); }
const CASES = [[2, 390, 650], [2, 375, 632], [2, 390, 664], [2, 393, 662], [2, 375, 667], [2, 320, 568], [2, 430, 932], [2, 390, 300], ['grid', 390, 650], ['grid', 320, 568], ['grid', 375, 667]];
const fails = [];
(async () => {
  await run(REPO, async (browser, url) => {
    for (const [step, W, H] of CASES) {
      const vp = `${step === 2 ? 'bước 2' : 'bước 3a'} ${W}x${H}`;
      const { ctx, page } = await open(browser, url, W, H, step); await install(page, step);
      const max = await page.evaluate(() => window.__m.geo().maxScroll);
      for (const y of [0, Math.round(max / 2), 1e5]) {
        await page.evaluate(y => window.__m.scrollTo(y), y); await page.waitForTimeout(500);
        const r = await page.evaluate(() => {
          const x = window.__mk(); const f = x.footer.getBoundingClientRect(), s = x.sheet.getBoundingClientRect();
          let top = 1e9; for (const e of x.footer.querySelectorAll('*')) { const b = e.getBoundingClientRect(); if (b.width === 0 || b.height === 0) continue; const own = e.tagName === 'BUTTON' || (e.children.length === 0 && e.textContent.trim() !== ''); if (own) top = Math.min(top, b.top); }
          const hits = [];
          for (let Y = Math.ceil(top); Y < f.bottom - 1; Y += 4) for (let X = s.left + 2; X <= s.right - 2; X += 12) { const t = document.elementFromPoint(X, Y); if (t && x.scroller.contains(t) && !x.footer.contains(t)) hits.push([Math.round(X), Math.round(Y)]); }
          const cover = []; for (const k of ['prim', 'sec']) { const b = x[k].getBoundingClientRect(); const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); if (!(t && (t === x[k] || x[k].contains(t)))) cover.push(k); }
          return { hits, cover, top: Math.round(top), bottom: Math.round(f.bottom) };
        });
        const pos = y === 0 ? 'đầu' : y === 1e5 ? 'cuối' : 'giữa';
        if (r.hits.length) fails.push(`${vp} cuộn ${pos}: ${r.hits.length} điểm của footer (y ${r.top}..${r.bottom}) chạm xuyên xuống vùng nội dung, vd ${JSON.stringify(r.hits.slice(0, 3))}`);
        if (r.cover.length) fails.push(`${vp} cuộn ${pos}: nút ${r.cover.join(', ')} của footer bị phủ tại tâm`);
      }
      await ctx.close();
    }
  });
  if (fails.length) { console.log('FAIL ' + fails.join(' | ')); process.exit(1); }
  console.log('PASS'); process.exit(0);
})().catch(e => { console.log('FAIL (lỗi chạy) ' + (e.stack || e.message)); process.exit(2); });
