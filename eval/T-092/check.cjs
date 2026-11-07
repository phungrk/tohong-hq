// Eval tầng 1 của T-092 (spec products/T-092-knowledge-reservoir-drawer.md), tiêu chí 2-5, kiểm HÀNH VI trên trang thật với dữ liệu cố định.
// Chạy: cd /home/user/tohong-hq && D3=/đường/dẫn/d3.min.js NODE_PATH=$(npm root -g) node eval/T-092/check.cjs --criterion 2|3|4|5
// Làm tươi dữ liệu khi drawer mở: page.clock.fastForward(61000) kích hoạt vòng tải lại (60s) của trang.
// Biến: D3 (bắt buộc), TOHONG_DASHBOARD_REPO (mặc định /home/user/tohong-hq-dashboard). In PASS hoặc FAIL <lý do>, mã thoát 0/1.
// Không đọc mã nguồn; chỉ dùng id/thuộc tính trong spec. Cuộn vào khung nhìn rồi bấm bằng toạ độ chuột thật tại điểm elementFromPoint thuộc #nd_kr.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const D3 = process.env.D3; if (!D3) { console.log('FAIL cần biến D3=/đường/dẫn/d3.min.js'); process.exit(1); }
const REPO = path.resolve(process.env.TOHONG_DASHBOARD_REPO || '/home/user/tohong-hq-dashboard');
const crit = process.argv.includes('--criterion') ? process.argv[process.argv.indexOf('--criterion') + 1] : '';
if (!['2', '3', '4', '5'].includes(crit)) { console.log('FAIL --criterion phải là 2, 3, 4 hoặc 5'); process.exit(1); }

const base = { title: 'Việc thử', state: 'doing', holder: 'engineering', owner: 'engineering', reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0, created: '2026-10-30T09:00', updated: new Date(Date.now() + 7 * 3600e3 - 3600e3).toISOString().slice(0, 16), hours_since_update: 1, tier: 'A', evals: 1, spec_returns: 0, evals_added: 0 };
const tasks = [{ ...base, id: 'T-1', area: 'planner/front', product: 'planner' }, { ...base, id: 'T-2', area: 'hq/dashboard', product: 'hq' }];
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const GH = 'https://github.com/phungrk/tohong-hq/blob/main/eval/invariants/';
const mk = (area, n, name, source) => { const id = 'INV-' + String(n).padStart(3, '0'); return { area, id, slug: 's' + n, name, source, url: GH + area + '/inv-' + String(n).padStart(3, '0') + '-s' + n + '.sh', path: 'eval/invariants/' + area + '/inv-' + String(n).padStart(3, '0') + '-s' + n + '.sh' }; };
const LONGTOK = 'x'.repeat(140);
const list = [mk('_shared', 1, 'Không có secret trong repo', 'T-010'), mk('_shared', 2, 'Sổ cái đọc được', ''),
  mk('dashboard/model', 1, 'Vùng cũ chưa có tiền tố', 'T-020'),
  mk('hq/dashboard', 8, 'Hàng chờ Capu không chứa việc đã xử lý', 'T-076'), mk('hq/dashboard', 12, LONGTOK, 'T-077'),
  mk('hq/dashboard/model', 3, 'Dot nằm trên đường', 'T-028'),
  mk('planner/front/layout', 1, 'Khung rộng đúng min(viewport, app-max)', 'T-025'), mk('planner/front/layout', 2, 'Không cuộn ngang', 'T-025'), mk('planner/front/layout', 9, 'Lớp mở khoá cuộn nền', 'T-040'),
  mk('planner/vendor/pool', 1, 'Pool khớp văn bản nguồn', 'T-073')];
const inv = {}; list.forEach(x => inv[x.area] = (inv[x.area] || 0) + 1);
const MODEL = { invariants: inv, invariants_total: list.length, invariant_list: list, adversarial_evals: 7, regression_evals: 3, specs: 5, insight_reports: 1, last_insight: '2026-11-01-weekly.md' };
// bể lớn để thử cuộn trong drawer
const big = []; for (let i = 1; i <= 112; i++) big.push(mk(i % 2 ? 'planner/front/layout' : 'hq/dashboard', i, 'Bất biến số ' + i + ' ' + 'mô tả khá dài để xuống dòng '.repeat(3), 'T-' + (100 + i % 9)));
const binv = {}; big.forEach(x => binv[x.area] = (binv[x.area] || 0) + 1);
const BIG = { ...MODEL, invariants: binv, invariants_total: 112, invariant_list: big };
const ALL = list.length, HQ = 2 + 3, PL = 2 + 4; // _shared 2; hq = 2+1; planner = 3+1
const SCOPE = { all: ALL, hq: HQ, planner: PL };
const mkData = m => ({ generated_at: '2026-11-07T10:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster, capu_queue: [], model: m });

let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } };
async function open(browser, vp, model, clock) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: vp.width < 500 }); const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const o = { page, errors, data: mkData(model) };
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(o.data) }));
  await page.routeWebSocket(/\/ws$/, ws => ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })));
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  if (clock) await page.clock.install();
  await page.goto('file://' + path.join(REPO, 'index.html')); await page.waitForTimeout(1300);
  return o;
}
// điểm bấm thuộc khối (không phải nhân vật), sau khi cuộn vào khung nhìn
const blockPoint = (page, wantChar) => page.evaluate(wantChar => {
  const g = document.getElementById('nd_kr'); if (!g) return null;
  const sh = g.querySelector(':scope > rect') || g; sh.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  const r = sh.getBoundingClientRect();
  for (let j = 1; j < 14; j++) for (let i = 1; i < 14; i++) {
    const x = r.left + r.width * i / 14, y = r.top + r.height * j / 14; if (x < 2 || y < 2 || x > innerWidth - 2 || y > innerHeight - 2) continue;
    const e = document.elementFromPoint(x, y); if (!e) continue;
    const inChars = !!e.closest('#chars');
    if (wantChar ? inChars : (e.closest('#nd_kr') && !inChars)) return { x, y };
  }
  return null;
}, !!wantChar);
const clickBlock = async page => { const p = await blockPoint(page, false); if (!p) return false; await page.mouse.click(p.x, p.y); await page.waitForTimeout(350); return true; };
const isOpen = page => page.evaluate(() => { const d = document.getElementById('kr-drawer'); if (!d || d.hidden) return false; const s = getComputedStyle(d); const r = d.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; });
const txt = (page, s) => page.$eval(s, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
const pick = async (page, f) => { await page.selectOption('#product-filter', f); await page.waitForTimeout(500); };
const panelOf = page => page.evaluateHandle(() => { let e = document.getElementById('kr-title'); while (e && e.parentElement && e.parentElement.id !== 'kr-drawer') e = e.parentElement; return e; });
const snapDrawer = page => page.evaluate(() => {
  const d = document.getElementById('kr-drawer'); if (!d) return null;
  const stats = {}; d.querySelectorAll('[data-kr-stat]').forEach(e => stats[e.getAttribute('data-kr-stat')] = e.getAttribute('data-value'));
  const areas = [...d.querySelectorAll('[data-kr-area]')].map(a => ({ area: a.getAttribute('data-kr-area'), n: a.querySelectorAll('[data-kr-inv]').length }));
  const rows = [...d.querySelectorAll('[data-kr-inv]')].map(r => { const a = r.querySelector('a[data-kr-link]'); return { area: r.getAttribute('data-area'), id: r.getAttribute('data-id'), source: r.getAttribute('data-source'), text: r.textContent.replace(/\s+/g, ' ').trim(), href: a && a.getAttribute('href'), target: a && a.getAttribute('target'), rel: a && a.getAttribute('rel'), linkText: a && a.textContent.trim(), nlinks: r.querySelectorAll('a[data-kr-link]').length, parent: r.closest('[data-kr-area]') && r.closest('[data-kr-area]').getAttribute('data-kr-area') }; });
  return { title: (document.getElementById('kr-title') || {}).textContent, stats, areas, rows, filter: [...d.querySelectorAll('[data-kr-filter]')].map(e => e.textContent.replace(/\s+/g, ' ').trim()), empty: [...d.querySelectorAll('[data-kr-empty]')].map(e => e.textContent.trim()), dialog: d.getAttribute('role') === 'dialog' && d.getAttribute('aria-modal') === 'true' && d.getAttribute('aria-labelledby') === 'kr-title' };
});
const within = (a, p) => a === '_shared' || a === p || a.startsWith(p + '/');

(async () => {
  const browser = await chromium.launch();
  try {
    // ---------- 2: khối hiện số đúng ----------
    if (crit === '2') for (const [tag, vp] of [['1280', { width: 1280, height: 1500 }], ['390', { width: 390, height: 900 }]]) {
      const o = await open(browser, vp, MODEL), p = o.page;
      for (const f of ['all', 'hq', 'planner']) {
        if (f !== 'all') await pick(p, f);
        const want = `${SCOPE[f]} bất biến · 7 eval đối kháng · 3 hồi quy`;
        ok(await txt(p, '#krTxt') === want, `${tag}/${f}: #krTxt phải "${want}", thấy "${await txt(p, '#krTxt')}"`);
        const rows = await p.$$eval('#nd_kr [data-kr-scope]', e => Object.fromEntries(e.map(x => [x.getAttribute('data-kr-scope'), x.textContent.trim()])));
        const wantRows = { _shared: '_shared 2', planner: 'planner 4', hq: 'hq 3', khac: 'khác 1' };
        ok(JSON.stringify(rows) === JSON.stringify(wantRows), `${tag}/${f}: dòng cây luôn cả cây ${JSON.stringify(wantRows)}, thấy ${JSON.stringify(rows)}`);
        const lbl = f === 'all' ? '6 vùng · 5 spec trong bể' : '3 vùng trong bể';
        ok(await txt(p, '#nd_kr .lbl') === lbl, `${tag}/${f}: #nd_kr .lbl phải "${lbl}", thấy "${await txt(p, '#nd_kr .lbl')}"`);
      }
      ok(!/^0 bất biến/.test(await txt(p, '#krTxt') || ''), `${tag}: số không được về 0 giả`);
      ok(o.errors.length === 0, `${tag}: không lỗi JS: ${o.errors[0]}`);
      await p.context().close();
    }

    // ---------- 3: bấm mở drawer, nội dung ----------
    if (crit === '3') {
      const o = await open(browser, { width: 1280, height: 900 }, MODEL), p = o.page;
      const a11y = await p.$eval('#nd_kr', e => ({ tab: e.getAttribute('tabindex'), role: e.getAttribute('role'), label: e.getAttribute('aria-label') }));
      ok(a11y.tab === '0' && a11y.role === 'button', `#nd_kr phải tabindex=0 role=button, thấy ${JSON.stringify(a11y)}`);
      ok(a11y.label === `Knowledge Reservoir, ${ALL} bất biến, bấm để xem danh sách`, `aria-label #nd_kr sai: "${a11y.label}"`);
      ok(!(await isOpen(p)), 'mới vào trang drawer phải đóng');
      ok(await p.$eval('#kr-drawer', e => e.hidden).catch(() => false), 'lúc đóng #kr-drawer phải có thuộc tính hidden');
      // bấm nhân vật không mở drawer
      const cp = await blockPoint(p, true);
      if (cp) { await p.mouse.click(cp.x, cp.y); await p.waitForTimeout(350); ok(!(await isOpen(p)), 'bấm nhân vật trên khối không được mở drawer'); await p.keyboard.press('Escape'); await p.waitForTimeout(200); await p.mouse.click(2, 2); await p.waitForTimeout(200); }
      ok(await clickBlock(p), 'không tìm được điểm bấm trên #nd_kr');
      ok(await isOpen(p), 'bấm khối #nd_kr phải mở #kr-drawer');
      const s = await snapDrawer(p);
      ok(s && s.dialog, 'drawer phải role=dialog aria-modal=true aria-labelledby=kr-title');
      ok(s && s.title.trim() === `Knowledge Reservoir (${ALL} bất biến)`, `tiêu đề phải "Knowledge Reservoir (${ALL} bất biến)", thấy "${s && s.title}"`);
      ok(s && JSON.stringify(s.stats) === JSON.stringify({ invariants: String(ALL), adversarial: '7', regression: '3', specs: '5' }), `[data-kr-stat] sai: ${JSON.stringify(s && s.stats)}`);
      const wantAreas = [['_shared', 2], ['dashboard/model', 1], ['hq/dashboard', 2], ['hq/dashboard/model', 1], ['planner/front/layout', 3], ['planner/vendor/pool', 1]];
      ok(s && JSON.stringify(s.areas.map(a => [a.area, a.n])) === JSON.stringify(wantAreas), `nhóm vùng phải ${JSON.stringify(wantAreas)}, thấy ${JSON.stringify(s && s.areas.map(a => [a.area, a.n]))}`);
      ok(s && s.rows.length === ALL, `phải ${ALL} dòng [data-kr-inv], thấy ${s && s.rows.length}`);
      ok(s && JSON.stringify(s.rows.map(r => r.id + '@' + r.area)) === JSON.stringify(list.map(x => x.id + '@' + x.area)), 'thứ tự/id/vùng dòng phải đúng invariant_list');
      ok(s && s.rows.every(r => r.parent === r.area), 'mỗi dòng phải nằm trong nhóm [data-kr-area] đúng vùng của nó');
      if (s) list.forEach((x, i) => {
        const r = s.rows[i]; if (!r) return;
        ok(r.text.includes(x.id) && r.text.includes(x.name), `dòng ${x.area} ${x.id} phải hiện mã và tên "${x.name.slice(0, 30)}"`);
        ok(r.source === x.source, `dòng ${x.id} data-source phải "${x.source}", thấy "${r.source}"`);
        ok(x.source ? r.text.includes('nguồn ' + x.source) : !/nguồn/.test(r.text), `dòng ${x.id}: ${x.source ? 'phải có' : 'không được có'} chữ "nguồn ${x.source}"`);
        ok(r.nlinks === 1 && r.href === x.url && r.target === '_blank' && /noopener/.test(r.rel || '') && /noreferrer/.test(r.rel || '') && r.linkText === 'Mở trên GitHub', `dòng ${x.id}: liên kết "Mở trên GitHub" đúng url/target/rel, thấy ${JSON.stringify({ h: r.href, t: r.target, r: r.rel, l: r.linkText })}`);
      });
      ok(s && s.filter.length === 0, 'chọn Tất cả thì không có [data-kr-filter]');
      // phím Enter/Space mở khi có focus bàn phím
      await p.keyboard.press('Escape'); await p.waitForTimeout(250);
      ok(!(await isOpen(p)), 'Esc phải đóng drawer');
      for (const key of ['Enter', 'Space']) {
        await p.focus('#nd_kr'); await p.keyboard.press(key === 'Space' ? ' ' : key); await p.waitForTimeout(300);
        ok(await isOpen(p), `${key} khi #nd_kr có focus phải mở drawer`);
        await p.keyboard.press('Escape'); await p.waitForTimeout(250);
      }
      // dữ liệu cũ không có invariant_list
      const o2 = await open(browser, { width: 1280, height: 900 }, { ...MODEL, invariant_list: undefined });
      ok(await clickBlock(o2.page) && await isOpen(o2.page), 'dữ liệu thiếu invariant_list: bấm khối vẫn mở drawer');
      const s2 = await snapDrawer(o2.page);
      ok(s2 && s2.rows.length === 0 && s2.empty.length === 1 && s2.empty[0] === 'Chưa có bất biến nào trong phạm vi này', `thiếu invariant_list: không dòng, đúng một [data-kr-empty] "Chưa có bất biến nào trong phạm vi này", thấy ${JSON.stringify(s2 && s2.empty)}`);
      ok(o.errors.length === 0 && o2.errors.length === 0, `không lỗi JS: ${o.errors[0] || o2.errors[0]}`);
      await o.page.context().close(); await o2.page.context().close();
    }

    // ---------- 4: đóng, focus, 390px, phóng to ----------
    if (crit === '4') {
      // 1280
      let o = await open(browser, { width: 1280, height: 800 }, BIG), p = o.page;
      const closers = {
        'nút X': async () => { await p.click('#kr-drawer-close'); },
        'phím Esc': async () => { await p.keyboard.press('Escape'); },
        'chạm ngoài khung': async () => { await p.mouse.click(6, 400); },
      };
      for (const [name, fn] of Object.entries(closers)) {
        ok(await clickBlock(p), `1280/${name}: không bấm được khối`);
        ok(await isOpen(p), `1280/${name}: drawer phải mở`);
        ok(await p.evaluate(() => document.activeElement && document.activeElement.id) === 'kr-drawer-close', `1280/${name}: khi mở focus phải ở #kr-drawer-close`);
        if (name === 'nút X') {
          const b = await p.$eval('#kr-drawer-close', e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, label: e.getAttribute('aria-label'), t: e.textContent.trim() }; });
          ok(b.w >= 44 && b.h >= 44 && b.label === 'Đóng' && /[×x]/i.test(b.t), `nút đóng phải >=44x44, aria-label Đóng, chữ ×: ${JSON.stringify(b)}`);
          const g = await p.evaluate(() => { const e = document.getElementById('kr-title'); let pn = e; while (pn.parentElement && pn.parentElement.id !== 'kr-drawer') pn = pn.parentElement; const r = pn.getBoundingClientRect(); return { w: r.width, right: r.right, vw: innerWidth, h: r.height, vh: innerHeight, z: getComputedStyle(document.getElementById('kr-drawer')).zIndex }; });
          ok(g.w <= 561 && g.w >= 300 && Math.abs(g.right - g.vw) <= 1, `1280: khung drawer rộng <=560 và sát mép phải: ${JSON.stringify(g)}`);
          ok(g.h <= g.vh + 1, `1280: khung drawer không cao hơn khung nhìn: ${JSON.stringify(g)}`);
          // bấm trong khung không đóng
          const t = await p.$eval('#kr-title', e => { const r = e.getBoundingClientRect(); return { x: r.left + 5, y: r.top + r.height / 2 }; });
          await p.mouse.click(t.x, t.y); await p.waitForTimeout(250);
          ok(await isOpen(p), '1280: bấm vào trong khung drawer (tiêu đề) không được đóng');
          // Tab xoay vòng trong drawer
          let outside = 0; for (let i = 0; i < 6; i++) { await p.keyboard.press('Tab'); if (!(await p.evaluate(() => !!(document.activeElement && document.activeElement.closest('#kr-drawer'))))) outside++; }
          ok(outside === 0, `1280: Tab ra ngoài drawer ${outside}/6 lần`);
          outside = 0; for (let i = 0; i < 4; i++) { await p.keyboard.press('Shift+Tab'); if (!(await p.evaluate(() => !!(document.activeElement && document.activeElement.closest('#kr-drawer'))))) outside++; }
          ok(outside === 0, `1280: Shift+Tab ra ngoài drawer ${outside}/4 lần`);
          // cuộn trong drawer được
          const sc = await p.evaluate(() => { const els = [...document.querySelectorAll('#kr-drawer *')].concat([document.getElementById('kr-drawer')]); return els.some(e => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 20; }); });
          ok(sc, '1280: 112 bất biến phải cuộn dọc được trong drawer');
        }
        await fn(); await p.waitForTimeout(300);
        ok(!(await isOpen(p)), `1280/${name}: drawer phải đóng`);
        ok(await p.evaluate(() => document.activeElement && document.activeElement.id) === 'nd_kr', `1280/${name}: sau khi đóng focus phải về #nd_kr, thấy ${await p.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName))}`);
      }
      await p.context().close();
      // 390
      o = await open(browser, { width: 390, height: 800 }, BIG); p = o.page;
      const sw0 = await p.evaluate(() => document.documentElement.scrollWidth);
      ok(await clickBlock(p), '390: không bấm được khối'); ok(await isOpen(p), '390: bấm khối phải mở drawer');
      const g = await p.evaluate(() => {
        let pn = document.getElementById('kr-title'); while (pn.parentElement && pn.parentElement.id !== 'kr-drawer') pn = pn.parentElement; const r = pn.getBoundingClientRect(), c = document.getElementById('kr-drawer-close').getBoundingClientRect();
        const links = [...document.querySelectorAll('#kr-drawer a[data-kr-link]')].map(a => a.getBoundingClientRect().height);
        const wide = [...document.querySelectorAll('#kr-drawer *')].filter(e => e.scrollWidth > e.clientWidth + 1 && /(visible|auto|scroll)/.test(getComputedStyle(e).overflowX) && e.clientWidth > 0 && getComputedStyle(e).display !== 'inline').length;
        return { left: r.left, right: r.right, w: r.width, vw: innerWidth, panelOverflow: pn.scrollWidth - pn.clientWidth, closeIn: c.left >= 0 && c.right <= innerWidth + 1 && c.top >= 0 && c.bottom <= innerHeight + 1, cw: c.width, ch: c.height, h: r.height, vh: innerHeight, minLink: Math.min(...links), docW: document.documentElement.scrollWidth, wide };
      });
      ok(g.w >= 388 && g.left >= -1 && g.right <= g.vw + 1, `390: khung drawer phải rộng đúng khung nhìn: ${JSON.stringify(g)}`);
      ok(g.panelOverflow <= 1 && g.wide === 0, `390: nội dung drawer không được tràn ngang: ${JSON.stringify({ o: g.panelOverflow, wide: g.wide })}`);
      ok(g.docW <= Math.max(sw0, g.vw) + 1, `390: trang không được phát sinh cuộn ngang khi mở (trước ${sw0}, sau ${g.docW})`);
      ok(g.closeIn && g.cw >= 44 && g.ch >= 44, `390: nút đóng phải trọn trong khung nhìn và >=44px: ${JSON.stringify(g)}`);
      ok(g.h <= g.vh + 1, `390: khung drawer không cao hơn khung nhìn: ${JSON.stringify(g)}`);
      ok(g.minLink >= 32, `390: liên kết phải cao >=32px, thấy ${g.minLink}`);
      const tx = await p.evaluate(() => { const d = document.getElementById('kr-drawer'); const els = [...d.querySelectorAll('*')].concat([d]); const s = els.find(e => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 20); if (!s) return null; s.scrollTop = 500; return s.scrollTop; });
      ok(tx !== null && tx > 0, '390: drawer phải cuộn dọc được');
      await p.touchscreen.tap(195, 20).catch(() => {}); // bấm vào khung (không phải nền) không đóng được vì khung phủ hết
      await p.click('#kr-drawer-close'); await p.waitForTimeout(300);
      ok(!(await isOpen(p)), '390: nút X phải đóng drawer');
      ok(await clickBlock(p) && await isOpen(p), '390: mở lại'); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
      ok(!(await isOpen(p)), '390: Esc phải đóng drawer');
      ok(o.errors.length === 0, `390: không lỗi JS: ${o.errors[0]}`);
      await p.context().close();
      // phóng to sơ đồ
      o = await open(browser, { width: 1280, height: 800 }, MODEL); p = o.page;
      await p.click('#model-zoom'); await p.waitForTimeout(500);
      const z = () => p.$eval('#model', e => e.getAttribute('data-zoom'));
      ok(await z() === 'on', 'bấm #model-zoom phải bật phóng to');
      ok(await clickBlock(p), 'phóng to: không bấm được khối'); ok(await isOpen(p), 'phóng to: bấm khối vẫn phải mở drawer');
      const top = await p.evaluate(() => { const e = document.elementFromPoint(innerWidth - 40, innerHeight / 2); return !!(e && e.closest('#kr-drawer')); });
      ok(top, 'phóng to: drawer phải nằm trên cùng (phần tử ở giữa mép phải thuộc drawer)');
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      ok(!(await isOpen(p)), 'phóng to: Esc đầu phải đóng drawer'); ok(await z() === 'on', 'phóng to: Esc đầu chỉ đóng drawer, sơ đồ vẫn phóng to');
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      ok(await z() !== 'on', 'phóng to: Esc thứ hai phải thoát phóng to');
      await p.context().close();
    }

    // ---------- 5: bộ lọc áp vào drawer ----------
    if (crit === '5') {
      const o = await open(browser, { width: 1280, height: 900 }, MODEL), p = o.page;
      ok(await clickBlock(p), 'không bấm được khối');
      for (const f of ['hq', 'planner', 'all']) {
        await pick(p, f);
        ok(await isOpen(p), `${f}: đổi bộ chọn khi drawer mở thì drawer không được đóng`);
        const s = await snapDrawer(p); if (!s) { ok(false, `${f}: thiếu drawer`); continue; }
        const want = f === 'all' ? list : list.filter(x => within(x.area, f));
        ok(s.rows.length === want.length && JSON.stringify(s.rows.map(r => r.id + '@' + r.area)) === JSON.stringify(want.map(x => x.id + '@' + x.area)), `${f}: dòng phải ${want.map(x => x.id + '@' + x.area)}, thấy ${s.rows.map(r => r.id + '@' + r.area)}`);
        ok(s.title.trim() === `Knowledge Reservoir (${SCOPE[f]} bất biến)`, `${f}: tiêu đề phải (${SCOPE[f]} bất biến), thấy "${s.title}"`);
        ok(s.stats.invariants === String(SCOPE[f]) && s.stats.adversarial === '7' && s.stats.regression === '3', `${f}: [data-kr-stat] invariants=${SCOPE[f]}, adversarial=7, regression=3 (không lọc), thấy ${JSON.stringify(s.stats)}`);
        ok(f === 'all' ? s.stats.specs === '5' : !('specs' in s.stats), `${f}: specs ${f === 'all' ? 'phải 5' : 'không được hiện khi lọc'}, thấy ${JSON.stringify(s.stats)}`);
        const wantA = [...new Set(want.map(x => x.area))];
        ok(JSON.stringify(s.areas.map(a => a.area)) === JSON.stringify(wantA), `${f}: nhóm vùng phải ${wantA}, thấy ${s.areas.map(a => a.area)}`);
        if (f === 'all') ok(s.filter.length === 0, 'all: không có [data-kr-filter]');
        else ok(s.filter.length === 1 && s.filter[0] === `Đang lọc theo sản phẩm: ${f}. Eval đối kháng và hồi quy tính cả công ty.`, `${f}: đúng một [data-kr-filter] "Đang lọc theo sản phẩm: ${f}. Eval đối kháng và hồi quy tính cả công ty.", thấy ${JSON.stringify(s.filter)}`);
        const lb = await p.$eval('#nd_kr', e => e.getAttribute('aria-label'));
        ok(lb === `Knowledge Reservoir, ${SCOPE[f]} bất biến, bấm để xem danh sách`, `${f}: aria-label khối phải theo bộ lọc, thấy "${lb}"`);
        ok((await txt(p, '#krTxt')).startsWith(`${SCOPE[f]} bất biến`), `${f}: #krTxt phải khớp tiêu đề drawer`);
      }
      // lọc ra rỗng: sản phẩm không có bất biến riêng (vẫn có _shared) -> dùng dữ liệu không có _shared
      // dữ liệu tải lại khi mở: cập nhật tại chỗ, không đóng, giữ vị trí cuộn nếu nội dung không đổi
      await p.context().close();
      const o2 = await open(browser, { width: 1280, height: 600 }, BIG, true), q = o2.page;
      ok(await clickBlock(q), 'bể lớn: không bấm được khối'); ok(await isOpen(q), 'bể lớn: phải mở');
      const set = await q.evaluate(() => { const d = document.getElementById('kr-drawer'); const els = [...d.querySelectorAll('*')].concat([d]); const s = els.find(e => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 20); if (!s) return null; s.scrollTop = 400; window.__krs = s; return s.scrollTop; });
      ok(set > 0, 'bể lớn: không cuộn được để thử giữ vị trí');
      await q.clock.fastForward(61000); await q.waitForTimeout(700);
      ok(await isOpen(q), 'tải lại cùng dữ liệu: drawer không được đóng');
      ok(await q.evaluate(() => { const d = document.getElementById('kr-drawer'); const els = [...d.querySelectorAll('*')].concat([d]); const s = els.find(e => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 20); return s ? Math.abs(s.scrollTop - 400) <= 2 : false; }), 'tải lại cùng dữ liệu: vị trí cuộn trong drawer phải giữ nguyên (400)');
      o2.data = mkData({ ...BIG, adversarial_evals: 9, regression_evals: 4 });
      await q.clock.fastForward(61000); await q.waitForTimeout(700);
      ok(await isOpen(q), 'dữ liệu đổi: drawer không được đóng');
      const st = (await snapDrawer(q)).stats; ok(st.adversarial === '9' && st.regression === '4', `dữ liệu đổi khi mở: [data-kr-stat] phải cập nhật tại chỗ (9, 4), thấy ${JSON.stringify(st)}`);
      ok(o2.errors.length === 0, `không lỗi JS: ${o2.errors[0]}`);
      await q.context().close();
    }
  } catch (e) { fails++; console.log('FAIL ngoại lệ: ' + String(e.message).split('\n')[0]); }
  await browser.close();
  if (fails) { console.log(`FAIL ${fails} điều kiện (tiêu chí ${crit})`); process.exit(1); }
  console.log('PASS');
})();
