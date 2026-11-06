// T-081 tiêu chí 1 (phần trang, D-I5..D-I9): dòng có link `Issue #<n>` thì modal hiện thẻ a tới issue (tab mới, noopener), đứng đúng thứ tự; gợi ý /ok chỉ ở dòng loại escalated có link issue;
// dòng không issue thì không có link issue và không có gợi ý. Dữ liệu cố định, kênh live/d3 giả. clickNode cuộn khối Capu vào khung nhìn trước khi bấm (bài học T-076 D3); link issue cũng được cuộn vào khung rồi mới bấm.
// Chạy: cd /home/user/tohong-hq && node eval/T-081/check_2_modal_link_issue_va_goi_y.cjs
const L = require('../T-076/lib.cjs'); const { T, Q, link, dash, pr, DR, DR_DIR } = L; const R = L.reporter();
const IS = n => `https://github.com/phungrk/tohong-hq/issues/${n}`, IL = n => link('Issue #' + n, IS(n));
const HINT = 'Quyết bằng cách bình luận "/ok <nội dung>" dưới issue';
const tasks = [T('T-72', { state: 'escalated', owner: 'product', title: 'Hợp đồng style chung' }), T('T-73', { state: 'escalated', owner: 'product', title: 'Leo thang không issue' }),
  T('T-74', { tier: 'B', title: 'Diff có issue' }), T('T-75', { tier: 'C', title: 'Merge không issue' }), T('T-76', { state: 'blocked', title: 'Chặn có issue' }),
  T('T-77', { title: 'Quyết định có issue', tier: 'B' }), T('T-78', { state: 'escalated', owner: 'product', title: 'Leo thang mới, queue chưa kịp xuất' })];
const queue = [Q('T-72', 'escalated', [link('Decision Request', DR('T-72-r8.md')), IL(16)], '2026-11-10'), Q('T-73', 'escalated', [link('Decision Request', DR_DIR)]),
  Q('T-74', 'diff-b', [IL(21), link('PR tohong-front#59', pr('tohong-front', 59), 'open')]), Q('T-75', 'merge-c', [link('PR tohong-back#37', pr('tohong-back', 37), 'open')]),
  Q('T-76', 'blocked', [link('Decision Request', DR_DIR), IL(18)]), Q('T-77', 'decision', [link('Decision Request', DR('T-77-x.md')), IL(17)], '2026-11-12')];
L.dumpCases('check_2', [{ name: 'chính', tasks, queue, expect: { hint: 'T-72', issue: { 'T-72': 16, 'T-74': 21, 'T-76': 18, 'T-77': 17 } } }]);
(async () => {
  await L.start();
  for (const [name, vp, touch] of [['desktop', { width: 1280, height: 900 }, false], ['iphone390', { width: 390, height: 844 }, true]]) {
    const o = await L.open(dash(tasks, queue), vp, { touch }); await L.clickNode(o);
    const rs = Object.fromEntries((await L.rows(o)).map(r => [r.task, r])); const g = id => rs[id] || { text: '', links: [] };
    const iss = id => g(id).links.filter(l => /\/issues\//.test(l.href));
    const hints = await o.page.$$eval('#capu-modal [data-capu-row]', rs => rs.map(r => ({ task: r.getAttribute('data-task'), n: r.querySelectorAll('[data-capu-ok-hint]').length, text: [...r.querySelectorAll('[data-capu-ok-hint]')].map(h => h.textContent.trim()).join('|'), anchor: !!r.querySelector('[data-capu-ok-hint] a, a[data-capu-ok-hint]') })));
    const hint = id => hints.find(h => h.task === id) || { n: -1, text: '' };
    R.ok(Object.keys(rs).length === 7, name + ': 7 dòng, thấy ' + Object.keys(rs).join());
    for (const [id, n] of [['T-72', 16], ['T-74', 21], ['T-76', 18], ['T-77', 17]]) {
      const l = iss(id);
      R.ok(l.length === 1 && l[0].href === IS(n) && l[0].text === 'Issue #' + n && l[0].target === '_blank' && /(^|\s)noopener(\s|$)/.test(l[0].rel), name + ': ' + id + ' có đúng một link "Issue #' + n + '" tới ' + IS(n) + ', tab mới, noopener; thấy ' + JSON.stringify(l));
    }
    for (const id of ['T-73', 'T-75', 'T-78']) R.ok(iss(id).length === 0 && !/Issue #/.test(g(id).text), name + ': ' + id + ' không có issue thì không có link issue');
    R.ok(g('T-72').links.map(l => l.href).join() === DR('T-72-r8.md') + ',' + IS(16), name + ': T-72 thứ tự link: Decision Request rồi Issue');
    R.ok(g('T-74').links.map(l => l.href).join() === IS(21) + ',' + pr('tohong-front', 59), name + ': T-74 thứ tự link: Issue rồi PR');
    R.ok(g('T-76').links.map(l => l.href).join() === DR_DIR + ',' + IS(18) && g('T-77').links.map(l => l.href).join() === DR('T-77-x.md') + ',' + IS(17), name + ': T-76, T-77: Decision Request rồi Issue');
    R.ok(hint('T-72').n === 1 && hint('T-72').text === HINT && !hint('T-72').anchor, name + ': dòng escalated có issue: đúng một gợi ý "' + HINT + '" (không phải link); thấy ' + JSON.stringify(hint('T-72')));
    for (const id of ['T-73', 'T-74', 'T-75', 'T-76', 'T-77', 'T-78']) R.ok(hint(id).n === 0, name + ': ' + id + ' không có gợi ý /ok (không phải escalated có issue; /ok chỉ nhận việc escalated)');
    R.ok(!/chưa có link/.test(g('T-74').text), name + ': dòng chỉ có Issue/PR không ghi "chưa có link"');
    if (touch) {
      const w = await o.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      R.ok(w.sw <= w.iw, name + ': không cuộn ngang trang (' + w.sw + '/' + w.iw + ')');
      const hh = await o.page.$$eval('#capu-modal a[href*="/issues/"]', as => as.map(a => a.getBoundingClientRect().height));
      R.ok(hh.length === 4 && hh.every(h => h >= 32), name + ': link issue cao >= 32px: ' + hh.map(Math.round));
      const hb = await o.page.$$eval('#capu-modal [data-task="T-72"] [data-capu-ok-hint]', es => es.map(e => { const r = e.getBoundingClientRect(); return { r: r.right, l: r.left, iw: window.innerWidth }; }));
      R.ok(hb.length === 1 && hb[0].l >= 0 && hb[0].r <= hb[0].iw, name + ': gợi ý nằm trọn trong chiều ngang màn hình');
    }
    // Bấm thật vào link issue (cuộn vào khung nhìn trước): mở tab mới tới đúng issue, tab mới không có opener
    if (!touch) {
      await o.ctx.route('https://github.com/**', r => r.fulfill({ contentType: 'text/html', body: '<title>gh</title>' }));
      const a = o.page.locator('#capu-modal [data-task="T-72"] a[href$="/issues/16"]'); await a.scrollIntoViewIfNeeded();
      const [pop] = await Promise.all([o.ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null), a.click()]);
      R.ok(!!pop, name + ': bấm "Issue #16" mở tab mới');
      if (pop) { await pop.waitForLoadState().catch(() => {}); R.ok(pop.url() === IS(16), name + ': tab mới tới ' + IS(16) + ', thấy ' + pop.url()); R.ok((await pop.evaluate(() => window.opener === null).catch(() => false)), name + ': tab mới không có opener (noopener)'); await pop.close(); }
      R.ok(await L.modalOpen(o), name + ': modal vẫn mở sau khi bấm link');
    }
    R.ok(!o.errors.length, name + ': không lỗi trang'); await o.ctx.close();
  }
  await L.close(); process.exit(R.done());
})().catch(e => { console.log('FAIL ngoại lệ ' + e.message); process.exit(1); });
