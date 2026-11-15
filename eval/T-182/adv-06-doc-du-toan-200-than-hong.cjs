#!/usr/bin/env node
/* T-182 adv-06 (adversary, spec T-179 H1 bước 2 "Không bao giờ in danh sách theo số đoán (0)" + Định nghĩa "D vắng thì D = 0"):
 * (a) GET dự toán 200 nhưng thân `{}` (không có categories: back hỏng, không phải "chưa có dự toán" vì back luôn trả categories) -> coi là đọc lỗi: không in, không match, có dòng `Chưa đọc được dự toán. Thử lại`.
 * (b) GET 200 có categories nhưng THIẾU hạng mục venue -> D vắng = 0: in danh sách với nhãn `Chưa có dự toán cho hạng mục này` (đúng định nghĩa, không phải lỗi đọc).
 * Chạy từ gốc tohong-hq: node eval/T-182/adv-06-doc-du-toan-200-than-hong.cjs [--repo <tohong-front>] */
const path = require('path');
const { run, sleep } = require(path.join(__dirname, '..', 'T-179', '_lib.cjs'));
const MSG = 'Chưa đọc được dự toán. Thử lại'; const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
run(async ({ dev, br, bad, newServer, openApp, lists, body, pressFindQuiet }) => {
  for (const mode of ['empty', 'novenue']) {
    const S = newServer(); const { ctx, pg } = await openApp(dev, br, S);
    await pg.route(/localhost:8787\/api\/couples\/t171\/budget$/, (r) => {
      if (r.request().method() !== 'GET') return r.fallback();
      const doc = mode === 'empty' ? {} : { ...S.budgetDoc(), categories: S.budgetDoc().categories.filter((c) => c.id !== 'venue') };
      return r.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(doc) });
    });
    const m0 = S.calls.match; const L = await pressFindQuiet(pg, 2500); const t = await body(pg);
    if (mode === 'empty') {
      if (L.length !== 0 || S.calls.match !== m0) bad(`200 {}: không được in/gọi match (danh sách ${L.length}, nhãn ${JSON.stringify(L.map((l) => l.label))})`);
      if (!t.includes(MSG)) bad(`200 {}: phải hiện "${MSG}"`);
    } else {
      if (L.length !== 1 || L[0].label !== 'Chưa có dự toán cho hạng mục này') bad(`thiếu hạng mục: phải in 1 danh sách nhãn "Chưa có dự toán cho hạng mục này", thấy ${L.length} ${JSON.stringify(L.map((l) => l.label))}`);
      if (t.includes(MSG)) bad('thiếu hạng mục (D vắng = 0) không phải lỗi đọc');
    }
    await sleep(100); await ctx.close();
  }
});
