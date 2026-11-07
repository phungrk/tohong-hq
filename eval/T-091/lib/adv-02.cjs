// T-091 adv-02 (tầng 3, adversary): K7 "trang không cuộn ngang ở 390px, kể cả khi đã hiện hết thẻ" với dữ liệu khó:
// tiêu đề việc xong rất dài không có dấu cách (đường dẫn), id 4 chữ số; và nút vẫn nằm trọn trong khung nhìn ở 320px.
const L = require('../../T-076/lib.cjs'); const { T, dash, stamp } = L; const R = L.reporter();
const mk = (id, state, upd, title) => Object.assign(T(id, { state, h: 2, title }), { product: 'hq', area: 'hq/x', updated: upd });
(async () => {
  await L.start();
  try {
    const t = []; for (let i = 0; i < 25; i++) t.push(mk('T-' + (1001 + i), 'done', stamp(3 + i), i === 17 ? 'Sửa https://github.com/phungrk/tohong-hq-dashboard/blob/main/index.html#L779-very-long-path-without-any-space-at-all' : 'Việc ' + i));
    for (const [vn, vp] of [['390', { width: 390, height: 844 }], ['320', { width: 320, height: 640 }]]) {
      const o = await L.open(dash(t), vp, { touch: true });
      const hs = () => o.page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth + 1);
      R.ok(!(await hs()), `${vn}: 10 thẻ, không cuộn ngang`);
      for (let k = 0; k < 2; k++) { const l = o.page.locator('#done-more'); await l.scrollIntoViewIfNeeded(); const b = await l.boundingBox();
        R.ok(b.x >= 0 && b.x + b.width <= vp.width, `${vn}: nút trọn trong khung nhìn (${Math.round(b.x)}..${Math.round(b.x + b.width)})`);
        await o.page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await o.page.waitForTimeout(400); }
      const n = await o.page.evaluate(() => [...document.querySelectorAll('#board .col')].pop().querySelectorAll('.tcard').length);
      R.ok(n === 25, `${vn}: hiện hết 25 thẻ, thấy ${n}`);
      R.ok(!(await hs()), `${vn}: hiện hết thẻ (có tiêu đề dài không dấu cách) vẫn không cuộn ngang, scrollWidth ${await o.page.evaluate(() => document.scrollingElement.scrollWidth)}`);
      R.ok(o.errors.length === 0, `${vn}: không lỗi trang ${o.errors[0] || ''}`); await o.ctx.close();
    }
  } catch (e) { console.log('FAIL lỗi chạy eval: ' + String(e).split('\n')[0]); await L.close(); process.exit(1); }
  const code = R.done(); await L.close(); process.exit(code);
})();
