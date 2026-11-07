// Eval đối kháng tầng 3 của T-093 (adversary), drawer Knowledge Reservoir (spec products/T-092-knowledge-reservoir-drawer.md C, D).
// Chạy qua eval/T-093/adv-02-drawer.sh. Biến: D3, NODE_PATH, TOHONG_DASHBOARD_REPO (mặc định /home/user/tohong-hq-dashboard).
// Ca thử (input mà eval tầng 1 chưa chạm):
//  a) Làm tươi dữ liệu ĐỔI nội dung khi focus đang ở một liên kết trong drawer: drawer vẫn mở, focus vẫn nằm trong drawer (D: không ra ngoài).
//  b) Modal Capu đang mở: không bấm hay Tab tới được #nd_kr; drawer không mở chồng lên.
//  c) Tóm tắt nhân vật đang mở, mở drawer bằng bàn phím (Enter trên #nd_kr): Esc đóng drawer, tóm tắt vẫn còn; Esc lần nữa mới đóng tóm tắt.
//  d) 390px trong chế độ phóng to: drawer phủ trên cùng, nút đóng nằm trọn khung nhìn và là phần tử trúng chuột ở tâm.
//  e) Làm tươi sang dữ liệu cũ thiếu `model` khi drawer mở: không lỗi JS, đúng một [data-kr-empty], không dòng [data-kr-inv].
// In PASS hoặc FAIL <lý do>; mã thoát 0/1.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const D3 = process.env.D3; if (!D3) { console.log('FAIL cần biến D3'); process.exit(1); }
const REPO = path.resolve(process.env.TOHONG_DASHBOARD_REPO || '/home/user/tohong-hq-dashboard');
const base = { title: 'Việc thử', state: 'doing', holder: 'engineering', owner: 'engineering', reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0, created: '2026-10-30T09:00', updated: '2026-11-07T09:00', hours: 1, hours_since_update: 1, tier: 'B', area: 'hq/dashboard', product: 'hq' };
const tasks = [{ ...base, id: 'T-1', area: 'planner/front', product: 'planner' }, { ...base, id: 'T-2' },
  { ...base, id: 'T-3', state: 'escalated', holder: 'capu' }];
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const GH = 'https://github.com/phungrk/tohong-hq/blob/main/eval/invariants/';
const mk = (area, n, name) => { const id = 'INV-' + String(n).padStart(3, '0'); return { area, id, slug: 's' + n, name, source: 'T-0' + n, url: GH + area + '/inv-' + n + '.sh' }; };
const mkModel = list => { const inv = {}; list.forEach(x => inv[x.area] = (inv[x.area] || 0) + 1); return { invariants: inv, invariants_total: list.length, invariant_list: list, adversarial_evals: 4, regression_evals: 0, specs: 3, insight_reports: 0, last_insight: '' }; };
const L1 = [mk('_shared', 1, 'Không secret'), mk('hq/dashboard', 2, 'Hàng chờ Capu'), mk('hq/dashboard', 3, 'Không cuộn ngang'), mk('planner/front/layout', 4, 'Khung rộng')];
const L2 = L1.concat([mk('planner/front/layout', 5, 'Bất biến mới vừa vào bể')]);
const mkData = m => { const d = { generated_at: '2026-11-07T10:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster, capu_queue: [{ task: 'T-3', kind: 'escalated', decide_by: '', links: [{ label: 'DR', url: 'https://github.com/phungrk/tohong-hq/tree/main/inbox/capu', pr_state: '' }] }] }; if (m) d.model = m; return d; };
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } };
async function open(browser, vp, model) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: vp.width < 500 }); const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const o = { page, errors, data: mkData(model), ctx };
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(o.data) }));
  await page.routeWebSocket(/\/ws$/, ws => ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })));
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.clock.install();
  await page.goto('file://' + path.join(REPO, 'index.html')); await page.waitForTimeout(1300);
  return o;
}
const pointIn = (page, sel, wantChar) => page.evaluate(([sel, wantChar]) => {
  const g = document.querySelector(sel); if (!g) return null;
  const sh = g.querySelector(':scope > rect') || g; sh.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  const r = sh.getBoundingClientRect();
  for (let j = 1; j < 14; j++) for (let i = 1; i < 14; i++) {
    const x = r.left + r.width * i / 14, y = r.top + r.height * j / 14; if (x < 2 || y < 2 || x > innerWidth - 2 || y > innerHeight - 2) continue;
    const e = document.elementFromPoint(x, y); if (!e) continue;
    const inChars = !!e.closest('#chars');
    if (wantChar ? inChars : (e.closest(sel) && !inChars)) return { x, y };
  }
  return null;
}, [sel, !!wantChar]);
const isOpen = page => page.evaluate(() => { const d = document.getElementById('kr-drawer'); return !!d && !d.hidden && getComputedStyle(d).display !== 'none'; });
const inDrawer = page => page.evaluate(() => !!(document.activeElement && document.activeElement.closest('#kr-drawer')));
(async () => {
  const browser = await chromium.launch();
  try {
    // a) focus giữ trong drawer khi dữ liệu làm tươi đổi nội dung
    { const o = await open(browser, { width: 1280, height: 1100 }, mkModel(L1)), p = o.page;
      const pt = await pointIn(p, '#nd_kr'); ok(!!pt, 'a: không tìm được điểm bấm khối');
      if (pt) { await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(300);
        ok(await isOpen(p), 'a: bấm khối không mở drawer');
        await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); // tới liên kết thứ hai
        const before = await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('href'));
        ok(before && before.startsWith(GH), `a: Tab không tới liên kết trong drawer (${before})`);
        o.data = mkData(mkModel(L2)); await p.clock.fastForward(61000); await p.waitForTimeout(800);
        const n = await p.$$eval('#kr-drawer [data-kr-inv]', e => e.length);
        ok(n === 5, `a: sau làm tươi phải có 5 dòng, thấy ${n} (vòng tải lại không chạy?)`);
        ok(await isOpen(p), 'a: drawer tự đóng khi làm tươi');
        const where = await p.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.tagName) + ' ' + (a.getAttribute('href') || '') : 'null'; });
        ok(await inDrawer(p), `a: dữ liệu làm tươi (đổi nội dung) khi focus ở liên kết trong drawer làm focus rơi ra ngoài drawer (activeElement = ${where}); drawer aria-modal phải giữ focus bên trong`);
      }
      ok(o.errors.length === 0, 'a: lỗi JS ' + o.errors.join(' | ')); await o.ctx.close(); }
    // b) modal Capu mở: #nd_kr không tới được
    { const o = await open(browser, { width: 1280, height: 1100 }, mkModel(L1)), p = o.page;
      const pc = await pointIn(p, '#nd_capu');
      if (!pc) ok(false, 'b: không tìm được điểm bấm #nd_capu');
      else { await p.mouse.click(pc.x, pc.y); await p.waitForTimeout(300);
        const capuOpen = await p.evaluate(() => { const m = document.getElementById('capu-modal'); return !!m && !m.hidden; });
        ok(capuOpen, 'b: bấm #nd_capu không mở modal Capu');
        const hit = await p.evaluate(() => { const g = document.getElementById('nd_kr'); const r = g.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(e && e.closest('#nd_kr')); });
        ok(!hit, 'b: khi modal Capu mở, tâm #nd_kr vẫn bấm được (không bị lớp nền che)');
        let reached = 0; for (let i = 0; i < 15; i++) { await p.keyboard.press('Tab'); if (await p.evaluate(() => document.activeElement && document.activeElement.id === 'nd_kr')) reached++; }
        ok(reached === 0, 'b: Tab tới được #nd_kr khi modal Capu mở');
        await p.keyboard.press('Enter'); await p.waitForTimeout(200);
        ok(!(await isOpen(p)), 'b: drawer mở chồng khi modal Capu đang mở');
      }
      ok(o.errors.length === 0, 'b: lỗi JS ' + o.errors.join(' | ')); await o.ctx.close(); }
    // c) tóm tắt nhân vật mở + mở drawer bằng bàn phím: Esc từng lớp
    { const o = await open(browser, { width: 1280, height: 1100 }, mkModel(L1)), p = o.page;
      const pc = await pointIn(p, '#nd_kr', true);
      if (!pc) ok(false, 'c: không tìm được nhân vật trên khối #nd_kr');
      else { await p.mouse.click(pc.x, pc.y); await p.waitForTimeout(400);
        const sum = () => p.evaluate(() => !!document.querySelector('#fx_s g.sum'));
        ok(await sum(), 'c: bấm nhân vật không mở tóm tắt');
        ok(!(await isOpen(p)), 'c: bấm nhân vật mở drawer');
        await p.evaluate(() => document.getElementById('nd_kr').focus()); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
        ok(await isOpen(p), 'c: Enter trên #nd_kr không mở drawer khi tóm tắt đang mở');
        await p.keyboard.press('Escape'); await p.waitForTimeout(250);
        ok(!(await isOpen(p)), 'c: Esc không đóng drawer');
        ok(await sum(), 'c: Esc đầu tiên đóng luôn tóm tắt nhân vật (phải chỉ đóng drawer)');
        ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'nd_kr'), 'c: đóng drawer focus không về #nd_kr');
        await p.keyboard.press('Escape'); await p.waitForTimeout(250);
        ok(!(await sum()), 'c: Esc lần hai không đóng tóm tắt');
      }
      ok(o.errors.length === 0, 'c: lỗi JS ' + o.errors.join(' | ')); await o.ctx.close(); }
    // d) 390 + phóng to
    { const o = await open(browser, { width: 390, height: 844 }, mkModel(L1)), p = o.page;
      await p.click('#model-zoom'); await p.waitForTimeout(500);
      const pt = await pointIn(p, '#nd_kr');
      if (!pt) ok(false, 'd: phóng to 390: không tìm được điểm bấm khối');
      else { await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(350);
        ok(await isOpen(p), 'd: phóng to 390: bấm khối không mở drawer');
        const r = await p.evaluate(() => { const b = document.getElementById('kr-drawer-close'), q = b.getBoundingClientRect(); const e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
          const pn = document.querySelector('#kr-drawer [data-kr-panel]') || b.parentElement; return { inV: q.left >= 0 && q.top >= 0 && q.right <= innerWidth && q.bottom <= innerHeight, top: e === b || (e && b.contains(e)), w: pn.getBoundingClientRect().width, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
        ok(r.inV, 'd: phóng to 390: nút đóng không nằm trọn khung nhìn');
        ok(r.top, 'd: phóng to 390: nút đóng bị che (drawer không trên cùng)');
        ok(Math.abs(r.w - 390) <= 1, `d: phóng to 390: khung drawer rộng ${r.w}, phải 390`);
        await p.keyboard.press('Escape'); await p.waitForTimeout(250);
        ok(!(await isOpen(p)) && await p.evaluate(() => document.getElementById('model').getAttribute('data-zoom') === 'on'), 'd: Esc phải chỉ đóng drawer, giữ phóng to');
      }
      ok(o.errors.length === 0, 'd: lỗi JS ' + o.errors.join(' | ')); await o.ctx.close(); }
    // e) làm tươi sang dữ liệu thiếu model
    { const o = await open(browser, { width: 1280, height: 1100 }, mkModel(L1)), p = o.page;
      const pt = await pointIn(p, '#nd_kr');
      if (pt) { await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(300);
        o.data = mkData(null); await p.clock.fastForward(61000); await p.waitForTimeout(800);
        const r = await p.evaluate(() => ({ inv: document.querySelectorAll('#kr-drawer [data-kr-inv]').length, empty: document.querySelectorAll('#kr-drawer [data-kr-empty]').length }));
        ok(await isOpen(p), 'e: drawer tự đóng khi dữ liệu mất model');
        ok(r.inv === 0 && r.empty === 1, `e: dữ liệu thiếu model: phải 0 dòng và 1 [data-kr-empty], thấy ${r.inv}/${r.empty}`);
      } else ok(false, 'e: không tìm được điểm bấm khối');
      ok(o.errors.length === 0, 'e: lỗi JS ' + o.errors.join(' | ')); await o.ctx.close(); }
  } finally { await browser.close(); }
  console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL lỗi chạy eval: ' + e.message); process.exit(1); });
