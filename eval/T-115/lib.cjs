// T-115: đo bước 2/3 của Onboarding (Kế hoạch đám cưới) bằng Playwright + vite dev qua helper chung. Không đọc class/style/mã nguồn.
const path = require('path'), { createRequire } = require('module');
const { startViteDev } = require('../_lib/vite_dev.cjs');
function loadPlaywright(REPO) {
  for (const t of [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean)) { try { return createRequire(path.join(REPO, 'x.js'))(t); } catch { /* tiếp */ } }
  console.log('FAIL không tìm thấy playwright'); process.exit(2);
}
// Đo ở viewport WxH (isMobile trừ khi desktop). scrollEnd=true: cuộn vùng nội dung tới cuối trước khi đo.
async function measure(browser, base, W, H, { desktop = false, scrollEnd = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: !desktop, hasTouch: !desktop });
  try {
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    await page.route('**/*', r => { const u = r.request().url(); return (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) ? r.continue() : r.abort(); });
    await page.goto(base);
    await page.getByRole('button', { name: /^Bắt đầu/ }).click(); await page.waitForTimeout(500);
    for (const i of await page.locator('input[type=text], input:not([type])').all()) { if (await i.isVisible()) await i.fill('An'); }
    await page.getByRole('button', { name: /^Tiếp theo/ }).first().click();
    await page.getByText('BƯỚC 2 / 3').first().waitFor(); await page.waitForTimeout(700);
    return await page.evaluate((scrollEnd) => {
      const R = e => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), h: Math.round(r.height) }; };
      const btn = [...document.querySelectorAll('button')].find(b => /^Tiếp theo/.test(b.textContent.trim()));
      const footer = btn.parentElement, scroller = footer.previousElementSibling, sheet = footer.parentElement;
      if (scrollEnd) scroller.scrollTop = scroller.scrollHeight;
      const lab = [...scroller.querySelectorAll('*')].find(e => e.children.length === 0 && /^Số khách/.test(e.textContent.trim()));
      let s = lab; while (s.parentElement !== scroller) s = s.parentElement;
      const pill = s.querySelector('button');
      const last = scroller.lastElementChild;
      return { innerW: innerWidth, innerH: innerHeight, docScrollW: document.documentElement.scrollWidth, scrollTop: Math.round(scroller.scrollTop),
        scrollH: scroller.scrollHeight, clientH: scroller.clientHeight, sheet: R(sheet), scroller: R(scroller), label: R(lab), pill: R(pill), last: R(last), footer: R(footer), btn: R(btn) };
    }, scrollEnd);
  } finally { await ctx.close(); }
}
async function run(REPO, fn) {
  const dev = await startViteDev({ repo: REPO, files: {} }).catch(e => { console.log('FAIL không dựng được vite: ' + e.message); process.exit(2); });
  const browser = await loadPlaywright(REPO).chromium.launch();
  try { return await fn(browser, dev.url); } finally { await browser.close(); await dev.stop(); }
}
// 3 viewport điện thoại (vùng nhìn thấy = cửa sổ) và 3 viewport "Safari có thanh công cụ dưới": thấp hơn TOOLBAR px (GIẢ ĐỊNH ~90px, tự tin 60%).
const PHONES = [[375, 667], [390, 844], [430, 932]];
const TOOLBAR = 90;
const PHONES_TB = PHONES.map(([w, h]) => [w, h - TOOLBAR]);
module.exports = { measure, run, PHONES, PHONES_TB, TOOLBAR };
