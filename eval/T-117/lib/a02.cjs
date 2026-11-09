#!/usr/bin/env node
// T-117 adv-02 (adversary). Ranh giới media query 600px và khoảng 601-767px (tablet dọc hẹp, cửa sổ desktop hẹp, điện thoại xoay ngang lớn)
// mà eval T-115 không chạm: 600x664, 601x664, 700x664, 767x664, 768x1024.
// Mong đợi (hành vi 1+4 của spec T-115 áp cho cỡ này): bước 2/3 chưa cuộn đã thấy trọn tiêu đề Số khách và hàng nút đầu, cách footer >= 4px,
// không bị che; footer trong vùng nhìn thấy; nút Tiếp theo >= 44px; không cuộn ngang; sheet trong vùng nhìn thấy.
const { measure } = require('../../T-115/lib.cjs'); const { main } = require('./adv.cjs');
main(async (browser, url, bad) => {
  for (const [w, h] of [[600, 664], [601, 664], [700, 664], [767, 664], [768, 1024]]) {
    const k = `${w}x${h}`, m = await measure(browser, url, w, h, { desktop: w > 600 });
    if (m.scrollTop !== 0) bad(`${k}: vùng nội dung không ở đầu`);
    if (m.label.top < m.scroller.top || m.labelCovered) bad(`${k}: tiêu đề Số khách bị che/ngoài vùng`);
    if (m.pill.bottom + 4 > m.footer.top || m.pillCovered) bad(`${k}: hàng nút đầu Số khách bị footer che (đáy ${m.pill.bottom}, footer ${m.footer.top})`);
    if (m.footer.bottom > m.innerH || m.btn.h < 44 || m.nextCovered) bad(`${k}: footer/nút Tiếp theo hỏng`);
    if (m.docScrollW > m.innerW) bad(`${k}: cuộn ngang`);
    if (m.sheet.top < 0 || m.sheet.bottom > m.innerH) bad(`${k}: sheet ngoài vùng nhìn thấy`);
  }
});
