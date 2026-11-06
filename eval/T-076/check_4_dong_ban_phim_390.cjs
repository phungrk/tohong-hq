// T-076 tiêu chí 4: đóng bằng X, Esc, chạm ngoài; iPhone 390px; bàn phím vào được. Chạy: cd /home/user/tohong-hq && node eval/T-076/check_4_dong_ban_phim_390.cjs
const L = require('./lib.cjs'); const { T, Q, link, dash, pr, DR } = L; const R = L.reporter();
const many = Array.from({ length: 12 }, (_, i) => T('T-' + (100 + i), { tier: 'B', title: 'Một tên việc khá dài để thử xuống dòng trên màn hình hẹp số ' + i }));
const data = dash([T('T-72', { state: 'escalated', owner: 'product' }), ...many], [Q('T-72', 'escalated', [link('Decision Request', DR('T-72-r8-khoa-eval.md'))]), ...many.map(t => Q(t.id, 'diff-b', [link('PR tohong-front#' + t.id.slice(2), pr('tohong-front', Number(t.id.slice(2))), 'open')]))]);
L.dumpCases('check_4', [{ name: '13 dòng', tasks: data.tasks, queue: data.capu_queue, expect: { count: 13, order: 'T-72,' + many.map(t => t.id).join() } }]);
(async () => {
  await L.start();
  for (const [name, vp, touch] of [['desktop', { width: 1280, height: 900 }, false], ['iphone390', { width: 390, height: 844 }, true]]) {
    const o = await L.open(data, vp, { touch }), p = o.page;
    // bàn phím: Tab tới khối Capu, Enter mở; Space cũng mở
    await p.focus('#nd_capu', { timeout: 2000 }).catch(() => {}); R.ok(await p.evaluate(() => document.activeElement.id) === 'nd_capu', name + ': khối Capu nhận focus bàn phím');
    R.ok((await p.$eval('#nd_capu', e => e.getAttribute('role'))) === 'button' && /Capu|chờ/i.test(await p.$eval('#nd_capu', e => e.getAttribute('aria-label') || '')), name + ': khối Capu có role=button và aria-label mô tả');
    await p.keyboard.press('Enter'); await p.waitForTimeout(300); R.ok(await L.modalOpen(o), name + ': Enter mở modal');
    R.ok(await p.evaluate(() => !!(document.querySelector('#capu-modal') && document.querySelector('#capu-modal').contains(document.activeElement))), name + ': mở xong focus nằm trong modal');
    // bẫy focus: Tab nhiều lần không ra khỏi modal
    let out = false; for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); if (!await p.evaluate(() => !!(document.querySelector('#capu-modal') && document.querySelector('#capu-modal').contains(document.activeElement)))) out = true; }
    R.ok(!out, name + ': Tab 40 lần không ra khỏi modal'); 
    await p.keyboard.press('Escape'); await p.waitForTimeout(250); R.ok(!(await L.modalOpen(o)), name + ': Esc đóng');
    R.ok(await p.evaluate(() => document.activeElement.id) === 'nd_capu', name + ': đóng xong focus về khối Capu');
    await p.keyboard.press('Space'); await p.waitForTimeout(300); R.ok(await L.modalOpen(o), name + ': Space mở modal');
    await p.click('#capu-modal-close', { timeout: 2000 }).catch(() => {}); await p.waitForTimeout(250); R.ok(!(await L.modalOpen(o)), name + ': nút X (#capu-modal-close) đóng');
    await L.clickNode(o); R.ok(await L.modalOpen(o), name + ': chạm khối Capu mở lại');
    await p.mouse.click(2, 2); await p.waitForTimeout(250); R.ok(!(await L.modalOpen(o)), name + ': chạm ngoài (góc màn hình) đóng');
    await L.clickNode(o);
    const b = await p.locator('#capu-modal [data-capu-panel]').boundingBox({ timeout: 2000 }).catch(() => null); if (b) await p.mouse.click(b.x + b.width / 2, b.y + 10); await p.waitForTimeout(250);
    R.ok(await L.modalOpen(o), name + ': chạm trong khung modal không đóng');
    const g = await p.evaluate(() => { if (!document.querySelector('#capu-modal [data-capu-panel]')) return { sw: 0, iw: 1, l: -1, r: 9e9, t: -1, bt: 9e9, ih: 0, cw: 0, ch: 0, over: '', sh: 9e9, chh: 0 }; const q = document.querySelector('#capu-modal [data-capu-panel]').getBoundingClientRect(), c = document.querySelector('#capu-modal-close').getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth, iw: innerWidth, l: q.left, r: q.right, t: q.top, bt: q.bottom, ih: innerHeight, cw: c.width, ch: c.height, over: getComputedStyle(document.querySelector('#capu-modal [data-capu-panel]')).overflowY, sh: document.querySelector('#capu-modal [data-capu-panel]').scrollHeight, chh: document.querySelector('#capu-modal [data-capu-panel]').clientHeight }; });
    R.ok(g.sw <= g.iw && g.l >= 0 && g.r <= g.iw, name + ': không cuộn ngang, khung modal nằm trong chiều rộng ' + g.iw);
    R.ok(g.t >= 0 && g.bt <= g.ih, name + ': khung modal nằm trong chiều cao màn hình với 13 dòng');
    R.ok(g.sh <= g.chh || /auto|scroll/.test(g.over), name + ': 13 dòng không vừa thì khung tự cuộn dọc');
    R.ok(g.cw >= 44 && g.ch >= 44, name + ': nút X vùng bấm >= 44x44px (' + Math.round(g.cw) + 'x' + Math.round(g.ch) + ')');
    const tooSmall = await p.$$eval('#capu-modal a[data-capu-link]', as => as.filter(a => { const q = a.getBoundingClientRect(); return q.height < 32; }).length);
    R.ok(tooSmall === 0, name + ': mọi link cao >= 32px để chạm được');
    // Trong chế độ phóng to bảng Mô hình: Esc đóng modal trước, phóng to còn (như inv-027)
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    const zb = await p.$('#model-zoom, [aria-label="Phóng to bảng Mô hình"]');
    if (zb) { await zb.click(); await p.waitForTimeout(400); await p.focus('#nd_capu'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
      R.ok(await L.modalOpen(o), name + ': khối Capu mở được modal cả khi bảng đang phóng to');
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      R.ok(!(await L.modalOpen(o)) && await p.$eval('#model', m => m.getAttribute('data-zoom')) === 'on', name + ': Esc lần một chỉ đóng modal, phóng to còn');
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      R.ok(await p.$eval('#model', m => m.getAttribute('data-zoom')) !== 'on', name + ': Esc lần hai đóng phóng to'); }
    R.ok(!o.errors.length, name + ': không lỗi trang ' + o.errors.join(';')); await o.ctx.close();
  }
  await L.close(); process.exit(R.done());
})().catch(e => { console.log('FAIL ngoại lệ ' + e.message); process.exit(1); });
