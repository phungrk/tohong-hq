#!/usr/bin/env node
/* T-194 tiêu chí 4: chỗ ghi lại dự toán. Khi người dùng chỉnh một hạng mục (kéo thanh trượt trang chi tiết), bản dự toán gửi lên server mang allocated_tr của MỌI hạng mục là SỐ JSON hữu hạn:
 * hạng mục rỗng ("", null, bỏ khuyết) hoặc không phải số ("abc") gửi 0 (không gửi "", "abc", null, chuỗi); hạng mục người dùng chỉnh gửi đúng số mới; hạng mục số hợp lệ (30, chuỗi "20") gửi 30 và 20 (kiểu số).
 * Mở màn không chỉnh gì thì không PUT (giữ inv-003): ca mở chỉ-xem phải 0 PUT.
 * Đỏ trên main 6b9ad94: PUT mang "abc" (và "") nguyên văn cho hạng mục không đụng tới.
 * Chạy: node eval/T-194/check_4_ghi_lai_du_toan_khong_ghi_abc.cjs [--repo <tohong-front>] */
const { E, waitText, MIX } = require('./_b.cjs'); const S = E.setup();
const WANT = { photography: 0, venue: 0, jewelry: 30, attire: 20, reserve: 0 };
S.run(async () => {
  const doc = E.budgetDoc(MIX, { total_tr: 100, mung_tr: 0 });
  doc.categories = doc.categories.filter((c) => c.id !== 'reserve'); doc.categories.push({ id: 'reserve', name: 'Dự phòng', pct: 10, items: [] }); // bỏ khuyết allocated_tr
  const watch = (pg, puts) => pg.on('request', (r) => { if (r.method() === 'PUT' && /\/budget$/.test(r.url())) { try { puts.push(JSON.parse(r.postData() || '{}')); } catch (e) { puts.push(null); } } });
  /* a. chỉ xem: không PUT */
  let puts = [], pg = await S.page('__t187b.html', '?v=budget', { budget: doc }); watch(pg, puts);
  try { await waitText(pg, 'Đã phân bổ'); await pg.waitForTimeout(2500); if (puts.length) S.bad(`chỉ xem: mong 0 lần ghi, thấy ${puts.length}`); } catch (e) { S.bad('chỉ xem: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
  /* b. chỉnh hạng mục Nhẫn cưới & trang sức 30 -> 31 */
  puts = []; pg = await S.page('__t187b.html', '?v=budget&cat=jewelry', { budget: doc }); watch(pg, puts);
  try {
    const sl = pg.getByRole('slider', { name: 'Dự toán' }); await sl.waitFor({ timeout: 15000 }); await pg.waitForTimeout(800);
    await sl.focus(); await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(2500);
    if (!puts.length) S.bad('chỉnh hạng mục: không thấy lần ghi nào sau khi kéo thanh trượt');
    else {
      const last = puts[puts.length - 1], cats = (last && last.categories) || [];
      for (const [id, w] of Object.entries(WANT)) {
        const c = cats.find((x) => x.id === id);
        if (!c) { S.bad(`ghi lại: thiếu hạng mục "${id}" trong bản gửi lên`); continue; }
        const v = c.allocated_tr, mong = id === 'jewelry' ? 31 : w;
        if (typeof v !== 'number' || !Number.isFinite(v)) S.bad(`ghi lại: hạng mục "${id}" gửi allocated_tr = ${JSON.stringify(v)} (mong số ${mong})`);
        else if (v !== mong) S.bad(`ghi lại: hạng mục "${id}" gửi ${v} (mong ${mong})`);
      }
    }
  } catch (e) { S.bad('chỉnh hạng mục: lỗi chạy ' + String(e.message).split('\n')[0]); }
  await pg.context().close();
});
