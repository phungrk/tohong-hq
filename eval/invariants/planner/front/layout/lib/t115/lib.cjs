// Bản chụp cố định của eval/T-115/lib.cjs (T-115 v2, qua Spec Gate 2026-11-09, spec-critic) + đo đơn vị chiều cao của sheet (vhDecl). Không sửa cho khớp code.
// Mọi phần tử được tìm theo HÀNH VI/NHÃN, không theo cấu trúc DOM: vùng nội dung = tổ tiên cuộn dọc được gần nhất của tiêu đề "Số khách";
// footer = tổ tiên chung nhỏ nhất của hai nút "Tiếp theo" và "Quay lại bước 1"; sheet = tổ tiên chung nhỏ nhất của chữ "BƯỚC 2 / 3" và nút "Tiếp theo".
// "Bị che" kiểm bằng elementFromPoint tại tâm phần tử.
const path = require('path'), { createRequire } = require('module');
const { startViteDev } = require('../../../../../../_lib/vite_dev.cjs');
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
      // vhDecl: khai báo chiều cao/vị trí dọc dùng vh/lvh (đơn vị theo viewport LỚN, Safari có thanh công cụ thì lớn hơn vùng nhìn thấy)
      // trên sheet và mọi tổ tiên tới lớp phủ position:fixed gần nhất (gồm cả nó). Đọc từ CSSOM đã áp (style inline + mọi luật khớp, kể cả trong @media/@supports đang khớp viewport),
      // nên không phụ thuộc file hay cách viết CSS. Khai báo bị khai báo sau ghi đè (vd fallback 100vh rồi 100dvh) không còn trong CSSOM nên không tính.
      const PROPS = ['height', 'min-height', 'max-height', 'top', 'bottom', 'inset', 'block-size', 'min-block-size', 'max-block-size', 'inset-block', 'inset-block-start', 'inset-block-end'];
      const VH = /(^|[^a-z-])l?vh\b/i;
      const chain = []; for (let n = sheet; n && n !== document.documentElement; n = n.parentElement) { chain.push(n); if (getComputedStyle(n).position === 'fixed') break; }
      const vhDecl = [];
      const desc = n => (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).join('.') : n.tagName.toLowerCase());
      const scan = (decl, where) => { for (const p of PROPS) { const v = decl.getPropertyValue(p); if (v && VH.test(v)) vhDecl.push(`${where} ${p}: ${v}`); } };
      const walk = (rules, cb) => { for (const r of rules) { if (r.selectorText !== undefined) cb(r); else if (r.cssRules) { const c = r.media ? r.media.mediaText : null; if (c && !matchMedia(c).matches) continue; if (r.conditionText !== undefined && !r.media && typeof CSS !== 'undefined' && CSS.supports && !CSS.supports(r.conditionText)) continue; walk(r.cssRules, cb); } } };
      for (const n of chain) {
        scan(n.style, desc(n) + ' [inline]');
        for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; }
          walk(rs, r => { let ok = false; try { ok = n.matches(r.selectorText); } catch (e) {} if (ok) scan(r.style, desc(n) + ' [' + r.selectorText + ']'); }); }
      }
      return { innerW: innerWidth, innerH: innerHeight, docScrollW: document.documentElement.scrollWidth, scrollTop: Math.round(scroller.scrollTop),
        scrollH: scroller.scrollHeight, clientH: scroller.clientHeight, sheet: R(sheet), scroller: R(scroller), label: R(lab), pill: R(pill), last: R(lastBtn), footer: R(footer), btn: R(next), back: R(back),
        pillCovered: covered(pill), lastCovered: covered(lastBtn), nextCovered: covered(next), labelCovered: covered(lab), vhDecl, chainLen: chain.length };
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
