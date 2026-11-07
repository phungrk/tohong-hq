// Eval tầng 1 của T-096 (spec products/T-096-drawer-tab-keo-rong.md), tiêu chí 3-7: hành vi drawer Knowledge Reservoir trên trang thật.
// Chạy: cd /home/user/tohong-hq && D3=/đường/dẫn/d3.min.js NODE_PATH=$(npm root -g) node eval/T-096/check.cjs --criterion 3|4|5|6|7
// Dữ liệu cố định chặn từ mạng (không đọc sổ cái). Biến: D3 (bắt buộc), TOHONG_DASHBOARD_REPO (mặc định /home/user/tohong-hq-dashboard).
// Không đọc mã nguồn trang; chỉ dùng id/thuộc tính/chữ ghi trong spec. Cuộn phần tử vào khung nhìn rồi bấm bằng toạ độ chuột thật (kiểm elementFromPoint).
// In PASS hoặc FAIL <lý do>, mã thoát 0/1.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const D3 = process.env.D3; if (!D3) { console.log('FAIL cần biến D3=/đường/dẫn/d3.min.js'); process.exit(1); }
const REPO = path.resolve(process.env.TOHONG_DASHBOARD_REPO || '/home/user/tohong-hq-dashboard');
const crit = process.argv.includes('--criterion') ? process.argv[process.argv.indexOf('--criterion') + 1] : '';
if (!['3', '4', '5', '6', '7'].includes(crit)) { console.log('FAIL --criterion phải là 3, 4, 5, 6 hoặc 7'); process.exit(1); }

const base = { title: 'Việc thử', state: 'doing', holder: 'engineering', owner: 'engineering', reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0, created: '2026-10-30T09:00', updated: new Date(Date.now() + 7 * 3600e3 - 3600e3).toISOString().slice(0, 16), hours_since_update: 1, tier: 'A', evals: 1, spec_returns: 0, evals_added: 0 };
const tasks = [{ ...base, id: 'T-1', area: 'planner/front', product: 'planner' }, { ...base, id: 'T-2', area: 'hq/dashboard', product: 'hq' }];
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const GH = 'https://github.com/phungrk/tohong-hq/blob/main/';
const pad = (n, k = 3) => String(n).padStart(k, '0');
const mkInv = (area, n, name, source) => ({ area, id: 'INV-' + pad(n), slug: 's' + n, name, source, url: GH + 'eval/invariants/' + area + '/inv-' + pad(n) + '-s' + n + '.sh' });
// 25 bất biến: _shared 2, hq/dashboard 8, hq/dashboard/model 5, planner/front/layout 6, planner/vendor/pool 4
const INV = [];
const spec = [['_shared', 2], ['hq/dashboard', 8], ['hq/dashboard/model', 5], ['planner/front/layout', 6], ['planner/vendor/pool', 4]];
let k = 0; spec.forEach(([a, c]) => { for (let i = 1; i <= c; i++) { k++; INV.push(mkInv(a, i, 'Bất biến mẫu ' + k + ' của ' + a, 'T-' + (200 + k))); } });
const ADV = []; for (let i = 0; i < 23; i++) { const t = 400 - Math.floor(i / 2); ADV.push({ id: 'adv-' + pad(i % 2 + 1, 2) + '-x', file: 'adv-' + pad(i % 2 + 1, 2) + '-x.sh', name: 'Eval đối kháng mẫu số ' + (i + 1), source: 'T-' + t, url: GH + 'eval/T-' + t + '/adv-' + pad(i % 2 + 1, 2) + '-x.sh' }); }
const REG = []; for (let i = 0; i < 11; i++) REG.push({ id: 'reg-' + pad(i + 1, 2), file: 'reg-' + pad(i + 1, 2) + '.sh', name: 'Hồi quy mẫu số ' + (i + 1), source: i % 3 ? 'T-' + (50 + i) : '', url: GH + 'eval/regression/reg-' + pad(i + 1, 2) + '.sh' });
const cnt = l => { const o = {}; l.forEach(x => o[x.area] = (o[x.area] || 0) + 1); return o; };
const MODEL = { invariants: cnt(INV), invariants_total: INV.length, invariant_list: INV, adversarial_evals: ADV.length, adversarial_list: ADV, regression_evals: REG.length, regression_list: REG, specs: 5, insight_reports: 1, last_insight: '2026-11-01-weekly.md' };
const within = (a, p) => a === '_shared' || a === p || a.startsWith(p + '/');
const HQ = INV.filter(x => within(x.area, 'hq')), PL = INV.filter(x => within(x.area, 'planner'));
const mkData = m => ({ generated_at: '2026-11-07T10:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster, capu_queue: [], model: m });

let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } };
async function open(browser, vp, model, o2 = {}) {
  const ctx = o2.ctx || await browser.newContext({ viewport: vp, hasTouch: vp.width < 500 || !!o2.touch }); const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const o = { page, ctx, errors, data: mkData(model) };
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(o.data) }));
  await page.routeWebSocket(/\/ws$/, ws => ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })));
  if (o2.clock) await page.clock.install();
  await page.goto('file://' + path.join(REPO, 'index.html')); await page.waitForTimeout(1300);
  return o;
}
const blockPoint = page => page.evaluate(() => {
  const g = document.getElementById('nd_kr'); if (!g) return null;
  const sh = g.querySelector(':scope > rect') || g; sh.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  const r = sh.getBoundingClientRect();
  for (let j = 1; j < 14; j++) for (let i = 1; i < 14; i++) {
    const x = r.left + r.width * i / 14, y = r.top + r.height * j / 14; if (x < 2 || y < 2 || x > innerWidth - 2 || y > innerHeight - 2) continue;
    const e = document.elementFromPoint(x, y); if (e && e.closest('#nd_kr') && !e.closest('#chars')) return { x, y };
  }
  return null;
});
const openDrawer = async page => { const p = await blockPoint(page); if (!p) return false; await page.mouse.click(p.x, p.y); await page.waitForTimeout(350); return true; };
const isOpen = page => page.evaluate(() => { const d = document.getElementById('kr-drawer'); if (!d || d.hidden) return false; const r = d.getBoundingClientRect(); return getComputedStyle(d).display !== 'none' && r.width > 0; });
// bấm thật vào phần tử trong drawer sau khi cuộn vào khung nhìn; trả false nếu điểm giữa bị che
const realClick = async (page, sel) => {
  const p = await page.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; e.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2; const t = document.elementFromPoint(x, y); return t && (t === e || e.contains(t)) ? { x, y } : { covered: true }; }, sel);
  if (!p || p.covered) return false; await page.mouse.click(p.x, p.y); await page.waitForTimeout(250); return true;
};
const snap = page => page.evaluate(() => {
  const d = document.getElementById('kr-drawer'); const t = s => [...d.querySelectorAll(s)];
  const norm = e => e.textContent.replace(/\s+/g, ' ').trim();
  const pn = d.querySelector('[data-kr-panel]');
  const rowSel = '[data-kr-inv],[data-kr-adv],[data-kr-reg]';
  return {
    tabs: t('[data-kr-tab]').map(e => ({ key: e.getAttribute('data-kr-tab'), text: norm(e), count: e.getAttribute('data-count'), sel: e.getAttribute('aria-selected'), role: e.getAttribute('role'), tabindex: e.getAttribute('tabindex'), w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height, l: e.getBoundingClientRect().left, r: e.getBoundingClientRect().right })),
    tablist: !!d.querySelector('[role=tablist]'), panels: t('[role=tabpanel]').map(e => e.getAttribute('data-kr-tabpanel')),
    stats: Object.fromEntries(t('[data-kr-stat]').map(e => [e.getAttribute('data-kr-stat'), e.getAttribute('data-value')])),
    rows: t(rowSel).map(e => { const a = e.querySelector('a[data-kr-link]'); return { kind: e.hasAttribute('data-kr-inv') ? 'inv' : e.hasAttribute('data-kr-adv') ? 'adv' : 'reg', id: e.getAttribute('data-id'), area: e.getAttribute('data-area'), source: e.getAttribute('data-source'), text: norm(e), href: a && a.getAttribute('href'), target: a && a.getAttribute('target'), rel: a && a.getAttribute('rel'), linkText: a && a.textContent.trim(), nlinks: e.querySelectorAll('a[data-kr-link]').length, parent: e.closest('[data-kr-area]') && e.closest('[data-kr-area]').getAttribute('data-kr-area') }; }),
    areas: t('[data-kr-area]').map(e => e.getAttribute('data-kr-area')),
    more: t('[data-kr-more]').map(e => { const r = e.getBoundingClientRect(); return { text: norm(e), tag: e.tagName, w: r.width, h: r.height, fs: parseFloat(getComputedStyle(e).fontSize), l: r.left, r: r.right }; }),
    filter: t('[data-kr-filter]').map(norm), empty: t('[data-kr-empty]').map(norm), title: (document.getElementById('kr-title') || {}).textContent,
    scrollTop: pn.scrollTop, panelW: pn.getBoundingClientRect().width, panelL: pn.getBoundingClientRect().left, panelOverflow: pn.scrollWidth - pn.clientWidth, docW: document.documentElement.scrollWidth, vw: innerWidth,
    active: document.activeElement && (document.activeElement.id || document.activeElement.getAttribute('data-kr-tab') || document.activeElement.tagName + ':' + (document.activeElement.getAttribute('data-id') || document.activeElement.getAttribute('data-kr-more') || document.activeElement.getAttribute('href') || '')),
    activeHref: document.activeElement && document.activeElement.hasAttribute && document.activeElement.hasAttribute('data-kr-link') ? document.activeElement.getAttribute('href') : '',
    activeIn: !!(document.activeElement && d.contains(document.activeElement)),
  };
});
const pick = async (page, f) => { await page.selectOption('#product-filter', f); await page.waitForTimeout(500); };
const tabBtn = key => `[data-kr-tab="${key}"]`;
const goTab = async (page, key) => { const r = await realClick(page, tabBtn(key)); await page.waitForTimeout(150); return r; };
const KIND = { invariants: 'inv', adversarial: 'adv', regression: 'reg' };
const LISTS = { invariants: INV, adversarial: ADV, regression: REG };
const label = { invariants: 'Bất biến', adversarial: 'Eval đối kháng', regression: 'Hồi quy' };

(async () => {
  const browser = await chromium.launch();
  try {
    // ---------- 3: ba tab, số đếm, tab mặc định/nhớ, bộ lọc ----------
    if (crit === '3') {
      let o = await open(browser, { width: 1280, height: 900 }, MODEL), p = o.page;
      ok(await openDrawer(p), 'không bấm được #nd_kr'); ok(await isOpen(p), 'drawer phải mở');
      let s = await snap(p);
      ok(s.tablist, 'phải có phần tử role=tablist');
      ok(JSON.stringify(s.tabs.map(t => t.key)) === JSON.stringify(['invariants', 'adversarial', 'regression']), `ba tab [data-kr-tab] theo thứ tự invariants, adversarial, regression; thấy ${JSON.stringify(s.tabs.map(t => t.key))}`);
      s.tabs.forEach(t => { ok(t.role === 'tab', `tab ${t.key} phải role=tab`); ok(t.text === `${label[t.key]} ${LISTS[t.key].length}`, `chữ tab ${t.key} phải "${label[t.key]} ${LISTS[t.key].length}", thấy "${t.text}"`); ok(t.count === String(LISTS[t.key].length), `data-count tab ${t.key}`); ok(t.h >= 40, `tab ${t.key} cao >= 40px, thấy ${t.h}`); });
      ok(s.tabs[0].sel === 'true' && s.tabs[1].sel === 'false' && s.tabs[2].sel === 'false', 'mặc định chỉ tab Bất biến aria-selected=true');
      ok(s.stats.invariants === String(INV.length) && s.stats.adversarial === String(ADV.length) && s.stats.regression === String(REG.length), `số trên tab phải khớp [data-kr-stat], thấy ${JSON.stringify(s.stats)}`);
      ok(JSON.stringify(s.panels) === '["invariants"]', `chỉ có tabpanel của tab đang chọn, thấy ${JSON.stringify(s.panels)}`);
      ok(s.rows.length === 10 && s.rows.every(r => r.kind === 'inv'), 'tab Bất biến mặc định: 10 dòng [data-kr-inv]');
      for (const key of ['adversarial', 'regression', 'invariants']) {
        ok(await goTab(p, key), `không bấm được tab ${key}`); s = await snap(p);
        ok(s.tabs.find(t => t.key === key).sel === 'true' && s.tabs.filter(t => t.sel === 'true').length === 1, `bấm tab ${key} phải chỉ tab đó aria-selected=true`);
        ok(JSON.stringify(s.panels) === JSON.stringify([key]), `tabpanel phải là ${key}, thấy ${JSON.stringify(s.panels)}`);
        const want = LISTS[key].slice(0, 10); ok(s.rows.length === 10 && s.rows.every(r => r.kind === KIND[key]), `tab ${key}: 10 dòng loại ${KIND[key]}, thấy ${s.rows.length}`);
        ok(JSON.stringify(s.rows.map(r => r.id)) === JSON.stringify(want.map(x => x.id)), `tab ${key}: id và thứ tự phải đúng 10 mục đầu của danh sách`);
        s.rows.forEach((r, i) => { const x = want[i]; if (!x) return;
          ok(r.text.includes(x.name), `tab ${key} dòng ${x.id}: phải hiện tên "${x.name}"`);
          ok(r.source === (x.source || ''), `tab ${key} dòng ${x.id}: data-source phải "${x.source || ''}", thấy "${r.source}"`);
          ok(x.source ? r.text.includes('nguồn ' + x.source) : !/nguồn/.test(r.text), `tab ${key} dòng ${x.id}: ${x.source ? 'phải có' : 'không được có'} chữ "nguồn ${x.source}"`);
          ok(r.nlinks === 1 && r.href === x.url && r.target === '_blank' && /noopener/.test(r.rel || '') && /noreferrer/.test(r.rel || '') && r.linkText === 'Mở trên GitHub', `tab ${key} dòng ${x.id}: liên kết GitHub sai (${r.href} vs ${x.url})`); });
      }
      // phím mũi tên trên tablist
      await p.focus(tabBtn('invariants')); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150); s = await snap(p);
      ok(s.tabs[1].sel === 'true', 'ArrowRight khi tab Bất biến có focus phải chọn tab Eval đối kháng'); ok(s.active === 'adversarial', `focus phải theo tab mới, thấy ${s.active}`);
      await p.keyboard.press('End'); await p.waitForTimeout(150); s = await snap(p); ok(s.tabs[2].sel === 'true', 'End phải chọn tab cuối (Hồi quy)');
      await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150); s = await snap(p); ok(s.tabs[0].sel === 'true', 'ArrowRight ở tab cuối phải quay về tab đầu');
      await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(150); s = await snap(p); ok(s.tabs[2].sel === 'true', 'ArrowLeft ở tab đầu phải về tab cuối');
      ok(s.tabs.filter(t => t.tabindex === '0').length === 1 && s.tabs[2].tabindex === '0', 'chỉ tab đang chọn có tabindex=0 (roving)');
      // nhớ tab khi đóng/mở trong cùng lần tải trang
      await p.keyboard.press('Escape'); await p.waitForTimeout(250); ok(!(await isOpen(p)), 'Esc phải đóng');
      ok(await openDrawer(p), 'mở lại'); s = await snap(p);
      ok(s.tabs[2].sel === 'true', 'mở lại drawer trong cùng lần tải phải giữ tab đã chọn (Hồi quy)');
      // tải lại trang: về Bất biến
      await p.reload(); await p.waitForTimeout(1300); ok(await openDrawer(p), 'mở sau khi tải lại'); s = await snap(p);
      ok(s.tabs[0].sel === 'true', 'sau khi tải lại trang tab mặc định là Bất biến (không lưu qua tải lại)');
      // bộ lọc: chỉ bất biến lọc
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      for (const [f, want] of [['hq', HQ], ['planner', PL]]) {
        await pick(p, f); ok(await openDrawer(p), 'mở sau khi lọc ' + f); s = await snap(p);
        ok(s.tabs[0].text === `Bất biến ${want.length}` && s.tabs[1].text === `Eval đối kháng ${ADV.length}` && s.tabs[2].text === `Hồi quy ${REG.length}`, `lọc ${f}: chữ tab phải Bất biến ${want.length} / ${ADV.length} / ${REG.length}, thấy ${JSON.stringify(s.tabs.map(t => t.text))}`);
        ok(s.title === `Knowledge Reservoir (${want.length} bất biến)`, `lọc ${f}: tiêu đề sai "${s.title}"`);
        ok(s.stats.specs === undefined, `lọc ${f}: không có [data-kr-stat=specs]`);
        for (const key of ['invariants', 'adversarial', 'regression']) {
          await goTab(p, key); s = await snap(p);
          ok(s.filter.length === 1 && s.filter[0] === `Đang lọc theo sản phẩm: ${f}. Eval đối kháng và hồi quy tính cả công ty.`, `lọc ${f}, tab ${key}: đúng một [data-kr-filter] với chữ T-092, thấy ${JSON.stringify(s.filter)}`);
          const L = key === 'invariants' ? want : LISTS[key];
          ok(JSON.stringify(s.rows.map(r => r.id + '@' + (r.area || ''))) === JSON.stringify(L.slice(0, 10).map(x => x.id + '@' + (x.area || ''))), `lọc ${f}, tab ${key}: 10 dòng đầu của danh sách trong phạm vi lọc`);
        }
        await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      }
      await pick(p, 'all'); ok(await openDrawer(p), 'mở lại Tất cả'); s = await snap(p);
      ok(s.filter.length === 0, 'chọn Tất cả không có [data-kr-filter]'); ok(s.stats.specs === '5', 'Tất cả có [data-kr-stat=specs] = 5');
      ok(o.errors.length === 0, 'lỗi JS: ' + o.errors.join(' | '));
    }

    // ---------- 4: 10 mục đầu, Xem thêm +10, reset ----------
    if (crit === '4') {
      let o = await open(browser, { width: 1280, height: 700 }, MODEL, { clock: true }), p = o.page;
      ok(await openDrawer(p), 'mở drawer');
      for (const key of ['invariants', 'adversarial', 'regression']) {
        await goTab(p, key); const L = LISTS[key]; let shown = 10, s = await snap(p);
        ok(s.rows.length === 10, `tab ${key}: mặc định 10 dòng, thấy ${s.rows.length}`);
        while (shown < L.length) {
          const left = L.length - shown;
          ok(s.more.length === 1 && s.more[0].text === `Xem thêm · còn ${left}` && s.more[0].tag === 'BUTTON', `tab ${key}: đúng một button[data-kr-more] chữ "Xem thêm · còn ${left}", thấy ${JSON.stringify(s.more)}`);
          if (s.more[0]) { ok(s.more[0].h >= 40 && s.more[0].w >= 120 && s.more[0].fs >= 14, `nút Xem thêm cao>=40 rộng>=120 chữ>=14, thấy ${JSON.stringify(s.more[0])}`);
            const lastBottom = await p.evaluate(() => { const r = [...document.querySelectorAll('#kr-drawer [data-kr-inv],#kr-drawer [data-kr-adv],#kr-drawer [data-kr-reg]')].pop().getBoundingClientRect(); return r.bottom; });
            const mt = await p.evaluate(() => document.querySelector('#kr-drawer [data-kr-more]').getBoundingClientRect().top); ok(mt >= lastBottom - 1, `nút Xem thêm phải nằm dưới dòng cuối (nút top ${mt} < dòng cuối bottom ${lastBottom})`); }
          const before = s.scrollTop;
          ok(await realClick(p, '#kr-drawer [data-kr-more]'), `tab ${key}: không bấm được nút Xem thêm (bị che?)`); s = await snap(p);
          const prev = shown; shown = Math.min(L.length, shown + 10);
          ok(s.rows.length === shown, `tab ${key}: sau bấm phải ${shown} dòng, thấy ${s.rows.length}`);
          ok(JSON.stringify(s.rows.map(r => r.id)) === JSON.stringify(L.slice(0, shown).map(x => x.id)), `tab ${key}: thứ tự phải giữ, thêm đúng các mục kế tiếp`);
          ok(s.scrollTop >= before - 2, `tab ${key}: bấm Xem thêm không được nhảy cuộn về đầu (${before} -> ${s.scrollTop})`);
          if (shown < L.length) ok(s.activeIn, `tab ${key}: sau Xem thêm focus không rơi ra ngoài drawer`);
          if (shown >= L.length) { ok(s.more.length === 0, `tab ${key}: hết danh sách thì nút Xem thêm biến mất`); ok(s.activeIn, `tab ${key}: nút biến mất thì focus không rơi ra ngoài drawer`);
            ok(s.activeHref === L[prev].url, `tab ${key}: nút biến mất thì focus phải ở liên kết GitHub của mục mới đầu tiên (${L[prev].url}), thấy "${s.activeHref}"`); }
        }
      }
      // invariants: nhóm vùng chỉ chứa dòng đang hiện
      await goTab(p, 'invariants'); let s = await snap(p);
      ok(s.rows.every(r => r.parent === r.area), 'mỗi dòng bất biến nằm trong nhóm [data-kr-area] đúng vùng');
      ok(JSON.stringify(s.areas) === JSON.stringify([...new Set(INV.slice(0, 10).map(x => x.area))]), `nhóm vùng của 10 dòng đầu phải ${JSON.stringify([...new Set(INV.slice(0, 10).map(x => x.area))])}, thấy ${JSON.stringify(s.areas)}`);
      // reset khi đổi tab
      await realClick(p, '#kr-drawer [data-kr-more]'); s = await snap(p); ok(s.rows.length === 20, 'sau một lần bấm có 20 dòng');
      await goTab(p, 'adversarial'); await goTab(p, 'invariants'); s = await snap(p); ok(s.rows.length === 10, `đổi tab rồi quay lại: về 10 dòng, thấy ${s.rows.length}`);
      // reset khi đóng/mở
      await realClick(p, '#kr-drawer [data-kr-more]'); await p.keyboard.press('Escape'); await p.waitForTimeout(250); await openDrawer(p); s = await snap(p); ok(s.rows.length === 10, `đóng rồi mở: về 10 dòng, thấy ${s.rows.length}`);
      // reset khi đổi bộ lọc sản phẩm (khi drawer mở)
      await realClick(p, '#kr-drawer [data-kr-more]'); await pick(p, 'planner'); s = await snap(p);
      ok(s.rows.length === 10, `đổi bộ chọn sản phẩm khi drawer mở: về 10 dòng, thấy ${s.rows.length}`); ok(s.more.length === 1 && s.more[0].text === `Xem thêm · còn ${PL.length - 10}`, `planner: nút phải "Xem thêm · còn ${PL.length - 10}", thấy ${JSON.stringify(s.more)}`);
      await pick(p, 'all');
      // làm tươi dữ liệu giữ nguyên số đang hiện và cuộn
      await realClick(p, '#kr-drawer [data-kr-more]'); s = await snap(p); const st0 = s.scrollTop; ok(s.rows.length === 20, 'trước làm tươi: 20 dòng');
      await p.clock.fastForward(61000); await p.waitForTimeout(800); s = await snap(p);
      ok(s.rows.length === 20, `làm tươi dữ liệu không được đặt lại số dòng (20), thấy ${s.rows.length}`); ok(Math.abs(s.scrollTop - st0) <= 2, 'làm tươi giữ vị trí cuộn');
      ok(await isOpen(p), 'làm tươi không đóng drawer');
      // biên: đúng 10 mục thì không nút
      await p.keyboard.press('Escape');
      const M10 = { ...MODEL, adversarial_evals: 10, adversarial_list: ADV.slice(0, 10), regression_evals: 1, regression_list: REG.slice(0, 1) };
      const o10 = await open(browser, { width: 1280, height: 700 }, M10), q = o10.page; await openDrawer(q);
      await goTab(q, 'adversarial'); s = await snap(q); ok(s.rows.length === 10 && s.more.length === 0, `đúng 10 mục: đủ 10 dòng, không có nút (dòng ${s.rows.length}, nút ${s.more.length})`);
      await goTab(q, 'regression'); s = await snap(q); ok(s.rows.length === 1 && s.more.length === 0, 'một mục: một dòng, không nút');
      ok(o.errors.length === 0 && o10.errors.length === 0, 'lỗi JS: ' + o.errors.concat(o10.errors).join(' | '));
    }

    // ---------- 5: tay nắm kéo ----------
    if (crit === '5') {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      let o = await open(browser, null, MODEL, { ctx }), p = o.page;
      ok(await openDrawer(p), 'mở drawer'); let s = await snap(p);
      const H = '#kr-drawer-resize';
      const hd = await p.$eval(H, e => { const r = e.getBoundingClientRect(); const pn = document.querySelector('#kr-drawer [data-kr-panel]').getBoundingClientRect(); return { role: e.getAttribute('role'), orient: e.getAttribute('aria-orientation'), tab: e.getAttribute('tabindex'), min: e.getAttribute('aria-valuemin'), max: e.getAttribute('aria-valuemax'), now: e.getAttribute('aria-valuenow'), label: e.getAttribute('aria-label'), w: r.width, h: r.height, l: r.left, ph: pn.height, pl: pn.left, cur: getComputedStyle(e).cursor, ta: getComputedStyle(e).touchAction }; }).catch(() => null);
      ok(hd, 'phải có #kr-drawer-resize'); if (!hd) { console.log('FAIL dừng'); process.exit(1); }
      ok(hd.role === 'separator' && hd.orient === 'vertical' && hd.tab === '0', `tay nắm: role=separator aria-orientation=vertical tabindex=0, thấy ${JSON.stringify([hd.role, hd.orient, hd.tab])}`);
      ok(hd.label && hd.label.length > 3, 'tay nắm phải có aria-label');
      ok(Math.abs(hd.l - hd.pl) <= 8 && hd.w >= 12 && hd.h >= hd.ph * 0.9, `tay nắm ở mép trái panel, rộng >= 12px, cao gần hết panel; thấy ${JSON.stringify({ l: hd.l, pl: hd.pl, w: hd.w, h: hd.h, ph: hd.ph })}`);
      ok(hd.cur === 'col-resize' && hd.ta === 'none', `con trỏ col-resize và touch-action none, thấy ${hd.cur}/${hd.ta}`);
      ok(Math.abs(s.panelW - 560) <= 1, `mặc định panel rộng 560px ở 1280, thấy ${s.panelW}`);
      ok(hd.min === '560' && hd.max === '1152' && hd.now === '560', `aria-valuemin/max/now phải 560/1152/560, thấy ${hd.min}/${hd.max}/${hd.now}`);
      const W = async () => (await snap(p)).panelW;
      const centre = async () => p.$eval(H, e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      // chuột: kéo sang trái 200px
      let c = await centre(); await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(c.x - 100, c.y, { steps: 5 }); await p.mouse.move(c.x - 200, c.y, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(150);
      let w = await W(); ok(Math.abs(w - 760) <= 2, `kéo trái 200px phải rộng 760, thấy ${w}`); ok(await isOpen(p), 'kéo thả không được đóng drawer');
      ok((await p.$eval(H, e => e.getAttribute('aria-valuenow'))) === String(Math.round(w)), 'aria-valuenow phải theo bề rộng');
      // kéo quá trái: kẹp max 1152; thả trên lớp nền không đóng
      c = await centre(); await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(2, c.y, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(150);
      w = await W(); ok(Math.abs(w - 1152) <= 2, `kéo quá trái phải kẹp 90% = 1152, thấy ${w}`); ok(await isOpen(p), 'thả chuột ngoài panel sau khi kéo không được đóng drawer');
      // kéo quá phải: kẹp min 560
      c = await centre(); await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(1270, c.y, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(150);
      w = await W(); ok(Math.abs(w - 560) <= 2, `kéo quá phải phải kẹp min 560, thấy ${w}`);
      // cảm ứng: CDP touch kéo trái 150px
      const cdp = await ctx.newCDPSession(p); c = await centre();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y }] });
      for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x - 30 * i, y: c.y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(200);
      w = await W(); ok(Math.abs(w - 710) <= 3, `chạm kéo trái 150px phải rộng 710, thấy ${w}`);
      // bàn phím
      await p.focus(H); await p.keyboard.press('ArrowLeft'); w = await W(); ok(Math.abs(w - 730) <= 1, `ArrowLeft +20: 730, thấy ${w}`);
      await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); w = await W(); ok(Math.abs(w - 690) <= 1, `ArrowRight x2 -40: 690, thấy ${w}`);
      await p.keyboard.press('Home'); w = await W(); ok(Math.abs(w - 560) <= 1, `Home: min 560, thấy ${w}`);
      await p.keyboard.press('ArrowRight'); w = await W(); ok(Math.abs(w - 560) <= 1, `ArrowRight ở min vẫn 560, thấy ${w}`);
      await p.keyboard.press('End'); w = await W(); ok(Math.abs(w - 1152) <= 1, `End: max 1152, thấy ${w}`);
      await p.keyboard.press('ArrowLeft'); w = await W(); ok(Math.abs(w - 1152) <= 1, `ArrowLeft ở max vẫn 1152, thấy ${w}`);
      ok((await p.evaluate(() => document.activeElement.id)) === 'kr-drawer-resize', 'phím mũi tên không làm mất focus tay nắm');
      ok(await isOpen(p), 'phím trên tay nắm không đóng drawer');
      // nhớ bề rộng: đặt 800 rồi đóng/mở, tải lại
      await p.keyboard.press('Home'); for (let i = 0; i < 12; i++) await p.keyboard.press('ArrowLeft'); w = await W(); ok(Math.abs(w - 800) <= 1, `Home + 12 lần ArrowLeft = 800, thấy ${w}`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(250); await openDrawer(p); w = await W(); ok(Math.abs(w - 800) <= 1, `đóng rồi mở: giữ 800, thấy ${w}`);
      await p.reload(); await p.waitForTimeout(1300); await openDrawer(p); w = await W(); ok(Math.abs(w - 800) <= 1, `tải lại trang: vẫn nhớ 800, thấy ${w}`);
      // thu cửa sổ còn 700: kẹp max 630, không tràn
      await p.setViewportSize({ width: 700, height: 800 }); await p.waitForTimeout(300); s = await snap(p);
      ok(Math.abs(s.panelW - 630) <= 1, `viewport 700: bề rộng lưu 800 phải kẹp max 630, thấy ${s.panelW}`); ok(s.docW <= 700, 'viewport 700: trang không cuộn ngang');
      const hv = await p.$eval(H, e => ({ min: e.getAttribute('aria-valuemin'), max: e.getAttribute('aria-valuemax') })); ok(hv.min === '560' && hv.max === '630', `viewport 700: valuemin/max 560/630, thấy ${JSON.stringify(hv)}`);
      await p.setViewportSize({ width: 1280, height: 800 }); await p.waitForTimeout(300); s = await snap(p); ok(Math.abs(s.panelW - 800) <= 1, `phóng lại 1280: về 800 đã lưu, thấy ${s.panelW}`);
      // ≤ 480px: không có tay nắm, full màn
      for (const vw of [390, 480]) {
        const ob = await open(browser, { width: vw, height: 800 }, MODEL), q = ob.page; await openDrawer(q); const sb = await snap(q);
        const hh = await q.$eval(H, e => { const r = e.getBoundingClientRect(); return { disp: getComputedStyle(e).display, vis: getComputedStyle(e).visibility, w: r.width, hid: e.hidden }; }).catch(() => ({ none: true }));
        ok(hh.none || hh.disp === 'none' || hh.hid || hh.w === 0 || hh.vis === 'hidden', `${vw}px: tay nắm không được hiện, thấy ${JSON.stringify(hh)}`);
        ok(Math.abs(sb.panelW - vw) <= 1 && sb.docW <= vw && sb.panelOverflow <= 0, `${vw}px: panel full ${vw}, không tràn; thấy ${sb.panelW} doc ${sb.docW} overflow ${sb.panelOverflow}`);
        await ob.ctx.close();
      }
      const o481 = await open(browser, { width: 481, height: 800 }, MODEL); await openDrawer(o481.page); const h481 = await o481.page.$eval(H, e => e.getBoundingClientRect().width).catch(() => 0); ok(h481 >= 12, '481px: tay nắm phải hiện'); await o481.ctx.close();
      ok(o.errors.length === 0, 'lỗi JS: ' + o.errors.join(' | '));
    }

    // ---------- 6: trạng thái rỗng và dữ liệu cũ ----------
    if (crit === '6') {
      // hồi quy rỗng
      let o = await open(browser, { width: 1280, height: 800 }, { ...MODEL, regression_evals: 0, regression_list: [] }), p = o.page; await openDrawer(p);
      let s = await snap(p); ok(s.tabs[2].text === 'Hồi quy 0', `tab hồi quy rỗng phải "Hồi quy 0", thấy "${s.tabs[2].text}"`); ok(s.stats.regression === '0', 'stat regression = 0');
      await goTab(p, 'regression'); s = await snap(p);
      ok(s.rows.length === 0 && s.more.length === 0, 'hồi quy rỗng: không dòng, không nút');
      ok(s.empty.length === 1 && s.empty[0] === 'Chưa có eval hồi quy nào', `hồi quy rỗng: đúng một [data-kr-empty] "Chưa có eval hồi quy nào", thấy ${JSON.stringify(s.empty)}`);
      ok(s.tabs[2].sel === 'true', 'tab rỗng vẫn bấm chọn được');
      // eval đối kháng rỗng
      await o.ctx.close();
      o = await open(browser, { width: 1280, height: 800 }, { ...MODEL, adversarial_evals: 0, adversarial_list: [] }); p = o.page; await openDrawer(p); await goTab(p, 'adversarial'); s = await snap(p);
      ok(s.empty.length === 1 && s.empty[0] === 'Chưa có eval đối kháng nào' && s.rows.length === 0, `đối kháng rỗng: "Chưa có eval đối kháng nào", thấy ${JSON.stringify(s.empty)}`);
      await o.ctx.close();
      // bất biến rỗng trong phạm vi lọc (vùng chỉ có planner, lọc hq)
      const onlyPl = PL.filter(x => !x.area.startsWith('_shared'));
      o = await open(browser, { width: 1280, height: 800 }, { ...MODEL, invariants: cnt(onlyPl), invariants_total: onlyPl.length, invariant_list: onlyPl }); p = o.page; await pick(p, 'hq'); await openDrawer(p); s = await snap(p);
      ok(s.tabs[0].text === 'Bất biến 0' && s.empty.length === 1 && s.empty[0] === 'Chưa có bất biến nào trong phạm vi này' && s.rows.length === 0, `bất biến rỗng khi lọc: "Bất biến 0" + chữ T-092, thấy ${JSON.stringify([s.tabs[0].text, s.empty])}`);
      await o.ctx.close();
      // dữ liệu cũ: có số, không có danh sách
      const OLD = { invariants: cnt(INV), invariants_total: INV.length, invariant_list: INV, adversarial_evals: 7, regression_evals: 3, specs: 5, insight_reports: 1, last_insight: '' };
      o = await open(browser, { width: 1280, height: 800 }, OLD); p = o.page; await openDrawer(p); s = await snap(p);
      ok(s.tabs[1].text === 'Eval đối kháng 7' && s.tabs[2].text === 'Hồi quy 3', `dữ liệu cũ: tab vẫn ghi số (7, 3), thấy ${JSON.stringify(s.tabs.map(t => t.text))}`);
      for (const key of ['adversarial', 'regression']) { await goTab(p, key); s = await snap(p); ok(s.rows.length === 0 && s.more.length === 0 && s.empty.length === 1 && s.empty[0] === 'Chưa có danh sách chi tiết', `dữ liệu cũ tab ${key}: không dòng, đúng một [data-kr-empty] "Chưa có danh sách chi tiết", thấy ${JSON.stringify(s.empty)}`); }
      ok(o.errors.length === 0, 'dữ liệu cũ: lỗi JS: ' + o.errors.join(' | ')); await o.ctx.close();
      // thiếu hẳn model
      o = await open(browser, { width: 1280, height: 800 }, undefined); p = o.page; await openDrawer(p); s = await snap(p);
      ok(await isOpen(p) && s.tabs.length === 3 && s.tabs.every(t => /\s0$/.test(t.text)), `thiếu model: drawer vẫn mở, ba tab ghi 0, thấy ${JSON.stringify(s.tabs.map(t => t.text))}`);
      ok(o.errors.length === 0, 'thiếu model: lỗi JS: ' + o.errors.join(' | '));
    }

    // ---------- 7: tương tác cũ còn đúng (đóng, focus, Tab, 390px) ----------
    if (crit === '7') {
      let o = await open(browser, { width: 1280, height: 800 }, MODEL), p = o.page;
      ok(await openDrawer(p), 'mở'); let s = await snap(p);
      ok(s.active === 'kr-drawer-close', `mở xong focus vào #kr-drawer-close, thấy ${s.active}`);
      // Esc ở từng tab và khi tay nắm có focus
      for (const key of ['invariants', 'adversarial', 'regression']) { await goTab(p, key); await p.keyboard.press('Escape'); await p.waitForTimeout(200); ok(!(await isOpen(p)), `Esc ở tab ${key} phải đóng`); ok((await p.evaluate(() => document.activeElement && document.activeElement.id)) === 'nd_kr', 'đóng xong focus về #nd_kr'); await openDrawer(p); }
      await p.focus('#kr-drawer-resize'); await p.keyboard.press('Escape'); await p.waitForTimeout(200); ok(!(await isOpen(p)), 'Esc khi tay nắm có focus phải đóng'); await openDrawer(p);
      ok(await realClick(p, '#kr-drawer-close'), 'bấm X'); ok(!(await isOpen(p)), 'X phải đóng'); await openDrawer(p);
      // bấm trong khung không đóng (chữ, khoảng trống, tab, xem thêm); bấm lớp nền đóng
      await p.mouse.click(await p.evaluate(() => { const r = document.querySelector('#kr-drawer [data-kr-panel]').getBoundingClientRect(); return r.left + r.width / 2; }), 5); await p.waitForTimeout(200); ok(await isOpen(p), 'bấm trong khung (khoảng trống) không được đóng');
      await goTab(p, 'adversarial'); await realClick(p, '#kr-drawer [data-kr-more]'); ok(await isOpen(p), 'bấm tab và Xem thêm không được đóng');
      await p.mouse.click(40, 400); await p.waitForTimeout(250); ok(!(await isOpen(p)), 'chạm lớp nền ngoài khung phải đóng');
      // Tab xoay vòng trong drawer
      await openDrawer(p); const seen = new Set();
      for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); const a = await p.evaluate(() => { const e = document.activeElement; return { inside: !!e.closest('#kr-drawer'), id: e.id || e.getAttribute('data-kr-tab') || (e.hasAttribute('data-kr-more') ? 'more' : e.tagName) }; }); ok(a.inside, `Tab lần ${i + 1} ra ngoài drawer`); seen.add(a.id); }
      ok(['kr-drawer-close', 'invariants', 'kr-drawer-resize', 'more'].every(x => seen.has(x)) || ['kr-drawer-close', 'adversarial', 'kr-drawer-resize', 'more'].every(x => seen.has(x)), `vòng Tab phải đi qua nút đóng, tab đang chọn, tay nắm, nút Xem thêm; thấy ${[...seen]}`);
      ok(!seen.has('regression'), 'tab không được chọn (tabindex=-1) không nằm trong vòng Tab');
      await p.keyboard.press('Escape'); await o.ctx.close();
      // 390px
      o = await open(browser, { width: 390, height: 800 }, MODEL); p = o.page; await openDrawer(p); s = await snap(p);
      ok(Math.abs(s.panelW - 390) <= 1 && s.docW <= 390 && s.panelOverflow <= 0, `390px: panel full màn không tràn, thấy w ${s.panelW} doc ${s.docW} overflow ${s.panelOverflow}`);
      ok(s.tabs.every(t => t.l >= 0 && t.r <= 390.5 && t.h >= 40), `390px: ba tab nằm trọn trong khung và cao >= 40px, thấy ${JSON.stringify(s.tabs.map(t => [Math.round(t.l), Math.round(t.r), Math.round(t.h)]))}`);
      for (const key of ['invariants', 'adversarial', 'regression']) { ok(await goTab(p, key), `390px: bấm tab ${key} (cảm ứng/chuột thật)`); s = await snap(p); ok(s.rows.length === 10, `390px tab ${key}: 10 dòng`);
        ok(await realClick(p, '#kr-drawer [data-kr-more]'), `390px tab ${key}: bấm Xem thêm`); s = await snap(p); ok(s.rows.length === Math.min(LISTS[key].length, 20), `390px tab ${key}: sau bấm ${Math.min(LISTS[key].length, 20)} dòng, thấy ${s.rows.length}`);
        ok(s.more.every(m => m.r <= 390.5 && m.l >= 0), '390px: nút Xem thêm trong khung'); ok(s.docW <= 390, `390px tab ${key}: không cuộn ngang`); }
      const minLink = await p.$$eval('#kr-drawer a[data-kr-link]', a => Math.min(...a.map(e => e.getBoundingClientRect().height))); ok(minLink >= 32, `390px: liên kết cao >= 32px, thấy ${minLink}`);
      ok(o.errors.length === 0, 'lỗi JS: ' + o.errors.join(' | '));
    }
  } catch (e) { fails++; console.log('FAIL lỗi chạy eval: ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join(' ')); }
  await browser.close();
  if (fails) process.exit(1); console.log('PASS');
})();
