#!/usr/bin/env node
/* T-181 adv-02 (adversary, tầng 3): spec T-177 H6 ở khung 320px và 360px, với tên dài CÓ dấu cách và tên dài KHÔNG có dấu cách (check_5 chỉ thử tên có dấu cách ở 360px).
 * Mong đợi: chữ nút đọc đủ (khớp nguyên văn), không ellipsis/line-clamp/overflow ẩn (findBtn của T-177), nút trong khung, trang không cuộn ngang, icon tìm còn đủ 16px và nằm trong nút.
 * Chạy từ gốc tohong-hq: node eval/T-181/adv-02-ten-dai-320-360.cjs [--repo <tohong-front>] */
const { run } = require('../T-177/_lib.cjs');
run(async ({ dev, br, bad, openCat, findBtn, mkDoc, sleep }) => {
  const names = ['Nhẫncướitrangsứcquàtặnghaihọrấtdàikhôngcódấucáchnàocảđâu', 'Nhẫn cưới + trang sức + quà tặng hai họ và lễ vật nhà trai rất rất dài'];
  for (const W of [320, 360]) for (const name of names) for (const amt of [1440, 1000.05]) {
    const { ctx, pg } = await openCat(br, dev, mkDoc([{ id: 'jewelry', name, allocated_tr: amt }, { id: 'reserve', name: 'Dự phòng', allocated_tr: 10 }]), 'jewelry');
    await pg.setViewportSize({ width: W, height: 900 });
    await pg.evaluate((w) => { for (const d of document.querySelectorAll('#root div')) if (d.style.width === '360px') { d.style.width = w + 'px'; break; } }, W);
    await sleep(200);
    const b = await findBtn(pg), r = Math.round(amt * 10) / 10, want = `Tìm ${name.toLowerCase()} trong khoảng ${String(r).replace('.', ',')}tr`, tag = `[${W}px ${name.slice(0, 12)}… ${amt}]`;
    if (b.n !== 1) { bad(`${tag} cần đúng một nút "Tìm", thấy ${b.n}`); await ctx.close(); continue; }
    if (b.text !== want) bad(`${tag} nhãn phải đọc đủ "${want}", thấy "${b.text}"`);
    if (b.right > W + 0.5 || b.left < -0.5) bad(`${tag} nút tràn khung (trái ${b.left}, phải ${b.right})`);
    if (b.cut.length) bad(`${tag} chữ bị cắt/tràn: ${b.cut.join('; ')}`);
    if (b.lines < 2) bad(`${tag} tên dài phải xuống dòng, thấy ${b.lines} dòng`);
    if (b.docW > W) bad(`${tag} trang cuộn ngang (rộng ${b.docW} > ${W})`);
    const ic = await pg.evaluate(() => { const bt = [...document.querySelectorAll('button')].find((x) => /^\s*Tìm\s/.test(x.innerText)); const s = bt && bt.querySelector('svg'); if (!s) return null; const a = s.getBoundingClientRect(), k = bt.getBoundingClientRect(); return { w: a.width, inside: a.left >= k.left && a.right <= k.right && a.top >= k.top && a.bottom <= k.bottom }; });
    if (!ic) bad(`${tag} mất icon tìm`); else { if (ic.w < 15) bad(`${tag} icon tìm bị bóp còn ${ic.w}px`); if (!ic.inside) bad(`${tag} icon tìm nằm ngoài nút`); }
    await ctx.close();
  }
});
