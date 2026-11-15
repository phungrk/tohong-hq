#!/usr/bin/env node
/* T-179 tiêu chí 14 (App thật, spec H1 bước 2): đọc dự toán đã lưu LỖI lúc bấm Tìm vendor (GET /api/couples/<id>/budget trả 500) thì KHÔNG in danh sách mới và không gọi match, hiện đúng dòng
 * `Chưa đọc được dự toán. Thử lại` kèm nút `Thử lại`; danh sách cũ giữ nguyên, không có nhãn "0tr". Server tốt lại, bấm `Thử lại` thì đọc lại: số đổi thì in danh sách mới (nhãn đúng số), dòng báo biến mất.
 * Hai ca: (a) đã có danh sách rồi số đổi 90 -> 40 mà đọc lỗi; (b) lần bấm đầu (chưa có danh sách) đọc lỗi: không có danh sách nào, có dòng báo, `Thử lại` thì có đúng một danh sách.
 * Chạy từ gốc tohong-hq: node eval/T-179/check_11_doc_du_toan_loi.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
const MSG = 'Chưa đọc được dự toán. Thử lại'; const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
run(async ({ dev, br, bad, newServer, openApp, lists, body, pressFind, pressFindQuiet, closeChat, fixed, same }) => {
  for (const hasList of [true, false]) {
    const tag = hasList ? 'đã có danh sách' : 'chưa có danh sách'; const S = newServer(); const { ctx, pg } = await openApp(dev, br, S);
    let fail = false; await pg.route(/localhost:8787\/api\/couples\/t171\/budget$/, (r) => (fail && r.request().method() === 'GET' ? r.fulfill({ status: 500, headers: CORS, contentType: 'application/json', body: '{"error":"boom"}' }) : r.fallback()));
    let s1 = null; if (hasList) { s1 = fixed(await pressFind(pg, 1)); await closeChat(pg); S.venue = 40; }
    fail = true; const m = S.calls.match; const L = await pressFindQuiet(pg, 2000); const t = await body(pg);
    if (L.length !== (hasList ? 1 : 0) || S.calls.match !== m) bad(`${tag}, đọc lỗi: không được in/gọi match (danh sách ${L.length}, match +${S.calls.match - m})`);
    if (!t.includes(MSG)) bad(`${tag}, đọc lỗi: phải hiện "${MSG}"`);
    if (hasList && !same(fixed(L), s1)) bad(`${tag}, đọc lỗi: danh sách cũ đổi nội dung`);
    if (/Theo dự toán 0tr|Chưa có dự toán/.test(t)) bad(`${tag}, đọc lỗi: không được hiện nhãn theo số đoán (0)`);
    fail = false; await pg.getByRole('button', { name: 'Thử lại' }).first().click();
    const t0 = Date.now(); let L2 = await lists(pg); while (L2.length < (hasList ? 2 : 1) && Date.now() - t0 < 6000) { await sleep(200); L2 = await lists(pg); } await sleep(800); L2 = await lists(pg);
    const wantLabel = hasList ? 'Theo dự toán 40tr · 200 khách' : 'Theo dự toán 90tr · 200 khách';
    if (L2.length !== (hasList ? 2 : 1) || L2[L2.length - 1].label !== wantLabel) bad(`${tag}, sau Thử lại: phải ${hasList ? 2 : 1} danh sách, cuối ghi "${wantLabel}", thấy ${L2.length} / ${L2[L2.length - 1] && L2[L2.length - 1].label}`);
    if ((await body(pg)).includes(MSG)) bad(`${tag}, sau Thử lại thành công dòng "${MSG}" phải biến mất`);
    await ctx.close();
  }
});
