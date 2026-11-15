#!/usr/bin/env node
/* T-181 adv-03 (adversary, tầng 3): padding 12px 14px + icon bọc span áp cho MỌI hạng mục có Vendor; nhãn ngắn không được lệch/vỡ ở hạng mục khác.
 * Mỗi hạng mục trong VENDOR_CATEGORIES (tên thật của front) với dự toán 25: nhãn đúng "Tìm <tên chữ thường> trong khoảng 25tr" (spec T-177 H1/H4), nút trong khung 360px,
 * không cắt chữ, icon 16px nằm cùng hàng với dòng chữ đầu (giữa icon nằm trong khoảng dòng đầu), cụm icon+chữ căn giữa nút (lệch tâm <= 2px khi một dòng).
 * Chạy từ gốc tohong-hq: node eval/T-181/adv-03-moi-hang-muc-vendor.cjs [--repo <tohong-front>] */
const { run } = require('../T-177/_lib.cjs');
const CATS = [['venue', 'Tiệc & nhà hàng'], ['ceremony', 'Ăn hỏi & sính lễ'], ['photography', 'Chụp ảnh / quay'], ['jewelry', 'Nhẫn cưới & trang sức'], ['attire', 'Trang phục'], ['decor', 'Trang trí & hoa'], ['makeup', 'Trang điểm & làm tóc'], ['transport', 'Xe hoa & đưa đón'], ['stationery', 'Thiệp & quà tặng'], ['honeymoon', 'Tuần trăng mật']];
run(async ({ dev, br, bad, openCat, findBtn, mkDoc }) => {
  for (const [id, name] of CATS) {
    const { ctx, pg } = await openCat(br, dev, mkDoc([{ id, name, allocated_tr: 25 }, { id: 'reserve', name: 'Dự phòng', allocated_tr: 100 }]), id);
    const b = await findBtn(pg), want = `Tìm ${name.toLowerCase()} trong khoảng 25tr`;
    if (b.n !== 1) { bad(`[${id}] cần đúng một nút "Tìm", thấy ${b.n}`); await ctx.close(); continue; }
    if (b.text !== want) bad(`[${id}] nhãn phải là "${want}", thấy "${b.text}"`);
    if (b.right > 360.5 || b.left < -0.5 || b.docW > 360) bad(`[${id}] nút/trang tràn khung 360px`);
    if (b.cut.length) bad(`[${id}] chữ bị cắt: ${b.cut.join('; ')}`);
    const g = await pg.evaluate(() => {
      const bt = [...document.querySelectorAll('button')].find((x) => /^\s*Tìm\s/.test(x.innerText)), s = bt.querySelector('svg'), k = bt.getBoundingClientRect(), a = s.getBoundingClientRect();
      const rects = []; const w = document.createTreeWalker(bt, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) if (q.width >= 1) rects.push({ l: q.left, r: q.right, t: q.top, b: q.bottom }); }
      const top = Math.min(...rects.map((q) => q.t)), first = rects.filter((q) => Math.abs(q.t - top) < 2);
      const lines = new Set(rects.map((q) => Math.round(q.t))).size;
      const gl = Math.min(a.left, ...rects.map((q) => q.l)), gr = Math.max(a.right, ...rects.map((q) => q.r));
      return { iw: a.width, icy: (a.top + a.bottom) / 2, ft: Math.min(...first.map((q) => q.t)), fb: Math.max(...first.map((q) => q.b)), lines, off: Math.abs((gl + gr) / 2 - (k.left + k.right) / 2), h: k.height };
    });
    if (g.iw < 15) bad(`[${id}] icon bị bóp còn ${g.iw}px`);
    if (g.lines === 1 && (g.icy < g.ft || g.icy > g.fb)) bad(`[${id}] icon lệch khỏi hàng chữ (tâm icon ${g.icy}, dòng ${g.ft}-${g.fb})`);
    if (g.lines === 1 && g.off > 2) bad(`[${id}] cụm icon+chữ lệch tâm nút ${g.off.toFixed(1)}px`);
    await ctx.close();
  }
});
