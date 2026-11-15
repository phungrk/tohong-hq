#!/usr/bin/env node
/* T-174 adversary 08 (tohong-front, spec T-171 v3.1 H5): chỉnh tiếp TRONG LÚC lần ghi ghép (Thử lại) đang bay (server đã ghi, phản hồi về chậm 2,5s).
 * Input: lưu 90 -> 40 lỗi; server tốt; bấm Thử lại (PUT 40 được ghi ngay nhưng phản hồi trễ 2,5s); trong lúc đó kéo 40 -> 50.
 * Mong đợi: cuối cùng server 50, thanh 50, không còn câu báo; phản hồi trễ của lần ghi 40 không kéo màn về 40; không lần ghi nào ghi 40 SAU lần ghi 50.
 * Chạy từ gốc tohong-hq: node eval/T-174/adv-08-chinh-tiep-khi-ghi-ghep-dang-bay.cjs [--repo <tohong-front>] */
const { runAdv } = require('./adv_khung.cjs');
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
runAdv(async ({ pg, D, bad, body, slider, dragTo, waitFor, venue, sleep }) => {
  D.putFail = '500'; await dragTo(pg, 40);
  if (!(await waitFor(async () => /Chưa lưu được dự toán/.test(await body())))) { bad('khung: lưu lỗi phải hiện câu báo'); return; }
  D.putFail = null; let slowNext = true; const order = [];
  await pg.route('http://localhost:8787/api/couples/t171/budget', async (r) => {
    if (r.request().method() !== 'PUT') return r.fallback();
    const b = JSON.parse(r.request().postData() || '{}'); D.puts.push(b);
    D.doc = { total_tr: b.total_tr, guests: b.guests, mung_tr: b.mung_tr, categories: b.categories.map((c) => ({ ...c, items: c.items || [] })) };
    order.push(venue().allocated_tr);
    if (slowNext) { slowNext = false; await sleep(2500); }
    return r.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(D.doc) });
  });
  await pg.getByRole('button', { name: 'Thử lại' }).first().click();
  await waitFor(async () => order.length >= 1, 3000);
  await dragTo(pg, 50);
  await sleep(5000);
  if (venue().allocated_tr !== 50) bad(`cuối cùng server phải 50, thấy ${venue().allocated_tr} (thứ tự ghi ${order.join('->')})`);
  if ((await slider()) !== 50) bad(`cuối cùng thanh phải 50, thấy ${await slider()}`);
  if (/Chưa lưu được dự toán/.test(await body())) bad('mọi lần ghi đã thành công mà câu báo còn');
});
