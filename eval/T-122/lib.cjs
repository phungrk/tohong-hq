// T-122: đo footer (nút Tiếp theo) của Onboarding trên điện thoại bằng Playwright + vite dev qua helper chung (files: {}, không ghi file vào repo).
// Phần tử tìm theo HÀNH VI/NHÃN, không theo class/DOM:
//   nút chính = nút có chữ bắt đầu "Tiếp theo" (bước 1, 2) hoặc "Xem Gu" (bước 3a); nút phụ = "Quay lại bước 1" (bước 2) hoặc "Bỏ qua" (bước 3a);
//   footer = tổ tiên chung nhỏ nhất của nút chính và nút phụ; sheet = tổ tiên chung nhỏ nhất của chữ "BƯỚC n / 3" và nút chính;
//   vùng nội dung = hậu duệ của sheet cuộn dọc được (overflow-y auto/scroll) có diện tích lớn nhất.
// "Độ đặc" của footer đo bằng ảnh chụp: tô nền sheet và vùng nội dung màu tím (#f0f) rồi chụp; điểm ảnh ở lề trái footer (x = mép sheet + 3, không có chữ/nút)
//   = alpha*màu_footer + (1-alpha)*tím  =>  alpha = 1 - (G_không_tô - G_tô)/G_giấy.
// "Nội dung còn nằm dưới footer" = đáy của phần tử nội dung thấp nhất (nút, ô nhập, ảnh, hoặc lá có chữ) trong vùng nội dung > đỉnh footer ở trạng thái đặc - 4px.
const path = require('path'), { createRequire } = require('module');
const { startViteDev } = require('../_lib/vite_dev.cjs');
function loadPlaywright(REPO) {
  for (const t of [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean)) { try { return createRequire(path.join(REPO, 'x.js'))(t); } catch { /* tiếp */ } }
  console.log('FAIL không tìm thấy playwright'); process.exit(2);
}
async function run(REPO, fn) {
  const dev = await startViteDev({ repo: REPO, files: {} }).catch(e => { console.log('FAIL không dựng được vite: ' + e.message); process.exit(2); });
  const browser = await loadPlaywright(REPO).chromium.launch();
  try { return await fn(browser, dev.url); } finally { await browser.close(); await dev.stop(); }
}
const STEPS = { 2: { label: /^BƯỚC 2 \/ 3/, primary: /^Tiếp theo/, secondary: /^Quay lại bước 1/ }, grid: { label: /^BƯỚC 3 \/ 3/, primary: /^Xem Gu/, secondary: /^Bỏ qua/ } };
async function open(browser, base, W, H, step, { desktop = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: !desktop, hasTouch: !desktop });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  await page.route('**/*', r => { const u = r.request().url(); return (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) ? r.continue() : r.abort(); });
  await page.goto(base);
  await page.getByRole('button', { name: /^Bắt đầu/ }).click(); await page.getByText('BƯỚC 1 / 3').first().waitFor(); await page.waitForTimeout(400);
  for (const i of await page.locator('input[type=text], input:not([type])').all()) { if (await i.isVisible()) await i.fill('An'); }
  await page.getByRole('button', { name: /^Tiếp theo/ }).first().click(); await page.getByText('BƯỚC 2 / 3').first().waitFor();
  if (step === 'grid') { await page.waitForTimeout(500); await page.getByRole('button', { name: /^Tiếp theo/ }).first().click(); await page.getByText(/BƯỚC 3 \/ 3/).first().waitFor(); }
  await page.waitForTimeout(800);
  return { ctx, page };
}
// Cài hàm đo vào trang, trả về window.__m.
async function install(page, step) {
  const S = STEPS[step];
  await page.evaluate(({ L, P, Q }) => {
    const txt = e => e.textContent.trim();
    const common = (a, b) => { for (let n = a.parentElement; n; n = n.parentElement) if (n.contains(b)) return n; return null; };
    const mk = () => {
      const btns = [...document.querySelectorAll('button')].filter(b => b.getBoundingClientRect().height > 0);
      const prim = btns.find(b => new RegExp(P).test(txt(b))), sec = btns.find(b => new RegExp(Q).test(txt(b)));
      const leaves = [...document.querySelectorAll('*')].filter(e => e.children.length === 0);
      const lab = leaves.find(e => new RegExp(L).test(txt(e)));
      const footer = common(prim, sec), sheet = common(lab, prim);
      let scroller = null, area = 0;
      for (const n of sheet.querySelectorAll('*')) { const o = getComputedStyle(n).overflowY; if ((o === 'auto' || o === 'scroll') && !n.contains(footer)) { const r = n.getBoundingClientRect(); if (r.width * r.height > area) { area = r.width * r.height; scroller = n; } } }
      return { prim, sec, footer, sheet, scroller };
    };
    const R = e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height, w: r.width }; };
    const contentBottom = sc => { let m = -1e9; for (const e of sc.querySelectorAll('*')) { const r = e.getBoundingClientRect(); if (r.height === 0 || r.width === 0) continue; const own = e.tagName === 'BUTTON' || e.tagName === 'INPUT' || e.tagName === 'IMG' || (e.children.length === 0 && txt(e) !== ''); if (own) m = Math.max(m, r.bottom); } return m; };
    window.__mk = mk;
    window.__m = {
      geo() { const x = mk(); return { inner: { w: innerWidth, h: innerHeight }, docScrollW: document.documentElement.scrollWidth, footer: R(x.footer), sheet: R(x.sheet), scroller: R(x.scroller), prim: R(x.prim), sec: R(x.sec), contentBottom: contentBottom(x.scroller), scrollTop: x.scroller.scrollTop, maxScroll: x.scroller.scrollHeight - x.scroller.clientHeight }; },
      scrollTo(y) { const x = mk(); x.scroller.scrollTop = y; },
      probe(on) { const x = mk(); for (const e of [x.sheet, x.scroller]) { if (on) { e.dataset.__bg = e.getAttribute('style') || ''; e.style.setProperty('background', '#f0f', 'important'); } else { e.setAttribute('style', e.dataset.__bg || ''); } } },
      hide(on) { const x = mk(); if (on) x.scroller.style.setProperty('visibility', 'hidden', 'important'); else x.scroller.style.removeProperty('visibility'); },
      // chạm tại (x,y): trả về 'footer' nếu phần tử trên cùng nằm trong footer, 'content' nếu trong vùng nội dung, 'other'
      hit(x0, y0) { const x = mk(); const t = document.elementFromPoint(x0, y0); if (!t) return 'none'; if (x.footer.contains(t) || t === x.footer) return 'footer'; if (x.scroller.contains(t)) return 'content'; return 'other'; },
      hitIs(sel, x0, y0) { const x = mk(); const e = x[sel]; const t = document.elementFromPoint(x0, y0); return !!(t && (t === e || e.contains(t))); },
      // có chữ của vùng nội dung có tâm nằm trong dải y0..y1 không
      textIn(y0, y1) { const x = mk(); for (const e of x.scroller.querySelectorAll('*')) { if (e.children.length || txt(e) === '') continue; const r = e.getBoundingClientRect(); const cy = (r.top + r.bottom) / 2; if (cy >= y0 && cy < y1 && r.width > 0) return true; } return false; },
      // nút trong vùng nội dung giao với dải y0..y1 (để thử chạm xuyên): trả tâm x của nút đầu tiên giao
      contentBtnAt(y0, y1) { const x = mk(); for (const b of x.scroller.querySelectorAll('button')) { const r = b.getBoundingClientRect(); if (r.bottom > y0 && r.top < y1 && r.width > 0) return { cx: r.left + r.width / 2, y: (Math.max(r.top, y0) + Math.min(r.bottom, y1)) / 2 }; } return null; },
    };
  }, { L: S.label.source, P: S.primary.source, Q: S.secondary.source });
}
// Chụp trang, giải mã vào window.__img (ImageData) để đọc điểm ảnh.
async function shot(page, slot) {
  const b64 = (await page.screenshot()).toString('base64');
  await page.evaluate(async ({ b64, slot }) => { const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const g = c.getContext('2d'); g.drawImage(bmp, 0, 0); (window.__img = window.__img || {})[slot] = g.getImageData(0, 0, c.width, c.height); }, { b64, slot });
}
// Đặc của footer: min và max alpha dọc lề trái, tại các y cho trước (toạ độ trang). Cần slot 'n' (không tô) và 'p' (tô tím).
function alphaAt(page, x, ys, paperY) {
  return page.evaluate(({ x, ys, paperY }) => { const px = (s, X, Y) => { const d = window.__img[s]; const i = (Math.round(Y) * d.width + Math.round(X)) * 4; return [d.data[i], d.data[i + 1], d.data[i + 2]]; }; const gp = px('n', x, paperY)[1]; return ys.map(y => Math.max(0, Math.min(1, 1 - (px('n', x, y)[1] - px('p', x, y)[1]) / gp))); }, { x, ys, paperY });
}
// Số điểm ảnh khác nhau (>40 ở một kênh) giữa hai lần chụp 'n' và 'h' trong hình chữ nhật, tính theo % diện tích.
function diffPct(page, r) {
  return page.evaluate((r) => { const a = window.__img.n, b = window.__img.h; let n = 0, t = 0; for (let y = Math.round(r.top); y < Math.round(r.bottom); y++) for (let x = Math.round(r.left); x < Math.round(r.right); x++) { const i = (y * a.width + x) * 4; t++; if (Math.abs(a.data[i] - b.data[i]) > 40 || Math.abs(a.data[i + 1] - b.data[i + 1]) > 40 || Math.abs(a.data[i + 2] - b.data[i + 2]) > 40) n++; } return t ? 100 * n / t : 0; }, r);
}
// Màu nền (màu hay gặp nhất) và tương phản chữ/nền trong hình chữ nhật của ảnh 'n'.
function contrastIn(page, r, slot = 'n') {
  return page.evaluate(({ r, slot }) => { const d = window.__img[slot]; const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
    const h = new Map(); const all = [];
    for (let y = Math.round(r.top) + 2; y < Math.round(r.bottom) - 2; y++) for (let x = Math.round(r.left) + 6; x < Math.round(r.right) - 6; x++) { const i = (y * d.width + x) * 4; const c = [d.data[i], d.data[i + 1], d.data[i + 2]]; const k = c.join(','); h.set(k, (h.get(k) || 0) + 1); all.push(c); }
    let bk = null, bn = 0; for (const [k, n] of h) if (n > bn) { bn = n; bk = k; } const bg = bk.split(',').map(Number); const lb = lum(bg);
    let far = bg, fd = -1; for (const c of all) { const dl = Math.abs(lum(c) - lb); if (dl > fd) { fd = dl; far = c; } }
    const l1 = Math.max(lb, lum(far)), l2 = Math.min(lb, lum(far)); return { bg, ratio: (l1 + .05) / (l2 + .05) }; }, { r, slot });
}
module.exports = { run, open, install, shot, alphaAt, diffPct, contrastIn, STEPS };
