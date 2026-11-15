#!/usr/bin/env node
/* T-179 tiêu chí 13 (App thật, spec H3 + H1 "so số thô"): ba dạng nhãn đúng nguyên văn. (a) dự toán hạng mục 0: `Chưa có dự toán cho hạng mục này`, không có "0tr"; (b) số khách trong dự toán 0 (vắng):
 * `Theo dự toán 90tr` (không có "khách"); (c) số lẻ 39,5: `Theo dự toán 39,5tr · 200 khách` (dấu phẩy, không "39.5"); (d) 90 -> 90,04 là số khác (so số thô, không làm tròn): in danh sách thứ hai, cả hai cùng nhãn `Theo dự toán 90tr · 200 khách`.
 * Server giả đổi số trực tiếp (front phải đọc số đã lưu lúc bấm). Chạy từ gốc tohong-hq: node eval/T-179/check_10_nhan_cac_dang_so.cjs [--repo <tohong-front>] */
const { run } = require('./_lib.cjs');
run(async ({ dev, br, bad, newServer, openApp, lists, pressFind, closeChat }) => {
  const t = async (name, setup, want, notRe) => {
    const S = newServer(); setup(S); const { ctx, pg } = await openApp(dev, br, S);
    const L = await pressFind(pg, 1); const l = L[0];
    if (!l) bad(`${name}: không có danh sách`); else { if (l.label !== want) bad(`${name}: nhãn phải là "${want}", thấy "${l.label}"`); if (notRe && notRe.test(l.text)) bad(`${name}: nhãn không được chứa ${notRe}: "${l.text.slice(0, 120)}"`); }
    await ctx.close();
  };
  await t('dự toán hạng mục 0', (S) => { S.venue = 0; }, 'Chưa có dự toán cho hạng mục này', /\b0\s?tr/);
  await t('số khách 0', (S) => { S.guests = 0; }, 'Theo dự toán 90tr', /khách\b.*khách|Theo dự toán 90tr ·/);
  await t('số lẻ', (S) => { S.venue = 39.5; }, 'Theo dự toán 39,5tr · 200 khách', /39\.5/);
  const S = newServer(); const { ctx, pg } = await openApp(dev, br, S);
  await pressFind(pg, 1); await closeChat(pg); S.venue = 90.04; const L = await pressFind(pg, 2);
  if (L.length !== 2) bad(`90 -> 90,04 phải in danh sách thứ hai (so số thô), thấy ${L.length}`);
  else if (L[0].label !== 'Theo dự toán 90tr · 200 khách' || L[1].label !== 'Theo dự toán 90tr · 200 khách') bad(`hai danh sách cùng nhãn "Theo dự toán 90tr · 200 khách", thấy ${L[0].label} / ${L[1].label}`);
  await ctx.close();
});
