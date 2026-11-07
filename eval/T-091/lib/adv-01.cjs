// T-091 adv-01 (tầng 3, adversary): các ngả spec T-089 hứa mà eval tầng 1 chưa chạm.
//  a) K6 qua hàng Cảnh báo: việc xong đang ẩn có cảnh báo (sửa tay sổ cái) → bấm hàng → Dòng thời gian của nó, không mở rộng cột, không thẻ nào pressed, không tự cuộn trang
//  b) K6 qua Feed: không tự cuộn trang
//  c) K5 làm tươi dữ liệu (dashboard.json mới sau REFRESH): limit đã mở 20 giữ nguyên, việc mới xong lên đầu
//  d) K5 việc rời Xong khi limit = 10 (chưa bấm) → thẻ ẩn kế tiếp vào, vẫn 10
//  e) Thứ tự: hoà phút với id khác số chữ số (T-99, T-100, T-1000) → số lớn trước (so số, không so chuỗi)
//  f) K2 bằng bàn phím: Enter/Space trên nút → focus ở nút; lần cuối → thẻ đầu vừa hiện
const L = require('../../T-076/lib.cjs'); const { T, dash, stamp } = L; const R = L.reporter();
const num = id => +id.slice(2);
const mk = (id, product, state, upd) => Object.assign(T(id, { state, h: 2 }), { product, area: product + '/x', updated: upd || stamp(2) });
const oracle = (tasks) => tasks.filter(x => x.state === 'done').sort((a, b) => a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : num(b.id) - num(a.id)).map(x => x.id);
function data() { const t = []; for (let i = 0; i < 30; i++) t.push(mk('T-' + (301 + i), 'hq', 'done', stamp(3 + i)));
  t.push(mk('T-801', 'hq', 'doing', stamp(1))); return t; }
const done = o => o.page.evaluate(() => { const c = [...document.querySelectorAll('#board .col')].find(c => c.querySelector('.colh span').textContent.trim() === 'Xong');
  return { ids: [...c.querySelectorAll('.tcard')].map(k => (/T-\d+/.exec(k.textContent) || [''])[0]), count: c.querySelectorAll('.colh span')[1].textContent.trim(),
    pressed: [...document.querySelectorAll('#board .tcard[aria-pressed="true"]')].length, btn: [...c.querySelectorAll('#done-more')].map(b => b.textContent.trim()),
    tl: document.getElementById('tl-title').textContent, tlRows: document.querySelectorAll('#timeline tbody tr').length }; });
const exp = async (o, tag, all, lim) => { const w = oracle(all), c = await done(o), s = w.slice(0, lim);
  R.ok(c.ids.join() === s.join(), `${tag}: cột Xong [${s.join(' ')}], thấy [${c.ids.join(' ')}]`);
  R.ok(c.count === String(w.length), `${tag}: đếm ${w.length}, thấy ${c.count}`);
  const rem = w.length - s.length; R.ok(rem ? c.btn.join() === `Xem thêm · còn ${rem} việc` : !c.btn.length, `${tag}: nút ${rem ? 'còn ' + rem : 'không có'}, thấy ${JSON.stringify(c.btn)}`); return c; };
const clickBtn = async o => { const l = o.page.locator('#done-more'); await l.scrollIntoViewIfNeeded(); await l.click(); await o.page.waitForTimeout(350); };
const vps = [['1280', { width: 1280, height: 900 }], ['390', { width: 390, height: 844 }]];
let clock = 0; const tick = () => stamp(-(++clock) / 60);
const ev = (task, event, state) => ({ type: 'event', id: 'E-91' + Math.random().toString(36).slice(2, 8), t: tick(), task, title: 'Việc ' + task, event, from: 'adversary', to: 'engineering', state, holder: 'engineering', owner: 'engineering', round: 0, severity: '', cost: 0 });
(async () => {
  await L.start();
  try {
    for (const [vn, vp] of vps) {
      // a + b
      const all = data(), ord = oracle(all), hid = ord[17], hid2 = ord[22];
      const d = dash(all); d.events = [
        { seq: 1, id: 'E-1', t: stamp(0.5), task: hid, title: 'x', event: 'board_edited_directly', from: 'engineering', to: '-', state: 'done', holder: '-', owner: 'engineering', round: 0, severity: '', cost: 0 },
        { seq: 2, id: 'E-2', t: stamp(0.4), task: hid2, title: 'x', event: 'accepted', from: 'adversary', to: 'chief-of-staff', state: 'done', holder: '-', owner: 'engineering', round: 0, severity: '', cost: 0 }];
      let o = await L.open(d, vp);
      const row = o.page.locator('#alerts tbody tr', { hasText: hid }).first();
      R.ok(await row.count() === 1, `${vn}: có hàng Cảnh báo cho việc ẩn ${hid}`);
      await row.scrollIntoViewIfNeeded(); const y0 = await o.page.evaluate(() => scrollY); await row.click(); await o.page.waitForTimeout(400);
      let c = await done(o), y1 = await o.page.evaluate(() => scrollY);
      R.ok(c.tl === 'Dòng thời gian · ' + hid && c.tlRows >= 1, `${vn}/Cảnh báo: Dòng thời gian · ${hid} có dòng sự kiện, thấy "${c.tl}" (${c.tlRows} dòng)`);
      R.ok(!c.ids.includes(hid) && c.ids.length === 10 && c.pressed === 0, `${vn}/Cảnh báo: không tự mở rộng cột, không thẻ pressed (thấy ${c.ids.length} thẻ, ${c.pressed} pressed)`);
      R.ok(Math.abs(y1 - y0) < 2, `${vn}/Cảnh báo: không tự cuộn trang (scrollY ${y0} → ${y1})`);
      const fr = o.page.locator('#feed tbody tr', { hasText: hid2 }).first(); await fr.scrollIntoViewIfNeeded();
      const y2 = await o.page.evaluate(() => scrollY); await fr.click(); await o.page.waitForTimeout(400); c = await done(o); const y3 = await o.page.evaluate(() => scrollY);
      R.ok(c.tl === 'Dòng thời gian · ' + hid2 && c.pressed === 0 && Math.abs(y3 - y2) < 2, `${vn}/Feed: Dòng thời gian · ${hid2}, không pressed, không cuộn (scrollY ${y2} → ${y3}), thấy "${c.tl}"`);
      // d: việc rời Xong khi limit 10
      const lv = data(); const top = oracle(lv)[3];
      { const e = ev(top, 'rejected', 'rework'); o.sock.send(JSON.stringify(e)); await o.page.waitForTimeout(700); const x = lv.find(v => v.id === top); x.state = 'rework'; x.updated = e.t; }
      await exp(o, `${vn}/live ${top} rời Xong (limit 10) → thẻ hạng 11 vào`, lv, 10);
      R.ok(o.errors.length === 0, `${vn}: không lỗi trang ${o.errors[0] || ''}`); await o.ctx.close();

      // c: làm tươi dữ liệu không reset limit
      const a2 = data(); o = await L.open(dash(a2), vp);
      await clickBtn(o); await exp(o, `${vn}/mở 20`, a2, 20);
      a2.push(mk('T-399', 'hq', 'done', stamp(0.1)));
      await o.page.unroute('**/raw.githubusercontent.com/**'); await o.page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(dash(a2)) }));
      await o.page.waitForTimeout(62000);
      c = await exp(o, `${vn}/sau làm tươi dashboard.json (60s) có việc mới xong → vẫn 20, việc mới ở đầu`, a2, 20);
      R.ok(o.errors.length === 0, `${vn}: không lỗi trang ${o.errors[0] || ''}`); await o.ctx.close();

      // e: hoà phút, id khác số chữ số
      const S = stamp(1.5), a3 = data(); a3.push(mk('T-99', 'hq', 'done', S), mk('T-100', 'hq', 'done', S), mk('T-1000', 'hq', 'done', S), mk('T-1001', 'hq', 'done', stamp(1.4)));
      o = await L.open(dash(a3), vp); c = await exp(o, `${vn}/hoà phút T-99/T-100/T-1000`, a3, 10);
      R.ok(c.ids.slice(0, 4).join() === 'T-1001,T-1000,T-100,T-99', `${vn}: thứ tự đầu T-1001,T-1000,T-100,T-99, thấy ${c.ids.slice(0, 4)}`);
      // f: bàn phím
      await o.page.locator('#done-more').focus(); await o.page.keyboard.press('Enter'); await o.page.waitForTimeout(350);
      R.ok(await o.page.evaluate(() => document.activeElement && document.activeElement.id) === 'done-more', `${vn}/Enter: focus ở lại nút`);
      await exp(o, `${vn}/Enter → 20`, a3, 20);
      await o.page.keyboard.press('Space'); await o.page.waitForTimeout(350);
      await o.page.keyboard.press('Space'); await o.page.waitForTimeout(350);
      c = await exp(o, `${vn}/Space x2 → hết`, a3, 40);
      const fi = await o.page.evaluate(() => { const a = document.activeElement; return a ? (/T-\d+/.exec(a.textContent) || [a.tagName])[0] : 'null'; });
      R.ok(fi === oracle(a3)[30], `${vn}/bàn phím: nút mất thì focus ở thẻ đầu vừa hiện ${oracle(a3)[30]}, thấy ${fi}`);
      R.ok(o.errors.length === 0, `${vn}: không lỗi trang ${o.errors[0] || ''}`); await o.ctx.close();
    }
  } catch (e) { console.log('FAIL lỗi chạy eval: ' + String(e).split('\n')[0]); await L.close(); process.exit(1); }
  const code = R.done(); await L.close(); process.exit(code);
})();
