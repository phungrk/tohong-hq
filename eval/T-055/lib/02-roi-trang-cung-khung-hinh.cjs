// adv-02 (T-055, adversary). Spec T-054 mục 4.1: "Khi rời trang X, vị trí scrollY LÚC RỜI được nhớ cho địa chỉ X."
// Input phá: vị trí cuộn đổi rồi rời trang trong cùng một tác vụ / trước khi trình duyệt kịp phát sự kiện scroll
// (lăn hay vuốt quán tính rồi chạm tab / Back ngay trong khung hình đó). Mong đợi: quay lại X thì về đúng vị trí lúc rời (sai số 2px).
// Trên PR #59 (385cea6) vị trí nhớ là vị trí của sự kiện scroll gần nhất, nên mất phần cuộn của khung hình cuối.
const A = require('./common.cjs');
A.run(async ({ mk }) => {
  const S = await mk({ viewport: { width: 390, height: 640 } }); const p = S.page;
  await A.goTab(p, 'Kế hoạch'); await A.jump(p, 120); await A.settle(p);
  await p.evaluate(() => { window.scrollTo({ top: 400, behavior: 'instant' }); [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Khách mời' && b.getBoundingClientRect().width > 2).click(); });
  await p.waitForFunction(() => location.hash === '#/khach-moi'); await A.settle(p);
  const back = await A.goTab(p, 'Kế hoạch');
  A.check(`Kế hoạch: cuộn tới 400 rồi chạm tab "Khách mời" cùng khung hình, chạm lại "Kế hoạch" về ${back} (mong 400)`, Math.abs(back - 400) <= 2);
  await A.goTab(p, 'Khách mời'); await A.jump(p, 50); await A.settle(p);
  await p.evaluate(() => { window.scrollTo({ top: 600, behavior: 'instant' }); history.back(); });
  await p.waitForFunction(() => location.hash === '#/ke-hoach'); await A.settle(p);
  await p.goForward(); await p.waitForFunction(() => location.hash === '#/khach-moi'); const f = await A.settle(p);
  A.check(`Khách mời: cuộn tới 600 rồi Back cùng khung hình, Forward về ${f} (mong 600)`, Math.abs(f - 600) <= 2);
  await S.ctx.close();
});
