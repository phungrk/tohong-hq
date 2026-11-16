'use strict';
/* Bất biến INV-013 (planner/front/budget, front) · Nguồn: T-195 adv-01 (adversary, Code Gate 2026-11-16), spec products/T-194-man-ngan-sach-so-phan-bo-rong.md v3 H0 + H5(i).
 * Hạng mục mà lần ghi ĐỔI số phân bổ (hạng mục người dùng vừa chỉnh, và Dự phòng khi luật Tuần trăng mật rút/trả phần chênh) gửi allocated_tr là SỐ JSON hữu hạn >= 0,
 * tính từ số đã lưu đọc theo Number(x) || 0, kể cả khi số đã lưu là rỗng, "abc" hay chuỗi số. Không bao giờ gửi null, chuỗi hay NaN cho hạng mục đó.
 * Hạng mục khác ghi nguyên như đã lưu (phần đó là INV-012, ở đây chỉ đo lại ở mức hạng mục khác không thành null).
 * Đỏ trên tohong-front main 6b9ad94: chỉnh trực tiếp hạng mục "abc" gửi null; Tuần trăng mật/Dự phòng "abc" hoặc "5" gửi null.
 * Chỉ đo thân PUT; không đọc mã nguồn. Khung: eval/T-187/_lib.cjs (dò gốc HQ ngược tới scripts/gate.py).
 * Biến: TOHONG_FRONT_REPO (hoặc --repo), PLAYWRIGHT_PATH. Thoát 0 = đạt, 1 = vi phạm, 2 = thiếu môi trường. */
const fs = require('fs'), path = require('path');
const HQ = (() => { let d = __dirname; for (;;) { if (fs.existsSync(path.join(d, 'scripts', 'gate.py'))) return d; const u = path.dirname(d); if (u === d) return null; d = u; } })();
if (!HQ) { console.log('FAIL không tìm thấy gốc tohong-hq (scripts/gate.py)'); process.exit(2); }
const E = require(path.join(HQ, 'eval', 'T-187', '_lib.cjs'));
const S = E.setup();
const same = (v, w) => (w === undefined ? v === undefined : (typeof v === typeof w && v === w));
const show = (v) => (v === undefined ? 'bỏ khuyết' : JSON.stringify(v));
const watch = (pg, puts) => pg.on('request', (r) => { if (r.method() === 'PUT' && /\/budget$/.test(r.url())) { try { puts.push(JSON.parse(r.postData() || '{}')); } catch (e) { puts.push(null); } } });
const MIXW = [['photography', 'Chụp ảnh', ''], ['venue', 'Tiệc & nhà hàng', 'abc'], ['jewelry', 'Nhẫn cưới & trang sức', 30], ['attire', 'Trang phục', '20']];
const KEEP = { photography: '', venue: 'abc', jewelry: 30, attire: '20' };
const docWith = (extra) => { const d = E.budgetDoc(MIXW, { total_tr: 100, mung_tr: 0 }); d.categories.push(...extra); return d; };
const hm = (h, r) => [{ id: 'honeymoon', name: 'Tuần trăng mật', pct: 0, allocated_tr: h, items: [] }, { id: 'reserve', name: 'Dự phòng', pct: 10, allocated_tr: r, items: [] }];
const slide = async (cat, doc, key, want, tag) => {
  const puts = []; const pg = await S.page('__t187b.html', `?v=budget&cat=${cat}`, { budget: doc }); watch(pg, puts);
  try {
    const sl = pg.getByRole('slider', { name: 'Dự toán' }); await sl.waitFor({ timeout: 15000 }); await pg.waitForTimeout(800);
    await sl.focus(); await pg.keyboard.press(key); await pg.waitForTimeout(2500);
    if (!puts.length) S.bad(`${tag}: không thấy lần ghi`);
    else {
      const cats = (puts[puts.length - 1] || {}).categories || [];
      for (const [id, w] of Object.entries(want)) {
        const c = cats.find((x) => x.id === id);
        if (!c) S.bad(`${tag}: thiếu "${id}"`);
        else if (!same(c.allocated_tr, w)) S.bad(`${tag}: "${id}" gửi ${show(c.allocated_tr)} (mong ${show(w)})`);
      }
    }
  } catch (e) { S.bad(tag + ': lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
};
S.run(async () => {
  /* mục tiêu 100: mốc venue 40, honeymoon 6 -> bước thanh trượt 1 */
  await slide('venue', docWith([]), 'ArrowRight', { ...KEEP, venue: 1 }, 'chỉnh trực tiếp hạng mục "abc"');
  await slide('attire', docWith([]), 'ArrowRight', { ...KEEP, attire: 21 }, 'chỉnh trực tiếp hạng mục "20"');
  await slide('honeymoon', docWith(hm(5, 'abc')), 'ArrowLeft', { ...KEEP, honeymoon: 4, reserve: 1 }, 'giảm Tuần trăng mật, Dự phòng "abc"');
  await slide('honeymoon', docWith(hm('5', '20')), 'ArrowLeft', { ...KEEP, honeymoon: 4, reserve: 21 }, 'Tuần trăng mật "5", Dự phòng "20"');
  await slide('honeymoon', docWith(hm('abc', 50)), 'ArrowRight', { ...KEEP, honeymoon: 1, reserve: 49 }, 'Tuần trăng mật "abc", Dự phòng 50');
});
