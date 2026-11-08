// Eval đối kháng T-100 (adversary, tầng 3, lần 3) cho spec products/T-096-drawer-tab-keo-rong.md mục B, C: luồng mũi tên đổi tab sau bản sửa chọn-lại-tab.
// H. Mũi tên/Home/End sang tab KHÁC: chọn tab, focus theo tab, limit về 10; quay lại tab cũ cũng về 10; sau đó Xem thêm giữ focus ở nút; làm tươi giữ focus ở tab vừa chọn.
//    Xen kẽ Home trên tab đang chọn (không đổi tab, giữ limit) với mũi tên đổi tab.
// G. Home/End/mũi tên trên tab ĐANG chọn (không đổi tab) rồi bấm Xem thêm: nút còn thì focus ở lại nút (mục C), không nhảy về tab;
//    rồi làm tươi dữ liệu: focus không bị kéo về tab.
// (Phần mô tả A-F dưới đây là của adv-02, giữ để tham chiếu harness.)
// Ca biên eval tầng 1 (eval/T-096/check.cjs) chưa chạm:
//  A. localStorage kr-drawer-width hỏng ("abc", "-5", "0", "", "99999") hoặc getItem/setItem ném lỗi: bề rộng nằm trong [min, max], kéo vẫn chạy, không lỗi JS (D: "lỗi ghi/đọc thì bỏ qua").
//  B. Cửa sổ hẹp hơn 560/0.9 (600px, 520px): min = max, End/Home không đổi, trang không cuộn ngang, nút đóng trọn trong khung nhìn (D).
//  C. Đổi cỡ cửa sổ khi drawer đang mở: 1280 -> 400 (full màn, tay nắm ẩn, ra khỏi vòng Tab) -> 1280 (về bề rộng đã lưu); số dòng đang hiện giữ (C: không reset khi đổi cỡ).
//  D. Làm tươi khi danh sách co lại dưới limit (hiện min(n, limit), nút mất, focus không rơi về body) và khi danh sách dài thêm (giữ limit, N mới).
//  E. Home/End trên tab ĐANG được chọn không phải "đổi tab" nên không reset limit (C: reset chỉ khi đổi tab, đóng/mở, đổi bộ chọn).
//  F. Vòng Tab và Shift+Tab ở 1280 có tay nắm, bỏ tab không chọn.
// Chạy: cd /home/user/tohong-hq && TOHONG_DASHBOARD_REPO=<repo dashboard> D3=/đường/dẫn/d3.min.js NODE_PATH=$(npm root -g) bash eval/T-100/adv-04-mui-ten-doi-tab-sau-sua.sh [--only A,B,...]
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
    const o = await open(browser, { width: 1280, height: 800 }, mkModel(45), { clock: true }); const p = o.page;
    const press = async k => { await p.keyboard.press(k); await p.waitForTimeout(120); return st(p); };
    await openDrawer(p); await clickSel(p, '[data-kr-tab="adversarial"]'); await clickSel(p, '#kr-drawer [data-kr-more]');
    let s = await st(p); ok(s.rows === 20 && s.sel === 'adversarial', `H: adversarial 20 dòng, thấy ${s.rows}`);
    await p.focus('[data-kr-tab="adversarial"]');
    s = await press('Home'); ok(s.sel === 'invariants' && s.active === 'invariants' && s.rows === 10, `H: Home từ adversarial sang invariants: chọn, focus theo, 10 dòng; thấy ${s.sel}/${s.active}/${s.rows}`);
    s = await press('Home'); ok(s.sel === 'invariants' && s.active === 'invariants', `H: Home lần hai trên tab đang chọn: giữ tab và focus, thấy ${s.sel}/${s.active}`);
    s = await press('ArrowRight'); ok(s.sel === 'adversarial' && s.active === 'adversarial' && s.rows === 10, `H: ArrowRight về adversarial (tab cũ): 10 dòng (reset khi quay lại tab cũ), focus theo; thấy ${s.sel}/${s.active}/${s.rows}`);
    await clickSel(p, '#kr-drawer [data-kr-more]'); s = await st(p); ok(s.rows === 20 && s.active === 'more', `H: sau đổi tab bằng phím, Xem thêm giữ focus ở nút, thấy ${s.rows}/${s.active}`);
    await p.focus('[data-kr-tab="adversarial"]');
    s = await press('End'); ok(s.sel === 'regression' && s.active === 'regression' && s.rows === 3, `H: End sang regression, thấy ${s.sel}/${s.active}/${s.rows}`);
    s = await press('End'); ok(s.sel === 'regression' && s.active === 'regression', `H: End trên tab đang chọn giữ, thấy ${s.sel}/${s.active}`);
    s = await press('ArrowRight'); ok(s.sel === 'invariants' && s.active === 'invariants', `H: ArrowRight ở tab cuối vòng về đầu, thấy ${s.sel}/${s.active}`);
    s = await press('ArrowLeft'); ok(s.sel === 'regression' && s.active === 'regression', `H: ArrowLeft ở tab đầu về cuối, thấy ${s.sel}/${s.active}`);
    s = await press('ArrowLeft'); ok(s.sel === 'adversarial' && s.active === 'adversarial' && s.rows === 10, `H: ArrowLeft sang adversarial: 10 dòng, thấy ${s.sel}/${s.active}/${s.rows}`);
    o.data = mkData(mkModel(46)); await p.clock.fastForward(61000); await p.waitForTimeout(800); s = await st(p);
    ok(s.active === 'adversarial' && s.sel === 'adversarial' && s.rows === 10, `H: làm tươi sau đổi tab bằng phím giữ focus ở tab đang chọn và 10 dòng, thấy ${s.active}/${s.rows}`);
    await p.focus('#kr-drawer-close'); o.data = mkData(mkModel(47)); await p.clock.fastForward(61000); await p.waitForTimeout(800); s = await st(p);
    ok(s.active === 'kr-drawer-close', `H: focus ở nút đóng, làm tươi không kéo về tab, thấy ${s.active}`);
    const tabs = await p.$$eval('#kr-drawer [data-kr-tab]', b => b.map(e => [e.getAttribute('data-kr-tab'), e.getAttribute('tabindex'), e.getAttribute('aria-selected')]));
    ok(JSON.stringify(tabs) === JSON.stringify([['invariants', '-1', 'false'], ['adversarial', '0', 'true'], ['regression', '-1', 'false']]), `H: roving tabindex sau chuỗi phím, thấy ${JSON.stringify(tabs)}`);
    ok(o.errors.length === 0, 'H: lỗi JS ' + o.errors.join(' | ')); await o.ctx.close();
  } catch (e) { fails++; console.log('FAIL lỗi chạy eval: ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join(' ')); }
  await browser.close();
  if (fails) process.exit(1); console.log('PASS');
})();
