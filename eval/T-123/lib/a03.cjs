#!/usr/bin/env node
// T-123 adv-03 (adversary). Trạng thái MỜ/ĐẶC của footer onboarding luôn khớp luật spec T-122 Chốt 3 sau các chuỗi thao tác mà eval T-122 không chạm:
// đổi bước 2 -> 3a -> quay lại (x6), xoay ngang (650x390, innerHeight < 480) rồi dọc lại khi đang cuộn hết, bàn phím mở/đóng giữa chừng (390x300),
// cuộn nhanh nhiều lần trong một khung hình, cuộn mượt (smooth); đứng yên đúng biên 4px (±1px) thì không nhấp nháy;
// đóng/mở các bước nhiều lần không rò listener resize hay ResizeObserver.
// MỜ = alpha tại đỉnh footer+1 (cột lề trái+3) <= 0.6; ĐẶC = >= 0.98 (đo như check.cjs). Mong đợi MỜ khi innerHeight >= 480 và đáy nội dung > đỉnh footer - 4.
const { run, open, install, shot, alphaAt } = require('../../T-122/lib.cjs');
const REPO = process.env.TOHONG_FRONT_REPO || process.cwd();
const fails = []; const bad = m => fails.push(m);
const backFromGrid = page => page.evaluate(() => { const lab = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /^BƯỚC 3 \/ 3/.test(e.textContent.trim())); let n = lab; while (n && !n.querySelector('button')) n = n.parentElement; n.querySelector('button').click(); });
async function check(page, step, tag) {
  await install(page, step); await page.waitForTimeout(500);
  const g = await page.evaluate(() => window.__m.geo());
  await shot(page, 'n'); await page.evaluate(() => window.__m.probe(true)); await page.waitForTimeout(200); await shot(page, 'p'); await page.evaluate(() => window.__m.probe(false));
  const a = (await alphaAt(page, g.sheet.left + 3, [g.footer.top + 1], g.scroller.top - 6, 'n', 'p'))[0];
  const want = g.inner.h >= 480 && g.contentBottom > g.footer.top - 4 ? 'MỜ' : 'ĐẶC';
  const got = a <= 0.6 ? 'MỜ' : a >= 0.98 ? 'ĐẶC' : `lưng chừng(${a.toFixed(2)})`;
  if (got !== want) bad(`${tag}: footer ${got}, mong đợi ${want} (đáy nội dung ${Math.round(g.contentBottom)}, đỉnh footer ${Math.round(g.footer.top)}, innerHeight ${g.inner.h})`);
  if (g.inner.h < 480 && g.scroller.bottom > g.footer.top + 1) bad(`${tag}: innerHeight ${g.inner.h} < 480 mà footer đè vùng nội dung`);
  if (Math.abs(g.footer.bottom - g.inner.h) > 1 && g.sheet.bottom >= g.inner.h - 1) bad(`${tag}: footer không sát đáy (${Math.round(g.footer.bottom)}/${g.inner.h})`);
  return g;
}
run(REPO, async (browser, url) => {
  const { ctx, page } = await open(browser, url, 390, 650, 2);
  try {
    await page.evaluate(() => { const L = window.__L = { w: 0, ro: 0 }; const a = window.addEventListener, r = window.removeEventListener; window.addEventListener = function (t, f, o) { if (t === 'resize') L.w++; return a.call(this, t, f, o); }; window.removeEventListener = function (t, f, o) { if (t === 'resize') L.w--; return r.call(this, t, f, o); }; const RO = window.ResizeObserver; window.ResizeObserver = class extends RO { constructor(cb) { super(cb); L.ro++; this.__on = 1; } disconnect() { if (this.__on) { L.ro--; this.__on = 0; } return super.disconnect(); } }; });
    // ép một lần render để hook đăng ký lại qua hàm đã bọc
    await page.evaluate(() => window.__m && 0); await check(page, 2, 'bước 2 chưa cuộn');
    await page.evaluate(() => window.__m.scrollTo(1e5)); await check(page, 2, 'bước 2 cuộn hết');
    let L0 = null;
    for (let i = 0; i < 6; i++) {
      await page.getByRole('button', { name: /^Tiếp theo/ }).first().click(); await page.getByText(/BƯỚC 3 \/ 3/).first().waitFor();
      if (i === 0 || i === 5) await check(page, 'grid', `vòng ${i} bước 3a`);
      await backFromGrid(page); await page.getByText('BƯỚC 2 / 3').first().waitFor();
      if (i === 0) L0 = await page.evaluate(() => ({ ...window.__L }));
      if (i === 0 || i === 5) await check(page, 2, `vòng ${i} quay lại bước 2`);
    }
    const L1 = await page.evaluate(() => ({ ...window.__L }));
    if (process.env.ADV_DEBUG) console.error("L", JSON.stringify(L0), JSON.stringify(L1));
    if (L1.w !== L0.w || L1.ro !== L0.ro) bad(`rò listener sau 5 vòng 2->3a->2: resize ${L0.w}->${L1.w}, ResizeObserver ${L0.ro}->${L1.ro}`);
    await page.evaluate(() => window.__m.scrollTo(1e5)); await page.waitForTimeout(300);
    await page.setViewportSize({ width: 650, height: 390 }); await check(page, 2, 'xoay ngang 650x390');
    await page.setViewportSize({ width: 390, height: 650 }); await check(page, 2, 'xoay dọc lại 390x650');
    await page.evaluate(() => window.__m.scrollTo(20)); await page.waitForTimeout(200);
    await page.setViewportSize({ width: 390, height: 300 }); await check(page, 2, 'bàn phím mở 390x300 giữa chừng');
    await page.setViewportSize({ width: 390, height: 650 }); await check(page, 2, 'bàn phím đóng 390x650');
    await page.evaluate(() => { const sc = window.__mk().scroller; for (const y of [0, 999, 0, 999, 10, 999, 0]) sc.scrollTop = y; }); await check(page, 2, 'cuộn nhanh, dừng ở đầu');
    await page.evaluate(() => window.__mk().scroller.scrollTo({ top: 1e5, behavior: 'smooth' })); await page.waitForTimeout(900); await check(page, 2, 'cuộn mượt tới đáy');
    // biên 4px: đứng yên ở mỗi vị trí, lấy mẫu nền footer mỗi khung hình trong 300ms: chỉ được có một giá trị
    const g = await page.evaluate(() => window.__m.geo());
    const edge = g.maxScroll - (g.footer.top - 4 - g.contentBottom); // scrollTop mà đáy nội dung = đỉnh footer - 4
    for (const y of [edge - 1, edge - 0.5, edge, edge + 0.5, edge + 1]) {
      const vals = await page.evaluate(async (y) => { const x = window.__mk(); x.scroller.scrollTop = y; await new Promise(r => setTimeout(r, 300)); const seen = new Set(); const t0 = performance.now(); while (performance.now() - t0 < 300) { await new Promise(r => requestAnimationFrame(r)); const s = getComputedStyle(x.footer); seen.add(s.backgroundImage + '|' + s.backgroundColor); } return seen.size; }, y);
      if (vals > 1) bad(`biên 4px scrollTop ${y.toFixed(1)}: nền footer nhấp nháy (${vals} giá trị khi đứng yên)`);
    }
  } catch (e) { bad(e.message.split('\n')[0]); } finally { await ctx.close(); }
}).then(() => { if (fails.length) { console.log('FAIL ' + fails.join(' | ')); process.exit(1); } console.log('PASS'); process.exit(0); })
  .catch(e => { console.log('FAIL (lỗi chạy) ' + e.message); process.exit(2); });
