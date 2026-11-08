#!/usr/bin/env node
// Thư viện đo bất biến rút từ eval đối kháng của T-100 (eval/T-100/adv-02, adv-03, adv-04; adversary, 2026-11-08), vùng hq/dashboard/model.
// Spec: products/T-096-drawer-tab-keo-rong.md (qua Spec Gate v3) mục B, C, D. Bản cố định, tự đủ, không import từ eval/T-100.
//   node t100_inv.cjs --repo <repo-dashboard> --check <bad-storage|reselect-limit|focus>
//   bad-storage    (INV-044): localStorage kr-drawer-width hỏng hoặc getItem/setItem ném lỗi: bề rộng trong [min, max], kéo bàn phím vẫn chạy, không lỗi JS.
//   reselect-limit (INV-045): chọn lại đúng tab đang chọn (Home/End trên tab đó, bấm chuột lại) không phải đổi tab, không reset Xem thêm.
//   focus          (INV-046): chọn lại tab đang chọn không để focus chờ treo (Xem thêm giữ focus ở nút, làm tươi không kéo focus về tab);
//                             mũi tên/Home/End sang tab khác: chọn, focus theo, limit về 10, vòng tròn, roving tabindex.
// Hợp đồng quan sát (spec T-096): #nd_kr, #kr-drawer, [data-kr-panel], #kr-drawer-resize (aria-valuemin/max/now), #kr-drawer-close,
// [data-kr-tab][aria-selected], [data-kr-inv|adv|reg], button[data-kr-more]. Khoá localStorage 'kr-drawer-width'.
// Áp dụng khi index.html có #kr-drawer-resize hoặc data-kr-tab, hoặc repo có docs/screenshots/T-100/; trước đó PASS "chưa áp dụng".
// Dữ liệu dashboard.json, kênh live (WebSocket) và d3 đều giả/cục bộ; đồng hồ trang giả để làm tươi 60 giây. Mã thoát 0 = đạt.
const fs = require('fs'), path = require('path');
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), CHECK = arg('--check'), INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3.min.js'].find(p => p && fs.existsSync(p));
const CHECKS = ['bad-storage', 'reselect-limit', 'focus'];
if (!CHECKS.includes(CHECK)) { console.log('FAIL --check phải là một trong ' + CHECKS.join(', ')); process.exit(1); }
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO + ' (đặt TOHONG_DASHBOARD_REPO)'); process.exit(1); }
const SRC = fs.readFileSync(INDEX, 'utf8');
if (!/kr-drawer-resize|data-kr-tab/.test(SRC) && !fs.existsSync(path.join(REPO, 'docs', 'screenshots', 'T-100'))) {
  console.log(`PASS ${CHECK} (chưa áp dụng: trang chưa có drawer tab/tay nắm của T-096/T-100)`); process.exit(0);
}
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js'); process.exit(1); }
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('FAIL thiếu playwright: đặt NODE_PATH=$(npm root -g)'); process.exit(1); }

const base = { title: 'Việc thử', state: 'doing', holder: 'engineering', owner: 'engineering', reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-10-30T09:00', updated: new Date(Date.now() + 7 * 3600e3 - 3600e3).toISOString().slice(0, 16), hours_since_update: 1, tier: 'A', evals: 1, spec_returns: 0, evals_added: 0 };
const tasks = [{ ...base, id: 'T-1', area: 'planner/front', product: 'planner' }, { ...base, id: 'T-2', area: 'hq/dashboard', product: 'hq' }];
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const GH = 'https://github.com/phungrk/tohong-hq/blob/main/';
const pad = (n, k = 3) => String(n).padStart(k, '0');
const INV = []; for (let i = 1; i <= 25; i++) INV.push({ area: 'hq/dashboard', id: 'INV-' + pad(i), slug: 's' + i, name: 'Bất biến mẫu ' + i, source: 'T-' + (200 + i), url: GH + 'eval/invariants/hq/dashboard/inv-' + pad(i) + '.sh' });
const mkAdv = n => { const a = []; for (let i = 0; i < n; i++) a.push({ id: 'adv-' + pad(i + 1, 2), file: 'adv-' + pad(i + 1, 2) + '.sh', name: 'Eval đối kháng mẫu ' + (i + 1), source: 'T-' + (500 - i), url: GH + 'eval/T-' + (500 - i) + '/adv-' + pad(i + 1, 2) + '.sh' }); return a; };
const REG = []; for (let i = 0; i < 3; i++) REG.push({ id: 'reg-' + i, file: 'reg-' + i + '.sh', name: 'Hồi quy mẫu ' + i, source: '', url: GH + 'eval/regression/reg-' + i + '.sh' });
const mkModel = nAdv => { const A = mkAdv(nAdv); return { invariants: { 'hq/dashboard': INV.length }, invariants_total: INV.length, invariant_list: INV, adversarial_evals: A.length, adversarial_list: A, regression_evals: REG.length, regression_list: REG, specs: 1, insight_reports: 0, last_insight: '' }; };
const mkData = m => ({ generated_at: '2026-11-08T10:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster, capu_queue: [], model: m });

const fails = []; const ok = (c, m) => { if (!c) fails.push(m); };
async function open(browser, vp, model, o2 = {}) {
  const ctx = await browser.newContext({ viewport: vp }); const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const o = { page, ctx, errors, data: mkData(model) };
  if (o2.init) await page.addInitScript(o2.init, o2.initArg);
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(o.data) }));
  await page.routeWebSocket(/\/ws$/, ws => ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })));
  if (o2.clock) await page.clock.install();
  await page.goto('file://' + INDEX); await page.waitForTimeout(1300);
  return o;
}
const openDrawer = async page => {
  const p = await page.evaluate(() => { const g = document.getElementById('nd_kr'); if (!g) return null; const sh = g.querySelector(':scope > rect') || g; sh.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); const r = sh.getBoundingClientRect();
    for (let j = 1; j < 14; j++) for (let i = 1; i < 14; i++) { const x = r.left + r.width * i / 14, y = r.top + r.height * j / 14; if (x < 2 || y < 2 || x > innerWidth - 2 || y > innerHeight - 2) continue; const e = document.elementFromPoint(x, y); if (e && e.closest('#nd_kr') && !e.closest('#chars')) return { x, y }; } return null; });
  if (!p) return false; await page.mouse.click(p.x, p.y); await page.waitForTimeout(350); return true; };
const isOpen = page => page.evaluate(() => { const d = document.getElementById('kr-drawer'); return !!d && !d.hidden && getComputedStyle(d).display !== 'none'; });
const st = page => page.evaluate(() => {
  const d = document.getElementById('kr-drawer'), pn = d.querySelector('[data-kr-panel]'), h = document.getElementById('kr-drawer-resize');
  const ae = document.activeElement, selTab = d.querySelector('[data-kr-tab][aria-selected=true]');
  return { w: pn.getBoundingClientRect().width, now: h && h.getAttribute('aria-valuenow'),
    rows: d.querySelectorAll('[data-kr-inv],[data-kr-adv],[data-kr-reg]').length, more: [...d.querySelectorAll('[data-kr-more]')].map(e => e.textContent.replace(/\s+/g, ' ').trim()),
    sel: selTab ? selTab.getAttribute('data-kr-tab') : null,
    // đọc data-kr-tab trước id: tab có thể có id (aria-controls) mà hành vi vẫn đúng
    active: !ae || ae === document.body ? 'BODY' : (ae.getAttribute('data-kr-tab') || (ae.hasAttribute('data-kr-more') ? 'more' : ae.id || ae.tagName)) };
});
const clickSel = async (page, sel) => { const p = await page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel); if (!p) return false; await page.mouse.click(p.x, p.y); await page.waitForTimeout(200); return true; };
const refresh = async (o, n) => { o.data = mkData(mkModel(n)); await o.page.clock.fastForward(61000); await o.page.waitForTimeout(800); };

// INV-044: localStorage hỏng / ném lỗi (spec D: "lỗi ghi/đọc thì bỏ qua và dùng bộ nhớ trong"; "Chưa lưu: bề rộng = min"; kẹp [min, max]).
async function badStorage(browser) {
  for (const bad of ['abc', '-5', '0', '', 'NaN', '99999']) {
    const o = await open(browser, { width: 1280, height: 800 }, mkModel(23), { init: v => { try { localStorage.setItem('kr-drawer-width', v); } catch (e) {} }, initArg: bad }); const p = o.page;
    const opened = await openDrawer(p) && await isOpen(p); ok(opened, `[${JSON.stringify(bad)}] không mở được drawer`);
    if (opened) {
      const s = await st(p), want = bad === '99999' ? 1152 : 560;
      ok(Math.abs(s.w - want) <= 1, `kr-drawer-width=${JSON.stringify(bad)} phải cho bề rộng ${want} (bỏ qua/kẹp), thấy ${s.w}`);
      ok(s.w >= 559 && s.w <= 1153 && s.now === String(Math.round(s.w)), `[${JSON.stringify(bad)}] bề rộng ngoài [560,1152] hoặc aria-valuenow lệch: ${s.w}/${s.now}`);
    }
    ok(o.errors.length === 0, `[${JSON.stringify(bad)}] lỗi JS: ${o.errors.join(' | ')}`); await o.ctx.close();
  }
  const thrower = () => { const P = Storage.prototype; P.getItem = function () { throw new Error('SecurityError'); }; P.setItem = function () { throw new Error('QuotaExceeded'); }; };
  const o = await open(browser, { width: 1280, height: 800 }, mkModel(23), { init: thrower }); const p = o.page;
  const opened = await openDrawer(p) && await isOpen(p); ok(opened, '[ném lỗi] localStorage ném lỗi thì không mở được drawer');
  if (opened) {
    let s = await st(p); ok(Math.abs(s.w - 560) <= 1, `[ném lỗi] mặc định phải 560, thấy ${s.w}`);
    await p.focus('#kr-drawer-resize'); for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowLeft'); s = await st(p);
    ok(Math.abs(s.w - 660) <= 1, `[ném lỗi] setItem ném lỗi thì ArrowLeft x5 vẫn đổi bề rộng bằng bộ nhớ trong (660), thấy ${s.w}`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200); await openDrawer(p); s = await st(p);
    ok(Math.abs(s.w - 660) <= 1, `[ném lỗi] đóng/mở phải giữ 660 (bộ nhớ trong), thấy ${s.w}`);
  }
  ok(o.errors.length === 0, '[ném lỗi] lỗi JS: ' + o.errors.join(' | ')); await o.ctx.close();
}

// INV-045: chọn lại đúng tab đang chọn không phải "đổi tab" nên không reset limit (spec C: reset chỉ khi đổi tab, đóng/mở, đổi bộ chọn).
async function reselectLimit(browser) {
  const o = await open(browser, { width: 1280, height: 800 }, mkModel(23)); const p = o.page;
  await openDrawer(p); await clickSel(p, '#kr-drawer [data-kr-more]'); let s = await st(p);
  ok(s.rows === 20 && s.sel === 'invariants', `chuẩn bị: tab Bất biến sau Xem thêm phải 20 dòng, thấy ${s.sel}/${s.rows}`);
  await p.focus('[data-kr-tab="invariants"]'); await p.keyboard.press('Home'); await p.waitForTimeout(150); s = await st(p);
  ok(s.rows === 20, `Home trên tab đầu đang chọn không phải đổi tab, không được reset Xem thêm (20 dòng), thấy ${s.rows}`);
  ok(s.sel === 'invariants' && s.active === 'invariants', `Home trên tab đang chọn: giữ tab và focus ở tab, thấy ${s.sel}/${s.active}`);
  await clickSel(p, '[data-kr-tab="adversarial"]'); await clickSel(p, '#kr-drawer [data-kr-more]'); s = await st(p);
  ok(s.rows === 20 && s.sel === 'adversarial', `chuẩn bị: tab Đối kháng sau Xem thêm phải 20 dòng, thấy ${s.sel}/${s.rows}`);
  await clickSel(p, '[data-kr-tab="adversarial"]'); s = await st(p);
  ok(s.rows === 20, `bấm chuột lại tab đang chọn không reset (20), thấy ${s.rows}`);
  await clickSel(p, '[data-kr-tab="regression"]'); await p.focus('[data-kr-tab="regression"]'); await p.keyboard.press('End'); await p.waitForTimeout(150); s = await st(p);
  ok(s.sel === 'regression' && s.rows === 3 && s.active === 'regression', `End trên tab cuối đang chọn giữ tab và focus, thấy ${s.sel}/${s.rows}/${s.active}`);
  ok(o.errors.length === 0, 'lỗi JS: ' + o.errors.join(' | ')); await o.ctx.close();
}

// INV-046: focus không treo sau khi chọn lại tab đang chọn; luồng mũi tên/Home/End sang tab khác đúng (spec B, C).
async function focusFlow(browser) {
  // G: chọn lại tab đang chọn bằng phím rồi Xem thêm / làm tươi
  for (const how of ['trái-phải', 'vòng 3 mũi tên']) {
    const o = await open(browser, { width: 1280, height: 800 }, mkModel(45), { clock: true }); const p = o.page;
    await openDrawer(p); await clickSel(p, '[data-kr-tab="adversarial"]'); await p.focus('[data-kr-tab="adversarial"]');
    if (how === 'trái-phải') { await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowRight'); } else { for (let i = 0; i < 3; i++) await p.keyboard.press('ArrowRight'); }
    await p.waitForTimeout(150); let s = await st(p);
    ok(s.sel === 'adversarial' && s.active === 'adversarial', `G[${how}] về lại tab adversarial bằng phím: phải chọn và có focus, thấy ${s.sel}/${s.active}`);
    await clickSel(p, '#kr-drawer [data-kr-more]'); s = await st(p);
    ok(s.rows === 20 && s.active === 'more', `G[${how}] bấm Xem thêm: 20 dòng, focus ở nút; thấy ${s.rows}/${s.active}`);
    await clickSel(p, '[data-kr-tab="invariants"]'); await p.focus('[data-kr-tab="invariants"]'); await p.keyboard.press('Home'); await p.waitForTimeout(100);
    await clickSel(p, '#kr-drawer [data-kr-more]'); s = await st(p);
    ok(s.rows === 20 && s.active === 'more', `G[${how}] Home trên tab đang chọn rồi bấm Xem thêm: nút còn thì focus phải ở lại nút, thấy ${s.rows} dòng, focus ${s.active}`);
    await p.focus('[data-kr-tab="invariants"]'); await p.keyboard.press('Home'); await p.focus('#kr-drawer-close');
    await refresh(o, 46); s = await st(p);
    ok(s.active === 'kr-drawer-close', `G[${how}] Home trên tab đang chọn, rời focus sang nút đóng, làm tươi: focus không được kéo về tab, thấy ${s.active}`);
    ok(o.errors.length === 0, `G[${how}] lỗi JS: ` + o.errors.join(' | ')); await o.ctx.close();
  }
  // H: mũi tên/Home/End sang tab khác
  const o = await open(browser, { width: 1280, height: 800 }, mkModel(45), { clock: true }); const p = o.page;
  const press = async k => { await p.keyboard.press(k); await p.waitForTimeout(120); return st(p); };
  await openDrawer(p); await clickSel(p, '[data-kr-tab="adversarial"]'); await clickSel(p, '#kr-drawer [data-kr-more]');
  let s = await st(p); ok(s.rows === 20 && s.sel === 'adversarial', `H chuẩn bị: adversarial 20 dòng, thấy ${s.sel}/${s.rows}`);
  await p.focus('[data-kr-tab="adversarial"]');
  s = await press('Home'); ok(s.sel === 'invariants' && s.active === 'invariants' && s.rows === 10, `H Home sang invariants: chọn, focus theo, 10 dòng; thấy ${s.sel}/${s.active}/${s.rows}`);
  s = await press('Home'); ok(s.sel === 'invariants' && s.active === 'invariants', `H Home lần hai trên tab đang chọn: giữ tab và focus, thấy ${s.sel}/${s.active}`);
  s = await press('ArrowRight'); ok(s.sel === 'adversarial' && s.active === 'adversarial' && s.rows === 10, `H ArrowRight về adversarial: 10 dòng, focus theo; thấy ${s.sel}/${s.active}/${s.rows}`);
  await clickSel(p, '#kr-drawer [data-kr-more]'); s = await st(p); ok(s.rows === 20 && s.active === 'more', `H sau đổi tab bằng phím, Xem thêm giữ focus ở nút, thấy ${s.rows}/${s.active}`);
  await p.focus('[data-kr-tab="adversarial"]');
  s = await press('End'); ok(s.sel === 'regression' && s.active === 'regression' && s.rows === 3, `H End sang regression, thấy ${s.sel}/${s.active}/${s.rows}`);
  s = await press('End'); ok(s.sel === 'regression' && s.active === 'regression', `H End trên tab đang chọn giữ, thấy ${s.sel}/${s.active}`);
  s = await press('ArrowRight'); ok(s.sel === 'invariants' && s.active === 'invariants', `H ArrowRight ở tab cuối vòng về đầu, thấy ${s.sel}/${s.active}`);
  s = await press('ArrowLeft'); ok(s.sel === 'regression' && s.active === 'regression', `H ArrowLeft ở tab đầu về cuối, thấy ${s.sel}/${s.active}`);
  s = await press('ArrowLeft'); ok(s.sel === 'adversarial' && s.active === 'adversarial' && s.rows === 10, `H ArrowLeft sang adversarial: 10 dòng, thấy ${s.sel}/${s.active}/${s.rows}`);
  await refresh(o, 46); s = await st(p);
  ok(s.active === 'adversarial' && s.sel === 'adversarial' && s.rows === 10, `H làm tươi sau đổi tab bằng phím giữ focus ở tab đang chọn và 10 dòng, thấy ${s.active}/${s.rows}`);
  await p.focus('#kr-drawer-close'); await refresh(o, 47); s = await st(p);
  ok(s.active === 'kr-drawer-close', `H focus ở nút đóng, làm tươi không kéo về tab, thấy ${s.active}`);
  const tabs = await p.$$eval('#kr-drawer [data-kr-tab]', b => b.map(e => [e.getAttribute('data-kr-tab'), e.getAttribute('tabindex'), e.getAttribute('aria-selected')]));
  ok(JSON.stringify(tabs) === JSON.stringify([['invariants', '-1', 'false'], ['adversarial', '0', 'true'], ['regression', '-1', 'false']]), `H roving tabindex sau chuỗi phím sai, thấy ${JSON.stringify(tabs)}`);
  ok(o.errors.length === 0, 'H lỗi JS: ' + o.errors.join(' | ')); await o.ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    if (CHECK === 'bad-storage') await badStorage(browser);
    else if (CHECK === 'reselect-limit') await reselectLimit(browser);
    else await focusFlow(browser);
  } catch (e) { fails.push('lỗi chạy: ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join(' ')); }
  await browser.close();
  if (fails.length) { console.log(`FAIL ${CHECK}: ` + fails.slice(0, 6).join('; ') + (fails.length > 6 ? ` (+${fails.length - 6} lỗi nữa)` : '')); process.exit(1); }
  console.log(`PASS ${CHECK}`); process.exit(0);
})();
