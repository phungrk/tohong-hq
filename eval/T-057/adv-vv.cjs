#!/usr/bin/env node
/*
 * Eval đối kháng (tầng 3) của T-057, spec products/T-056-chrome-ios-thanh-tab.md. visualViewport giả như eval/T-056/check_vv.cjs.
 *   --case 1  thanh Chrome 83px, cuối trang cả 4 tab (Trang chủ, Ngân sách không có trong TC4): không chữ nào bị thanh tab che, không chữ nào nằm sau thanh Chrome mà không cuộn tới được (hành vi 1, ý định)
 *   --case 2  hành vi 8 với loại ô nhập TC8 không chạm: number/date/email, contenteditable="plaintext-only" -> bù 0; select, input disabled/hidden, contenteditable="false" -> vẫn bù;
 *             ô đang focus bị gỡ khỏi DOM hoặc display:none (không có sự kiện visualViewport) -> bù lại ngay ("tính lại khi focus đổi")
 *   --case 3  hành vi 4, 5 ở biên: scale 1.0001 -> 0; chênh 0.5 / 0.8 -> 0; chênh 1 -> 1; chênh lẻ 83.5 -> đáy đúng 556.5
 * Chạy: cd /home/user/tohong-hq && node eval/T-057/adv-vv.cjs --repo /home/user/tohong-front --case N. Dòng cuối PASS/FAIL, mã 0/1 (2 = không chạy được).
 */
const path = require('path');
const L = require('../T-054/lib.cjs');
const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REPO = arg('--repo') && path.resolve(arg('--repo'));
if (!REPO || !require('fs').existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo'); process.exit(2); }
const CASE = Number(arg('--case'));
if (![1, 2, 3].includes(CASE)) { console.log('FAIL --case 1|2|3'); process.exit(2); }
const { chromium } = L.loadPlaywright(REPO);
const VP = { width: 390, height: 640 };
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1';
const STUB = `(() => { const t = new EventTarget(); const st = { h: null, top: 0, scale: 1 };
  const o = { get height() { return st.h === null ? window.innerHeight : st.h; }, get width() { return window.innerWidth; }, get offsetTop() { return st.top; }, get offsetLeft() { return 0; },
    get pageTop() { return window.scrollY + st.top; }, get pageLeft() { return 0; }, get scale() { return st.scale; },
    addEventListener: (...a) => t.addEventListener(...a), removeEventListener: (...a) => t.removeEventListener(...a), dispatchEvent: (e) => t.dispatchEvent(e) };
  Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => o });
  window.__setVV = (h, top = 0, scale = 1) => { st.h = h; st.top = top; st.scale = scale; t.dispatchEvent(new Event('resize')); t.dispatchEvent(new Event('scroll')); }; })();`;
const TABS = ['Trang chủ', 'Kế hoạch', 'Ngân sách', 'Khách mời'];
const fails = [];
const check = (name, ok, extra) => { console.log(`${ok ? '  ok ' : '  XX '} ${name}${!ok && extra ? '  :: ' + String(extra).slice(0, 400) : ''}`); if (!ok) fails.push(name); };
const near = (a, b, t = 1) => Math.abs(a - b) <= t;
const bar = (p) => p.evaluate((names) => { const bs = names.map((n) => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === n).map((b) => b.getBoundingClientRect()).filter((r) => r.width > 2 && r.left >= 0 && r.left < innerWidth).sort((a, b) => b.top - a.top)[0]);
  if (bs.some((x) => !x)) return null; return { top: Math.min(...bs.map((r) => r.top)), bottom: Math.max(...bs.map((r) => r.bottom)) }; }, TABS);
const waitBottom = (p, want) => p.waitForFunction((w) => { const bs = [...document.querySelectorAll('button')].filter((b) => ['Trang chủ', 'Kế hoạch', 'Ngân sách', 'Khách mời'].includes(b.textContent.trim())).map((b) => b.getBoundingClientRect()).filter((r) => r.width > 2 && r.left >= 0 && r.left < innerWidth);
  return bs.length >= 4 && Math.abs(Math.max(...bs.map((r) => r.bottom)) - w) <= 1; }, want, { timeout: 2000 }).then(() => true, () => false);
async function barAt(p, want) { await waitBottom(p, want); return bar(p); }
const setVV = (p, h, top = 0, scale = 1) => p.evaluate(([a, b, c]) => window.__setVV(a, b, c), [h, top, scale]);
async function toEnd(p) { let last = -1; for (let i = 0; i < 60; i++) { await p.mouse.move(195, 300); await p.mouse.wheel(0, 600); await p.waitForTimeout(80); const y = await p.evaluate(() => Math.round(scrollY)); if (y === last) break; last = y; } await p.waitForTimeout(250); }
async function goTab(p, name) { await p.getByRole('button', { name, exact: true }).last().click(); await p.waitForFunction((n) => [...document.querySelectorAll('button[aria-current="page"]')].some((x) => x.textContent.trim() === n), name); await p.waitForTimeout(250); }

(async () => {
  const dist = await L.buildDist(REPO); const srv = await L.serve(dist); const browser = await chromium.launch();
  const open = async (hash) => { const S = await L.scenario(browser, srv.base, { viewport: VP, ua: IOS_UA }); await S.page.addInitScript(STUB); await S.page.goto(srv.base + '#/' + (hash || 'trang-chu')); await S.page.reload(); await S.page.getByRole('button', { name: 'Khách mời', exact: true }).first().waitFor(); await S.page.waitForTimeout(300); return S; };
  try {
    if (CASE === 1) {
      const S = await open(); const p = S.page; await setVV(p, VP.height - 83);
      for (const name of TABS) { await goTab(p, name); await toEnd(p); const b = await barAt(p, VP.height - 83);
        const bad = await p.evaluate(([bt]) => { const out = []; for (const e of document.querySelectorAll('body *')) { if (e.children.length || !(e.textContent || '').trim()) continue; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
          let hid = false; for (let a = e; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || a.getAttribute('aria-hidden') === 'true' || a.hasAttribute('inert')) { hid = true; break; } } if (hid) continue;
          if (r.bottom > bt + 1 && r.top < innerHeight) { const cy = Math.min((Math.max(r.top, bt) + Math.min(r.bottom, innerHeight)) / 2, innerHeight - 1); const t = document.elementFromPoint(r.left + r.width / 2, cy); if (!(t && (e === t || e.contains(t) || t.contains(e)))) out.push(`"${e.textContent.trim().slice(0, 24)}" ${Math.round(r.top)}-${Math.round(r.bottom)} dưới ${t && t.tagName}`); } } return out; }, [b.top]);
        check(`${name}, cuối trang, thanh Chrome 83px: thanh tab ở 557 (${b && b.bottom}) và không chữ nào nằm dưới đỉnh thanh tab (${b && b.top}) mà bị che`, !!b && near(b.bottom, 557) && bad.length === 0, bad.slice(0, 3).join('; ')); }
      await S.ctx.close();
    }
    if (CASE === 2) {
      const S = await open('ke-hoach'); const p = S.page; await toEnd(p); await setVV(p, VP.height - 83); await barAt(p, 557);
      const mk = (tag, attrs) => p.evaluate(([tag, attrs]) => { document.getElementById('adv-x')?.remove(); const e = document.createElement(tag); e.id = 'adv-x'; Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); if (tag === 'select') e.innerHTML = '<option>a</option><option>b</option>';
        e.style.cssText = 'position:absolute;left:0;top:0;width:20px;height:20px;opacity:.01'; document.body.appendChild(e); e.focus(); }, [tag, attrs]);
      const typing = [['input', { type: 'number' }], ['input', { type: 'date' }], ['input', { type: 'email' }], ['input', { type: 'tel' }], ['input', {}], ['div', { contenteditable: 'plaintext-only', tabindex: '0' }], ['div', { contenteditable: '', tabindex: '0' }]];
      for (const [tag, a] of typing) { await mk(tag, a); const b = await barAt(p, 640); check(`focus <${tag} ${JSON.stringify(a)}>: ô nhập chữ, bù 0, thanh tab sát đáy cửa sổ (đáy ${b && b.bottom}, cần 640)`, !!b && near(b.bottom, 640));
        await p.evaluate(() => document.getElementById('adv-x').blur()); const b2 = await barAt(p, 557); check(`  hết focus: bù lại (đáy ${b2 && b2.bottom}, cần 557)`, !!b2 && near(b2.bottom, 557)); }
      const nonTyping = [['input', { type: 'radio' }], ['input', { type: 'range' }], ['input', { type: 'color' }], ['input', { type: 'text', disabled: '' }], ['input', { type: 'hidden' }], ['div', { contenteditable: 'false', tabindex: '0' }], ['a', { href: '#x' }]];
      for (const [tag, a] of nonTyping) { await mk(tag, a); await p.waitForTimeout(150); const b = await barAt(p, 557); check(`focus <${tag} ${JSON.stringify(a)}>: không phải ô nhập chữ, vẫn bù (đáy ${b && b.bottom}, cần 557)`, !!b && near(b.bottom, 557)); await p.evaluate(() => document.getElementById('adv-x').blur()); }
      await p.evaluate(() => document.getElementById('adv-x')?.remove());
      await mk('input', { type: 'text' }); await barAt(p, 640); await p.evaluate(() => document.getElementById('adv-x').remove()); let b = await barAt(p, 557);
      check(`ô nhập đang focus bị gỡ khỏi DOM, không có sự kiện visualViewport: bù lại (đáy ${b && b.bottom}, cần 557)`, !!b && near(b.bottom, 557));
      await mk('textarea', {}); await barAt(p, 640); await p.evaluate(() => { document.getElementById('adv-x').style.display = 'none'; }); b = await barAt(p, 557);
      check(`ô nhập đang focus bị ẩn (display:none), không có sự kiện visualViewport: bù lại (đáy ${b && b.bottom}, cần 557)`, !!b && near(b.bottom, 557));
      await p.evaluate(() => document.getElementById('adv-x')?.remove());
      await mk('input', { type: 'text' }); await barAt(p, 640); await mk('input', { type: 'search' }); await p.waitForTimeout(300); b = await bar(p);
      check(`chuyển focus thẳng từ ô nhập này sang ô nhập khác: vẫn bù 0, không nháy về 557 (đáy ${b && b.bottom})`, !!b && near(b.bottom, 640));
      await S.ctx.close();
    }
    if (CASE === 3) {
      const S = await open('ngan-sach'); const p = S.page; await toEnd(p);
      for (const [h, s, want, label] of [[557, 1.0001, 640, 'scale 1.0001 (khác 1): không bù'], [557, 0.9999, 640, 'scale 0.9999: không bù'], [557, 1, 557, 'scale 1, chênh 83: bù'], [639.5, 1, 640, 'chênh 0.5px: coi là 0'], [639.2, 1, 640, 'chênh 0.8px: coi là 0'], [639, 1, 639, 'chênh 1px: bù 1'], [556.5, 1, 556.5, 'chênh 83.5px: đáy 556.5'], [700, 1, 640, 'vv cao hơn innerHeight (chênh âm): không bù, không đẩy xuống'], [500, 200, 640, 'offsetTop lớn, offsetTop+height > innerHeight: không bù']]) {
        await setVV(p, h, h === 500 ? 200 : 0, s); await p.waitForTimeout(150); const b = await barAt(p, want);
        check(`${label} (đáy ${b && b.bottom}, cần ${want})`, !!b && near(b.bottom, want, 0.6)); }
      await S.ctx.close();
    }
  } catch (e) { console.log('  XX [lỗi chạy] ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')); fails.push('lỗi chạy'); }
  finally { await browser.close().catch(() => {}); await srv.close().catch(() => {}); }
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1})` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
