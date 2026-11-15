#!/usr/bin/env node
/* T-179 tiêu chí 9 (App thật, spec H4 + H6 của T-171, giữ nguyên): chi tiết một vendor mà server trả 200 với match null (vendor ẩn hoặc không qua lọc cứng) hiện đúng dòng "Chưa có điểm cho vendor này",
 * không có nút "Thử lại", không hiện "Đang cập nhật điểm…" / "Chưa cập nhật được điểm", không hiện điểm cũ của hàng đã bấm (80% của Beta) trong khối phân tích.
 * Chạy từ gốc tohong-hq: node eval/T-179/check_9_chi_tiet_khong_co_diem.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
run(async ({ dev, br, bad, newServer, openApp, lists, body, pressFind }) => {
  const S = newServer(); const { ctx, pg } = await openApp(dev, br, S);
  await pg.route(/localhost:8787\/api\/vendors\/t171_b\?/, async (r) => { const v = S.vendors().find((x) => x.id === 't171_b'); return r.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ vendor: v, match: null }) }); });
  await pressFind(pg, 1);
  await pg.getByText('Beta Hall', { exact: false }).first().click(); await sleep(2500); const t = await body(pg);
  if (!t.includes('Chưa có điểm cho vendor này')) bad('chi tiết 200 match null phải hiện "Chưa có điểm cho vendor này"');
  if (/Chưa cập nhật được điểm|Đang cập nhật điểm/.test(t)) bad('chi tiết 200 match null không được kẹt ở trạng thái lỗi/đang cập nhật');
  if (await pg.getByRole('button', { name: 'Thử lại' }).count()) bad('chi tiết 200 match null không được có nút "Thử lại"');
  if (/Phân tích AI\s*·\s*\d+%/.test(t)) bad('chi tiết 200 match null không được hiện phần trăm "Phân tích AI · N%"');
  await ctx.close();
});
