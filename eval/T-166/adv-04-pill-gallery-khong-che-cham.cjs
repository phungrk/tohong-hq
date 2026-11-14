#!/usr/bin/env node
/* T-166 adv-04 (adversary, tầng 3): gallery chi tiết nhiều ảnh, tên tác giả ngắn và dài (120 ký tự).
 * Kỳ vọng: chữ ghi công không đè lên chấm chuyển ảnh hay nút Lưu (các nút vẫn bấm được: điểm giữa nút trả về chính nút), ở mọi ảnh.
 * Chạy: node adv-04-pill-gallery-khong-che-cham.cjs --repo <tohong-front> */
const path = require('path');
const L = require(path.join(__dirname, '..', 'T-156', 'lib', 'f156.cjs'));
const { REPO, chromium } = L.repoArgs(process.argv.slice(2));
const R = L.reporter();
let A;
(async () => {
  const pool = L.loadPool();
  const base = [...pool].sort((a, b) => (a.id < b.id ? -1 : 1)).find((v) => v.category === 'photography');
  const LONG = 'Nguyễn Thị Hoàng Anh & Trần Văn Minh Quân Studio Chụp Ảnh Cưới Đẹp Nhất Quận Bình Thạnh Thành Phố Hồ Chí Minh Việt Nam ZZ';
  const mk = (id, name, auths) => ({ ...base, id, name, photos: auths.map((a, i) => ({ url: `https://lh3.googleusercontent.com/adv4/${id}-${i}=s800`, source: 'google', attribution: a })) });
  const vs = [mk('adv4_s', 'Short Pill Studio', ['An', 'Bao Ngoc ZZ', 'Cuong ZZ']), mk('adv4_l', 'Long Pill Studio', [LONG, 'Tac Gia Hai ZZ4'])];
  A = await L.startApp(REPO, chromium);
  for (const v of vs) {
    const pg = await A.open('__t156c.html', '', { vendors: vs });
    try {
      await pg.waitForFunction((n) => n.every((x) => document.body.innerText.includes(x)), vs.map((x) => x.name), { timeout: 20000 }); await pg.waitForTimeout(800);
      await pg.locator('[data-card="0"]').getByText(v.name).first().click(); await pg.waitForSelector('[data-card="1"]'); await pg.waitForTimeout(1200);
      for (let i = 0; i < v.photos.length; i++) {
        const res = await pg.evaluate(([k, needle]) => {
          const sc = document.querySelector('[data-card="1"]');
          const dots = [...sc.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().height > 0).filter((b) => !(b.innerText || '').trim() && b.getBoundingClientRect().height <= 10).sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
          if (k > 0) dots[k].click();
          return dots.length;
        }, [i, v.photos[i].attribution]);
        await pg.waitForTimeout(500);
        const chk = await pg.evaluate((needle) => {
          const sc = document.querySelector('[data-card="1"]');
          const all = [...sc.querySelectorAll('*')]; const has = (e) => (e.innerText || '').replace(/\s+/g, ' ').includes(needle);
          const leaf = all.filter((e) => has(e) && ![...e.children].some(has))[0];
          const out = [];
          if (!leaf) return ['không thấy tên tác giả ảnh đang xem'];
          let box = leaf.parentElement; while (box && box !== sc && !box.querySelector('button')) box = box.parentElement;
          const btns = [...box.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().height > 0);
          if (!btns.length) out.push('không thấy nút trong khung ảnh');
          for (const b of btns) { const r = b.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y);
            if (!(hit === b || b.contains(hit))) out.push(`nút ${b.getAttribute('aria-label') || (b.innerText || '').trim() || 'chấm'} bị che bởi "${(hit && hit.innerText || '').slice(0, 40)}"`); }
          const txt = sc.innerText.replace(/\s+/g, ' ');
          if (!txt.includes(needle)) out.push('không thấy tên tác giả ảnh đang xem');
          return out;
        }, v.photos[i].attribution);
        chk.forEach((m) => R.bad(`${v.name} ảnh ${i + 1}: ${m}`));
        if (res !== v.photos.length) R.bad(`${v.name}: ${res} chấm cho ${v.photos.length} ảnh`);
      }
    } catch (e) { R.bad(`${v.name}: lỗi chạy ` + String(e.message).split('\n')[0]); }
    await pg.context().close();
  }
})().catch((e) => R.bad('lỗi khung chạy: ' + String(e.message).split('\n')[0])).finally(async () => { try { A && await A.stop(); } catch (e) { /* */ } R.finish(); });
