// T-089: cột Xong của Kanban. Dữ liệu dashboard.json, kênh live, d3 đều giả/cục bộ; chỉ kiểm hành vi nhìn thấy.
// Dùng node eval/T-089/done-kanban.cjs <1..7>. Mọi tiêu chí chạy ở 1280px và 390px. Bấm như người dùng: cuộn vào khung nhìn rồi mới bấm.
const L = require('../T-076/lib.cjs'); const { T, dash, stamp } = L; const R = L.reporter();
const crit = process.argv[2];
const STEP = 10, BTN = '#done-more';
const num = id => +id.slice(2);
const label = n => `Xem thêm · còn ${n} việc`;
// ---- dữ liệu cố định ----
const S20 = stamp(20); // ba việc planner cùng một phút: hoà thì id lớn hơn xếp trước
const mk = (id, product, state, upd, o = {}) => Object.assign(T(id, Object.assign({ state, h: 2 }, o)), { product, area: product ? product + '/x' : '', updated: upd || stamp(2) });
function main() {
  const t = [];
  for (let i = 0; i < 25; i++) t.push(mk('T-' + (501 + i), 'hq', 'done', stamp(2 + ((i * 7) % 25))));            // 25 việc hq xong, id không theo thứ tự updated
  for (let i = 0; i < 9; i++) t.push(mk('T-' + (601 + i), 'planner', 'done', stamp(2 + ((i * 5) % 9))));       // 9 việc planner xong, khác phút
  ['T-610', 'T-611', 'T-612'].forEach(id => t.push(mk(id, 'planner', 'done', S20)));                               // 3 việc cùng phút ở vị trí 10..12
  for (let i = 0; i < 3; i++) t.push(mk('T-' + (701 + i), '', 'done', stamp(30 + i)));                             // 3 việc không sản phẩm
  for (let i = 0; i < 12; i++) t.push(mk('T-' + (801 + i), i < 7 ? 'hq' : 'planner', 'doing', stamp(1)));          // 12 việc đang làm: cột khác không bị cắt
  t.push(mk('T-820', 'hq', 'new'), mk('T-821', 'planner', 'review'), mk('T-822', 'hq', 'rework'), mk('T-823', 'hq', 'blocked', stamp(2), { owner: 'product' }), mk('T-824', 'planner', 'escalated', stamp(2), { owner: 'product' }));
  return t;
}
function edge() { // hq đúng 10 việc xong, planner 11
  const t = [];
  for (let i = 0; i < 10; i++) t.push(mk('T-' + (901 + i), 'hq', 'done', stamp(3 + i)));
  for (let i = 0; i < 11; i++) t.push(mk('T-' + (931 + i), 'planner', 'done', stamp(3 + i)));
  t.push(mk('T-960', 'hq', 'doing'));
  return t;
}
const zero = () => [mk('T-970', 'hq', 'doing'), mk('T-971', 'planner', 'review')];
// kỳ vọng: thứ tự mới -> cũ theo updated, hoà thì số id lớn trước
const oracle = (tasks, f) => tasks.filter(x => x.state === 'done' && (f === 'all' || x.product === f)).sort((a, b) => a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : num(b.id) - num(a.id)).map(x => x.id);
const others = (tasks, f) => { const g = {}; tasks.filter(x => x.state !== 'done' && (f === 'all' || x.product === f)).forEach(x => (g[x.state] = g[x.state] || []).push(x.id)); Object.keys(g).forEach(k => g[k].sort()); return g; };
// ---- đọc / thao tác ----
const read = o => o.page.evaluate(() => {
  const cols = [...document.querySelectorAll('#board .col')].map(c => { const sp = c.querySelectorAll('.colh span');
    return { label: sp[0].textContent.trim(), count: sp[1].textContent.trim(), ids: [...c.querySelectorAll('.tcard')].map(k => (/T-\d+/.exec(k.textContent) || [''])[0]),
      pressed: [...c.querySelectorAll('.tcard')].filter(k => k.getAttribute('aria-pressed') === 'true').map(k => (/T-\d+/.exec(k.textContent) || [''])[0]),
      btn: [...c.querySelectorAll('#done-more')].map(b => b.textContent.replace(/\s+/g, ' ').trim()), empty: !!c.querySelector('.empty') }; });
  return { cols, btnTotal: document.querySelectorAll('#done-more').length, kdone: (document.getElementById('k-done') || {}).textContent, tl: (document.getElementById('tl-title') || {}).textContent };
});
const doneCol = async o => (await read(o)).cols.find(c => c.label === 'Xong');
const pick = async (o, f) => { await o.page.selectOption('#product-filter', f); await o.page.waitForTimeout(500); };
const realClick = async (o, sel) => { const loc = o.page.locator(sel).first(); await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox();
  const hit = await o.page.evaluate(([x, y, s]) => { const e = document.elementFromPoint(x, y); const t = document.querySelector(s); return !!(e && t && (e === t || t.contains(e))); }, [b.x + b.width / 2, b.y + b.height / 2, sel]);
  await o.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await o.page.waitForTimeout(350); return hit; };
const focusInfo = o => o.page.evaluate(() => { const a = document.activeElement; const col = [...document.querySelectorAll('#board .col')].find(c => c.querySelector('.colh span').textContent.trim() === 'Xong');
  return { id: a && a.id, inDone: !!(a && col && col.contains(a)), text: a ? (/T-\d+/.exec(a.textContent) || [''])[0] : '' }; });
const vps = [['1280', { width: 1280, height: 900 }], ['390', { width: 390, height: 844 }]];
// kiểm cột Xong đang hiện đúng limit đầu của oracle, đếm đầu cột là tổng, nút khớp
async function expectDone(o, tag, all, f, limit) {
  const want = oracle(all, f), shown = want.slice(0, limit), rem = want.length - shown.length, c = await doneCol(o);
  R.ok(c && c.ids.join() === shown.join(), `${tag}: cột Xong hiện ${shown.length} thẻ [${shown.join(' ')}], thấy [${c && c.ids.join(' ')}]`);
  R.ok(c && c.count === String(want.length), `${tag}: số đầu cột Xong là tổng ${want.length}, thấy ${c && c.count}`);
  if (rem > 0) R.ok(c && c.btn.length === 1 && c.btn[0] === label(rem), `${tag}: đúng một nút "${label(rem)}" trong cột Xong, thấy ${JSON.stringify(c && c.btn)}`);
  else R.ok(c && c.btn.length === 0, `${tag}: hết việc ẩn thì không có nút, thấy ${JSON.stringify(c && c.btn)}`);
  return c;
}
let clock = 0; const tick = () => stamp(-(++clock) / 60); // mỗi bước muộn hơn bước trước một phút, tất định
const ev = (task, event, state, t) => ({ type: 'event', id: 'E-89' + Math.random().toString(36).slice(2, 8), t: t || tick(), task, title: 'Việc ' + task, event, from: 'adversary', to: 'engineering', state, holder: state === 'done' ? '-' : 'engineering', owner: 'engineering', round: 0, severity: '', cost: 0 });
const live = async (o, ...evs) => { for (const e of evs) o.sock.send(JSON.stringify(e)); await o.page.waitForTimeout(700); };

const CRIT = {
  // 1. Tối đa 10 thẻ, đúng 10 việc gần nhất theo updated (hoà: id lớn trước), ở mọi bộ chọn; ít hơn 10 thì đủ, đúng 10 thì không nút
  1: async () => {
    const all = main();
    for (const [vn, vp] of vps) {
      const o = await L.open(dash(all), vp);
      R.ok(await o.page.$eval('#product-filter', s => s.value) === 'all', `${vn}: mặc định Tất cả`);
      for (const f of ['all', 'planner', 'hq', 'all']) { await pick(o, f); await expectDone(o, `${vn}/${f}`, all, f, STEP); }
      R.ok(o.errors.length === 0, `${vn}: không lỗi trang ${o.errors[0] || ''}`); await o.ctx.close();
      const e = edge(), o2 = await L.open(dash(e), vp);
      for (const f of ['hq', 'planner', 'all']) { await pick(o2, f); await expectDone(o2, `${vn}/biên/${f}`, e, f, STEP); }
      await o2.ctx.close();
      const z = zero(), o3 = await L.open(dash(z), vp), c = await doneCol(o3);
      R.ok(c && c.ids.length === 0 && c.count === '0' && c.btn.length === 0 && c.empty, `${vn}: không việc xong thì cột Xong trống, đếm 0, không nút`); await o3.ctx.close();
    }
  },
  // 2. Nút ghi số còn lại, mỗi lần bấm thêm 10 (lần cuối ít hơn), thẻ mới là các thẻ kế tiếp, tới hết thì nút biến mất, focus không rơi
  2: async () => {
    const all = main();
    for (const [vn, vp] of vps) {
      const o = await L.open(dash(all), vp); let lim = STEP;
      for (const f of ['all', 'planner']) {
        await pick(o, f); lim = STEP; const total = oracle(all, f).length;
        while (lim < total) {
          const hit = await realClick(o, BTN); R.ok(hit, `${vn}/${f}: nút bấm được ở giữa nút (không bị che)`);
          const before = lim; lim = Math.min(total, lim + STEP);
          const c = await expectDone(o, `${vn}/${f}/sau bấm → ${lim}`, all, f, lim);
          const fi = await focusInfo(o);
          if (lim < total) R.ok(fi.id === 'done-more', `${vn}/${f}: nút còn thì focus ở lại nút`);
          else R.ok(fi.inDone && fi.text === oracle(all, f)[before], `${vn}/${f}: nút hết thì focus ở thẻ đầu tiên vừa hiện (${oracle(all, f)[before]}), thấy ${JSON.stringify(fi)}`);
        }
      }
      R.ok(true, `${vn}: đã bấm tới hết ở Tất cả (40 việc) và planner (12 việc)`); await o.ctx.close();
    }
  },
  // 3. Cột khác không đổi (không cắt, đủ thẻ, đếm đúng); số đếm cột Xong và KPI Đã xong là tổng, trước và sau khi bấm Xem thêm
  3: async () => {
    const all = main();
    for (const [vn, vp] of vps) {
      const o = await L.open(dash(all), vp);
      for (const f of ['all', 'hq', 'planner']) {
        await pick(o, f); const g = others(all, f), total = oracle(all, f).length;
        for (const phase of ['10 thẻ', 'sau Xem thêm']) {
          if (phase !== '10 thẻ' && (await doneCol(o)).btn.length) await realClick(o, BTN);
          const r = await read(o);
          for (const c of r.cols.filter(c => c.label !== 'Xong')) {
            const st = { 'Mới': 'new', 'Đang làm': 'doing', 'Chờ review': 'review', 'Rework': 'rework', 'Bị chặn': 'blocked', 'Chờ Capu': 'escalated' }[c.label], want = g[st] || [];
            R.ok(c.ids.slice().sort().join() === want.join() && c.count === String(want.length), `${vn}/${f}/${phase}: cột ${c.label} đủ ${want.length} thẻ, thấy ${c.ids.length} (đếm ${c.count})`);
          }
          R.ok(r.cols.map(c => c.label).join() === 'Mới,Đang làm,Chờ review,Rework,Bị chặn,Chờ Capu,Xong', `${vn}/${f}/${phase}: bảy cột đúng thứ tự`);
          R.ok(r.cols.find(c => c.label === 'Xong').count === String(total) && r.kdone === String(total), `${vn}/${f}/${phase}: số cột Xong và KPI Đã xong đều là tổng ${total}, thấy ${r.cols.find(c => c.label === 'Xong').count}/${r.kdone}`);
          R.ok(r.btnTotal <= 1, `${vn}/${f}/${phase}: không quá một nút Xem thêm trên cả trang`);
        }
      }
      R.ok(g12(all), 'dữ liệu thử có cột Đang làm với 12 thẻ (>10)'); await o.ctx.close();
    }
  },
  // 4. Đổi bộ chọn thì cột Xong về 10 thẻ; tải lại cũng 10; không nhớ số đã mở
  4: async () => {
    const all = main();
    for (const [vn, vp] of vps) {
      const o = await L.open(dash(all), vp);
      await realClick(o, BTN); await realClick(o, BTN); await expectDone(o, `${vn}/all đã mở 30`, all, 'all', 30);
      await pick(o, 'hq'); await expectDone(o, `${vn}/đổi → hq về 10`, all, 'hq', STEP);
      await realClick(o, BTN); await expectDone(o, `${vn}/hq mở 20`, all, 'hq', 20);
      await pick(o, 'all'); await expectDone(o, `${vn}/đổi → all về 10 (không nhớ 30)`, all, 'all', STEP);
      await realClick(o, BTN); await pick(o, 'planner'); await expectDone(o, `${vn}/đổi → planner về 10`, all, 'planner', STEP);
      await pick(o, 'hq'); await realClick(o, BTN); await expectDone(o, `${vn}/hq mở 20 lần nữa`, all, 'hq', 20);
      await o.page.reload(); await o.page.waitForSelector('#model svg'); await o.page.waitForTimeout(1200);
      await expectDone(o, `${vn}/tải lại trang → 10`, all, await o.page.$eval('#product-filter', s => s.value), STEP);
      R.ok(o.errors.length === 0, `${vn}: không lỗi trang ${o.errors[0] || ''}`); await o.ctx.close();
    }
  },
  // 5. Live: việc mới xong lên đầu và đẩy thẻ cũ nhất ra; đã mở thêm thì giữ số thẻ; việc rời cột Xong kéo thẻ ẩn vào; lọc sản phẩm; vẽ lại không reset
  5: async () => {
    for (const [vn, vp] of vps) {
      const all = main(); const patch = (id, state, e) => { const x = all.find(v => v.id === id); x.state = state; x.updated = e.t; };
      const o = await L.open(dash(main()), vp);
      await expectDone(o, `${vn}/đầu`, all, 'all', STEP);
      { const e = ev('T-801', 'accepted', 'done'); await live(o, e); patch('T-801', 'done', e); }
      let c = await expectDone(o, `${vn}/live T-801 xong (đang 10 thẻ)`, all, 'all', STEP);
      R.ok(c.ids[0] === 'T-801' && c.ids.length === STEP, `${vn}: T-801 lên đầu, vẫn đúng 10 thẻ`);
      await realClick(o, BTN); await realClick(o, BTN); await expectDone(o, `${vn}/mở 30`, all, 'all', 30);
      { const e = ev('T-802', 'accepted', 'done'); await live(o, e); patch('T-802', 'done', e); }
      await expectDone(o, `${vn}/live T-802 xong khi đã mở 30 → vẫn 30 thẻ`, all, 'all', 30);
      await o.page.setViewportSize({ width: vp.width, height: vp.height + 1 }); await o.page.waitForTimeout(500); await o.page.setViewportSize(vp); await o.page.waitForTimeout(500);
      await expectDone(o, `${vn}/vẽ lại do đổi cỡ cửa sổ không reset về 10`, all, 'all', 30);
      { const e = ev('T-801', 'rejected', 'rework'); await live(o, e); patch('T-801', 'rework', e); }
      await expectDone(o, `${vn}/live T-801 rời cột Xong (rework) → thẻ ẩn kế tiếp vào, vẫn 30`, all, 'all', 30);
      await pick(o, 'hq'); const hqBefore = (await doneCol(o)).ids.join();
      { const e = ev('T-808', 'accepted', 'done'); await live(o, e); patch('T-808', 'done', e); } // T-808 là planner
      c = await expectDone(o, `${vn}/hq: live việc planner xong không đổi cột`, all, 'hq', STEP);
      R.ok(c.ids.join() === hqBefore, `${vn}/hq: cột Xong của hq giữ nguyên`);
      { const e = ev('T-803', 'accepted', 'done'); await live(o, e); patch('T-803', 'done', e); } // T-803 là hq
      c = await expectDone(o, `${vn}/hq: live việc hq xong lên đầu`, all, 'hq', STEP); R.ok(c.ids[0] === 'T-803', `${vn}/hq: T-803 lên đầu`);
      await pick(o, 'all'); await expectDone(o, `${vn}/về Tất cả: 10 thẻ gồm việc live`, all, 'all', STEP);
      R.ok(o.errors.length === 0, `${vn}: không lỗi trang ${o.errors[0] || ''}`); await o.ctx.close();
    }
  },
  // 6. Việc xong đã ẩn: không có thẻ nhưng bấm hàng Hoạt động (Feed) vẫn mở Dòng thời gian của nó; không tự mở rộng cột; chọn rồi bị đẩy ẩn vẫn giữ Dòng thời gian
  6: async () => {
    const all = main(), order = oracle(all, 'all'), hidden = order[14], visible = order[2];
    const d = dash(all), t = k => stamp(0.2 + k / 100);
    d.events = [{ seq: 9001, id: 'E-9001', t: t(1), task: hidden, title: 'Việc ' + hidden, event: 'accepted', from: 'adversary', to: 'chief-of-staff', state: 'done', holder: '-', owner: 'engineering', round: 0, severity: '', cost: 0 },
      { seq: 9002, id: 'E-9002', t: t(2), task: visible, title: 'Việc ' + visible, event: 'accepted', from: 'adversary', to: 'chief-of-staff', state: 'done', holder: '-', owner: 'engineering', round: 0, severity: '', cost: 0 }];
    for (const [vn, vp] of vps) {
      const o = await L.open(d, vp); let r = await read(o);
      R.ok(!r.cols.find(c => c.label === 'Xong').ids.includes(hidden), `${vn}: ${hidden} đang ẩn (hạng 15 trong 40)`);
      await o.page.locator('#feed tbody tr', { hasText: hidden }).first().scrollIntoViewIfNeeded();
      await o.page.locator('#feed tbody tr', { hasText: hidden }).first().click(); await o.page.waitForTimeout(400); r = await read(o);
      R.ok(r.tl === 'Dòng thời gian · ' + hidden, `${vn}: bấm hàng Feed của việc ẩn → Dòng thời gian "${hidden}", thấy "${r.tl}"`);
      R.ok(await o.page.locator('#timeline tbody tr').count() >= 1, `${vn}: Dòng thời gian có ít nhất một dòng sự kiện`);
      await expectDone(o, `${vn}/sau khi mở việc ẩn`, all, 'all', STEP);
      R.ok(r.cols.every(c => !c.pressed.length), `${vn}: không thẻ nào ở trạng thái đang chọn (việc ẩn không có thẻ)`);
      await realClick(o, BTN); await realClick(o, BTN); r = await read(o);
      R.ok(r.cols.find(c => c.label === 'Xong').pressed.join() === hidden, `${vn}: mở thêm làm thẻ ${hidden} hiện ra thì đang được chọn, thấy [${r.cols.find(c => c.label === 'Xong').pressed}]`);
      R.ok(r.tl === 'Dòng thời gian · ' + hidden, `${vn}: Dòng thời gian vẫn là ${hidden}`);
      await pick(o, 'all'); await o.page.locator('#board .tcard', { hasText: visible }).first().scrollIntoViewIfNeeded(); await o.page.locator('#board .tcard', { hasText: visible }).first().click(); await o.page.waitForTimeout(400);
      r = await read(o); R.ok(r.tl === 'Dòng thời gian · ' + visible && r.cols.find(c => c.label === 'Xong').pressed.join() === visible, `${vn}: bấm thẻ đang hiện chọn đúng ${visible}`);
      await live(o, ev('T-801', 'accepted', 'done'), ev('T-802', 'accepted', 'done'), ev('T-803', 'accepted', 'done'));
      r = await read(o);
      R.ok(r.tl === 'Dòng thời gian · ' + visible, `${vn}: ${visible} bị đẩy khỏi 10 thẻ do việc live, Dòng thời gian vẫn giữ ${visible}, thấy "${r.tl}"`);
      R.ok(o.errors.length === 0, `${vn}: không lỗi trang ${o.errors[0] || ''}`); await o.ctx.close();
    }
  },
  // 7. Nút dùng được trên điện thoại 390px (và 1280px): trọn trong màn hình, đủ lớn, chữ đọc đủ, không bị che, không cuộn ngang, chạm bằng cảm ứng được, nằm dưới thẻ cuối
  7: async () => {
    const all = main();
    for (const [vn, vp] of vps) {
      const o = await L.open(dash(all), vp, { touch: vn === '390' });
      const g = async tag => {
        const loc = o.page.locator(BTN); await loc.scrollIntoViewIfNeeded(); const m = await o.page.evaluate(() => { const b = document.querySelector('#done-more'); if (!b) return null; const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
          const cards = [...b.parentElement.querySelectorAll('.tcard')], last = cards[cards.length - 1], lr = last && last.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { l: r.left, r: r.right, w: r.width, h: r.height, fs: parseFloat(cs.fontSize), clip: b.scrollWidth > b.clientWidth + 1, hit: !!(e && (e === b || b.contains(e))), below: !lr || r.top >= lr.bottom - 0.5, vw: innerWidth,
            hscroll: document.scrollingElement.scrollWidth > innerWidth + 1, tag: b.tagName, type: b.getAttribute('type') }; });
        R.ok(!!m, `${vn}/${tag}: có nút`); if (!m) return;
        R.ok(m.tag === 'BUTTON', `${vn}/${tag}: là phần tử button`);
        R.ok(m.l >= 0 && m.r <= m.vw, `${vn}/${tag}: nút nằm trọn trong 0..${m.vw}px (${Math.round(m.l)}..${Math.round(m.r)})`);
        R.ok(m.h >= 40 && m.w >= 120, `${vn}/${tag}: nút cao >= 40 và rộng >= 120 (thấy ${Math.round(m.w)}x${Math.round(m.h)})`);
        R.ok(m.fs >= 14, `${vn}/${tag}: chữ nút >= 14px (thấy ${m.fs})`);
        R.ok(!m.clip, `${vn}/${tag}: chữ nút không bị cắt`);
        R.ok(m.hit, `${vn}/${tag}: sau khi cuộn tới, giữa nút không bị phần tử khác che`);
        R.ok(m.below, `${vn}/${tag}: nút nằm dưới thẻ cuối của cột Xong`);
        R.ok(!m.hscroll, `${vn}/${tag}: trang không cuộn ngang`);
      };
      await g('10 thẻ');
      const b = await o.page.locator(BTN).boundingBox();
      if (vn === '390') await o.page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await o.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await o.page.waitForTimeout(400); await expectDone(o, `${vn}/chạm/bấm một lần → 20`, all, 'all', 20); await g('20 thẻ');
      await realClick(o, BTN); await realClick(o, BTN);
      const c = await doneCol(o); R.ok(c.ids.length === 40 && c.btn.length === 0, `${vn}: bấm tới hết: 40 thẻ, không còn nút`);
      R.ok(!(await o.page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth + 1)), `${vn}: hiện đủ 40 thẻ, trang không cuộn ngang`);
      await o.ctx.close();
    }
  },
};
const g12 = all => all.filter(x => x.state === 'doing').length > 10;
(async () => {
  if (!CRIT[crit]) { console.log('FAIL cần tham số tiêu chí 1..7'); process.exit(1); }
  await L.start();
  try { await CRIT[crit](); } catch (e) { console.log('FAIL lỗi chạy eval: ' + String(e).split('\n')[0]); L.close(); process.exit(1); }
  const code = R.done(); await L.close(); process.exit(code);
})();
