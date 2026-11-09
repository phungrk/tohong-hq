// T-117 adversary: dụng cụ đo chung cho eval đối kháng adv-*.cjs (KHÔNG phải eval; gate chỉ chạy file adv-*).
// Dựng vite dev qua eval/T-115/lib.cjs (startViteDev với files: {}, không ghi file vào repo), chặn mạng ngoài.
// Phần tử tìm theo nhãn/hành vi; "bị che" = elementFromPoint tại tâm không trả về chính nó (như T-115).
const { run } = require('../../T-115/lib.cjs');
const REPO = process.env.TOHONG_FRONT_REPO || process.cwd();
async function open(browser, base, W, H, { desktop = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: !desktop, hasTouch: !desktop });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  await page.route('**/*', r => { const u = r.request().url(); return (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) ? r.continue() : r.abort(); });
  await page.goto(base);
  await page.getByRole('button', { name: /^Bắt đầu/ }).waitFor(); await page.waitForTimeout(500);
  return { ctx, page };
}
// Đi tới bước: 0 = chào, 1, 2, 'grid', 'result'.
async function goStep(page, step) {
  if (step === 0) return;
  await page.getByRole('button', { name: /^Bắt đầu/ }).click(); await page.getByText('BƯỚC 1 / 3').first().waitFor();
  if (step === 1) return page.waitForTimeout(500);
  for (const i of await page.locator('input[type=text], input:not([type])').all()) { if (await i.isVisible()) await i.fill('An'); }
  await page.getByRole('button', { name: /^Tiếp theo/ }).first().click(); await page.getByText('BƯỚC 2 / 3').first().waitFor();
  if (step === 2) return page.waitForTimeout(700);
  await page.getByRole('button', { name: /^Tiếp theo/ }).first().click(); await page.getByText(/BƯỚC 3 \/ 3/).first().waitFor();
  if (step === 'grid') return page.waitForTimeout(700);
  // chọn 4 ảnh: các nút trong vùng cuộn của lưới
  for (let k = 0; k < 4; k++) await page.evaluate((k) => { const t = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /^Không cần gọi tên phong cách/.test(e.textContent.trim())); let s = t; while (s && !(['auto', 'scroll'].includes(getComputedStyle(s).overflowY) && s.querySelectorAll('button').length >= 4)) s = s.parentElement; s.querySelectorAll('button')[k].click(); }, k);
  await page.getByRole('button', { name: /^Xem Gu của tôi/ }).click(); await page.getByRole('button', { name: /Vào Tơ Hồng/ }).waitFor();
  return page.waitForTimeout(700);
}
// Đo một nút theo nhãn: hộp, có bị che không, có nằm trọn trong vùng nhìn thấy không.
async function probe(page, re) {
  return page.evaluate((src) => {
    const re = new RegExp(src), b = [...document.querySelectorAll('button')].find(x => re.test(x.textContent.trim()) && x.getBoundingClientRect().height > 0);
    if (!b) return null;
    const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const vv = window.visualViewport, vh = vv ? vv.height : innerHeight;
    const inView = r.top >= 0 && r.bottom <= vh + 0.5 && r.left >= 0 && r.right <= innerWidth + 0.5;
    const t = (y >= 0 && y <= innerHeight) ? document.elementFromPoint(x, y) : null;
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), inView, covered: !(t && (t === b || b.contains(t))), vh: Math.round(vh), docScrollW: document.documentElement.scrollWidth, innerW: innerWidth };
  }, re.source);
}
function main(body) {
  const fails = []; const bad = m => fails.push(m);
  (async () => { await run(REPO, (browser, url) => body(browser, url, bad));
    if (fails.length) { console.log('FAIL ' + fails.join(' | ')); process.exit(1); }
    console.log('PASS'); process.exit(0);
  })().catch(e => { console.log('FAIL (lỗi chạy) ' + e.message); process.exit(2); });
}
module.exports = { open, goStep, probe, main, REPO };
