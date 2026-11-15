#!/usr/bin/env node
/* T-182 adv-04 (adversary, spec T-179 H1 bước 4-5): số đổi 90 -> 40 (đã lưu), GET dự toán chậm 1s, cặp đôi bấm Tìm vendor HAI lần liên tiếp (lần 2 lúc lần 1 còn đang đọc).
 * Mong đợi: đúng MỘT danh sách mới (tổng 2), nhãn 40tr; không in trùng hai danh sách 40tr; match cho danh sách mới 1-2 lần (StrictMode); không còn dòng "Đang lấy dự toán…".
 * Chạy từ gốc tohong-hq: node eval/T-182/adv-04-bam-hai-lan-lien-tiep-khi-doc-cham.cjs [--repo <tohong-front>] */
const path = require('path');
const { run, sleep } = require(path.join(__dirname, '..', 'T-179', '_lib.cjs'));
run(async ({ dev, br, bad, newServer, openApp, dragTo, lists, body, pressFind, closeChat, FIND }) => {
  const S = newServer(); const { ctx, pg } = await openApp(dev, br, S);
  await pressFind(pg, 1); await closeChat(pg);
  await dragTo(pg, 40, { settleMs: 2000 });
  let slow = true; await pg.route(/localhost:8787\/api\/couples\/t171\/budget$/, async (r) => { if (slow && r.request().method() === 'GET') await sleep(1000); return r.fallback(); });
  const m0 = S.calls.match;
  await pg.getByText('Tìm nhà hàng tiệc cưới').first().click();
  await sleep(300);
  await closeChat(pg); await pg.getByText('Tìm nhà hàng tiệc cưới').first().click();
  await sleep(4000); slow = false;
  const L = await lists(pg); const t = await body(pg);
  if (L.length !== 2 || L[1].label !== 'Theo dự toán 40tr · 200 khách') bad(`bấm hai lần khi đọc chậm: phải đúng 2 danh sách, cuối 40tr; thấy ${L.length} ${JSON.stringify(L.map((l) => l.label))}`);
  const dm = S.calls.match - m0; if (dm < 1 || dm > 2) bad(`match cho một danh sách mới phải 1-2 lần, thấy ${dm}`);
  if (/Đang lấy dự toán…/.test(t)) bad('dòng "Đang lấy dự toán…" còn kẹt');
  void FIND;
  await ctx.close();
});
