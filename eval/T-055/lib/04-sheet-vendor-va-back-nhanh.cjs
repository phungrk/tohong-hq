// adv-04 (T-055, adversary). Spec T-054 mục 5 cho sheet vendor ở Ngân sách (INV-C ghi "không mở được trong harness"; ở đây mở được
// bằng vendor giả "Nhà hàng Hoa Sen" mà lib T-054 gieo sẵn), và mục 4.2/4.3 với Back/Back/Back/Forward liên tiếp không chờ.
const A = require('./common.cjs');
A.run(async ({ mk }) => {
  { const S = await mk({ viewport: { width: 390, height: 360 }, hash: 'ngan-sach/venue' }); const p = S.page;
    await p.waitForFunction(() => location.hash === '#/ngan-sach/venue'); await A.settle(p);
    let pt = null; for (let i = 0; i < 25; i++) { pt = await A.leafPoint(p, 'Nhà hàng Hoa Sen'); if (pt && pt.y > 140 && pt.y < 260 && (await A.sy(p)) > 0) break; await p.mouse.move(195, 300); await p.mouse.wheel(0, 60); await A.settle(p, 8); }
    const y0 = await A.sy(p); A.check(`Sheet vendor: thẻ "Nhà hàng Hoa Sen" chạm được khi đã cuộn (${y0})`, !!pt && y0 > 0);
    if (pt && y0 > 0) {
      const locked = () => p.evaluate(() => getComputedStyle(document.documentElement).overflowY === 'hidden' || getComputedStyle(document.body).overflowY === 'hidden');
      for (const how of ['scrim', 'back']) {
        await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(450); await A.idle(p);
        const y1 = await A.settle(p); const m1 = await A.leafPoint(p, 'Nhà hàng Hoa Sen');
        A.check(`Sheet vendor (${how}): mở, nền khoá, không nhảy (${y1}/${y0})`, (await locked()) && Math.abs(y1 - y0) <= 1);
        await p.mouse.move(195, 20); await p.mouse.wheel(0, 300); const y2 = await A.settle(p);
        A.check(`Sheet vendor (${how}): lăn trên lớp tối nền đứng yên (${y2})`, Math.abs(y2 - y0) <= 1);
        if (how === 'scrim') await p.mouse.click(195, 8); else await p.goBack();
        await p.waitForTimeout(450); await A.idle(p);
        const y3 = await A.settle(p); const m3 = await A.leafPoint(p, 'Nhà hàng Hoa Sen');
        A.check(`Sheet vendor (${how}): đóng, trả đúng vị trí và mốc (${y3}/${y0}, ${m3 && m3.top.toFixed(0)}/${pt.top.toFixed(0)}), hash ${await p.evaluate(() => location.hash)}`,
          !(await locked()) && Math.abs(y3 - y0) <= 1 && !!m3 && Math.abs(m3.top - pt.top) <= 1 && (await p.evaluate(() => location.hash)) === '#/ngan-sach/venue');
      }
    }
    await S.ctx.close(); }
  { const S = await mk({ viewport: { width: 390, height: 640 } }); const p = S.page; const pos = { '#/trang-chu': 0 };
    await A.goTab(p, 'Kế hoạch'); pos['#/ke-hoach'] = await A.jump(p, 700); await A.settle(p);
    await A.goTab(p, 'Ngân sách'); pos['#/ngan-sach'] = await A.jump(p, 250); await A.settle(p);
    await A.goTab(p, 'Khách mời'); pos['#/khach-moi'] = await A.jump(p, 450); await A.settle(p);
    await p.evaluate(() => { history.back(); history.back(); history.back(); history.forward(); });
    await p.waitForTimeout(600); let y = await A.settle(p); let h = await p.evaluate(() => location.hash);
    A.check(`Back×3 + Forward liên tiếp: ${h} ở ${y} (mong ${pos[h]})`, pos[h] !== undefined && Math.abs(y - pos[h]) <= 2);
    await p.goForward(); await p.goForward(); y = await A.settle(p); h = await p.evaluate(() => location.hash);
    A.check(`Forward×2 liên tiếp: ${h} ở ${y} (mong ${pos[h]})`, pos[h] !== undefined && Math.abs(y - pos[h]) <= 2);
    for (const [name, hh] of [['Kế hoạch', '#/ke-hoach'], ['Ngân sách', '#/ngan-sach']]) { const v = await A.goTab(p, name); A.check(`Sau loạt Back/Forward, chạm ${name}: ${v} (mong ${pos[hh]})`, Math.abs(v - pos[hh]) <= 2); }
    A.check('Không lỗi JS', S.errors.length === 0, S.errors.slice(0, 2).join(' | '));
    await S.ctx.close(); }
});
