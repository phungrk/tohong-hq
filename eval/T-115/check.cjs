#!/usr/bin/env node
// T-115 eval tầng 1. Dùng: node eval/T-115/check.cjs --repo <tohong-front> --only <1..6>   (in PASS hoặc FAIL <lý do>; thoát 0/1; 2 = không chạy được)
const { measure, run, PHONES, PHONES_TB } = require('./lib.cjs');
const a = process.argv.slice(2), arg = n => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : null; };
const REPO = arg('--repo') || process.env.TOHONG_FRONT_REPO || process.cwd(), ONLY = Number(arg('--only'));
const GAP = 4; // px tối thiểu giữa đáy hàng lựa chọn đầu và đỉnh footer
const BASE_SHEET_H = { '375x667': 591, '390x844': 768, '430x932': 856 }; // đo trên origin/main a7e5807, 2026-11-09
const fails = [];
const bad = (m) => fails.push(m);
(async () => {
  if (!(ONLY >= 1 && ONLY <= 6)) { console.log('FAIL thiếu --only 1..6'); process.exit(2); }
  await run(REPO, async (browser, url) => {
    if (ONLY === 1) for (const [w, h] of PHONES) { // không cuộn: tiêu đề + hàng đầu của "Số khách" trọn trong vùng nhìn thấy, trên footer
      const m = await measure(browser, url, w, h), k = `${w}x${h}`;
      if (m.scrollTop !== 0) bad(`${k}: vùng nội dung không ở đầu (scrollTop=${m.scrollTop})`);
      if (m.label.top < m.scroller.top) bad(`${k}: tiêu đề Số khách nằm trên vùng nội dung (top ${m.label.top} < ${m.scroller.top})`);
      if (m.pill.bottom + GAP > m.footer.top) bad(`${k}: hàng lựa chọn đầu bị footer che/chạm (đáy ${m.pill.bottom}, đỉnh footer ${m.footer.top}, cần cách >= ${GAP})`);
      if (m.pill.bottom > m.innerH) bad(`${k}: hàng lựa chọn đầu ngoài vùng nhìn thấy`);
    }
    if (ONLY === 2) for (const [w, h] of PHONES) { // modal cao hơn bản gốc >= 24px
      const m = await measure(browser, url, w, h), k = `${w}x${h}`, base = BASE_SHEET_H[k];
      if (m.sheet.h < base + 24) bad(`${k}: sheet cao ${m.sheet.h}px, cần >= ${base + 24} (gốc ${base})`);
      if (m.sheet.top < 0 || m.sheet.bottom > m.innerH) bad(`${k}: sheet vượt vùng nhìn thấy (${m.sheet.top}..${m.sheet.bottom} / ${m.innerH})`);
    }
    if (ONLY === 3) for (const [w, h] of [...PHONES, ...PHONES_TB]) { // cuộn tới cuối: Số khách + mục cuối thấy trọn, trên footer; nội dung cuộn được khi thiếu chỗ
      const m = await measure(browser, url, w, h, { scrollEnd: true }), k = `${w}x${h}`;
      if (m.label.top < m.scroller.top) bad(`${k}: sau khi cuộn hết, tiêu đề Số khách vẫn nằm trên vùng nội dung`);
      if (m.pill.bottom + GAP > m.footer.top || m.last.bottom > m.footer.top) bad(`${k}: sau khi cuộn hết, nội dung cuối (${Math.max(m.pill.bottom, m.last.bottom)}) bị footer (${m.footer.top}) che`);
      if (m.pill.bottom > m.innerH) bad(`${k}: hàng lựa chọn đầu ngoài vùng nhìn thấy`);
      const m0 = await measure(browser, url, w, h);
      if (m0.scrollH > m0.clientH + 1 && m.scrollTop === 0) bad(`${k}: nội dung dài hơn vùng hiển thị nhưng không cuộn được`);
    }
    if (ONLY === 4) for (const [w, h] of [...PHONES, ...PHONES_TB]) { // footer + nút Tiếp theo trong vùng nhìn thấy, nút >= 44px, không cuộn ngang
      const m = await measure(browser, url, w, h), k = `${w}x${h}`;
      if (m.footer.bottom > m.innerH) bad(`${k}: footer vượt đáy vùng nhìn thấy (${m.footer.bottom} > ${m.innerH})`);
      if (m.btn.h < 44) bad(`${k}: nút Tiếp theo cao ${m.btn.h}px < 44`);
      if (m.btn.right > m.innerW || m.btn.left < 0) bad(`${k}: nút Tiếp theo ngoài bề rộng`);
      if (m.docScrollW > m.innerW) bad(`${k}: cuộn ngang (${m.docScrollW} > ${m.innerW})`);
    }
    if (ONLY === 5) { // desktop 1280x800 giữ nguyên số đo gốc (±1px)
      const m = await measure(browser, url, 1280, 800, { desktop: true });
      const exp = { 'sheet.top': [m.sheet.top, 76], 'sheet.h': [m.sheet.h, 724], 'sheet.left': [m.sheet.left, 256], 'sheet.right': [m.sheet.right, 1024], 'scroller.top': [m.scroller.top, 174], 'footer.h': [m.footer.h, 119], 'footer.top': [m.footer.top, 681] };
      for (const [n, [got, want]] of Object.entries(exp)) if (Math.abs(got - want) > 1) bad(`desktop 1280x800: ${n}=${got}, gốc ${want}`);
    }
    if (ONLY === 6) for (const [w, h] of [[320, 568], [375, 667]]) { // rộng hẹp: chữ Số khách và các nút không tràn ngang; hàng đầu thấy sau khi cuộn
      const m = await measure(browser, url, w, h, { scrollEnd: true }), k = `${w}x${h}`;
      if (m.docScrollW > m.innerW || m.label.right > m.innerW) bad(`${k}: tràn ngang`);
      if (m.pill.bottom + GAP > m.footer.top) bad(`${k}: hàng đầu bị footer che sau khi cuộn hết`);
    }
  });
  if (fails.length) { console.log('FAIL ' + fails.join(' | ')); process.exit(1); }
  console.log('PASS'); process.exit(0);
})().catch(e => { console.log('FAIL (lỗi chạy) ' + e.message); process.exit(2); });
