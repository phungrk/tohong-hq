#!/usr/bin/env node
/*
 * Eval đối kháng T-060 (adversary, Code Gate). Spec: products/T-059-safari-thanh-tren-xam.md.
 * Input mà eval tầng 1 (eval/T-059/check_tint.cjs, chỉ 390x640/844) không chạm:
 *   A  bề rộng 320x640, 768x1024, 1280x800: TC1 (4 tab, đầu + giữa trang) với cùng phép quét
 *   B  đóng chat AI và ngăn kéo bằng Back (eval tầng 1 đóng bằng nút)
 *   C  đóng giữa chừng hiệu ứng (mở rồi đóng sau 60 ms; mở-đóng-mở-đóng liên tiếp)
 *   D  lớp ngoài 4 tab: chi tiết hạng mục Ngân sách (#/ngan-sach/venue): hộp thoại "Cách hoạt động" (VendorFlowSheet dialog),
 *      sheet chi tiết vendor; sheet "Thêm mốc" ở tab Ngày cưới (Kế hoạch)
 *   E  hiệu ứng đóng chat AI: màu nền lớp tối giữ tông tối suốt quá trình (không lóe xám/đen), độ đậm không tăng lại khi đóng
 *   F  1280px: lề ngoài khung (trái, phải, trên, dưới) vẫn màu linen #F0E6D8 ở cả 4 tab (thay đổi html nền giấy không làm mất lề)
 * Chạy: cd /home/user/tohong-hq && node eval/T-060/adv-01.cjs --repo /home/user/tohong-front [--only A,B]
 */
const path = require('path');
const L = require('../T-054/lib.cjs');
const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REPO = arg('--repo') && path.resolve(arg('--repo'));
if (!REPO) { console.log('FAIL thiếu --repo'); process.exit(2); }
const ONLY = arg('--only') ? arg('--only').split(',') : null; const wants = (c) => !ONLY || ONLY.includes(c);
const { chromium } = L.loadPlaywright(REPO);
const fails = []; let crit = '';
const check = (name, ok, extra) => { console.log(`${ok ? '  ok ' : '  XX '} [${crit}] ${name}${!ok && extra ? '  :: ' + String(extra).slice(0, 500) : ''}`); if (!ok) fails.push(`[${crit}] ${name}`); };
const TABS = ['Trang chủ', 'Kế hoạch', 'Ngân sách', 'Khách mời'];
async function btn(page, name) { const loc = page.getByRole('button', { name, exact: true }); const n = await loc.count();
  for (let i = 0; i < n; i++) { const ok = await loc.nth(i).evaluate((el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return false; const t = document.elementFromPoint(cx, cy); return !!t && el.contains(t); }).catch(() => false); if (ok) return loc.nth(i); } return null; }
async function tap(p, name) { const b = await btn(p, name); if (!b) throw new Error('không thấy nút: ' + name); await b.click(); }
const settle = (page) => page.evaluate(() => new Promise((res) => { let last = -1, n = 0; const t0 = performance.now(); const g = () => { if (scrollY === last) { if (++n >= 8) return res(scrollY); } else { n = 0; last = scrollY; } if (performance.now() - t0 > 4000) return res(scrollY); requestAnimationFrame(g); }; g(); }));
const idle = async (page) => { await page.waitForFunction(() => document.getAnimations().filter((a) => a.playState === 'running').length === 0, null, { timeout: 4000 }).catch(() => {}); await page.waitForTimeout(400); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); };
async function wheel(p, dy) { const vp = p.viewportSize(); await p.mouse.move(vp.width / 2, 300); await p.mouse.wheel(0, dy); return settle(p); }
async function toTop(p) { for (let i = 0; i < 40 && (await p.evaluate(() => scrollY)) > 0; i++) await wheel(p, -400); }
async function goTab(p, name) { await tap(p, name); await p.waitForFunction((n) => [...document.querySelectorAll('button[aria-current="page"]')].some((x) => x.textContent.trim() === n), name); await settle(p); }
const fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, '../T-059/check_tint.cjs'), 'utf8');
const SCAN = eval(src.match(/const SCAN = (`[\s\S]*?`);/)[1]); const DIM = eval(src.match(/const DIM = (`[\s\S]*?`);/)[1]);
const scan = (p) => p.evaluate(SCAN); const dim = (p) => p.evaluate(DIM);
async function clean(p, label) { await idle(p); await toTop(p); const r = await scan(p); const d = await dim(p);
  check(`${label}: sau khi đóng, mép trên sạch (${r.bad.length}) và lớp tối ~0 (${d.toFixed(2)})`, r.bad.length === 0 && d < 0.05, r.bad.join(' ; ')); }
const sampleBg = (p, ms) => p.evaluate(`new Promise((res) => { const out = []; const t0 = performance.now(); const f = () => {
  const el = [...document.querySelectorAll('.ov-fixed > div')].find((d) => d.style.zIndex === '' && d.parentElement.style.zIndex === '500');
  if (el) { const cs = getComputedStyle(el); out.push({ bg: cs.backgroundColor, op: +cs.opacity, d: (${DIM}) }); }
  if (performance.now() - t0 < ${ms}) requestAnimationFrame(f); else res(out); }; f(); })`);
const parse = (s) => { if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }; const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null; };

(async () => {
  const dist = await L.buildDist(REPO); const srv = await L.serve(dist); const browser = await chromium.launch();
  try {
    if (wants('A')) { crit = 'A';
      for (const vp of [{ width: 320, height: 640 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
        const S = await L.scenario(browser, srv.base, { viewport: vp }); const p = S.page;
        for (const t of TABS) { await goTab(p, t); await toTop(p); let r = await scan(p);
          check(`${vp.width}px ${t} đầu trang: mép trên sạch (${r.bad.length})`, r.bad.length === 0, r.bad.join(' ; '));
          const y = await wheel(p, 150); r = await scan(p); check(`${vp.width}px ${t} giữa trang (scrollY ${y}): mép trên sạch (${r.bad.length})`, r.bad.length === 0, r.bad.join(' ; ')); }
        await S.ctx.close(); } }

    if (wants('B')) { crit = 'B';
      for (const [name, tab, open, isOpenBtn] of [['Chat AI', 'Ngân sách', 'AI', 'Đóng'], ['Ngăn kéo', 'Kế hoạch', 'Mở menu', 'Đóng menu']]) {
        const S = await L.scenario(browser, srv.base, {}); const p = S.page; await goTab(p, tab); await idle(p);
        await tap(p, open); await p.waitForFunction(() => true); await idle(p); const o = !!(await btn(p, isOpenBtn)); check(`${name}: mở được`, o);
        await p.goBack(); await idle(p); const c = !(await btn(p, isOpenBtn)); check(`${name}: Back đóng lớp`, c);
        await clean(p, `${name} đóng bằng Back`); await S.ctx.close(); } }

    if (wants('C')) { crit = 'C';
      const S = await L.scenario(browser, srv.base, {}); const p = S.page; await goTab(p, 'Ngân sách'); await idle(p);
      await tap(p, 'AI'); await p.waitForTimeout(60); await p.goBack(); await clean(p, 'Chat AI mở rồi đóng sau 60 ms');
      await tap(p, 'AI'); await p.waitForTimeout(60); await p.goBack(); await p.waitForTimeout(60); await tap(p, 'AI'); await p.waitForTimeout(60); await p.goBack();
      await clean(p, 'Chat AI mở-đóng-mở-đóng liên tiếp');
      await goTab(p, 'Kế hoạch'); await tap(p, 'Mở menu'); await p.waitForTimeout(60); await p.goBack(); await clean(p, 'Ngăn kéo mở rồi đóng sau 60 ms');
      await S.ctx.close(); }

    if (wants('D')) { crit = 'D';
      let S = await L.scenario(browser, srv.base, { hash: 'ngan-sach/venue' }); let p = S.page; await p.waitForTimeout(600); await idle(p);
      let r = await scan(p); check(`chi tiết hạng mục venue, không lớp mở: mép trên sạch (${r.bad.length})`, r.bad.length === 0, r.bad.join(' ; '));
      const b = p.getByRole('button', { name: 'Chi tiết', exact: true }).first();
      if (await b.count()) { await b.click(); await idle(p); const n = await p.getByRole('dialog', { name: 'Cách hoạt động' }).count(); const d = await dim(p);
        check(`"Cách hoạt động" mở, lớp tối thấy được (${d.toFixed(2)})`, n === 1 && d >= 0.3, 'dialog=' + n);
        await p.keyboard.press('Escape'); await clean(p, '"Cách hoạt động" đóng bằng Escape');
        await b.click(); await idle(p); await p.goBack(); await clean(p, '"Cách hoạt động" đóng bằng Back'); }
      else check('có nút "Chi tiết"', false);
      const v = p.getByText('Nhà hàng Hoa Sen').first();
      if (await v.count()) { await v.click(); await idle(p); const d = await dim(p); check(`sheet vendor mở, lớp tối thấy được (${d.toFixed(2)})`, d >= 0.3);
        await p.goBack(); await clean(p, 'sheet vendor đóng bằng Back'); } else check('thấy vendor đã lưu', false);
      await S.ctx.close();
      S = await L.scenario(browser, srv.base, { viewport: { width: 390, height: 844 } }); p = S.page; await goTab(p, 'Kế hoạch');
      await p.getByRole('button', { name: /^Ngày cưới/ }).first().click(); await idle(p);
      for (let i = 0; i < 30; i++) await wheel(p, 500);
      const add = p.getByRole('button', { name: 'Thêm mốc' }).first(); await add.click(); await idle(p); const d = await dim(p);
      check(`sheet "Thêm mốc" mở, lớp tối thấy được (${d.toFixed(2)})`, d >= 0.3);
      await p.goBack(); await clean(p, 'sheet "Thêm mốc" đóng bằng Back'); await S.ctx.close(); }

    if (wants('E')) { crit = 'E';
      const S = await L.scenario(browser, srv.base, {}); const p = S.page; await goTab(p, 'Ngân sách'); await idle(p);
      await tap(p, 'AI'); await idle(p); const sp = sampleBg(p, 450); await tap(p, 'Đóng'); const xs = await sp;
      const shifted = xs.filter((x) => { const c = parse(x.bg); return c && c.a > 0.02 && (Math.abs(c.r - 43) > 3 || Math.abs(c.g - 36) > 3 || Math.abs(c.b - 32) > 3); });
      check(`đóng chat AI: màu lớp tối giữ tông (43,36,32) suốt hiệu ứng (${xs.length} mẫu)`, xs.length > 3 && shifted.length === 0, shifted.slice(0, 3).map((x) => x.bg).join(' | '));
      let up = 0; for (let i = 1; i < xs.length; i++) if (xs[i].d > xs[i - 1].d + 0.01) up++;
      check('đóng chat AI: độ đậm không tăng lại (không lóe tối)', up === 0, xs.map((x) => x.d.toFixed(2)).join(','));
      const last = xs[xs.length - 1]; check(`đóng chat AI: cuối hiệu ứng nền trong suốt hẳn (${last && last.bg})`, last && parse(last.bg).a === 0);
      await S.ctx.close(); }

    if (wants('F')) { crit = 'F';
      // Màu thấy được tại một điểm: đi từ elementFromPoint lên tổ tiên tới nền đục đầu tiên; tới <html> thì là nền canvas (html).
      const PAINT = `((x, y) => { let e = document.elementFromPoint(x, y); for (; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const m = c.match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/);
        if (m && (m[4] === undefined || +m[4] > 0.9)) return e.tagName.toLowerCase() + ' ' + c; } return 'canvas'; })`;
      const S = await L.scenario(browser, srv.base, { viewport: { width: 1280, height: 800 } }); const p = S.page;
      const pts = [[8, 4], [8, 795], [1271, 4], [1271, 795]];
      for (const t of TABS) { await goTab(p, t); await toTop(p); await idle(p);
        for (const pos of ['đầu trang', 'cuối trang']) { if (pos === 'cuối trang') await wheel(p, 4000);
          const got = await p.evaluate(`(${JSON.stringify(pts)}).map(([x, y]) => (${PAINT})(x, y))`);
          const bad = got.filter((g) => !/rgb\(240, 230, 216\)/.test(g));
          check(`1280px ${t} ${pos}: lề ngoài khung 4 góc là linen`, bad.length === 0, got.join(' | ')); } }
      // trang ngắn: Khách mời không có khách
      const S2 = await L.scenario(browser, srv.base, { viewport: { width: 1280, height: 1400 }, emptyGuests: true, hash: 'khach-moi' }); const q = S2.page; await idle(q);
      const got = await q.evaluate(`([[8, 1390], [1271, 1390]]).map(([x, y]) => (${PAINT})(x, y))`);
      check('1280x1400 trang ngắn: lề dưới ngoài khung là linen', got.every((g) => /rgb\(240, 230, 216\)/.test(g)), got.join(' | '));
      await S2.ctx.close(); await S.ctx.close(); }
  } catch (e) { console.log('  XX [lỗi chạy] ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); fails.push(`[${crit}] lỗi chạy: ${String(e.message || e).split('\n')[0]}`);
  } finally { await browser.close().catch(() => {}); await srv.close().catch(() => {}); }
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1})` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
