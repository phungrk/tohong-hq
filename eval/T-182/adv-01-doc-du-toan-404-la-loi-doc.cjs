#!/usr/bin/env node
/* T-182 adv-01 (adversary, spec T-179 "Định nghĩa: Số đã lưu" + H1 bước 2): "Đọc lỗi (không 2xx, mạng đứt) KHÔNG cho ra số"; "Không bao giờ in danh sách theo số đoán (0)".
 * Back thật (tohong-back api/budget.js GET) KHÔNG trả 404 khi cặp đôi chưa có bảng dự toán (dùng defaultBudget, 200); 404 chỉ xảy ra khi requireCoupleAccess không thấy cặp đôi
 * (lib/auth.js:100 "couple not found") hoặc route không có. Nên 404 lúc bấm Tìm vendor là một lần đọc lỗi, phải xử lý như GET 500 của eval 14 (check_11):
 * không in danh sách, không gọi match, hiện `Chưa đọc được dự toán. Thử lại`; không có nhãn `Chưa có dự toán cho hạng mục này` (số đoán D = 0).
 * Hai ca như check_11: (a) đã có danh sách rồi số đổi; (b) lần bấm đầu. Sau đó server tốt lại, `Thử lại` in đúng theo số đã lưu.
 * Chạy từ gốc tohong-hq: node eval/T-182/adv-01-doc-du-toan-404-la-loi-doc.cjs [--repo <tohong-front>] */
const path = require('path');
const { run, sleep } = require(path.join(__dirname, '..', 'T-179', '_lib.cjs'));
const MSG = 'Chưa đọc được dự toán. Thử lại'; const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
run(async ({ dev, br, bad, newServer, openApp, lists, body, pressFind, pressFindQuiet, closeChat, fixed, same }) => {
  for (const hasList of [true, false]) {
    const tag = hasList ? 'đã có danh sách' : 'chưa có danh sách'; const S = newServer(); const { ctx, pg } = await openApp(dev, br, S);
    let fail = false; await pg.route(/localhost:8787\/api\/couples\/t171\/budget$/, (r) => (fail && r.request().method() === 'GET' ? r.fulfill({ status: 404, headers: CORS, contentType: 'application/json', body: '{"error":"couple not found"}' }) : r.fallback()));
    let s1 = null; if (hasList) { s1 = fixed(await pressFind(pg, 1)); await closeChat(pg); S.venue = 40; }
    fail = true; const m = S.calls.match; const L = await pressFindQuiet(pg, 2000); const t = await body(pg);
    if (L.length !== (hasList ? 1 : 0) || S.calls.match !== m) bad(`${tag}, GET dự toán 404: không được in/gọi match (danh sách ${L.length}, match +${S.calls.match - m}, nhãn cuối ${L.length ? JSON.stringify(L[L.length - 1].label) : '-'})`);
    if (!t.includes(MSG)) bad(`${tag}, GET dự toán 404: phải hiện "${MSG}"`);
    if (hasList && !same(fixed(L).slice(0, 1), s1)) bad(`${tag}, GET dự toán 404: danh sách cũ đổi nội dung`);
    if (/Theo dự toán 0tr|Chưa có dự toán cho hạng mục này/.test(t)) bad(`${tag}, GET dự toán 404: không được in danh sách theo số đoán (nhãn "Chưa có dự toán cho hạng mục này")`);
    fail = false; const retry = pg.getByRole('button', { name: 'Thử lại' }).first();
    if (await retry.count()) {
      await retry.click();
      const want = hasList ? 2 : 1; const t0 = Date.now(); let L2 = await lists(pg); while (L2.length < want && Date.now() - t0 < 6000) { await sleep(200); L2 = await lists(pg); } await sleep(800); L2 = await lists(pg);
      const wantLabel = hasList ? 'Theo dự toán 40tr · 200 khách' : 'Theo dự toán 90tr · 200 khách';
      if (L2.length !== want || L2[L2.length - 1].label !== wantLabel) bad(`${tag}, sau Thử lại: phải ${want} danh sách, cuối ghi "${wantLabel}", thấy ${L2.length} / ${L2[L2.length - 1] && L2[L2.length - 1].label}`);
    }
    await ctx.close();
  }
});
