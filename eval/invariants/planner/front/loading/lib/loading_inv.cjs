#!/usr/bin/env node
/*
 * Helper cho các bất biến của vùng planner/front/loading. Nguồn: T-061, spec products/T-061-skeleton-dang-tai.md v3, qua Spec Gate 2026-11-04 (spec-critic).
 * Harness là bản chụp cố định của eval/T-061/lib.cjs và eval/T-054/lib.cjs, đặt trong lib/t061 và lib/t054: API giả, build bằng vite trong nhóm tiến trình, dọn dist khi xong.
 * Phép đo chỉ dựa trên chữ, vai trò, màu và hình học nhìn thấy. Không dùng bộ chọn class/style, không đọc mã nguồn.
 *   --only 1  Trạng thái chờ không nói dối: ở 4 tab, khi /api/me (300ms) và dữ liệu (1,5s) chưa trả lời, không có chữ rỗng giả, chữ chờ trơn hay nút "Thêm …" nhìn thấy.
 *             "Nhìn thấy" nghĩa là rộng và cao > 8px, không bị display/visibility ẩn, và độ mờ hiệu dụng (tích opacity của mọi tổ tiên) >= 0,05.
 *   --only 2  Vùng chờ có nhãn và không focus được: lúc chờ có ít nhất một [aria-busy="true"] nhìn thấy. Mỗi vùng như vậy chứa role=status tên "Đang tải",
 *             không chứa phần tử focus được (vì vậy không phủ header hay thanh tab), và Tab 14 lần không đưa focus vào vùng. Tải xong thì không còn aria-busy="true".
 *   --only 3  Vùng chờ tôn trọng reduced-motion: khi prefers-reduced-motion: reduce, không animation nào đang chạy trong [aria-busy="true"], và vẫn có khối tô màu nhìn thấy.
 * Chạy: node lib/loading_inv.cjs --repo <tohong-front> --only N. Dòng cuối là PASS hoặc FAIL <lý do>. Mã thoát: 0 đạt, 1 không đạt, 2 không chạy được.
 */
const path = require('path'), fs = require('fs');
const L = require('./t061/lib.cjs');
const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REPO = arg('--repo') && path.resolve(arg('--repo'));
const ONLY = Number(arg('--only'));
if (!REPO || !fs.existsSync(path.join(REPO, 'package.json')) || ![1, 2, 3].includes(ONLY)) { console.log('FAIL cần --repo <tohong-front> và --only 1|2|3'); process.exit(2); }

const TABS = [
  { id: 'trang-chu', at: /ngày nữa/, fake: [/Chọn ngày/] },
  { id: 'ke-hoach', at: /việc trong giai đoạn/, fake: [/^Thêm việc$/, /0\/0 việc/] },
  { id: 'ngan-sach', at: /Đã phân bổ/i, fake: [/Chưa có hạng mục/, /^Thêm hạng mục$/, /Chưa đặt mục tiêu/, /Chưa có số khách/, /^0tr$/] },
  { id: 'khach-moi', at: /^Nhà trai$/, fake: [/Chưa có khách mời/, /^Thêm khách mời$/, /^0 người$/, /Chưa đặt sức chứa/, /xác nhận ·\s+chờ/] },
];
const PLAIN = /Đang tải|Đang tìm vendor phù hợp/;
const DELAY = (p) => (p === '/api/me' ? 300 : 1500);

const visibleHits = (page, regexes) => page.evaluate((src) => { const res = src.map((s) => new RegExp(s[0], s[1])); const out = [];
  const effOpacity = (e) => { let o = 1; for (let a = e; a && a.nodeType === 1; a = a.parentElement) o *= parseFloat(getComputedStyle(a).opacity); return o; };
  for (const e of document.querySelectorAll('body *')) { const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(); if (!own || !res.some((r) => r.test(own))) continue;
    const r = e.getBoundingClientRect(); if (r.width <= 8 || r.height <= 8) continue; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (effOpacity(e) < 0.05) continue; out.push(own.slice(0, 40)); } return out; }, regexes.map((r) => [r.source, r.flags]));
const busyRegions = (page) => page.evaluate(() => [...document.querySelectorAll('[aria-busy="true"]')].map((e, i) => ({ i, vis: (() => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })(),
  focusable: e.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),[contenteditable=""],[contenteditable="true"]').length,
  painted: [...e.querySelectorAll('*')].filter((x) => { if (x.children.length || (x.textContent || '').trim()) return false; const r = x.getBoundingClientRect(); const m = getComputedStyle(x).backgroundColor.match(/rgba?\(([^)]+)\)/); const p = m ? m[1].split(',').map(parseFloat) : null; return r.width >= 8 && r.height >= 4 && p && (p.length < 4 || p[3] > 0); }).length })));

const fails = []; const check = (name, ok, extra) => { console.log(`  ${ok ? 'ok' : 'XX'}  ${name}${!ok && extra ? '  :: ' + String(extra).slice(0, 160) : ''}`); if (!ok) fails.push(name + (extra ? ' [' + String(extra).slice(0, 120) + ']' : '')); };

(async () => {
  const { chromium } = L.loadPlaywright(REPO);
  const dist = await L.buildDist(REPO); const srv = await L.serve(dist); const browser = await chromium.launch();
  try {
    for (const sc of TABS) {
      const S = await L.scenario(browser, srv.base, { hash: sc.id, delay: DELAY, reduced: ONLY === 3 }); const { page } = S;
      try {
        if (ONLY === 1) {
          const seen = new Set();
          let prev = 0; for (const t of [100, 250, 450, 800, 1200]) { await page.waitForTimeout(t - prev); prev = t; for (const h of await visibleHits(page, [PLAIN, ...sc.fake])) seen.add(h); } // mốc tính từ lúc trang tải xong; dữ liệu về sau >= 1,8s
          check(`${sc.id}: lúc chờ (gồm chờ /api/me) không có chữ rỗng giả, chữ chờ trơn hay nút thêm nhìn thấy`, seen.size === 0, [...seen].join(' | '));
        } else if (ONLY === 2) {
          await page.waitForTimeout(800);
          const regs = (await busyRegions(page)).filter((r) => r.vis);
          check(`${sc.id}: lúc chờ có vùng aria-busy="true" nhìn thấy`, regs.length >= 1, 'không có');
          for (const r of regs) {
            const reg = page.locator('[aria-busy="true"]').nth(r.i); // status nằm trong vùng, hoặc chính vùng là status
            const named = (await reg.getByRole('status', { name: /Đang tải/ }).count()) > 0 || (await reg.evaluate((e) => e.getAttribute('role') === 'status' && /Đang tải/.test(e.getAttribute('aria-label') || e.textContent || '')));
            check(`${sc.id}: vùng chờ #${r.i} có role=status tên "Đang tải"`, named);
            check(`${sc.id}: vùng chờ #${r.i} không chứa phần tử focus được (không phủ header, thanh tab)`, r.focusable === 0, r.focusable + ' phần tử');
          }
          let bad = null; for (let k = 0; k < 14 && !bad; k++) { await page.keyboard.press('Tab'); if (await page.evaluate(() => !!(document.activeElement && document.activeElement.closest('[aria-busy="true"]')))) bad = 'sau ' + (k + 1) + ' lần Tab'; }
          check(`${sc.id}: Tab 14 lần không đưa focus vào vùng chờ`, !bad, bad);
          await page.getByText(sc.at).first().waitFor({ state: 'visible', timeout: 9000 }).catch(() => {});
          let gone = true; try { await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 4000 }); } catch { gone = false; }
          check(`${sc.id}: tải xong thì không còn aria-busy="true"`, gone);
        } else {
          await page.waitForTimeout(800);
          const regs = (await busyRegions(page)).filter((r) => r.vis);
          const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('[aria-busy="true"]')).length);
          check(`${sc.id}: reduced-motion: có vùng chờ với khối tô màu nhìn thấy`, regs.some((r) => r.painted >= 1), regs.length ? 'vùng không có khối tô màu' : 'không có vùng aria-busy');
          check(`${sc.id}: reduced-motion: không animation nào chạy trong vùng chờ`, running === 0, running + ' animation');
        }
      } finally { await S.ctx.close(); }
    }
  } catch (e) { check('luồng đo gặp lỗi: ' + String(e && e.message).split('\n')[0], false); }
  finally { await browser.close().catch(() => {}); await srv.close().catch(() => {}); L.killAll(); }
  if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); process.exit(1); }
  console.log('PASS'); process.exit(0);
})().catch((e) => { console.log('FAIL harness: ' + (e && e.stack || e)); process.exit(2); });
