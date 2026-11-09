#!/usr/bin/env node
// T-115 eval tầng 1. Dùng: node eval/T-115/check.cjs --repo <tohong-front> --only <1..7>   (in PASS hoặc FAIL <lý do>; thoát 0/1; 2 = không chạy được)
const fs = require('fs'), path = require('path');
const { measure, run, PHONES, LOW } = require('./lib.cjs');
const a = process.argv.slice(2), arg = n => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : null; };
const REPO = arg('--repo') || process.env.TOHONG_FRONT_REPO || process.cwd(), ONLY = Number(arg('--only'));
const GAP = 4; // px tối thiểu giữa đáy hàng lựa chọn đầu và đỉnh footer
const BASE_SHEET_H = { '375x667': 591, '390x664': 588, '430x932': 856 }; // đo trên origin/main a7e5807, 2026-11-09
const fails = []; const bad = (m) => fails.push(m);
(async () => {
  if (!(ONLY >= 1 && ONLY <= 7)) { console.log('FAIL thiếu --only 1..7'); process.exit(2); }
  if (ONLY === 6) { // tĩnh: chiều cao sheet không dựa vh/lvh (Chromium không phân biệt được với Safari). dvh/svh/visualViewport được phép.
    const files = [['src/screens/Onboarding.jsx', null], ['src/index.css', /\.ov-fixed[^{]*\{[^}]*\}/g]];
    for (const [f, only] of files) {
      const p = path.join(REPO, f); if (!fs.existsSync(p)) { console.log('FAIL thiếu ' + f); process.exit(2); }
      let s = fs.readFileSync(p, 'utf8'); if (only) s = (s.match(only) || []).join('\n');
      s = s.replace(/\/\*[\s\S]*?\*\//g, '');
      const m = s.match(/[}\d.]+\s*l?vh\b|['"`]\s*l?vh\b|\blvh\b|\b100\s*vh\b/gi);
      if (m) bad(`${f}: dùng vh/lvh (${[...new Set(m)].join(', ')}); dùng dvh/svh hoặc visualViewport`);
    }
  } else await run(REPO, async (browser, url) => {
    const cov = (m, k, tag) => { if (m.pillCovered) bad(`${k}${tag}: hàng lựa chọn đầu bị che (elementFromPoint không trả về chính nó)`); };
    if (ONLY === 1) for (const [w, h] of PHONES) { // không cuộn: tiêu đề + hàng đầu của "Số khách" trọn trong vùng nhìn thấy, trên footer
      const m = await measure(browser, url, w, h), k = `${w}x${h}`;
      if (m.scrollTop !== 0) bad(`${k}: vùng nội dung không ở đầu (scrollTop=${m.scrollTop})`);
      if (m.label.top < m.scroller.top) bad(`${k}: tiêu đề Số khách nằm trên vùng nội dung (top ${m.label.top} < ${m.scroller.top})`);
      if (m.labelCovered) bad(`${k}: tiêu đề Số khách bị che hoặc ngoài vùng nhìn thấy`);
      if (m.pill.bottom + GAP > m.footer.top) bad(`${k}: hàng lựa chọn đầu bị footer che/chạm (đáy ${m.pill.bottom}, đỉnh footer ${m.footer.top}, cần cách >= ${GAP})`);
      cov(m, k, '');
    }
    if (ONLY === 2) for (const [w, h] of PHONES) { // modal cao hơn bản gốc >= 24px, trong vùng nhìn thấy
      const m = await measure(browser, url, w, h), k = `${w}x${h}`, base = BASE_SHEET_H[k];
      if (m.sheet.h < base + 24) bad(`${k}: sheet cao ${m.sheet.h}px, cần >= ${base + 24} (gốc ${base})`);
      if (m.sheet.top < 0 || m.sheet.bottom > m.innerH) bad(`${k}: sheet vượt vùng nhìn thấy (${m.sheet.top}..${m.sheet.bottom} / ${m.innerH})`);
    }
    if (ONLY === 3) for (const [w, h] of LOW) { // màn rất thấp: chỉ cần cuộn được và Tiếp theo không che nội dung
      const m0 = await measure(browser, url, w, h), m = await measure(browser, url, w, h, { scrollEnd: true }), k = `${w}x${h}`;
      if (m0.scrollH > m0.clientH + 1 && m.scrollTop === 0) bad(`${k}: nội dung dài hơn vùng hiển thị nhưng không cuộn được`);
      if (m.label.top < m.scroller.top) bad(`${k}: sau khi cuộn hết, tiêu đề Số khách vẫn nằm trên vùng nội dung`);
      if (m.last.bottom + GAP > m.footer.top) bad(`${k}: sau khi cuộn hết, nút cuối của nội dung (${m.last.bottom}) bị footer (${m.footer.top}) che`);
      if (m.pillCovered || m.lastCovered) bad(`${k}: sau khi cuộn hết, hàng lựa chọn Số khách bị che (elementFromPoint)`);
      if (m.nextCovered) bad(`${k}: nút Tiếp theo bị che hoặc ngoài vùng nhìn thấy`);
    }
    if (ONLY === 4) for (const [w, h] of [...PHONES, ...LOW]) { // footer + nút trong vùng nhìn thấy, nút >= 44px, không cuộn ngang
      const m = await measure(browser, url, w, h), k = `${w}x${h}`;
      if (m.footer.bottom > m.innerH) bad(`${k}: footer vượt đáy vùng nhìn thấy (${m.footer.bottom} > ${m.innerH})`);
      if (m.btn.h < 44 || m.back.h < 1) bad(`${k}: nút Tiếp theo cao ${m.btn.h}px < 44`);
      if (m.btn.right > m.innerW || m.btn.left < 0) bad(`${k}: nút Tiếp theo ngoài bề rộng`);
      if (m.nextCovered) bad(`${k}: nút Tiếp theo bị che`);
      if (m.docScrollW > m.innerW) bad(`${k}: cuộn ngang (${m.docScrollW} > ${m.innerW})`);
    }
    if (ONLY === 5) { // desktop 1280x800 giữ nguyên số đo gốc (±1px)
      const m = await measure(browser, url, 1280, 800, { desktop: true });
      const exp = { 'sheet.top': [m.sheet.top, 76], 'sheet.h': [m.sheet.h, 724], 'sheet.left': [m.sheet.left, 256], 'sheet.right': [m.sheet.right, 1024], 'scroller.top': [m.scroller.top, 174], 'footer.h': [m.footer.h, 119], 'footer.top': [m.footer.top, 681] };
      for (const [n, [got, want]] of Object.entries(exp)) if (Math.abs(got - want) > 1) bad(`desktop 1280x800: ${n}=${got}, gốc ${want}`);
    }
    if (ONLY === 7) for (const [w, h] of [[390, 664], [375, 667]]) { // tự kiểm phép đo: biến thể cấu trúc (dấu hiệu cuộn, bọc nút) không đổi kết quả
      const ref = await measure(browser, url, w, h);
      for (const variant of ['fade', 'wrapped']) {
        const m = await measure(browser, url, w, h, { variant });
        for (const [n, got, want] of [['label.top', m.label.top, ref.label.top], ['pill.bottom', m.pill.bottom, ref.pill.bottom], ['footer.top', m.footer.top, ref.footer.top], ['footer.h', m.footer.h, ref.footer.h], ['scroller.top', m.scroller.top, ref.scroller.top], ['sheet.top', m.sheet.top, ref.sheet.top], ['btn.h', m.btn.h, ref.btn.h]])
          if (Math.abs(got - want) > 1) bad(`${w}x${h} biến thể ${variant}: ${n}=${got}, bản thường ${want}`);
        if (m.pillCovered !== ref.pillCovered) bad(`${w}x${h} biến thể ${variant}: kết luận "bị che" đổi (${ref.pillCovered} -> ${m.pillCovered})`);
      }
    }
  });
  if (fails.length) { console.log('FAIL ' + fails.join(' | ')); process.exit(1); }
  console.log('PASS'); process.exit(0);
})().catch(e => { console.log('FAIL (lỗi chạy) ' + e.message); process.exit(2); });
