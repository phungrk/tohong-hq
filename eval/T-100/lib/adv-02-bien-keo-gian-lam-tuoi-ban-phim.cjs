// Eval đối kháng T-100 (adversary, tầng 3) cho spec products/T-096-drawer-tab-keo-rong.md mục B, C, D, E.
// Ca biên eval tầng 1 (eval/T-096/check.cjs) chưa chạm:
//  A. localStorage kr-drawer-width hỏng ("abc", "-5", "0", "", "99999") hoặc getItem/setItem ném lỗi: bề rộng nằm trong [min, max], kéo vẫn chạy, không lỗi JS (D: "lỗi ghi/đọc thì bỏ qua").
//  B. Cửa sổ hẹp hơn 560/0.9 (600px, 520px): min = max, End/Home không đổi, trang không cuộn ngang, nút đóng trọn trong khung nhìn (D).
//  C. Đổi cỡ cửa sổ khi drawer đang mở: 1280 -> 400 (full màn, tay nắm ẩn, ra khỏi vòng Tab) -> 1280 (về bề rộng đã lưu); số dòng đang hiện giữ (C: không reset khi đổi cỡ).
//  D. Làm tươi khi danh sách co lại dưới limit (hiện min(n, limit), nút mất, focus không rơi về body) và khi danh sách dài thêm (giữ limit, N mới).
//  E. Home/End trên tab ĐANG được chọn không phải "đổi tab" nên không reset limit (C: reset chỉ khi đổi tab, đóng/mở, đổi bộ chọn).
//  F. Vòng Tab và Shift+Tab ở 1280 có tay nắm, bỏ tab không chọn.
// Chạy: cd /home/user/tohong-hq && TOHONG_DASHBOARD_REPO=<repo dashboard> D3=/đường/dẫn/d3.min.js NODE_PATH=$(npm root -g) bash eval/T-100/adv-02-bien-keo-gian-lam-tuoi-ban-phim.sh (gọi lib/ này) [--only A,B,...]
// In PASS hoặc FAIL <lý do>, mã thoát 0/1.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const D3 = process.env.D3; if (!D3) { console.log('FAIL cần biến D3'); process.exit(1); }
const REPO = path.resolve(process.env.TOHONG_DASHBOARD_REPO || '/home/user/tohong-hq-dashboard');
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const run = k => !ONLY || ONLY.includes(k);

const base = { title: 'Việc thử', state: 'doing', holder: 'engineering', owner: 'engineering', reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0, created: '2026-10-30T09:00', updated: new Date(Date.now() + 7 * 3600e3 - 3600e3).toISOString().slice(0, 16), hours_since_update: 1, tier: 'A', evals: 1, spec_returns: 0, evals_added: 0 };
const tasks = [{ ...base, id: 'T-1', area: 'planner/front', product: 'planner' }, { ...base, id: 'T-2', area: 'hq/dashboard', product: 'hq' }];
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const GH = 'https://github.com/phungrk/tohong-hq/blob/main/';
const pad = (n, k = 3) => String(n).padStart(k, '0');
const INV = []; for (let i = 1; i <= 25; i++) INV.push({ area: 'hq/dashboard', id: 'INV-' + pad(i), slug: 's' + i, name: 'Bất biến mẫu ' + i, source: 'T-' + (200 + i), url: GH + 'eval/invariants/hq/dashboard/inv-' + pad(i) + '.sh' });
const mkAdv = n => { const a = []; for (let i = 0; i < n; i++) a.push({ id: 'adv-' + pad(i + 1, 2), file: 'adv-' + pad(i + 1, 2) + '.sh', name: 'Eval đối kháng mẫu ' + (i + 1), source: 'T-' + (500 - i), url: GH + 'eval/T-' + (500 - i) + '/adv-' + pad(i + 1, 2) + '.sh' }); return a; };
const REG = []; for (let i = 0; i < 3; i++) REG.push({ id: 'reg-' + i, file: 'reg-' + i + '.sh', name: 'Hồi quy mẫu ' + i, source: '', url: GH + 'eval/regression/reg-' + i + '.sh' });
const mkModel = nAdv => { const A = mkAdv(nAdv); return { invariants: { 'hq/dashboard': INV.length }, invariants_total: INV.length, invariant_list: INV, adversarial_evals: A.length, adversarial_list: A, regression_evals: REG.length, regression_list: REG, specs: 1, insight_reports: 0, last_insight: '' }; };
const mkData = m => ({ generated_at: '2026-11-08T10:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster, capu_queue: [], model: m });

let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } };
async function open(browser, vp, model, o2 = {}) {
  const ctx = await browser.newContext({ viewport: vp }); const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const o = { page, ctx, errors, data: mkData(model) };
  if (o2.init) await page.addInitScript(o2.init, o2.initArg);
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(o.data) }));
  await page.routeWebSocket(/\/ws$/, ws => ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })));
  if (o2.clock) await page.clock.install();
  await page.goto('file://' + path.join(REPO, 'index.html')); await page.waitForTimeout(1300);
  return o;
}
const openDrawer = async page => {
  const p = await page.evaluate(() => { const g = document.getElementById('nd_kr'); if (!g) return null; const sh = g.querySelector(':scope > rect') || g; sh.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); const r = sh.getBoundingClientRect();
    for (let j = 1; j < 14; j++) for (let i = 1; i < 14; i++) { const x = r.left + r.width * i / 14, y = r.top + r.height * j / 14; if (x < 2 || y < 2 || x > innerWidth - 2 || y > innerHeight - 2) continue; const e = document.elementFromPoint(x, y); if (e && e.closest('#nd_kr') && !e.closest('#chars')) return { x, y }; } return null; });
  if (!p) return false; await page.mouse.click(p.x, p.y); await page.waitForTimeout(350); return true; };
const isOpen = page => page.evaluate(() => { const d = document.getElementById('kr-drawer'); return !!d && !d.hidden && getComputedStyle(d).display !== 'none'; });
const st = page => page.evaluate(() => {
  const d = document.getElementById('kr-drawer'), pn = d.querySelector('[data-kr-panel]'), h = document.getElementById('kr-drawer-resize'), c = document.getElementById('kr-drawer-close');
  const hr = h && h.getBoundingClientRect(), cr = c.getBoundingClientRect();
  return { w: pn.getBoundingClientRect().width, vw: innerWidth, docW: document.documentElement.scrollWidth, overflow: pn.scrollWidth - pn.clientWidth,
    hDisp: h ? getComputedStyle(h).display : 'none', hW: hr ? hr.width : 0, hL: hr ? hr.left : 0, min: h && h.getAttribute('aria-valuemin'), max: h && h.getAttribute('aria-valuemax'), now: h && h.getAttribute('aria-valuenow'),
    closeIn: cr.left >= 0 && cr.right <= innerWidth + 0.5 && cr.top >= 0,
    rows: d.querySelectorAll('[data-kr-inv],[data-kr-adv],[data-kr-reg]').length, more: [...d.querySelectorAll('[data-kr-more]')].map(e => e.textContent.replace(/\s+/g, ' ').trim()),
    sel: (d.querySelector('[data-kr-tab][aria-selected=true]') || {}).getAttribute && d.querySelector('[data-kr-tab][aria-selected=true]').getAttribute('data-kr-tab'),
    active: document.activeElement === document.body ? 'BODY' : (document.activeElement.id || document.activeElement.getAttribute('data-kr-tab') || (document.activeElement.hasAttribute('data-kr-more') ? 'more' : document.activeElement.tagName)),
    activeIn: d.contains(document.activeElement) };
});
const clickSel = async (page, sel) => { const p = await page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel); if (!p) return false; await page.mouse.click(p.x, p.y); await page.waitForTimeout(200); return true; };

(async () => {
  const browser = await chromium.launch();
  try {
    // A. localStorage hỏng
    if (run('A')) {
      for (const bad of ['abc', '-5', '0', '', 'NaN', '99999']) {
        const o = await open(browser, { width: 1280, height: 800 }, mkModel(23), { init: v => { try { localStorage.setItem('kr-drawer-width', v); } catch (e) {} }, initArg: bad }); const p = o.page;
        ok(await openDrawer(p) && await isOpen(p), `A[${bad}]: mở được drawer`); const s = await st(p);
        const want = bad === '99999' ? 1152 : 560;
        ok(Math.abs(s.w - want) <= 1, `A: localStorage kr-drawer-width=${JSON.stringify(bad)} phải cho bề rộng ${want} (kẹp/bỏ qua), thấy ${s.w}`);
        ok(s.w >= 560 - 1 && s.w <= 1152 + 1 && s.now === String(Math.round(s.w)), `A[${bad}]: bề rộng trong [560,1152] và aria-valuenow khớp, thấy ${s.w}/${s.now}`);
        ok(o.errors.length === 0, `A[${bad}]: lỗi JS ${o.errors.join(' | ')}`); await o.ctx.close();
      }
      const thrower = () => { const P = Storage.prototype; P.getItem = function () { throw new Error('SecurityError'); }; P.setItem = function () { throw new Error('QuotaExceeded'); }; };
      const o = await open(browser, { width: 1280, height: 800 }, mkModel(23), { init: thrower }); const p = o.page;
      ok(await openDrawer(p) && await isOpen(p), 'A[throw]: localStorage ném lỗi vẫn mở được drawer'); let s = await st(p); ok(Math.abs(s.w - 560) <= 1, `A[throw]: mặc định 560, thấy ${s.w}`);
      await p.focus('#kr-drawer-resize'); for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowLeft'); s = await st(p);
      ok(Math.abs(s.w - 660) <= 1, `A[throw]: setItem ném lỗi thì vẫn đổi bề rộng bằng bộ nhớ trong (660), thấy ${s.w}`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(200); await openDrawer(p); s = await st(p); ok(Math.abs(s.w - 660) <= 1, `A[throw]: đóng/mở giữ 660 (bộ nhớ trong), thấy ${s.w}`);
      ok(o.errors.length === 0, 'A[throw]: lỗi JS ' + o.errors.join(' | ')); await o.ctx.close();
    }
    // B. cửa sổ hẹp hơn 560/0.9
    if (run('B')) {
      for (const vw of [600, 560, 520, 481]) {
        const o = await open(browser, { width: vw, height: 800 }, mkModel(23), { init: () => localStorage.setItem('kr-drawer-width', '900') }); const p = o.page;
        await openDrawer(p); let s = await st(p); const mn = Math.min(560, vw), mx = Math.max(mn, Math.round(vw * 0.9));
        ok(Math.abs(s.w - Math.min(mx, 900)) <= 1, `B ${vw}px: lưu 900 phải kẹp ${Math.min(mx, 900)}, thấy ${s.w}`);
        ok(s.min === String(mn) && s.max === String(mx), `B ${vw}px: aria-valuemin/max phải ${mn}/${mx}, thấy ${s.min}/${s.max}`);
        await p.focus('#kr-drawer-resize'); await p.keyboard.press('End'); s = await st(p); ok(Math.abs(s.w - mx) <= 1, `B ${vw}px: End = max ${mx}, thấy ${s.w}`);
        await p.keyboard.press('ArrowLeft'); s = await st(p); ok(Math.abs(s.w - mx) <= 1, `B ${vw}px: ArrowLeft ở max giữ ${mx}, thấy ${s.w}`);
        ok(s.docW <= vw && s.overflow <= 0 && s.closeIn, `B ${vw}px: không cuộn ngang, không tràn, nút đóng trọn khung (doc ${s.docW}, overflow ${s.overflow}, close ${s.closeIn})`);
        ok(await isOpen(p), `B ${vw}px: phím trên tay nắm không đóng`);
        ok(o.errors.length === 0, `B ${vw}px: lỗi JS ${o.errors.join(' | ')}`); await o.ctx.close();
      }
    }
    // C. đổi cỡ cửa sổ khi đang mở
    if (run('C')) {
      const o = await open(browser, { width: 1280, height: 800 }, mkModel(23)); const p = o.page;
      await openDrawer(p); await p.focus('#kr-drawer-resize'); await p.keyboard.press('Home'); for (let i = 0; i < 12; i++) await p.keyboard.press('ArrowLeft');
      await clickSel(p, '[data-kr-tab="adversarial"]'); await clickSel(p, '#kr-drawer [data-kr-more]'); let s = await st(p); ok(s.rows === 20, `C: trước đổi cỡ 20 dòng, thấy ${s.rows}`);
      await p.setViewportSize({ width: 400, height: 800 }); await p.waitForTimeout(300); s = await st(p);
      ok(Math.abs(s.w - 400) <= 1 && s.docW <= 400 && s.overflow <= 0, `C: thu còn 400 khi đang mở phải full màn không tràn, thấy w ${s.w} doc ${s.docW}`);
      ok(s.hDisp === 'none' || s.hW === 0, `C: 400px tay nắm phải ẩn, thấy display ${s.hDisp} w ${s.hW}`);
      ok(s.rows === 20 && await isOpen(p), `C: đổi cỡ không reset số dòng (20) và không đóng, thấy ${s.rows}`);
      const seen = new Set(); for (let i = 0; i < 30; i++) { await p.keyboard.press('Tab'); seen.add((await st(p)).active); }
      ok(!seen.has('kr-drawer-resize') && !seen.has('BODY'), `C: 400px vòng Tab không có tay nắm và không rơi ra body, thấy ${[...seen]}`);
      await p.setViewportSize({ width: 1280, height: 800 }); await p.waitForTimeout(300); s = await st(p);
      ok(Math.abs(s.w - 800) <= 1 && s.now === '800' && s.max === '1152' && s.hW >= 12, `C: phóng lại 1280 về 800 đã lưu, tay nắm hiện, aria 800/1152; thấy w ${s.w} now ${s.now} max ${s.max} hW ${s.hW}`);
      ok(s.rows === 20, `C: phóng lại vẫn 20 dòng, thấy ${s.rows}`);
      ok(o.errors.length === 0, 'C: lỗi JS ' + o.errors.join(' | ')); await o.ctx.close();
    }
    // D. làm tươi khi danh sách co / giãn
    if (run('D')) {
      const o = await open(browser, { width: 1280, height: 800 }, mkModel(23), { clock: true }); const p = o.page;
      await openDrawer(p); await clickSel(p, '[data-kr-tab="adversarial"]'); await clickSel(p, '#kr-drawer [data-kr-more]'); let s = await st(p);
      ok(s.rows === 20 && s.more[0] === 'Xem thêm · còn 3' && s.active === 'more', `D: 23 mục, bấm một lần: 20 dòng, "còn 3", focus ở nút; thấy ${s.rows} ${JSON.stringify(s.more)} ${s.active}`);
      o.data = mkData(mkModel(15)); await p.clock.fastForward(61000); await p.waitForTimeout(800); s = await st(p);
      ok(s.rows === 15 && s.more.length === 0, `D: làm tươi còn 15 mục (< limit 20): hiện 15, không nút; thấy ${s.rows} ${JSON.stringify(s.more)}`);
      ok(s.activeIn && s.active !== 'BODY', `D: nút có focus biến mất do làm tươi thì focus không rơi khỏi drawer, thấy ${s.active}`);
      ok(s.sel === 'adversarial', `D: làm tươi giữ tab, thấy ${s.sel}`);
      o.data = mkData(mkModel(40)); await p.clock.fastForward(61000); await p.waitForTimeout(800); s = await st(p);
      ok(s.rows === 20 && s.more[0] === 'Xem thêm · còn 20', `D: làm tươi dài lại 40 mục: giữ limit 20, "còn 20"; thấy ${s.rows} ${JSON.stringify(s.more)}`);
      o.data = mkData(mkModel(0)); await p.clock.fastForward(61000); await p.waitForTimeout(800); s = await st(p);
      ok(s.rows === 0 && s.more.length === 0, `D: làm tươi rỗng: không dòng không nút, thấy ${s.rows}`);
      o.data = mkData(mkModel(40)); await p.clock.fastForward(61000); await p.waitForTimeout(800); s = await st(p);
      ok(s.rows === 20, `D: rỗng rồi có lại 40: limit vẫn 20 (không reset khi làm tươi), thấy ${s.rows}`);
      ok(o.errors.length === 0, 'D: lỗi JS ' + o.errors.join(' | ')); await o.ctx.close();
    }
    // E. Home/End trên tab đang chọn
    if (run('E')) {
      const o = await open(browser, { width: 1280, height: 800 }, mkModel(23)); const p = o.page;
      await openDrawer(p); await clickSel(p, '#kr-drawer [data-kr-more]'); let s = await st(p); ok(s.rows === 20 && s.sel === 'invariants', `E: tab Bất biến 20 dòng, thấy ${s.rows}`);
      await p.focus('[data-kr-tab="invariants"]'); await p.keyboard.press('Home'); await p.waitForTimeout(150); s = await st(p);
      ok(s.rows === 20, `E: Home khi tab đầu đã được chọn không phải đổi tab, không được reset Xem thêm (20 dòng), thấy ${s.rows}`);
      ok(s.active === 'invariants', `E: focus giữ ở tab, thấy ${s.active}`);
      await clickSel(p, '[data-kr-tab="regression"]'); await p.focus('[data-kr-tab="regression"]'); await p.keyboard.press('End'); await p.waitForTimeout(150); s = await st(p);
      ok(s.sel === 'regression' && s.rows === 3, `E: End ở tab cuối giữ tab, thấy ${s.sel} ${s.rows}`);
      // nhất quán với bấm chuột vào tab đang chọn
      await clickSel(p, '[data-kr-tab="adversarial"]'); await clickSel(p, '#kr-drawer [data-kr-more]'); await clickSel(p, '[data-kr-tab="adversarial"]'); s = await st(p);
      ok(s.rows === 20, `E: bấm chuột lại tab đang chọn không reset (20), thấy ${s.rows}`);
      ok(o.errors.length === 0, 'E: lỗi JS ' + o.errors.join(' | ')); await o.ctx.close();
    }
    // F. vòng Tab / Shift+Tab ở 1280
    if (run('F')) {
      const o = await open(browser, { width: 1280, height: 800 }, mkModel(23)); const p = o.page; await openDrawer(p);
      const fw = [], bw = [];
      for (let i = 0; i < 16; i++) { await p.keyboard.press('Tab'); fw.push((await st(p)).active); }
      for (let i = 0; i < 16; i++) { await p.keyboard.press('Shift+Tab'); bw.push((await st(p)).active); }
      ok(fw.includes('kr-drawer-resize') && bw.includes('kr-drawer-resize'), `F: Tab và Shift+Tab đều đi qua tay nắm, thấy ${fw} / ${bw}`);
      ok(![...fw, ...bw].some(x => x === 'adversarial' || x === 'regression' || x === 'BODY'), `F: không dừng ở tab không chọn hay body, thấy ${fw} / ${bw}`);
      ok(o.errors.length === 0, 'F: lỗi JS ' + o.errors.join(' | ')); await o.ctx.close();
    }
  } catch (e) { fails++; console.log('FAIL lỗi chạy eval: ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join(' ')); }
  await browser.close();
  if (fails) process.exit(1); console.log('PASS');
})();
