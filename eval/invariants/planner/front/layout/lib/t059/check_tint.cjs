#!/usr/bin/env node
// Bản chụp cố định của eval/T-059/check_tint.cjs cho layout inv-011 (nguồn T-059, qua Spec Gate 2026-11-04). Không sửa cho khớp code.
/*
 * Eval tầng 1 của T-059 (Chromium). Spec: products/T-059-safari-thanh-tren-xam.md. --only N = tiêu chí N:
 *   1 không lớp nào mở, 4 tab, đầu và giữa trang: mọi phần tử fixed/sticky (và mọi phần tử nằm trong cây con của chúng) có hộp chạm y=0 có nền trong suốt hoặc màu giấy (rgb 252,248,243, mọi độ trong)
 *   2 mở rồi đóng từng lớp (chat AI, ngăn kéo, sheet Mời, sheet Thêm việc), rồi quét lại như TC1 ở đầu và giữa trang
 *   3 khi lớp đang mở vẫn có lớp tối thấy được (độ đậm hiệu dụng >= 0.3); mở và đóng đều có giá trị trung gian (hiệu ứng mờ dần còn: chỉ chat AI và ngăn kéo, vì sheet Mời/Thêm việc vốn không mờ dần trên main 67a33aa)
 * Tiêu chí 4 (nav.js không đổi): run.sh --only 4. Tiêu chí 5-7: chạy lại T-054, T-056, bất biến (run.sh).
 *
 * Đo bằng getComputedStyle (màu nền), KHÔNG xét opacity của phần tử: Safari tô theo màu nền, không theo opacity (giả thuyết, xem spec).
 * Phần tử display:none hoặc visibility:hidden không tính (không có hộp / không vẽ).
 * Chạy: cd /home/user/tohong-hq && node eval/T-059/check_tint.cjs --repo /home/user/tohong-front [--only 1,2]
 * Dòng cuối PASS hoặc FAIL <lý do đầu>; mã thoát 0/1 (2 = không chạy được).
 */
const path = require('path');
const L = require('./lib.cjs');
const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REPO = arg('--repo') && path.resolve(arg('--repo'));
if (!REPO || !require('fs').existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo trỏ tới tohong-front'); process.exit(2); }
const ONLY = arg('--only') ? arg('--only').split(',').map(Number) : null;
const wants = (c) => !ONLY || ONLY.includes(c);
const { chromium } = L.loadPlaywright(REPO);
const fails = []; let crit = 0;
const check = (name, ok, extra) => {
  console.log(`${ok ? '  ok ' : '  XX '} [TC${crit}] ${name}${!ok && extra ? '  :: ' + String(extra).replace(/\s+/g, ' ').slice(0, 600) : ''}`);
  if (!ok) fails.push(`[TC${crit}] ${name}${extra ? ' [' + String(extra).replace(/\s+/g, ' ').slice(0, 160) + ']' : ''}`);
};
const VP = { width: 390, height: 640 };
const TABS = ['Trang chủ', 'Kế hoạch', 'Ngân sách', 'Khách mời'];

async function btn(page, name) {
  const loc = page.getByRole('button', { name, exact: true }); const n = await loc.count();
  for (let i = 0; i < n; i++) { const ok = await loc.nth(i).evaluate((el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return false; const t = document.elementFromPoint(cx, cy); return !!t && el.contains(t); }).catch(() => false); if (ok) return loc.nth(i); }
  return null;
}
async function tap(p, name) { const b = await btn(p, name); if (!b) throw new Error('không thấy nút chạm được: ' + name); await b.click(); }
const settle = (page, fr = 8) => page.evaluate((f) => new Promise((res) => { let last = -1, n = 0; const t0 = performance.now(); const g = () => { if (scrollY === last) { if (++n >= f) return res(scrollY); } else { n = 0; last = scrollY; } if (performance.now() - t0 > 4000) return res(scrollY); requestAnimationFrame(g); }; g(); }), fr);
const idle = async (page) => { await page.waitForFunction(() => document.getAnimations().filter((a) => a.playState === 'running').length === 0, null, { timeout: 4000 }).catch(() => {}); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); };
const sy = (p) => p.evaluate(() => Math.round(scrollY));
async function wheel(p, dy) { await p.mouse.move(VP.width / 2, 300); await p.mouse.wheel(0, dy); return settle(p); }
async function toTop(p) { for (let i = 0; i < 40 && (await sy(p)) > 0; i++) await wheel(p, -400); }
const maxScroll = (p) => p.evaluate(() => Math.max(0, document.scrollingElement.scrollHeight - innerHeight));
async function toMid(p) { await toTop(p); return wheel(p, 150); }
// Trang ngắn hơn vùng nhìn thấy (maxScroll 0): giữa trang trùng đầu trang, vẫn quét.
const midOk = async (p, y) => y > 20 || (await maxScroll(p)) === 0;
async function goTab(p, name) { await tap(p, name); await p.waitForFunction((n) => [...document.querySelectorAll('button[aria-current="page"]')].some((x) => x.textContent.trim() === n), name); await settle(p); }

// Quét: mọi phần tử fixed/sticky hoặc nằm trong cây con của phần tử fixed/sticky, có hộp chạm y=0, mà nền không trong suốt và không phải màu giấy.
const SCAN = `(() => {
  const PAPER = [252, 248, 243];
  const parse = (s) => { s = (s || '').trim(); if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    const m = s.match(/^rgba?\\(\\s*([\\d.]+)[ ,]+([\\d.]+)[ ,]+([\\d.]+)(?:[ ,/]+([\\d.]+%?))?\\s*\\)$/); if (!m) return null;
    let a = m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])); return { r: +m[1], g: +m[2], b: +m[3], a }; };
  const bad = []; let fixedCount = 0;
  for (const e of document.querySelectorAll('body, body *')) {
    let inFixed = false; for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const pos = getComputedStyle(a).position; if (pos === 'fixed' || pos === 'sticky') { inFixed = true; break; } }
    if (!inFixed) continue; fixedCount++;
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') continue;
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    if (!(r.top <= 0.5 && r.bottom >= 1 && r.right > 0 && r.left < innerWidth)) continue;
    const c = parse(cs.backgroundColor); const okColor = c && (c.a === 0 || (c.r === PAPER[0] && c.g === PAPER[1] && c.b === PAPER[2]));
    const okImg = cs.backgroundImage === 'none';
    if (!okColor || !okImg) bad.push(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).join('.') : '') + ' bg=' + cs.backgroundColor + (okImg ? '' : ' img=' + cs.backgroundImage.slice(0, 40)) + ' opacity=' + cs.opacity + ' top=' + Math.round(r.top) + ' h=' + Math.round(r.height));
  }
  return { bad, fixedCount };
})()`;
const scan = (p) => p.evaluate(SCAN);

// Độ đậm hiệu dụng của lớp tối: max trên các phần tử tối (r+g+b<300) phủ >= 80% vùng nhìn thấy, trong cây fixed, của alpha nền x tích opacity tổ tiên.
const DIM = `(() => { let best = 0;
  for (const e of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const m = cs.backgroundColor.match(/^rgba?\\(\\s*([\\d.]+)[ ,]+([\\d.]+)[ ,]+([\\d.]+)(?:[ ,/]+([\\d.]+))?\\s*\\)$/); if (!m) continue;
    const a = m[4] === undefined ? 1 : parseFloat(m[4]); if (+m[1] + +m[2] + +m[3] >= 300 || a === 0) continue;
    const r = e.getBoundingClientRect(); const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)), h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    if (w * h < 0.8 * Math.min(innerWidth, 768) * innerHeight) continue;
    let op = 1, fx = false; for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const c = getComputedStyle(x); op *= parseFloat(c.opacity); if (c.position === 'fixed') fx = true; }
    if (!fx) continue; best = Math.max(best, a * op);
  } return best; })()`;
const dim = (p) => p.evaluate(DIM);
// Lấy mẫu độ đậm mỗi khung hình trong ms mili giây.
const sampleDim = (p, ms) => p.evaluate(`new Promise((res) => { const out = []; const t0 = performance.now(); const f = () => { out.push((${DIM})); if (performance.now() - t0 < ${ms}) requestAnimationFrame(f); else res(out); }; f(); })`);

const LAYERS = [
  { fade: true, name: 'Chat AI', tab: 'Ngân sách', open: (p) => tap(p, 'AI'), isOpen: (p) => btn(p, 'Đóng').then((b) => !!b), close: (p) => tap(p, 'Đóng') },
  { fade: true, name: 'Ngăn kéo menu', tab: 'Kế hoạch', open: (p) => tap(p, 'Mở menu'), isOpen: (p) => btn(p, 'Đóng menu').then((b) => !!b), close: (p) => tap(p, 'Đóng menu') },
  { name: 'Sheet "Mời người ấy"', tab: 'Trang chủ', open: (p) => tap(p, 'Mời người ấy / gia đình cùng xem'), isOpen: (p) => p.getByRole('dialog', { name: 'Mời người ấy hoặc gia đình cùng xem' }).isVisible(), close: (p) => p.goBack() },
  { name: 'Sheet "Thêm việc"', tab: 'Kế hoạch', vp: { width: 390, height: 844 }, prep: async (p) => { let last = -1; for (let i = 0; i < 60; i++) { const y = await wheel(p, 500); if (y === last) break; last = y; } },
    open: (p) => tap(p, 'Thêm việc'), close: (p) => p.goBack(),
    isOpen: (p) => p.evaluate(`(() => { const i = document.querySelector('input[placeholder="VD: Chốt số bàn với nhà hàng"]'); if (!i) return false; const r = i.getBoundingClientRect();
      for (let a = i; a && a !== document.documentElement; a = a.parentElement) { if (parseFloat(getComputedStyle(a).opacity) < 0.05) return false; } return r.width > 20 && r.top >= 0 && r.bottom <= innerHeight; })()`) },
];
const waitState = async (p, fn, want) => { for (let i = 0; i < 60; i++) { if ((await fn(p)) === want) return true; await p.waitForTimeout(50); } return false; };

(async () => {
  const dist = await L.buildDist(REPO); const srv = await L.serve(dist); const browser = await chromium.launch();
  try {
    if (wants(1)) { crit = 1;
      const S = await L.scenario(browser, srv.base, { viewport: VP }); const p = S.page; let total = 0;
      for (const t of TABS) { await goTab(p, t);
        await toTop(p); let r = await scan(p); total += r.fixedCount; check(`${t}, đầu trang, không lớp nào mở: không phần tử fixed/sticky chạm mép trên có nền màu lạ (${r.bad.length})`, r.bad.length === 0, r.bad.join(' ; '));
        const y = await toMid(p); r = await scan(p); check(`${t}, giữa trang (scrollY ${y}), không lớp nào mở: như trên (${r.bad.length})`, (await midOk(p, y)) && r.bad.length === 0, r.bad.join(' ; ') || 'không cuộn được tới giữa trang'); }
      check('Phép quét có thấy phần tử fixed/sticky (không quét rỗng)', total > 0, 'fixedCount=0');
      await S.ctx.close(); }

    if (wants(2)) { crit = 2;
      for (const lay of LAYERS) { const S = await L.scenario(browser, srv.base, { viewport: lay.vp || VP }); const p = S.page;
        await goTab(p, lay.tab); await toTop(p); if (lay.prep) await lay.prep(p);
        await lay.open(p); const o = await waitState(p, lay.isOpen, true); check(`${lay.name}: mở được`, o); if (!o) { await S.ctx.close(); continue; }
        await idle(p); await lay.close(p); const c = await waitState(p, lay.isOpen, false); check(`${lay.name}: đóng được`, c); await idle(p);
        await toTop(p); let r = await scan(p); check(`${lay.name}, sau khi đóng, đầu trang: không phần tử fixed/sticky chạm mép trên có nền màu lạ (${r.bad.length})`, r.bad.length === 0, r.bad.join(' ; '));
        const y = await toMid(p); r = await scan(p); check(`${lay.name}, sau khi đóng, giữa trang (scrollY ${y}): như trên (${r.bad.length})`, (await midOk(p, y)) && r.bad.length === 0, r.bad.join(' ; ') || 'không cuộn được tới giữa trang');
        await S.ctx.close(); }
      // mở-đóng cả bốn lớp liên tiếp ở từng tab còn lại, rồi quét một lần
      const S = await L.scenario(browser, srv.base, { viewport: VP }); const p = S.page;
      for (const t of ['Trang chủ', 'Khách mời']) { await goTab(p, t); await tap(p, 'Mở menu'); await waitState(p, (q) => btn(q, 'Đóng menu').then((b) => !!b), true); await idle(p); await tap(p, 'Đóng menu'); await waitState(p, (q) => btn(q, 'Đóng menu').then((b) => !!b), false); await idle(p);
        await toTop(p); let r = await scan(p); check(`${t}: mở rồi đóng ngăn kéo, đầu trang: không nền màu lạ (${r.bad.length})`, r.bad.length === 0, r.bad.join(' ; '));
        const y = await toMid(p); r = await scan(p); check(`${t}: mở rồi đóng ngăn kéo, giữa trang (scrollY ${y}): không nền màu lạ (${r.bad.length})`, (await midOk(p, y)) && r.bad.length === 0, r.bad.join(' ; ') || 'không cuộn được'); }
      await S.ctx.close(); }

    if (wants(3)) { crit = 3;
      for (const lay of LAYERS) { const S = await L.scenario(browser, srv.base, { viewport: lay.vp || VP }); const p = S.page;
        await goTab(p, lay.tab); await toTop(p); if (lay.prep) await lay.prep(p); await idle(p);
        const d0 = await dim(p); check(`${lay.name}: trước khi mở, lớp tối hiệu dụng ~0 (${d0.toFixed(2)})`, d0 < 0.05, d0);
        const sp = sampleDim(p, 420); await lay.open(p); const so = await sp; const o = await waitState(p, lay.isOpen, true); await idle(p);
        const dOpen = await dim(p); check(`${lay.name}: đang mở, lớp tối thấy được (hiệu dụng ${dOpen.toFixed(2)} >= 0.3)`, o && dOpen >= 0.3, `mở=${o}`);
        const mid = so.filter((v) => v > 0.03 && v < dOpen - 0.03).length; if (lay.fade) check(`${lay.name}: hiệu ứng mở còn mờ dần (có ${mid} mẫu trung gian)`, mid >= 1, 'đổi đậm tức thì: ' + so.map((v) => v.toFixed(2)).join(','));
        const sc = sampleDim(p, 420); await lay.close(p); const sx = await sc; await waitState(p, lay.isOpen, false); await idle(p);
        const mid2 = sx.filter((v) => v > 0.03 && v < dOpen - 0.03).length; if (lay.fade) check(`${lay.name}: hiệu ứng đóng còn mờ dần (có ${mid2} mẫu trung gian)`, mid2 >= 1, 'đổi đậm tức thì: ' + sx.map((v) => v.toFixed(2)).join(','));
        const d1 = await dim(p); check(`${lay.name}: đóng xong, lớp tối hiệu dụng ~0 (${d1.toFixed(2)})`, d1 < 0.05, d1);
        await S.ctx.close(); }
    }
  } catch (e) { console.log('  XX [lỗi chạy] ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); fails.push(`[TC${crit}] lỗi chạy: ${String(e.message || e).split('\n')[0].slice(0, 140)}`);
  } finally { await browser.close().catch(() => {}); await srv.close().catch(() => {}); }
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
