// T-115: đo bước 2/3 của Onboarding (Kế hoạch đám cưới) bằng Playwright + vite dev qua helper chung (files: {}, không ghi file vào repo).
// Mọi phần tử được tìm theo HÀNH VI/NHÃN, không theo cấu trúc DOM: vùng nội dung = tổ tiên cuộn dọc được gần nhất của tiêu đề "Số khách";
// footer = tổ tiên chung nhỏ nhất của hai nút "Tiếp theo" và "Quay lại bước 1"; sheet = tổ tiên chung nhỏ nhất của chữ "BƯỚC 2 / 3" và nút "Tiếp theo".
// "Bị che" kiểm bằng elementFromPoint tại tâm phần tử.
const path = require('path'), { createRequire } = require('module');
const { startViteDev } = require('../_lib/vite_dev.cjs');
function loadPlaywright(REPO) {
  for (const t of [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean)) { try { return createRequire(path.join(REPO, 'x.js'))(t); } catch { /* tiếp */ } }
  console.log('FAIL không tìm thấy playwright'); process.exit(2);
}
// variant: 'plain' | 'fade' (thêm dấu hiệu "còn nội dung" giữa vùng nội dung và footer) | 'wrapped' (bọc hai nút trong div) — chỉ để tự kiểm phép đo.
async function measure(browser, base, W, H, { desktop = false, scrollEnd = false, variant = 'plain' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: !desktop, hasTouch: !desktop });
  try {
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    await page.route('**/*', r => { const u = r.request().url(); return (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) ? r.continue() : r.abort(); });
    await page.goto(base);
    await page.getByRole('button', { name: /^Bắt đầu/ }).click(); await page.waitForTimeout(500);
    for (const i of await page.locator('input[type=text], input:not([type])').all()) { if (await i.isVisible()) await i.fill('An'); }
    await page.getByRole('button', { name: /^Tiếp theo/ }).first().click();
    await page.getByText('BƯỚC 2 / 3').first().waitFor(); await page.waitForTimeout(700);
    return await page.evaluate(({ scrollEnd, variant }) => {
      const R = e => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), h: Math.round(r.height) }; };
      const txt = e => e.textContent.trim();
      const btns = [...document.querySelectorAll('button')];
      const next = btns.find(b => /^Tiếp theo/.test(txt(b))), back = btns.find(b => /^Quay lại bước 1/.test(txt(b)));
      const common = (a, b) => { for (let n = a.parentElement; n; n = n.parentElement) if (n.contains(b)) return n; return null; };
      if (variant === 'wrapped') for (const b of [next, back]) { const w = document.createElement('div'); b.replaceWith(w); w.appendChild(b); }
      const footer = common(next, back);
      if (variant === 'fade') { const d = document.createElement('div'); d.style.cssText = 'position:relative;height:0;flex:none'; d.innerHTML = '<div style="position:absolute;left:0;right:0;bottom:0;height:24px;pointer-events:none;background:linear-gradient(transparent,#fff)"></div>'; footer.parentElement.insertBefore(d, footer); }
      const leaves = [...document.querySelectorAll('*')].filter(e => e.children.length === 0);
      const lab = leaves.find(e => /^Số khách/.test(txt(e)));
      const step = leaves.find(e => /^BƯỚC 2 \/ 3/.test(txt(e)));
      let scroller = null; for (let n = lab.parentElement; n; n = n.parentElement) { const o = getComputedStyle(n).overflowY; if ((o === 'auto' || o === 'scroll') && n.scrollHeight > 0) { scroller = n; break; } }
      const sheet = common(step, next);
      if (scrollEnd) scroller.scrollTop = scroller.scrollHeight;
      const after = [...scroller.querySelectorAll('button')].filter(b => lab.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      const pill = after[0], lastBtn = after[after.length - 1];
      const covered = e => { const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) return true; const t = document.elementFromPoint(x, y); return !(t && (e === t || e.contains(t))); };
      return { innerW: innerWidth, innerH: innerHeight, docScrollW: document.documentElement.scrollWidth, scrollTop: Math.round(scroller.scrollTop),
        scrollH: scroller.scrollHeight, clientH: scroller.clientHeight, sheet: R(sheet), scroller: R(scroller), label: R(lab), pill: R(pill), last: R(lastBtn), footer: R(footer), btn: R(next), back: R(back),
        pillCovered: covered(pill), lastCovered: covered(lastBtn), nextCovered: covered(next), labelCovered: covered(lab) };
    }, { scrollEnd, variant });
  } finally { await ctx.close(); }
}
async function run(REPO, fn) {
  const dev = await startViteDev({ repo: REPO, files: {} }).catch(e => { console.log('FAIL không dựng được vite: ' + e.message); process.exit(2); });
  const browser = await loadPlaywright(REPO).chromium.launch();
  try { return await fn(browser, dev.url); } finally { await browser.close(); await dev.stop(); }
}
// 390x664: viewport tái hiện ảnh Capu (Safari iPhone, thanh địa chỉ dưới mở rộng; innerHeight ~664, GIẢ ĐỊNH tự tin ~65%, xem spec).
const PHONES = [[375, 667], [390, 664], [430, 932]];
const LOW = [[320, 568], [375, 548]];
module.exports = { measure, run, PHONES, LOW };
