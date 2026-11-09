#!/usr/bin/env node
// T-117 adv-01 (adversary). Hành vi 3+4 của spec T-115 tổng quát ra các viewport điện thoại thật nằm GIỮA "màn rất thấp" (320x568, 375x548)
// và ba viewport bắt buộc: iPhone mini/12-13 mini Safari ~375x632, Android 360x640, 384x640, iPhone Plus Safari 414x622, Android 360x740.
// Mong đợi: bước 2/3 cuộn được tới hết; sau khi cuộn hết, tiêu đề Số khách và nút cuối mục Số khách không bị footer che;
// footer trong vùng nhìn thấy; nút Tiếp theo cao >= 44px, không bị che; không cuộn ngang. (Không đòi thấy Số khách khi CHƯA cuộn: spec không hứa ở các cỡ này.)
// Chạy: node eval/T-117/adv-01-*.cjs (cwd = repo tohong-front, hoặc đặt TOHONG_FRONT_REPO)
const { measure } = require('../../T-115/lib.cjs'); const { main } = require('./adv.cjs');
main(async (browser, url, bad) => {
  for (const [w, h] of [[375, 632], [360, 640], [384, 640], [414, 622], [360, 740]]) {
    const k = `${w}x${h}`, m0 = await measure(browser, url, w, h), m = await measure(browser, url, w, h, { scrollEnd: true });
    if (m0.scrollH > m0.clientH + 1 && m.scrollTop === 0) bad(`${k}: nội dung dài hơn vùng hiển thị nhưng không cuộn được`);
    if (m.label.top < m.scroller.top) bad(`${k}: cuộn hết, tiêu đề Số khách vẫn trên đỉnh vùng nội dung`);
    if (m.last.bottom + 4 > m.footer.top || m.lastCovered || m.pillCovered) bad(`${k}: cuộn hết, hàng Số khách bị footer che (đáy nút cuối ${m.last.bottom}, đỉnh footer ${m.footer.top})`);
    if (m.footer.bottom > m.innerH) bad(`${k}: footer vượt đáy (${m.footer.bottom} > ${m.innerH})`);
    if (m.btn.h < 44 || m.nextCovered) bad(`${k}: nút Tiếp theo cao ${m.btn.h} hoặc bị che`);
    if (m.docScrollW > m.innerW) bad(`${k}: cuộn ngang`);
    if (m.sheet.top < 0) bad(`${k}: đỉnh sheet ngoài vùng nhìn thấy (${m.sheet.top})`);
  }
});
