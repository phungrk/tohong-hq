#!/usr/bin/env node
/* T-182 adv-05 (adversary, spec T-179 H4 câu cuối + T-171 H2/H8): bảng so sánh tạo từ chi tiết mở ở danh sách MỚI (40tr), lần gọi match?ids= lúc tạo bảng LỖI (500):
 * không hiện phần trăm nào (không điểm theo số cũ/điểm chụp như điểm hiện hành), không có câu tư vấn xếp hạng, có `Chưa cập nhật được điểm. Thử lại`;
 * bấm `Thử lại` (server tốt lại) thì bảng chấm theo số đã lưu: Alpha 70%, Beta 80%, câu tư vấn xếp Beta trước; không gọi chi tiết từng vendor.
 * Chạy từ gốc tohong-hq: node eval/T-182/adv-05-bang-so-sanh-tu-danh-sach-moi-loi-ids-thu-lai.cjs [--repo <tohong-front>] */
const path = require('path');
const { run, sleep } = require(path.join(__dirname, '..', 'T-179', '_lib.cjs'));
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const TABLE_JS = () => {
  const el = [...document.querySelectorAll('*')].filter((e) => /vendor đặt cạnh nhau/.test(e.innerText || '')).pop();
  let c = el; while (c && !/Đánh giá/i.test(c.innerText || '')) c = c.parentElement;
  return c ? c.innerText.replace(/\s+/g, ' ') : '';
};
run(async ({ dev, br, bad, newServer, openApp, dragTo, pressFind, closeChat }) => {
  const S = newServer(); const { ctx, pg } = await openApp(dev, br, S);
  let idsFail = false, ids = 0;
  await pg.route(/localhost:8787\/api\/vendors\/match\?/, (r) => {
    const u = new URL(r.request().url()); if (!u.searchParams.get('ids')) return r.fallback();
    ids++; if (idsFail) return r.fulfill({ status: 500, headers: CORS, contentType: 'application/json', body: '{"error":"boom"}' }); return r.fallback();
  });
  await pressFind(pg, 1); await closeChat(pg); await dragTo(pg, 40, { settleMs: 2000 }); await pressFind(pg, 2);
  await pg.locator('a.vm-card-in', { hasText: 'Alpha' }).last().click(); // hàng Alpha của danh sách MỚI
  await pg.waitForFunction(() => /so với 40tr/.test(document.body.innerText), null, { timeout: 8000 }); await sleep(600);
  await pg.getByRole('button', { name: 'So sánh', exact: true }).first().click();
  await pg.waitForFunction(() => /Chọn tối đa/.test(document.body.innerText), null, { timeout: 8000 }); await sleep(800);
  await pg.locator('button', { hasText: 'Beta' }).last().click(); await sleep(300);
  idsFail = true; const d0 = S.calls.detail, i0 = ids;
  await pg.getByRole('button', { name: /So sánh 2 vendor/ }).first().click();
  await pg.waitForFunction(() => /vendor đặt cạnh nhau/.test(document.body.innerText), null, { timeout: 8000 }); await sleep(1500);
  let t = await pg.evaluate(TABLE_JS);
  if (ids - i0 < 1) bad('tạo bảng phải gọi match?ids= (chấm theo số đã lưu lúc tạo)');
  if (/\d+%/.test(t)) bad(`ids lỗi: bảng không được hiện phần trăm nào, thấy ${JSON.stringify(t.match(/\d+%/g))}`);
  if (/dẫn đầu|Xếp theo độ phù hợp/.test(t)) bad('ids lỗi: không được có câu tư vấn xếp hạng theo điểm');
  if (!/Chưa cập nhật được điểm/.test(t)) bad('ids lỗi: phải có "Chưa cập nhật được điểm. Thử lại"');
  idsFail = false; const i1 = ids;
  const btn = pg.getByRole('button', { name: 'Thử lại' }).last();
  if (await btn.count()) { await btn.click(); await sleep(2000); }
  t = await pg.evaluate(TABLE_JS); const p = t.match(/\d+%/g) || [];
  if (!p.includes('70%') || !p.includes('80%') || p.includes('100%')) bad(`sau Thử lại: bảng phải Alpha 70%, Beta 80% (40tr), thấy ${JSON.stringify(p)}`);
  if (/Chưa cập nhật được điểm/.test(t)) bad('sau Thử lại thành công dòng lỗi phải biến mất');
  if (!/Beta[^›]*›[^›]*Alpha/.test(t)) bad(`câu tư vấn phải xếp Beta trước Alpha ở 40tr: ${t.slice(-200)}`);
  const di = ids - i1; if (di < 1 || di > 2) bad(`Thử lại phải gọi ids một lần (1-2 do StrictMode), thấy ${di}`);
  if (S.calls.detail !== d0) bad(`tạo bảng/Thử lại không được gọi chi tiết từng vendor (+${S.calls.detail - d0})`);
  await ctx.close();
});
