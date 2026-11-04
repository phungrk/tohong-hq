#!/usr/bin/env node
/*
 * Eval tầng 1 của T-054 (front): cuộn ở cấp trang để Safari iPhone thu gọn thanh địa chỉ và ẩn thanh dưới.
 * Spec: products/T-054-cuon-cap-trang.md. --only N = tiêu chí N:
 *   1 document cuộn, không còn khung con cuộn nội dung chính   2 chiều cao trang chỉ là nội dung của trang đang xem
 *   3 header và thanh tab luôn thấy, không che nội dung        4 nhớ và khôi phục vị trí cuộn (đổi tab, Back/Forward, trang con)
 *   5 lớp phủ mở thì khoá cuộn nền, đóng giữ nguyên vị trí     6 chat AI
 *   7 không cuộn ngang 320-1280, khung tối đa 768px   8 khối gợi ý cài ẩn khi kéo nội dung lên, hiện khi kéo xuống
 * Tiêu chí 9 (bất biến): bash eval/T-054/run_invariants.sh <front>. Tiêu chí 10 (Safari thật): eval/T-054/checklist.md.
 *
 * Chạy: cd /home/user/tohong-hq && node eval/T-054/check_ui.cjs --repo /home/user/tohong-front [--only 1,4]
 * Tìm phần tử theo CHỮ và VAI TRÒ (nút theo tên truy cập, văn bản). Không có bộ chọn theo class/style/cấu trúc component, không đọc mã nguồn.
 * Chromium không có thanh công cụ Safari: eval đo "document là thứ cuộn" (scrollY) và hành vi quanh nó.
 * Dòng cuối PASS hoặc FAIL <lý do đầu> (+n lỗi nữa); mã thoát 0/1 (2 = không chạy được).
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
  console.log(`${ok ? '  ok ' : '  XX '} [TC${crit}] ${name}${!ok && extra ? '  :: ' + String(extra).replace(/\s+/g, ' ').slice(0, 500) : ''}`);
  if (!ok) fails.push(`[TC${crit}] ${name}${extra ? ' [' + String(extra).replace(/\s+/g, ' ').slice(0, 140) + ']' : ''}`);
};
const near = (a, b, t = 2) => Math.abs(a - b) <= t;

const TABS = [['Trang chủ', 'trang-chu'], ['Kế hoạch', 'ke-hoach'], ['Ngân sách', 'ngan-sach'], ['Khách mời', 'khach-moi']];

/* ---------- trợ giúp trong trang ---------- */
// Nút theo tên truy cập mà người dùng đang thật sự chạm được (không bị ẩn, không bị che, nằm trong màn hình).
async function btn(page, name) {
  const loc = page.getByRole('button', { name, exact: true });
  const n = await loc.count();
  for (let i = 0; i < n; i++) {
    const ok = await loc.nth(i).evaluate((el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return false;
      const t = document.elementFromPoint(cx, cy); return !!t && el.contains(t); }).catch(() => false);
    if (ok) return loc.nth(i);
  }
  return null;
}
async function tap(page, name) { const b = await btn(page, name); if (!b) throw new Error('không thấy nút chạm được: ' + name); await b.click(); }
const settle = (page, frames = 30) => page.evaluate((fr) => new Promise((res) => { let last = -1, n = 0; const t0 = performance.now();
  const f = () => { if (scrollY === last) { if (++n >= fr) return res(scrollY); } else { n = 0; last = scrollY; } if (performance.now() - t0 > 4000) return res(scrollY); requestAnimationFrame(f); }; f(); }), frames);
// Chờ mọi chuyển động CSS đang chạy xong (sheet trượt lên, opacity đổi), cộng hai khung hình.
const idle = async (page) => { await page.waitForFunction(() => document.getAnimations().filter((a) => a.playState === 'running').length === 0, null, { timeout: 4000 }).catch(() => {}); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); };
const sy = (page) => page.evaluate(() => Math.round(scrollY));
const maxScroll = (page) => page.evaluate(() => Math.max(0, document.scrollingElement.scrollHeight - innerHeight));
async function wheel(page, dy, x) { const vp = page.viewportSize(); await page.mouse.move(x ?? vp.width / 2, Math.min(vp.height / 2, 300)); await page.mouse.wheel(0, dy); return settle(page, 8); }
async function toTop(page) { for (let i = 0; i < 40 && (await sy(page)) > 0; i++) await wheel(page, -400); return sy(page); }
async function toEnd(page) { let last = -1; for (let i = 0; i < 60; i++) { const y = await wheel(page, 500); if (y === last) break; last = y; } return sy(page); }
async function goTabTap(page, name) { await tap(page, name); await page.waitForFunction((n) => [...document.querySelectorAll('button[aria-current="page"]')].some((b) => b.textContent.trim() === n), name); return settle(page); }
// Mọi phần tử (trừ document) đang bị cuộn khỏi đầu: nếu có thì có khung con đang tự cuộn nội dung.
// Lớp nhận diện theo hành vi: cây con của role=dialog, hoặc cây con nhỏ nhất quanh nút "Đóng"/"Đóng menu" mà chưa chứa header của trang (nút "Mở menu").
const LAYER_JS = `const closers = [...document.querySelectorAll('button')].filter((b) => ['Đóng', 'Đóng menu'].includes((b.getAttribute('aria-label') || '').trim()));
  const roots = [...document.querySelectorAll('[role="dialog"]')];
  for (const c of closers) { let root = null; for (let a = c.parentElement; a && a !== document.body; a = a.parentElement) { if (a.querySelector('button[aria-label="Mở menu"]')) break; root = a; } if (root) roots.push(root); }
  const inLayer = (e) => roots.some((r) => r.contains(e));`;
const innerScrolled = (page) => page.evaluate(`(() => { ${LAYER_JS}
  return [...document.querySelectorAll('body *')].filter((e) => e.scrollTop > 0 && !inLayer(e)).map((e) => e.tagName + (e.getAttribute('aria-label') || '').slice(0, 20) + ' top=' + Math.round(e.scrollTop)); })()`);
// Phần tử văn bản (lá) đầu tiên nằm trọn trong vùng nhìn thấy dưới y >= minY: dùng làm "mốc" để đo nội dung có nhảy không.
const probe = (page, minY = 130) => page.evaluate((mn) => { const shown = (e) => { for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) < 0.05 || a.hasAttribute('inert') || a.getAttribute('aria-hidden') === 'true') return false; } return true; }; const vis = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && (e.textContent || '').trim().length > 2)
  .map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ e, r }) => shown(e) && r.width > 1 && r.height > 1 && r.top >= mn && r.bottom < innerHeight - 75 && r.left >= 0 && r.right <= innerWidth)
  .sort((a, b) => a.r.top - b.r.top); window.__t054probe = vis.length ? vis[0].e : null; return vis.length ? { text: vis[0].e.textContent.trim(), top: vis[0].r.top } : null; }, minY);
// Đọc lại vị trí của đúng phần tử mốc đã chọn (không cần chạm được: lớp phủ có thể đang che nó).
const probeNow = (page) => page.evaluate(() => { const e = window.__t054probe; if (!e || !e.isConnected) return null; const r = e.getBoundingClientRect(); return r.width > 0 ? r.top : null; });
// Chữ đang thật sự hiện ra (không nằm trong tab ẩn): lá văn bản khớp mà điểm giữa của nó chạm đúng nó.
const leafPoint = (page, text) => page.evaluate((t) => { for (const e of document.querySelectorAll('body *')) { if (e.children.length || (e.textContent || '').trim() !== t) continue;
  const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; const x = r.left + r.width / 2, y = r.top + r.height / 2; if (y < 0 || y > innerHeight) continue;
  const h = document.elementFromPoint(x, y); if (h && (e === h || e.contains(h))) return { x, y, top: r.top }; } return null; }, text);
const probeTop = async (page, text) => { const v = await leafPoint(page, text); return v ? v.top : null; };
const tabBarBox = (page) => page.evaluate((names) => { const bs = names.map((n) => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === n).map((b) => ({ b, r: b.getBoundingClientRect() })).filter(({ r }) => r.width > 2 && r.left >= 0 && r.left < innerWidth && r.top < innerHeight && r.bottom > 0).sort((a, b) => b.r.top - a.r.top)[0]);
  if (bs.some((x) => !x)) return null; const rs = bs.map((x) => x.r); return { l: Math.min(...rs.map((r) => r.left)), r: Math.max(...rs.map((r) => r.right)), top: Math.min(...rs.map((r) => r.top)), bottom: Math.max(...rs.map((r) => r.bottom)), vh: innerHeight, vw: document.documentElement.clientWidth }; }, TABS.map((t) => t[0]));
// Văn bản nằm trong vùng đáy/đầu mà phần tử trên cùng tại điểm đó KHÔNG phải chính nó = bị che.
const coveredText = (page, zone, barTop) => page.evaluate(([z, bt]) => { const shown = (e) => { for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) < 0.05 || a.hasAttribute('inert') || a.getAttribute('aria-hidden') === 'true') return false; } return true; }; const out = [];
  for (const e of document.querySelectorAll('body *')) { if (e.children.length || !(e.textContent || '').trim()) continue;
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || !shown(e)) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (cx < 0 || cx > innerWidth || cy < 0 || cy > innerHeight) continue;
    if (z === 'top' ? cy > 110 : cy < bt) continue;
    const t = document.elementFromPoint(cx, cy); if (t && !(e === t || e.contains(t) || t.contains(e))) out.push(`"${e.textContent.trim().slice(0, 24)}" bị che bởi ${t.tagName.toLowerCase()}`); }
  return out; }, [zone, barTop]);

// Mép trên của vùng dính đáy: thanh tab, cộng khối gợi ý cài app nếu đang hiện.
async function barTopOf(page) { const tb = await tabBarBox(page); let top = tb ? tb.top : page.viewportSize().height;
  const hint = page.getByRole('region', { name: 'Thêm Tơ Hồng vào màn hình chính' }); if (await hint.count()) { const t = await hint.first().evaluate((e) => e.getBoundingClientRect().top).catch(() => null); if (t !== null && t < top) top = t; }
  return top; }

// Ghi (địa chỉ, scrollY) ở MỌI khung hình trong ~700ms quanh một hành động; khung đầu tiên có địa chỉ mới phải đã ở đúng vị trí, mọi khung sau cũng vậy (không hoạt ảnh cuộn).
async function framed(page, action, hash, y, label) {
  await page.evaluate(() => { window.__fr = []; const t0 = performance.now(); const f = () => { window.__fr.push([location.hash, Math.round(scrollY)]); if (performance.now() - t0 < 700) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await action(); await page.waitForTimeout(750);
  const fr = await page.evaluate(() => window.__fr); const mine = fr.filter((f) => f[0] === hash);
  check(`${label}: khung hình đầu tiên hiện ${hash} đã ở đúng vị trí ${y}, không hoạt ảnh cuộn (các khung: ${mine.slice(0, 5).map((f) => f[1]).join(',')})`, mine.length > 0 && mine.every((f) => near(f[1], y, 2)), `khung ${fr.length}, có địa chỉ ${mine.length}`);
}
// Khối gợi ý cài đang thật sự thấy được? (tiêu đề của nó chạm được, không bị che hay đẩy ra ngoài)
const hintVisible = async (page) => !!(await leafPoint(page, 'Thêm Tơ Hồng vào màn hình chính'));
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
async function openApp(browser, base, opts) { return L.scenario(browser, base, opts); }
const gotoHash = async (S, hash) => { await S.page.goto(S.base + '/#/' + hash); await S.page.waitForFunction(() => document.readyState === 'complete'); await settle(S.page, 10); };

(async () => {
  const dist = await L.buildDist(REPO); const srv = await L.serve(dist);
  const browser = await chromium.launch();
  const SHORT = { width: 390, height: 360 };
  const mk = async (o = {}) => { const S = await L.scenario(browser, srv.base, o); S.base = srv.base;
    if (process.env.T054_HACK_JS) await S.page.evaluate(require('fs').readFileSync(process.env.T054_HACK_JS, 'utf8')); // chỉ để thử chính eval
    if (process.env.T054_HACK_CSS) { const css = require('fs').readFileSync(process.env.T054_HACK_CSS, 'utf8'); await S.page.addStyleTag({ content: css }); } // chỉ để thử chính eval, không dùng khi chấm
    return S; };
  try {
    /* ===== 1. document cuộn, không khung con ===== */
    if (wants(1)) { crit = 1;
      const S = await mk({ viewport: SHORT }); const p = S.page;
      for (const [name] of TABS) {
        await goTabTap(p, name); await toTop(p);
        const m = await maxScroll(p); check(`${name}: nội dung dài hơn màn hình thấp 360px nên document cuộn được (dài thêm ${m}px)`, m > 20, 'document không có chỗ để cuộn: chiều cao trang không vượt màn hình');
        const y = await wheel(p, 120); check(`${name}: lăn nội dung thì window.scrollY tăng (đo ${y})`, y > 0);
        const inner = await innerScrolled(p); check(`${name}: không phần tử con nào tự cuộn nội dung`, inner.length === 0, inner.slice(0, 3).join('; '));
        const e = await toEnd(p); check(`${name}: cuộn tới cuối được bằng document (scrollY ${e}/${await maxScroll(p)})`, e > 0 && near(e, await maxScroll(p), 2));
        const back = await toTop(p); check(`${name}: lăn ngược về đầu trang (scrollY ${back})`, back === 0);
      }
      // trang con ngân sách
      await goTabTap(p, 'Ngân sách'); await toTop(p);
      for (let i = 0; i < 12 && !(await probeTop(p, 'Nhà hàng tiệc cưới') > 120 && await probeTop(p, 'Nhà hàng tiệc cưới') < 250); i++) await wheel(p, 80);
      const vt = await leafPoint(p, 'Nhà hàng tiệc cưới');
      check('Ngân sách: chạm được hạng mục "Nhà hàng tiệc cưới" để mở trang con', !!vt);
      if (vt) { await p.mouse.click(vt.x, vt.y); await p.waitForFunction(() => /ngan-sach\/venue/.test(location.hash)); await settle(p);
        const y0 = await sy(p); check(`Trang con: mở từ danh sách thì bắt đầu ở đầu trang (scrollY ${y0})`, y0 === 0);
        const y = await wheel(p, 150); check(`Trang con: lăn nội dung thì window.scrollY tăng (đo ${y})`, y > 0);
        const inner = await innerScrolled(p); check('Trang con: không phần tử con nào tự cuộn nội dung', inner.length === 0, inner.slice(0, 3).join('; ')); }
      await S.ctx.close();
      // kéo bằng cảm ứng (điện thoại)
      const T = await mk({ viewport: SHORT, touch: true }); const tp = T.page; await goTabTap(tp, 'Ngân sách'); await toTop(tp);
      const cdp = await T.ctx.newCDPSession(tp);
      const x = 195, y0 = 250, y1 = 100; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
      for (let k = 1; k <= 12; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (y1 - y0) * k / 12 }] }); await tp.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); const ty = await settle(tp, 20); // vuốt ngón tay từ dưới lên
      check(`Cảm ứng: kéo nội dung lên thì window.scrollY tăng (đo ${ty})`, ty > 0);
      const inner = await innerScrolled(tp); check('Cảm ứng: không phần tử con nào tự cuộn nội dung', inner.length === 0, inner.slice(0, 3).join('; '));
      await T.ctx.close();
    }

    /* ===== 2. chiều cao trang = nội dung của trang đang xem ===== */
    if (wants(2)) { crit = 2;
      const S = await mk({ viewport: { width: 390, height: 844 }, emptyGuests: true }); const p = S.page;
      for (const [name] of [TABS[0], TABS[3]]) {
        await goTabTap(p, name); await toTop(p);
        const m = await maxScroll(p); check(`${name} (nội dung ngắn, màn 844px): không có khoảng cuộn thừa do các tab khác dài (thừa ${m}px)`, m <= 1);
        const y = await wheel(p, 300); check(`${name}: lăn không làm trang trôi (scrollY ${y})`, y === 0);
        const tb = await tabBarBox(p); check(`${name}: nội dung ngắn thì thanh tab vẫn nằm sát đáy màn hình (đáy ${tb ? tb.bottom.toFixed(0) : '?'} / ${tb ? tb.vh : '?'})`, !!tb && near(tb.bottom, tb.vh, 1.5));
      }
      await goTabTap(p, 'Kế hoạch'); await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
      { const bad = []; for (let i = 0; i < 45; i++) { await p.keyboard.press('Tab');
          const r = await p.evaluate(`(() => { ${LAYER_JS} const e = document.activeElement; if (!e || e === document.body || inLayer(e)) return null;
            for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) < 0.05) return e.tagName + ' "' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20) + '" trong phần tử ẩn'; }
            return null; })()`); if (r) bad.push(r); }
        check('Bấm Tab 45 lần ở Kế hoạch: focus không rơi vào phần tử của màn đang ẩn', bad.length === 0, bad.slice(0, 2).join('; ')); }
      await p.evaluate(() => window.scrollTo(0, 0));
      await goTabTap(p, 'Kế hoạch'); const mp = await maxScroll(p); await toTop(p);
      await goTabTap(p, 'Trang chủ'); const mh = await maxScroll(p);
      check(`Từ tab dài (Kế hoạch dài thêm ${mp}px) sang tab ngắn: khoảng cuộn co lại theo tab ngắn (${mh}px)`, mp > 200 && mh <= 1);
      await S.ctx.close();
    }

    /* ===== 3. header và thanh tab luôn thấy, không che nội dung ===== */
    if (wants(3)) { crit = 3;
      const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
      for (const withHint of [false, true]) {
        const S = await mk({ viewport: SHORT, ua: withHint ? IOS : undefined }); const p = S.page;
        for (const [name] of TABS) {
          const tag = `${name}${withHint ? ' (có khối gợi ý cài app, iPhone)' : ''}`;
          await goTabTap(p, name); await toTop(p);
          const h0 = await btn(p, 'Mở menu'); check(`${tag}: ở đầu trang thấy nút "Mở menu" (header)`, !!h0);
          const cov0 = await coveredText(p, 'top'); check(`${tag}: ở đầu trang, header không che chữ nào của nội dung`, cov0.length === 0, cov0.slice(0, 2).join('; '));
          for (const where of ['giữa', 'cuối']) {
            if (where === 'giữa') await wheel(p, Math.max(60, Math.floor((await maxScroll(p)) / 2))); else await toEnd(p);
            const tb = await tabBarBox(p);
            check(`${tag}: cuộn tới ${where}: thanh tab đủ 4 nút, dính đáy màn hình`, !!tb && near(tb.bottom, tb.vh, 1.5) && tb.top > 0, tb && `đáy nút ${tb.bottom} / màn ${tb.vh}`);
            const hb = await btn(p, 'Mở menu'); const hr = hb && await hb.evaluate((e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
            check(`${tag}: cuộn tới ${where}: header (nút "Mở menu") vẫn ở đầu màn hình`, !!hr && hr.top >= -1 && hr.bottom < 110, hr && JSON.stringify(hr));
          }
          const cov1 = await coveredText(p, 'bottom', await barTopOf(p)); check(`${tag}: ở cuối trang, thanh tab ${withHint ? 'và khối gợi ý ' : ''}không che chữ nào của nội dung`, cov1.length === 0, cov1.slice(0, 2).join('; '));
          if (withHint) { const hint = await p.getByRole('region', { name: 'Thêm Tơ Hồng vào màn hình chính' }).count(); check(`${tag}: khối gợi ý cài hiện trên iPhone`, hint > 0); }
          // chạm được thanh tab khi đang cuộn tới cuối
          const next = TABS[(TABS.findIndex((t) => t[0] === name) + 1) % 4][0]; await goTabTap(p, next);
          check(`${tag}: đang ở cuối trang vẫn chạm tab "${next}" chuyển được trang`, true);
        }
        await S.ctx.close();
      }
      // trang con có header dính
      const S = await mk({ viewport: SHORT, hash: 'ngan-sach/venue' }); const p = S.page; await settle(p, 20);
      const q0 = await btn(p, 'Quay lại'); check('Trang con: thấy nút "Quay lại" ở đầu trang', !!q0);
      await toEnd(p); const q1 = await btn(p, 'Quay lại'); const qr = q1 && await q1.evaluate((e) => e.getBoundingClientRect().top);
      check(`Trang con: cuộn tới cuối vẫn thấy nút "Quay lại" dính đầu màn hình (top ${qr})`, !!q1 && qr >= -1 && qr < 110);
      const tb = await tabBarBox(p); check('Trang con: thanh tab dính đáy', !!tb && near(tb.bottom, tb.vh, 1.5));
      const cov = await coveredText(p, 'bottom', await barTopOf(p)); check('Trang con: ở cuối trang không có chữ bị che', cov.length === 0, cov.slice(0, 2).join('; '));
      await S.ctx.close();
    }

    /* ===== 4. nhớ và khôi phục vị trí cuộn ===== */
    if (wants(4)) { crit = 4;
      const S = await mk({ viewport: SHORT }); const p = S.page;
      const at = async (f) => { const m = await maxScroll(p); return wheel(p, Math.round(m * f) - (await sy(p))); };
      await goTabTap(p, 'Trang chủ'); const yH = await at(0.5);
      await goTabTap(p, 'Ngân sách'); const first = await sy(p); check(`Tab chưa từng xem bắt đầu ở đầu trang (scrollY ${first})`, first === 0);
      const yB = await at(0.4);
      await goTabTap(p, 'Kế hoạch'); const yP = await at(0.7);
      check(`Ba tab ở ba vị trí khác nhau (${yH}, ${yB}, ${yP})`, yH > 10 && yB > 10 && yP > 10 && yH !== yB && yB !== yP);
      if (yH > 10 && yB > 10 && yP > 10) { // chạm tab đang xem: đứng yên
        await goTabTap(p, 'Kế hoạch'); const hh = await p.evaluate(() => location.hash), hl = await p.evaluate(() => history.length);
        await tap(p, 'Kế hoạch'); const ys = await settle(p, 20);
        check(`Chạm tab đang xem: đứng yên, scrollY không đổi, không thêm bước lịch sử (${ys} so với ${yP})`, near(ys, yP, 1) && (await p.evaluate(() => location.hash)) === hh && (await p.evaluate(() => history.length)) === hl); }
      // đổi tab bằng thanh tab
      for (const [name, y, hh] of [['Trang chủ', yH, '#/trang-chu'], ['Ngân sách', yB, '#/ngan-sach'], ['Kế hoạch', yP, '#/ke-hoach']]) { if (y > 10) await framed(p, () => tap(p, name), hh, y, `Chạm tab "${name}"`); const got = await goTabTap(p, name); check(`Chạm tab "${name}": về đúng vị trí đã rời (${got} so với ${y})`, near(got, y, 2)); }
      if (!(yH > 10 && yB > 10 && yP > 10)) { await S.ctx.close(); } else {
      // Back / Forward giữa các tab. Lịch sử: [0]Trang chủ [1]Ngân sách [2]Kế hoạch [3]Trang chủ [4]Ngân sách [5]Kế hoạch
      await goTabTap(p, 'Ngân sách'); /* [6] đứng ở Ngân sách (yB) */
      const yB2 = await wheel(p, 40); check(`Cuộn thêm ở Ngân sách để có vị trí rời mới (${yB2} so với ${yB})`, yB2 !== yB);
      await framed(p, () => p.goBack(), '#/ke-hoach', yP, 'Back về Kế hoạch'); let g = await settle(p); check(`Back về Kế hoạch: đúng vị trí (${g} so với ${yP})`, near(g, yP, 2));
      await p.goBack(); await p.waitForFunction(() => location.hash === '#/ngan-sach'); g = await settle(p); check(`Back về một bước Ngân sách cũ: dùng vị trí rời gần nhất của trang đó (${g} so với ${yB2})`, near(g, yB2, 2));
      await p.goBack(); await p.waitForFunction(() => location.hash === '#/trang-chu'); g = await settle(p); check(`Back về Trang chủ: đúng vị trí (${g} so với ${yH})`, near(g, yH, 2));
      await p.goForward(); await p.waitForFunction(() => location.hash === '#/ngan-sach'); g = await settle(p); check(`Forward tới Ngân sách: đúng vị trí (${g} so với ${yB2})`, near(g, yB2, 2));
      // trang con
      await goTabTap(p, 'Ngân sách'); await toTop(p);
      for (let i = 0; i < 12; i++) { const t = await probeTop(p, 'Nhà hàng tiệc cưới'); if (t !== null && t > 130 && t < 220) break; await wheel(p, 70); }
      const yList = await sy(p);
      const vt = await leafPoint(p, 'Nhà hàng tiệc cưới');
      if (!vt || yList <= 0) { check('Danh sách Ngân sách cuộn được tới hạng mục "Nhà hàng tiệc cưới"', false, `scrollY ${yList}`); }
      else {
        await p.mouse.click(vt.x, vt.y); await p.waitForFunction(() => /ngan-sach\/venue/.test(location.hash)); let s = await settle(p);
        check(`Mở trang con: bắt đầu ở đầu trang (scrollY ${s})`, s === 0);
        const z = await wheel(p, 140); check(`Trang con cuộn được (scrollY ${z})`, z > 20);
        await p.goBack(); await p.waitForFunction(() => location.hash === '#/ngan-sach'); s = await settle(p); check(`Back từ trang con: danh sách về đúng vị trí (${s} so với ${yList})`, near(s, yList, 2));
        await p.goForward(); await p.waitForFunction(() => /ngan-sach\/venue/.test(location.hash)); s = await settle(p); check(`Forward vào trang con: đúng vị trí (${s} so với ${z})`, near(s, z, 2));
        await tap(p, 'Quay lại'); await p.waitForFunction(() => location.hash === '#/ngan-sach'); s = await settle(p); check(`Nút "Quay lại" của trang con: danh sách về đúng vị trí (${s} so với ${yList})`, near(s, yList, 2));
        // rời trang con bằng thanh tab rồi quay lại tab Ngân sách
        await p.goForward(); await p.waitForFunction(() => /ngan-sach\/venue/.test(location.hash)); await settle(p);
        await goTabTap(p, 'Trang chủ'); s = await settle(p); check(`Từ trang con sang tab Trang chủ: đúng vị trí Trang chủ (${s} so với ${yH})`, near(s, yH, 2));
        s = await goTabTap(p, 'Ngân sách'); check(`Chạm lại tab Ngân sách: danh sách đúng vị trí cũ (${s} so với ${yList})`, near(s, yList, 2));
      }
      await S.ctx.close(); }
    }

    /* ===== 5. lớp phủ mở thì khoá cuộn nền ===== */
    if (wants(5)) { crit = 5;
      const layers = [
        { name: 'Sheet "Mời người ấy"', tab: 'Trang chủ', open: (p) => tap(p, 'Mời người ấy / gia đình cùng xem'), isOpen: (p) => p.getByRole('dialog', { name: 'Mời người ấy hoặc gia đình cùng xem' }).isVisible(), close: 'back', scrim: true },
        { name: 'Ngăn kéo menu', tab: 'Kế hoạch', open: (p) => tap(p, 'Mở menu'), isOpen: (p) => btn(p, 'Đóng menu').then((b) => !!b), close: 'Đóng menu' },
        { name: 'Chat AI', tab: 'Ngân sách', open: (p) => tap(p, 'AI'), isOpen: (p) => btn(p, 'Đóng').then((b) => !!b), close: 'Đóng' },
        { name: 'Sheet "Thêm việc" (Kế hoạch)', tab: 'Kế hoạch', prep: async (p) => toEnd(p), open: (p) => tap(p, 'Thêm việc'), scrim: true, close: 'back',
          isOpen: (p) => p.evaluate(`(() => { const i = document.querySelector('input[placeholder="VD: Chốt số bàn với nhà hàng"]'); if (!i) return false; const r = i.getBoundingClientRect();
            for (let a = i; a && a !== document.documentElement; a = a.parentElement) { if (parseFloat(getComputedStyle(a).opacity) < 0.05) return false; } return r.width > 20 && r.top >= 0 && r.bottom <= innerHeight; })()`),
          anchor: (p) => p.evaluate(`(() => { const i = document.querySelector('input[placeholder="VD: Chốt số bàn với nhà hàng"]'); const need = Math.min(document.documentElement.clientWidth, 768) - 4;
            for (let a = i; a && a !== document.documentElement; a = a.parentElement) { const r = a.getBoundingClientRect(); if (r.width >= need && Math.abs(r.bottom - innerHeight) <= 1.5) return true; } return false; })()`) },
        { name: 'Hộp thoại "Cách hoạt động" (trang con Nhà hàng)', hash: 'ngan-sach/venue', prep: async (p) => { await toTop(p); for (let i = 0; i < 20 && !(await btn(p, 'Chi tiết')); i++) await wheel(p, 60); return sy(p); },
          open: (p) => tap(p, 'Chi tiết'), isOpen: (p) => p.getByRole('dialog', { name: 'Cách hoạt động' }).isVisible(), close: 'back',
          anchor: (p) => p.evaluate(() => { const d = document.querySelector('[role="dialog"]'); if (!d) return false; const r = d.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1; }) },
        // Không mở được trong harness: sheet vendor ở Ngân sách (cần danh sách vendor từ API tìm vendor và thao tác chọn nhiều bước); đã có INV-003/005/006 (bề rộng, chạm ngoài) và budget/inv-004.
      ];
      for (const lay of layers) {
        const S = await mk({ viewport: SHORT, hash: lay.hash }); const p = S.page;
        if (lay.tab) await goTabTap(p, lay.tab); await settle(p, 10);
        let y0; if (lay.prep) y0 = await lay.prep(p); else { await toTop(p); y0 = await wheel(p, 70); } const pr = await probe(p);
        check(`${lay.name}: có chỗ để thử (đã cuộn ${y0}px, có mốc nội dung)`, y0 > 20 && !!pr);
        if (!(y0 > 20 && pr)) { await S.ctx.close(); continue; }
        await lay.open(p); await p.waitForFunction(() => true); for (let i = 0; i < 40 && !(await lay.isOpen(p)); i++) await p.waitForTimeout(50);
        check(`${lay.name}: mở được`, await lay.isOpen(p));
        await idle(p); await settle(p, 20);
        if (lay.anchor) check(`${lay.name}: nằm trong vùng nhìn thấy, dính đáy vùng nhìn thấy theo bề rộng khung`, await lay.anchor(p));
        const yOpen = await sy(p); const tOpen = await probeNow(p);
        check(`${lay.name}: vừa mở nền không nhảy (scrollY ${yOpen} so với ${y0}; mốc "${pr.text.slice(0, 20)}" ${tOpen === null ? 'mất' : tOpen.toFixed(0)} so với ${pr.top.toFixed(0)})`, near(yOpen, y0, 1) && tOpen !== null && near(tOpen, pr.top, 1));
        await wheel(p, 200, 195); await wheel(p, -200, 195); const yW = await wheel(p, 200, 30);
        const tW = await probeNow(p);
        check(`${lay.name}: lăn khi lớp đang mở thì nền đứng yên (scrollY ${yW}, mốc ${tW === null ? 'mất' : tW.toFixed(0)})`, near(yW, y0, 1) && tW !== null && near(tW, pr.top, 1));
        if (lay.scrim) { const vp = p.viewportSize(); await p.mouse.click(vp.width / 2, 8); for (let i = 0; i < 30 && (await lay.isOpen(p)); i++) await p.waitForTimeout(50);
          check(`${lay.name}: chạm lớp tối ở mép trên màn hình thì đóng`, !(await lay.isOpen(p)));
          const yS = await settle(p, 20); check(`${lay.name}: đóng bằng chạm lớp tối, vị trí cũ giữ nguyên (${yS} so với ${y0})`, near(yS, y0, 1));
          await lay.open(p); for (let i = 0; i < 40 && !(await lay.isOpen(p)); i++) await p.waitForTimeout(50); }
        if (lay.close === 'back') await p.goBack(); else { const b = await btn(p, lay.close); if (b) await b.click(); }
        for (let i = 0; i < 40 && (await lay.isOpen(p)); i++) await p.waitForTimeout(50);
        await idle(p);
        check(`${lay.name}: đóng được`, !(await lay.isOpen(p)));
        const yC = await settle(p, 30); const tC = await probeNow(p);
        check(`${lay.name}: đóng xong giữ đúng vị trí cũ, không nhảy (scrollY ${yC} so với ${y0}; mốc ${tC === null ? 'mất' : tC.toFixed(0)} so với ${pr.top.toFixed(0)})`, near(yC, y0, 1) && tC !== null && near(tC, pr.top, 1));
        const yA = await wheel(p, 40); check(`${lay.name}: đóng xong lăn lại bình thường (scrollY ${yA})`, yA !== y0 && yA > 0);
        const inner = await innerScrolled(p); check(`${lay.name}: đóng xong không để lại khung con đang cuộn`, inner.length === 0, inner.join('; '));
        await S.ctx.close();
      }
      // lớp xếp chồng: ngăn kéo rồi chat? không có đường mở chồng chung; đủ ba lớp trên
    }

    /* ===== 6. chat AI ===== */
    if (wants(6)) { crit = 6;
      for (const W of [390, 1024]) {
        const S = await mk({ viewport: { width: W, height: 640 } }); const p = S.page;
        await goTabTap(p, 'Ngân sách'); await wheel(p, 100); await tap(p, 'AI');
        for (let i = 0; i < 40 && !(await btn(p, 'Đóng')); i++) await p.waitForTimeout(50);
        await idle(p); const cb = await btn(p, 'Đóng'); check(`${W}px: chat AI mở ra, thấy nút "Đóng"`, !!cb);
        if (cb) {
          const r = await cb.evaluate((e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, vh: innerHeight }; });
          check(`${W}px: nút "Đóng" của chat nằm trong vùng nhìn thấy, ở nửa trên (top ${r.top.toFixed(0)})`, r.top >= 0 && r.bottom < r.vh / 2);
          const box = await p.evaluate(() => { const shown = (e) => { for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) < 0.05 || a.hasAttribute('inert') || a.getAttribute('aria-hidden') === 'true') return false; } return true; }; const ins = [...document.querySelectorAll('textarea,input[type="text"],input:not([type]),[contenteditable="true"],[role="textbox"]')].map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ e, r }) => shown(e) && r.width > 40 && r.height > 10); const x = ins.sort((a, b) => b.r.bottom - a.r.bottom)[0]; return x ? { bottom: x.r.bottom, top: x.r.top, vh: innerHeight } : null; });
          check(`${W}px: ô nhập tin nhắn thấy trọn trong màn hình, sát đáy vùng nhìn (đáy ${box ? box.bottom.toFixed(0) : '?'} / ${box ? box.vh : '?'})`, !!box && box.top >= 0 && box.bottom <= box.vh + 1 && box.bottom >= box.vh - 80);
          const sc = await sy(p); await wheel(p, 300); check('Chat mở: lăn không làm nền trôi', near(await sy(p), sc, 1));
          await cb.click(); for (let i = 0; i < 40 && (await btn(p, 'Đóng')); i++) await p.waitForTimeout(50);
          await idle(p); const yy = await settle(p, 20); check(`${W}px: đóng chat, nền về đúng vị trí (${yy} so với ${sc})`, near(yy, sc, 1));
        }
        await S.ctx.close();
      }
    }

    /* ===== 7. không cuộn ngang, khung tối đa 768px ===== */
    if (wants(7)) { crit = 7;
      for (const W of [320, 360, 390, 768, 1024, 1280]) {
        const S = await mk({ viewport: { width: W, height: 500 } }); const p = S.page;
        for (const [name] of TABS) {
          await goTabTap(p, name); await toEnd(p); await p.mouse.wheel(200, 0); await settle(p, 6);
          const m = await p.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, cw: document.documentElement.clientWidth, x: Math.round(scrollX), bsw: document.body.scrollWidth }));
          check(`${W}px, ${name}: không cuộn ngang (scrollWidth ${m.sw}, màn ${m.cw}, scrollX ${m.x})`, m.sw <= m.cw && m.bsw <= m.cw && m.x === 0);
        }
        const tb = await tabBarBox(p); const ew = Math.min(W, 768);
        check(`${W}px: khung rộng ${ew}px (thanh tab ${tb ? (tb.r - tb.l).toFixed(0) : '?'}), căn giữa`, !!tb && near(tb.r - tb.l, ew, 2.5) && near(tb.l, (W - ew) / 2, 2.5));
        const y = await sy(p); await toTop(p); const y2 = await wheel(p, 150, W / 2); check(`${W}px: lăn giữa khung thì document cuộn (${y2})`, y2 > 0);
        await S.ctx.close();
      }
    }
    /* ===== 8. khối gợi ý cài ẩn khi kéo nội dung lên, hiện khi kéo xuống ===== */
    if (wants(8)) { crit = 8;
      const S = await mk({ viewport: SHORT, ua: IOS_UA }); const p = S.page;
      const vis = async () => { await idle(p); await settle(p, 12); return hintVisible(p); };
      await goTabTap(p, 'Kế hoạch'); await toTop(p);
      check('Ở đầu trang: khối gợi ý hiện', await vis());
      let y = await wheel(p, 4); check(`Kéo lên 4px (dưới ngưỡng 8px, scrollY ${y}): khối vẫn hiện`, await vis());
      y = await wheel(p, 40); const pr = await probe(p); const before = await sy(p);
      check(`Kéo nội dung lên thêm 40px (scrollY ${y}): khối ẩn`, !(await vis()));
      check('Khối ẩn không làm scrollY đổi và không làm nội dung dịch', near(await sy(p), before, 1) && (!pr || near((await probeNow(p)) ?? -999, pr.top, 1)));
      check('Khối đang ẩn không nhận chạm: nút "Không nhắc lại" không chạm được', (await btn(p, 'Không nhắc lại')) === null);
      y = await wheel(p, -4); check(`Kéo xuống 4px (dưới ngưỡng, scrollY ${y}): khối vẫn ẩn`, !(await vis()));
      y = await wheel(p, -40); check(`Kéo nội dung xuống thêm 40px (scrollY ${y}): khối hiện lại`, await vis());
      await wheel(p, 60); check('Kéo lên lại: khối ẩn', !(await vis()));
      await toTop(p); check('Về đầu trang: khối hiện lại', await vis());
      // cuối trang: ẩn rồi đứng yên, không dao động
      await toEnd(p); const e1 = await sy(p); check('Kéo tới cuối trang: khối ẩn', !(await vis()));
      await p.waitForTimeout(600); check(`Ở cuối trang khối ẩn không làm trang dao động (scrollY ${e1} -> ${await sy(p)}, vẫn ẩn)`, near(await sy(p), e1, 1) && !(await hintVisible(p)));
      const cov = await coveredText(p, 'bottom', await barTopOf(p)); check('Khối ẩn ở cuối trang: không chữ nào bị che', cov.length === 0, cov.slice(0, 2).join('; '));
      const tb = await tabBarBox(p); check('Khối ẩn: thanh tab vẫn dính đáy', !!tb && near(tb.bottom, tb.vh, 1.5));
      await wheel(p, -30); check('Từ cuối trang kéo xuống 30px: khối hiện', await vis());
      // lớp mở: ẩn; đóng lớp: về đúng trạng thái trước khi mở
      await wheel(p, 40); check('Chuẩn bị: khối đang ẩn', !(await vis()));
      await tap(p, 'Mở menu'); for (let i = 0; i < 40 && !(await btn(p, 'Đóng menu')); i++) await p.waitForTimeout(50);
      check('Mở ngăn kéo: khối ẩn', !(await vis()));
      const cb = await btn(p, 'Đóng menu'); if (cb) await cb.click(); for (let i = 0; i < 40 && (await btn(p, 'Đóng menu')); i++) await p.waitForTimeout(50);
      check('Đóng ngăn kéo: khối trở về trạng thái ẩn như trước khi mở (không tự hiện)', !(await vis()));
      await wheel(p, -30); check('Sau khi đóng lớp, kéo xuống 30px: khối hiện', await vis());
      // đổi trang: khôi phục vị trí không tính là kéo của người dùng
      await goTabTap(p, 'Ngân sách'); await wheel(p, 120); await vis();
      await goTabTap(p, 'Kế hoạch'); check('Đổi sang trang khác: khối hiện', await vis());
      await goTabTap(p, 'Ngân sách'); check(`Quay lại trang đã cuộn (scrollY ${await sy(p)}): khôi phục vị trí không làm khối ẩn`, (await sy(p)) > 20 && await vis());
      await toTop(p); await vis();
      const dn = await btn(p, 'Không nhắc lại'); check('Ở đầu trang chạm được "Không nhắc lại"', !!dn);
      if (dn) { await dn.click(); await p.waitForTimeout(300); check('Bấm "Không nhắc lại": khối biến mất', (await p.getByRole('region', { name: 'Thêm Tơ Hồng vào màn hình chính' }).count()) === 0); }
      await S.ctx.close();
    }
  } catch (e) {
    console.log('  XX [lỗi chạy] ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); fails.push(`[TC${crit}] lỗi chạy: ${String(e.message || e).split('\n')[0].slice(0, 160)}`);
  } finally { await browser.close().catch(() => {}); await srv.close().catch(() => {}); }
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
