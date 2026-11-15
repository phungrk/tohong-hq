#!/usr/bin/env node
/* T-179 tiêu chí 5 (App thật, spec H1 bước 1): bấm Tìm vendor NGAY sau khi kéo thanh Dự toán (lần tự lưu còn chờ gửi hoặc đang gửi) vẫn thấy danh sách theo số mới: danh sách mới ghi "Theo dự toán 40tr",
 * Alpha 70%, và chỉ in MỘT danh sách mới (không in một theo 90tr rồi một theo 40tr). Lần lưu phản hồi chậm 1,2 giây cũng vậy.
 * Chạy từ gốc tohong-hq: node eval/T-179/check_5_bam_ngay_sau_khi_keo.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async ({ dev, br, bad, newServer, openApp, dragTo, lists, pressFind, closeChat }) => {
  const S = newServer(); const { ctx, pg } = await openApp(dev, br, S);
  await pressFind(pg, 1); await closeChat(pg);
  for (const slow of [false, true]) {
    const target = slow ? 70 : 40; const prev = slow ? 40 : 90;
    if (slow) await pg.route('http://localhost:8787/api/couples/t171/budget', async (r) => { if (r.request().method() === 'PUT') await sleep(1200); return r.fallback(); });
    await dragTo(pg, target, { settleMs: 0 });
    const want = slow ? 3 : 2;
    const L = await pressFind(pg, want, 9000); await sleep(2500); const L2 = await lists(pg);
    if (L2.length !== want) bad(`${slow ? 'phản hồi lưu chậm' : 'bấm ngay'}: phải đúng ${want} danh sách (một danh sách mới), thấy ${L2.length}`);
    else if (L2[want - 1].label !== `Theo dự toán ${target}tr · 200 khách`) bad(`${slow ? 'phản hồi lưu chậm' : 'bấm ngay'}: danh sách mới phải ghi "Theo dự toán ${target}tr · 200 khách" (số vừa kéo), thấy ${L2[want - 1].label} (số cũ ${prev})`);
    if (L2.length === want && !slow && L2[1].pcts[0] !== '70') bad(`danh sách theo 40tr phải Alpha 70%, thấy ${L2[1].pcts[0]}%`);
    await closeChat(pg);
  }
  await ctx.close();
});
