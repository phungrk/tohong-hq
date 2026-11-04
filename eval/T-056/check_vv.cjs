#!/usr/bin/env node
/*
 * Eval tầng 1 của T-056: thanh tab của app nằm trọn trong vùng nhìn thấy (visualViewport) khi trình duyệt có thanh công cụ dưới
 * che một phần cửa sổ (Chrome iOS). Spec: products/T-056-chrome-ios-thanh-tab.md. --only N = tiêu chí N:
 *   1 thanh Chrome 83px: thanh tab sát đáy vùng nhìn thấy ở đầu/giữa/cuối trang, cả 4 tab
 *   2 thanh Chrome đổi chiều cao khi đang xem (83 -> 30 -> 0 -> 83): thanh tab đi theo; khi 0 thì như T-055 (sát đáy cửa sổ)
 *   3 đang zoom (scale != 1): không bù
 *   4 thanh Chrome 83px: khối gợi ý cài nằm trên thanh tab và trong vùng nhìn thấy; chữ cuối trang không bị che
 *   6 ?vvdebug=1 hiện dòng số đo; không có cờ thì không hiện
 * Tiêu chí 5 (Safari/T-054 không đổi): bash eval/T-054/run.sh <front>. Tiêu chí 7 (iPhone thật): eval/T-056/checklist-iphone.md.
 *
 * Cách giả lập: Chromium headless không có thanh Chrome iOS. Eval thay window.visualViewport bằng một đối tượng giả
 * (height, offsetTop, scale, sự kiện resize/scroll) do eval điều khiển; innerHeight giữ nguyên. Đây là đúng tình huống
 * "cửa sổ bố cục cao hơn vùng nhìn thấy". Không đọc mã nguồn, không nhắc tên biến CSS hay hook.
 *
 * Chạy: cd /home/user/tohong-hq && node eval/T-056/check_vv.cjs --repo /home/user/tohong-front [--only 1,2]
 * Dòng cuối PASS hoặc FAIL <lý do đầu>; mã thoát 0/1 (2 = không chạy được).
 */
const path = require('path');
const L = require('../T-054/lib.cjs');
const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REPO = arg('--repo') && path.resolve(arg('--repo'));
if (!REPO || !require('fs').existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo trỏ tới tohong-front'); process.exit(2); }
const ONLY = arg('--only') ? arg('--only').split(',').map(Number) : null;
const wants = (c) => !ONLY || ONLY.includes(c);
const { chromium } = L.loadPlaywright(REPO);
const fails = []; let crit = 0;
const check = (name, ok, extra) => {
  console.log(`${ok ? '  ok ' : '  XX '} [TC${crit}] ${name}${!ok && extra ? '  :: ' + String(extra).replace(/\s+/g, ' ').slice(0, 500) : ''}`);
  if (!ok) fails.push(`[TC${crit}] ${name}${extra ? ' [' + String(extra).replace(/\s+/g, ' ').slice(0, 140) + ']' : ''}`);
};
const near = (a, b, t = 1.5) => Math.abs(a - b) <= t;
const TABS = ['Trang chủ', 'Kế hoạch', 'Ngân sách', 'Khách mời'];
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1';
const VP = { width: 390, height: 640 };

// visualViewport giả, cài trước khi app chạy (addInitScript + tải lại).
const STUB = `(() => { const t = new EventTarget(); const st = { h: null, top: 0, scale: 1 };
  const o = { get height() { return st.h === null ? window.innerHeight : st.h; }, get width() { return window.innerWidth; }, get offsetTop() { return st.top; }, get offsetLeft() { return 0; },
    get pageTop() { return window.scrollY + st.top; }, get pageLeft() { return 0; }, get scale() { return st.scale; },
    addEventListener: (...a) => t.addEventListener(...a), removeEventListener: (...a) => t.removeEventListener(...a), dispatchEvent: (e) => t.dispatchEvent(e) };
  Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => o });
  window.__setVV = (h, top = 0, scale = 1) => { st.h = h; st.top = top; st.scale = scale; t.dispatchEvent(new Event('resize')); t.dispatchEvent(new Event('scroll')); }; })();`;

async function btn(page, name) {
  const loc = page.getByRole('button', { name, exact: true }); const n = await loc.count();
  for (let i = 0; i < n; i++) { const ok = await loc.nth(i).evaluate((el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return false; const t = document.elementFromPoint(cx, cy); return !!t && el.contains(t); }).catch(() => false); if (ok) return loc.nth(i); }
  return null;
}
const settle = (page, fr = 8) => page.evaluate((f) => new Promise((res) => { let last = -1, n = 0; const t0 = performance.now(); const g = () => { if (scrollY === last) { if (++n >= f) return res(scrollY); } else { n = 0; last = scrollY; } if (performance.now() - t0 > 4000) return res(scrollY); requestAnimationFrame(g); }; g(); }), fr);
const sy = (p) => p.evaluate(() => Math.round(scrollY));
const maxScroll = (p) => p.evaluate(() => Math.max(0, document.scrollingElement.scrollHeight - innerHeight));
async function wheel(p, dy) { await p.mouse.move(VP.width / 2, 300); await p.mouse.wheel(0, dy); return settle(p); }
async function toTop(p) { for (let i = 0; i < 40 && (await sy(p)) > 0; i++) await wheel(p, -400); }
async function toEnd(p) { let last = -1; for (let i = 0; i < 60; i++) { const y = await wheel(p, 500); if (y === last) break; last = y; } }
async function goTab(p, name) { const b = await btn(p, name); if (!b) throw new Error('không chạm được tab ' + name); await b.click(); await p.waitForFunction((n) => [...document.querySelectorAll('button[aria-current="page"]')].some((x) => x.textContent.trim() === n), name); await settle(p); }
// Thanh tab = hộp bao của 4 nút tab đang thấy; trả thêm vùng nhìn thấy (theo visualViewport giả) và innerHeight.
const bar = (p) => p.evaluate((names) => { const bs = names.map((n) => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === n).map((b) => b.getBoundingClientRect()).filter((r) => r.width > 2 && r.left >= 0 && r.left < innerWidth).sort((a, b) => b.top - a.top)[0]);
  if (bs.some((x) => !x)) return null; const vv = window.visualViewport; return { top: Math.min(...bs.map((r) => r.top)), bottom: Math.max(...bs.map((r) => r.bottom)), ih: innerHeight, vvBottom: vv.offsetTop + vv.height, vvTop: vv.offsetTop }; }, TABS);
const waitBar = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 3000 }).then(() => true, () => false);
const setVV = (p, h, top = 0, scale = 1) => p.evaluate(([a, b, c]) => window.__setVV(a, b, c), [h, top, scale]);
// Chờ thanh tab đạt đáy mong muốn (cho phép cài đặt cập nhật bằng sự kiện hoặc khung hình kế tiếp), rồi đọc.
async function barAt(p, want) { await waitBar(p, (w) => { const bs = [...document.querySelectorAll('button')].filter((b) => ['Trang chủ', 'Kế hoạch', 'Ngân sách', 'Khách mời'].includes(b.textContent.trim())).map((b) => b.getBoundingClientRect()).filter((r) => r.width > 2 && r.left >= 0 && r.left < innerWidth); return bs.length >= 4 && Math.abs(Math.max(...bs.map((r) => r.bottom)) - w) <= 1.5; }, want); return bar(p); }
async function open(browser, base, o = {}) {
  const S = await L.scenario(browser, base, { viewport: VP, ua: o.ua, touch: !!o.touch });
  await S.page.addInitScript(STUB); await S.page.goto(base + (o.query || '') + '#/' + (o.hash || 'trang-chu')); await S.page.reload();
  await S.page.getByRole('button', { name: 'Khách mời', exact: true }).first().waitFor(); await settle(S.page); return S;
}
const coveredBottom = (p, barTop, vvBottom) => p.evaluate(([bt, vb]) => { const shown = (e) => { for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) < 0.05 || a.hasAttribute('inert') || a.getAttribute('aria-hidden') === 'true') return false; } return true; }; const out = [];
  for (const e of document.querySelectorAll('body *')) { if (e.children.length || !(e.textContent || '').trim()) continue; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || !shown(e)) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (cx < 0 || cx > innerWidth || cy < bt || cy > vb) continue; const t = document.elementFromPoint(cx, cy); if (t && !(e === t || e.contains(t) || t.contains(e))) out.push(`"${e.textContent.trim().slice(0, 24)}" bị che bởi ${t.tagName.toLowerCase()}`); } return out; }, [barTop, vvBottom]);

(async () => {
  const dist = await L.buildDist(REPO); const srv = await L.serve(dist); const browser = await chromium.launch(); const CHROME_BAR = 83;
  try {
    if (wants(1)) { crit = 1;
      const S = await open(browser, srv.base, { ua: IOS_UA }); const p = S.page; await setVV(p, VP.height - CHROME_BAR);
      for (const name of TABS) { await goTab(p, name); await toTop(p);
        for (const where of ['đầu', 'giữa', 'cuối']) {
          if (where === 'giữa') await wheel(p, Math.max(60, Math.floor((await maxScroll(p)) / 2))); if (where === 'cuối') await toEnd(p);
          const b = await barAt(p, VP.height - CHROME_BAR);
          check(`${name}, ${where} trang: thanh Chrome 83px, thanh tab sát đáy vùng nhìn thấy (đáy nút ${b && b.bottom}, vùng nhìn thấy ${b && b.vvBottom}, cửa sổ ${b && b.ih})`, !!b && near(b.bottom, b.vvBottom) && b.top > b.vvTop, b && JSON.stringify(b)); } }
      await S.ctx.close(); }
    if (wants(2)) { crit = 2;
      const S = await open(browser, srv.base, { ua: IOS_UA }); const p = S.page; await goTab(p, 'Kế hoạch'); await toEnd(p);
      for (const [label, h] of [['không có thanh Chrome (như T-055)', VP.height], ['Chrome hiện thanh 83px', VP.height - 83], ['Chrome thu thanh còn 30px', VP.height - 30], ['Chrome thu hẳn', VP.height], ['Chrome hiện lại 83px', VP.height - 83]]) {
        await setVV(p, h); const b = await barAt(p, h); check(`${label}: thanh tab sát đáy vùng nhìn thấy (đáy nút ${b && b.bottom}, cần ${h})`, !!b && near(b.bottom, h), b && JSON.stringify(b)); }
      await setVV(p, VP.height - 83, 12); const b2 = await barAt(p, VP.height - 83 + 12); check(`offsetTop 12px (vùng nhìn thấy lệch xuống): đáy thanh tab bằng offsetTop + height = ${VP.height - 83 + 12} (đo ${b2 && b2.bottom}); không vượt đáy cửa sổ`, !!b2 && near(b2.bottom, Math.min(VP.height, VP.height - 83 + 12)), b2 && JSON.stringify(b2));
      await S.ctx.close(); }
    if (wants(3)) { crit = 3;
      const S = await open(browser, srv.base); const p = S.page; await goTab(p, 'Ngân sách'); await toEnd(p);
      await setVV(p, 320, 0, 2); await p.waitForTimeout(300); const b = await bar(p);
      check(`Đang zoom (scale 2, vùng nhìn thấy cao 320): thanh tab vẫn sát đáy cửa sổ, không bù (đáy nút ${b && b.bottom}, cửa sổ ${b && b.ih})`, !!b && near(b.bottom, b.ih), b && JSON.stringify(b));
      await setVV(p, VP.height - 83, 0, 1); const b1 = await barAt(p, VP.height - 83); check('Hết zoom: thanh tab lại sát đáy vùng nhìn thấy', !!b1 && near(b1.bottom, VP.height - 83), b1 && JSON.stringify(b1));
      await S.ctx.close(); }
    if (wants(4)) { crit = 4;
      const S = await open(browser, srv.base, { ua: IOS_UA }); const p = S.page; await setVV(p, VP.height - CHROME_BAR); await goTab(p, 'Kế hoạch'); await toTop(p);
      const hint = await p.evaluate(() => { const e = [...document.querySelectorAll('body *')].find((x) => !x.children.length && (x.textContent || '').trim() === 'Thêm Tơ Hồng vào màn hình chính'); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
      const b = await barAt(p, VP.height - CHROME_BAR);
      check(`Ở đầu trang (khối gợi ý đang hiện): thanh tab trọn trong vùng nhìn thấy, khối gợi ý thấy được, nằm trên thanh tab (đáy ${hint && hint.bottom}, đỉnh thanh tab ${b && b.top}) và trong vùng nhìn thấy`, !!hint && !!b && b.bottom <= b.vvBottom + 1.5 && hint.bottom <= b.top + 1 && hint.top >= 0 && hint.bottom <= b.vvBottom, JSON.stringify({ hint, b }));
      for (const name of ['Kế hoạch', 'Khách mời']) { await goTab(p, name); await toEnd(p); const bb = await barAt(p, VP.height - CHROME_BAR); const cov = await coveredBottom(p, bb.top, bb.vvBottom);
        check(`${name}, cuối trang: thanh tab trọn trong vùng nhìn thấy (đáy ${bb.bottom} / ${bb.vvBottom}) và không chữ nào nằm giữa đỉnh thanh tab và đáy vùng nhìn thấy bị che`, bb.bottom <= bb.vvBottom + 1.5 && cov.length === 0, cov.slice(0, 2).join('; ')); }
      await S.ctx.close(); }
    if (wants(6)) { crit = 6;
      const S = await open(browser, srv.base, { query: '?vvdebug=1' }); const p = S.page; await setVV(p, VP.height - 83, 5);
      const ok = await p.waitForFunction(() => /innerHeight\s*=\s*640/.test(document.body.innerText) && /vv\.height\s*=\s*557/.test(document.body.innerText) && /vv\.offsetTop\s*=\s*5/.test(document.body.innerText), null, { timeout: 3000 }).then(() => true, () => false);
      check('Có ?vvdebug=1: màn hình hiện chữ "innerHeight=640", "vv.height=557", "vv.offsetTop=5" (đổi theo sự kiện)', ok, await p.evaluate(() => document.body.innerText.slice(0, 200)));
      await S.ctx.close();
      const S2 = await open(browser, srv.base); await setVV(S2.page, VP.height - 83);
      check('Không có cờ: không hiện dòng số đo nào', !(await S2.page.evaluate(() => /innerHeight\s*=|vv\.height\s*=/.test(document.body.innerText)))); await S2.ctx.close(); }
  } catch (e) { console.log('  XX [lỗi chạy] ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); fails.push(`[TC${crit}] lỗi chạy: ${String(e.message || e).split('\n')[0].slice(0, 160)}`);
  } finally { await browser.close().catch(() => {}); await srv.close().catch(() => {}); }
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
