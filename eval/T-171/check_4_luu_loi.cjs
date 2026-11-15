#!/usr/bin/env node
/* T-171 tiêu chí 4 (tohong-front): lưu dự toán LỖI (server 500, hoặc mạng đứt) thì không im lặng.
 * Ở màn Ngân sách, khi thanh Dự toán đang ở 40 mà chưa lưu được: hiện câu "Chưa lưu được dự toán" và nút "Thử lại" (thấy được cùng lúc với số 40, nên số chưa lưu không giả làm đã lưu);
 * thẻ vendor trong chat KHÔNG gọi lại và vẫn hiện điểm theo bản đã lưu (100%, so với 90tr); câu báo còn đó sau khi chuyển tab; bấm "Thử lại" (khi server tốt lại) lưu thành công,
 * câu báo biến mất và thẻ chat lấy điểm theo 40tr (70%). Chạy cả hai kiểu lỗi.
 * Ca thứ ba: lưu lỗi (500), rồi server tốt lại và người dùng kéo tiếp 40 -> 45: lần tự lưu kế tiếp thành công làm câu báo biến mất và thẻ chat hiện theo 45tr.
 * Chạy từ gốc tohong-hq: node eval/T-171/check_4_luu_loi.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async ({ dev, br, bad, newServer, mount, open, goBudget, goChat, dragTo, rowOf, cardText }) => {
  for (const mode of ['500', 'abort']) {
    const L = `[lỗi ${mode}]`;
    const S = newServer(); S.putFail = mode; const { ctx, pg } = await mount(br, S); await open(dev, pg);
    const m0 = S.calls.match;
    await goBudget(pg); await dragTo(pg, 40);
    const t0 = Date.now(); while (S.calls.put < 1 && Date.now() - t0 < 6000) await sleep(100);
    await sleep(1200);
    const body = () => pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    const sliderNow = await pg.getByRole('slider', { name: 'Dự toán' }).getAttribute('aria-valuenow');
    let b = await body();
    if (!/Chưa lưu được dự toán/.test(b)) bad(`${L} lưu lỗi mà màn Ngân sách không báo "Chưa lưu được dự toán" (im lặng) khi thanh đang ở ${sliderNow}`);
    if (!(await pg.getByRole('button', { name: /Thử lại/ }).first().isVisible().catch(() => false))) bad(`${L} câu báo lỗi phải có nút "Thử lại" thấy được`);
    if (S.venue !== 90) bad(`${L} khung: server giả phải còn 90 sau lưu lỗi, thấy ${S.venue}`);
    if (S.calls.match !== m0) bad(`${L} lưu lỗi (server không đổi) mà thẻ chat vẫn gọi lại match (+${S.calls.match - m0}); phải +0`);
    await goChat(pg); await sleep(800);
    const a = await rowOf(pg, 'Alpha Hall');
    if (a.pct !== '100') bad(`${L} sau lưu lỗi thẻ chat phải còn theo bản đã lưu (Alpha 100%), thấy ${a.pct}%`);
    await goBudget(pg); b = await body();
    if (!/Chưa lưu được dự toán/.test(b)) bad(`${L} câu báo lỗi biến mất sau khi chuyển tab trong khi dự toán vẫn chưa lưu`);
    S.putFail = null;
    await pg.getByRole('button', { name: /Thử lại/ }).first().click();
    const t1 = Date.now(); while (S.venue !== 40 && Date.now() - t1 < 6000) await sleep(100);
    if (S.venue !== 40) bad(`${L} bấm "Thử lại" khi server đã tốt mà không lưu được 40 (server còn ${S.venue})`);
    await sleep(500); b = await body();
    if (/Chưa lưu được dự toán/.test(b)) bad(`${L} lưu lại thành công mà câu báo lỗi vẫn còn`);
    await goChat(pg); let a2 = null; const t2 = Date.now(); while (Date.now() - t2 < 5000) { a2 = await rowOf(pg, 'Alpha Hall'); if (a2.pct === '70') break; await sleep(150); }
    if (a2.pct !== '70') bad(`${L} sau lưu thành công thẻ chat phải hiện Alpha 70% (theo 40tr), thấy ${a2.pct}%`);
    await ctx.close();
  }
  { // ca 3: chỉnh tiếp thành công cũng xoá câu báo
    const L = '[chỉnh tiếp]'; const S = newServer(); S.putFail = '500'; const { ctx, pg } = await mount(br, S); await open(dev, pg);
    await goBudget(pg); await dragTo(pg, 40); let t0 = Date.now(); while (S.calls.put < 1 && Date.now() - t0 < 6000) await sleep(100); await sleep(1000);
    const body = () => pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    if (!/Chưa lưu được dự toán/.test(await body())) bad(`${L} khung: lưu lỗi phải hiện câu báo`);
    S.putFail = null; await dragTo(pg, 45); t0 = Date.now(); while (S.venue !== 45 && Date.now() - t0 < 6000) await sleep(100);
    if (S.venue !== 45) bad(`${L} khung: lần lưu kế tiếp phải thành công (server ${S.venue})`);
    await sleep(500); if (/Chưa lưu được dự toán/.test(await body())) bad(`${L} lần tự lưu kế tiếp thành công mà câu báo vẫn còn`);
    await goChat(pg); let a = null; const t1 = Date.now(); while (Date.now() - t1 < 5000) { a = await rowOf(pg, 'Alpha Hall'); if (a.pct === '70') break; await sleep(150); }
    if (a.pct !== '70') bad(`${L} sau lưu thành công 45tr thẻ chat phải hiện Alpha 70% (78tr so với 45tr vượt > 20%), thấy ${a.pct}%`);
    await ctx.close();
  }
});
