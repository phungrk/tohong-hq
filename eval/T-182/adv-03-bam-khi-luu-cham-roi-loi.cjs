#!/usr/bin/env node
/* T-182 adv-03 (adversary, spec T-179 H1 bước 1 + H6): bấm Tìm vendor NGAY sau khi kéo (lần lưu còn trong 800ms gộp), và lần lưu đó về CHẬM (1,5s) rồi LỖI (500).
 * Số đã lưu vẫn là 90 nên: không in danh sách mới, không gọi match, không có nhãn "40tr"; câu `Chưa lưu được dự toán` hiện. (check_5 đo chậm-mà-thành-công, check_6 đo lỗi-ngay sau khi lắng; tổ hợp chậm + lỗi + bấm ngay chưa có.)
 * Chạy từ gốc tohong-hq: node eval/T-182/adv-03-bam-khi-luu-cham-roi-loi.cjs [--repo <tohong-front>] */
const path = require('path');
const { run, sleep } = require(path.join(__dirname, '..', 'T-179', '_lib.cjs'));
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
run(async ({ dev, br, bad, newServer, openApp, dragTo, lists, body, pressFind, closeChat }) => {
  const S = newServer(); const { ctx, pg } = await openApp(dev, br, S);
  await pressFind(pg, 1); await closeChat(pg);
  let puts = 0; await pg.route(/localhost:8787\/api\/couples\/t171\/budget$/, async (r) => {
    if (r.request().method() !== 'PUT') return r.fallback();
    puts++; await sleep(1500); return r.fulfill({ status: 500, headers: CORS, contentType: 'application/json', body: '{"error":"boom"}' });
  });
  const m0 = S.calls.match;
  await dragTo(pg, 40);
  await pg.getByText('Tìm nhà hàng tiệc cưới').first().click();
  await sleep(4500);
  const L = await lists(pg); const t = await body(pg);
  if (puts < 1) bad('kịch bản hỏng: không có lần lưu nào');
  if (L.length !== 1 || S.calls.match !== m0) bad(`lưu chậm rồi lỗi: không được in danh sách mới/gọi match (danh sách ${L.length}, match +${S.calls.match - m0}, nhãn ${JSON.stringify(L.map((l) => l.label))})`);
  if (/Theo dự toán 40tr/.test(t)) bad('lưu lỗi: không được in danh sách theo số chưa lưu (40tr)');
  if (/Đang lấy dự toán…/.test(t)) bad('dòng "Đang lấy dự toán…" còn kẹt sau khi lần lưu đã xong (lỗi)');
  await closeChat(pg).catch(() => {});
  if (!(await body(pg)).includes('Chưa lưu được dự toán')) bad('màn Ngân sách phải còn "Chưa lưu được dự toán"');
  await ctx.close();
});
