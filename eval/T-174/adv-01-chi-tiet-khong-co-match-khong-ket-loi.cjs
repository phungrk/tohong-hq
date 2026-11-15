#!/usr/bin/env node
/* T-174 adversary 01 (tohong-front, spec T-171 H1/H2): back THẬT (tohong-back main api/vendors.js:217-244) trả GET /api/vendors/:id?coupleId= là 200 với match: null khi vendor
 * không còn trong top 50 của danh mục (computeMatches limit 50) hoặc bị lọc (thành phố, ẩn). Với pool hiện tại (85 venue HCMC) hạ dự toán 60 -> 30tr đẩy 3/10 vendor top đầu và
 * 5/20 vendor của thẻ chọn so sánh (limit 20) ra ngoài top 50; đây là ca thường, không hiếm.
 * Input: chi tiết Beta đang mở và bảng so sánh Alpha+Beta; lưu 90 -> 40; server trả chi tiết Beta = 200 { vendor, match: null } (Alpha bình thường).
 * Mong đợi theo spec: H2 chỉ coi là LỖI khi server không 2xx hoặc mạng đứt; (a) thẻ không được kẹt mãi ở "Chưa cập nhật được điểm. Thử lại" mà bấm "Thử lại" (server vẫn 200) không bao giờ gỡ được;
 * (b) bảng so sánh vẫn lấy lại điểm cho TỪNG vendor có điểm (H1: "cho từng vendor trong bảng"): Alpha phải hiện 70%, không vì Beta thiếu điểm mà ẩn cả hàng "Phù hợp".
 * Không hiện điểm cũ (100%/80%, so với 90tr) ở đâu cả.
 * Chạy từ gốc tohong-hq: node eval/T-174/adv-01-chi-tiet-khong-co-match-khong-ket-loi.cjs [--repo <tohong-front>] */
const { run, sleep } = require('../T-171/_lib.cjs');
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
run(async ({ dev, br, bad, newServer, mount, open, goBudget, goChat, dragTo, cardText, waitText, openDetail }) => {
  const S = newServer(); const { ctx, pg } = await mount(br, S); await open(dev, pg);
  let nullBeta = false;
  await pg.route(/localhost:8787\/api\/vendors\/t171_b\?/, async (r) => { // như back main: vendor ngoài top 50 -> 200, match null
    if (!nullBeta || !new URL(r.request().url()).searchParams.get('coupleId')) return r.fallback();
    S.calls.detail++; const q = S.vendors().find((e) => e.id === 't171_b');
    return r.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ vendor: q, match: null }) });
  });
  await openDetail(pg, 'Beta Hall', 1);
  await pg.locator('[data-card="1"]').getByText('So sánh', { exact: false }).first().click();
  await pg.waitForSelector('[data-card="2"]'); await pg.locator('[data-card="2"]').getByText('Alpha Hall', { exact: false }).first().waitFor();
  await pg.locator('[data-card="2"]').getByText('Alpha Hall', { exact: false }).first().click();
  await pg.locator('[data-card="2"]').getByRole('button', { name: /So sánh 2 vendor/ }).click();
  await pg.waitForSelector('[data-card="3"]'); await pg.waitForTimeout(500);
  nullBeta = true;
  await goBudget(pg); await dragTo(pg, 40); const t0 = Date.now(); while (S.venue !== 40 && Date.now() - t0 < 6000) await sleep(100);
  await goChat(pg); await sleep(2500);
  const d = await cardText(pg, 1), c = await cardText(pg, 3);
  if (/80% phù hợp/.test(d || '') || /so với 90tr/.test(d || '')) bad('chi tiết Beta vẫn hiện điểm/phép so cũ');
  // (a) Thử lại khi server vẫn 200 + match null
  const btn = pg.locator('[data-card="1"]').getByRole('button', { name: /Thử lại/ }).first();
  if (await btn.isVisible().catch(() => false)) { await btn.click(); await sleep(1500); }
  const d2 = await cardText(pg, 1);
  if (/Chưa cập nhật được điểm/.test(d2 || '')) bad('(a) chi tiết Beta kẹt "Chưa cập nhật được điểm. Thử lại" dù server trả 200 (match null, như back main với vendor ngoài top 50); bấm Thử lại không gỡ được: ' + (d2 || '').slice(0, 160));
  // (b) bảng so sánh: Alpha có điểm mới thì phải hiện
  if (!/70%/.test(c || '')) bad('(b) bảng so sánh không hiện Alpha 70% vì Beta thiếu điểm (cả hàng "Phù hợp" bị ẩn / báo lỗi): ' + (c || '').slice(0, 220));
  if (/100%|80%/.test(c || '')) bad('bảng so sánh vẫn hiện điểm cũ');
  await ctx.close();
});
