#!/usr/bin/env node
/* T-152 tiêu chí 6 (tohong-front): drawer LUÔN ở chế độ PHỦ (quyết định của Capu 2026-11-13, bỏ chế độ ĐẨY của T-147 B4).
 * Đo, ở mọi khung nhìn 390/520/600/1280 và mọi độ rộng drawer (mặc định, 632, 656, max): hình học của bảng enrich và của trang TRƯỚC khi mở drawer
 * bằng đúng hình học SAU khi mở và sau khi kéo giãn (không đẩy, không co, không cuộn ngang); drawer dính mép phải và nằm trên bảng (bảng ở dưới);
 * kéo giãn vẫn theo min/max/phím/nhớ độ rộng của T-147; đóng drawer thì Approve/Sửa thủ công bấm được như cũ.
 * Chạy: cd tohong-front && node <HQ>/eval/T-152/check_6_drawer_phu_khong_doi_layout.cjs --repo .   (hoặc bash eval/T-152/check_6_drawer_phu_khong_doi_layout.sh) */
const { setup } = require('./lib/front152.cjs');
const E = setup(process.argv.slice(2), 't152-6');
const { check, H } = E;
const same = (a, b) => ['x', 'y', 'width', 'height'].every((k) => Math.abs(a[k] - b[k]) <= 1);
E.run(async () => {
  for (const vw of [1280, 600, 520, 390]) {
    const S = await E.scenario({ viewport: { width: vw, height: 900 } });
    const { page } = S;
    const wb0 = await H.wrapBox(S); const pb0 = await H.pageBox(S);
    await S.openRow('Alpha Hall', 'Số 1 đường thử');
    const wb1 = await H.wrapBox(S); const pb1 = await H.pageBox(S);
    const g = await H.geom(S);
    check(`${vw}px: mở drawer không đổi vị trí/kích thước bảng (không đẩy)`, same(wb0, wb1), JSON.stringify([wb0, wb1]));
    check(`${vw}px: mở drawer không đổi bề rộng trang, không cuộn ngang`, Math.abs(pb0.w - pb1.w) <= 1 && pb1.sw <= pb1.cw, JSON.stringify([pb0, pb1]));
    check(`${vw}px: drawer dính mép phải, cao hết khung nhìn`, H.near(g.right, g.vw) && H.near(g.top, 0) && H.near(g.bottom, g.vh), JSON.stringify(g));
    const top = await page.evaluate(() => { const d = document.querySelector('[role=dialog][aria-label^="Chi tiết vendor"]'); const r = d.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + 20, 120); return !!el && d.contains(el); });
    check(`${vw}px: drawer nằm TRÊN bảng (điểm chạm ở mép trái drawer thuộc drawer)`, top);
    if (vw === 1280) {
      const widths = [];
      await S.sep().focus();
      for (const [lbl, key, n] of [['3 lần ← (632)', 'ArrowLeft', 3], ['thêm 1 lần ← (656)', 'ArrowLeft', 1]]) {
        for (let i = 0; i < n; i++) await page.keyboard.press(key);
        const w = await H.geom(S); const wb = await H.wrapBox(S); const pb = await H.pageBox(S);
        widths.push(w.w);
        check(`1280px ${lbl}: bảng và trang giữ nguyên, không cuộn ngang`, same(wb0, wb) && pb.sw <= pb.cw, JSON.stringify([w.w, wb, pb]));
      }
      check('1280px: các mức 632 và 656 đúng như T-147 (kéo giãn theo phím 24px)', H.near(widths[0], 632, 2) && H.near(widths[1], 656, 2), widths.join(','));
      await page.keyboard.press('End');
      const wm = await H.geom(S); const wbm = await H.wrapBox(S); const pbm = await H.pageBox(S);
      check('1280px kéo tới max (1152): bảng và trang giữ nguyên, không cuộn ngang, drawer rộng 1152', H.near(wm.w, 1152, 2) && same(wb0, wbm) && pbm.sw <= pbm.cw, JSON.stringify([wm.w, wbm, pbm]));
      // kéo chuột: sang trái làm rộng, vẫn không đổi bảng
      await page.keyboard.press('Home');
      const bb = await S.sep().boundingBox();
      await page.mouse.move(bb.x + bb.width / 2, bb.y + 200); await page.mouse.down();
      await page.mouse.move(bb.x + bb.width / 2 - 300, bb.y + 200, { steps: 6 }); await page.mouse.up();
      const wd = await H.geom(S); const wbd = await H.wrapBox(S);
      check('kéo chuột 300px sang trái: drawer rộng 860 (±3), bảng không đổi', H.near(wd.w, 860, 3) && same(wb0, wbd), JSON.stringify([wd.w, wbd]));
      check('min/max của tay cầm giữ như T-147 (560 / 1152)', (await S.sep().getAttribute('aria-valuemin')) === '560' && (await S.sep().getAttribute('aria-valuemax')) === '1152');
      await page.keyboard.press('Escape');
      await S.dlg().waitFor({ state: 'detached' });
      const wba = await H.wrapBox(S);
      check('đóng drawer: bảng vẫn y nguyên', same(wb0, wba));
      await S.openRow('Alpha Hall', 'Số 1 đường thử');
      check('mở lại: nhớ độ rộng 860 (localStorage)', H.near((await H.geom(S)).w, 860, 3));
    }
    if (vw === 390) {
      check('390px: drawer rộng bằng khung nhìn, không tay cầm', H.near(g.w, g.vw) && (await S.sep().filter({ visible: true }).count()) === 0, JSON.stringify(g));
    }
    // đóng rồi thao tác bảng như cũ (Sửa thủ công mở hộp thoại, không mở drawer)
    await S.dlg().getByRole('button', { name: 'Đóng', exact: true }).click();
    await S.dlg().waitFor({ state: 'detached' });
    check(`${vw}px: đóng bằng nút "Đóng", bảng y nguyên`, same(wb0, await H.wrapBox(S)));
    check(`${vw}px: không request ra ngoài ngoài ảnh (không Google API)`, S.external.length === 0, S.external.join(' '));
    await S.ctx.close();
  }
});
