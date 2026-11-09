#!/usr/bin/env node
// Bất biến rút từ T-115 v2 (qua Spec Gate 2026-11-09, spec-critic). Bản chụp cố định của eval/T-115/check.cjs tiêu chí 3, 4 + kiểm đơn vị chiều cao chạy thật (vh).
// Dùng: node check_inv.cjs --repo <tohong-front> --only 1 | 3,4 | vh      In PASS / FAIL <lý do>; thoát 0/1; 2 = không chạy được.
const fs = require('fs'), path = require('path');
const { measure, run } = require('./lib.cjs');
const a = process.argv.slice(2), arg = n => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : null; };
const REPO = arg('--repo') || process.env.TOHONG_FRONT_REPO || process.cwd();
const ONLY = new Set(String(arg('--only') || '').split(',').filter(Boolean));
if (!REPO || !fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo trỏ tới tohong-front'); process.exit(2); }
if (!ONLY.size || [...ONLY].some(x => !['1', '3', '4', 'vh'].includes(x))) { console.log('FAIL --only phải là 1, 3,4 hoặc vh'); process.exit(2); }
const GAP = 4;
const PHONES = [[375, 667], [390, 664], [430, 932]], LOW = [[320, 568], [375, 548]];
const fails = []; const bad = (m) => fails.push(m);
(async () => {
  await run(REPO, async (browser, url) => {
    if (ONLY.has('1')) for (const [w, h] of PHONES) { // không cuộn: tiêu đề + hàng đầu của Số khách trọn, trên footer, không bị phủ (tiêu chí 1; chỉ vào bể sau khi T-115 merge)
      const m = await measure(browser, url, w, h), k = `${w}x${h}`;
      if (m.scrollTop !== 0) bad(`${k}: vùng nội dung không ở đầu (scrollTop=${m.scrollTop})`);
      if (m.label.top < m.scroller.top || m.labelCovered) bad(`${k}: tiêu đề Số khách bị che hoặc ngoài vùng nội dung`);
      if (m.pill.bottom + GAP > m.footer.top) bad(`${k}: hàng lựa chọn đầu bị footer che/chạm (đáy ${m.pill.bottom}, đỉnh footer ${m.footer.top})`);
      if (m.pillCovered) bad(`${k}: hàng lựa chọn đầu bị phủ (elementFromPoint)`);
    }
    if (ONLY.has('3')) for (const [w, h] of [...PHONES, ...LOW]) { // cuộn hết: Số khách và nút cuối trên footer, không bị che; nội dung dài thì cuộn được
      const m0 = await measure(browser, url, w, h), m = await measure(browser, url, w, h, { scrollEnd: true }), k = `${w}x${h}`;
      if (m0.scrollH > m0.clientH + 1 && m.scrollTop === 0) bad(`${k}: nội dung dài hơn vùng hiển thị nhưng không cuộn được`);
      if (m.label.top < m.scroller.top) bad(`${k}: sau khi cuộn hết, tiêu đề Số khách vẫn nằm trên vùng nội dung`);
      if (m.last.bottom + GAP > m.footer.top) bad(`${k}: sau khi cuộn hết, nút cuối của nội dung (${m.last.bottom}) bị footer (${m.footer.top}) che`);
      if (m.pillCovered || m.lastCovered) bad(`${k}: sau khi cuộn hết, hàng lựa chọn Số khách bị che (elementFromPoint)`);
      if (m.nextCovered) bad(`${k}: nút Tiếp theo bị che hoặc ngoài vùng nhìn thấy`);
    }
    if (ONLY.has('4')) for (const [w, h] of [...PHONES, ...LOW]) { // footer trong vùng nhìn thấy, nút Tiếp theo >= 44px không bị che, không cuộn ngang
      const m = await measure(browser, url, w, h), k = `${w}x${h}`;
      if (m.footer.bottom > m.innerH) bad(`${k}: footer vượt đáy vùng nhìn thấy (${m.footer.bottom} > ${m.innerH})`);
      if (m.btn.h < 44) bad(`${k}: nút Tiếp theo cao ${m.btn.h}px < 44`);
      if (m.btn.right > m.innerW || m.btn.left < 0) bad(`${k}: nút Tiếp theo ngoài bề rộng`);
      if (m.nextCovered) bad(`${k}: nút Tiếp theo bị che`);
      if (m.docScrollW > m.innerW) bad(`${k}: cuộn ngang (${m.docScrollW} > ${m.innerW})`);
    }
    if (ONLY.has('vh')) for (const [w, h] of [[390, 664], [1280, 800]]) { // chiều cao/vị trí dọc của sheet không theo vh/lvh (Chromium không phân biệt được với vùng nhìn thấy Safari)
      const m = await measure(browser, url, w, h, { desktop: w > 800 }), k = `${w}x${h}`;
      if (m.chainLen < 1) bad(`${k}: không tìm thấy sheet`);
      if (m.vhDecl.length) bad(`${k}: sheet/lớp phủ dùng vh/lvh: ${m.vhDecl.join('; ')} (dùng dvh/svh, neo vào lớp phủ cố định, hoặc visualViewport)`);
    }
  });
  if (fails.length) { console.log('FAIL ' + fails.join(' | ')); process.exit(1); }
  console.log('PASS'); process.exit(0);
})().catch(e => { console.log('FAIL (lỗi chạy) ' + e.message); process.exit(2); });
