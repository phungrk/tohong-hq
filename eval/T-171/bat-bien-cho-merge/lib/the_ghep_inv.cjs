#!/usr/bin/env node
/* Nguồn: T-171 (spec products/T-171-the-vendor-theo-du-toan-hien-tai.md v2, "Bất biến đề xuất", H1, H2, H3); rút bởi spec-critic khi spec qua Spec Gate 2026-11-15.
 * INV · Thẻ ghép vendor trong chat không hiện điểm hay dòng phép so tính trên dự toán/số khách cũ hơn bản đã lưu của cặp đôi trong cùng phiên, và không gọi lại khi không có gì đổi.
 * Ba ca, API giả có trạng thái, đổi dự toán bằng thanh "Dự toán" của màn Ngân sách (đường tự lưu thật); đo chữ người dùng thấy và số lần gọi ở ranh giới mạng, không đọc mã nguồn:
 *  (A) Có thẻ danh sách, chi tiết đang mở, bảng so sánh; lưu 90 -> 40 thành công (phản hồi điểm chậm 1,5s). Từ 300ms sau khi server nhận 40 trở đi, không lúc nào thẻ danh sách hay chi tiết
 *      còn "so với 90tr" hay Alpha 100% (điểm theo 90tr) (bảng so sánh trong lúc chờ không đo, như spec H2); trong 6s mọi thẻ theo 40tr (danh sách Alpha 70%, chi tiết "so với 40tr tiệc cưới", bảng so sánh có 70% không có 100%).
 *  (B) Lưu 90 -> 40 (phản hồi chậm 2,5s) rồi 40 -> 70 (nhanh): sau khi mọi phản hồi về, danh sách Alpha 83% và chi tiết "so với 70tr", không bị phản hồi trễ đè.
 *  (C) Không có gì đổi (chuyển tab qua lại; kéo 90 -> 95 -> 90 liền): số lần gọi match và chi tiết +0.
 * Chạy: node <file> [--repo <tohong-front>]; biến TOHONG_FRONT_REPO (mặc định <gốc HQ>/../tohong-front), PLAYWRIGHT_PATH. */
const { run, sleep } = require('./the_ghep_khung.cjs');
run(async ({ dev, br, bad, newServer, mount, open, goBudget, goChat, dragTo, cardText, rowOf, waitText, openDetail }) => {
  { // (A)
    const S = newServer(); const { ctx, pg } = await mount(br, S); await open(dev, pg);
    await openDetail(pg, 'Alpha Hall', 1);
    await pg.locator('[data-card="1"]').getByText('So sánh', { exact: false }).first().click();
    await pg.waitForSelector('[data-card="2"]'); await pg.locator('[data-card="2"]').getByText('Beta Hall', { exact: false }).first().click();
    await pg.locator('[data-card="2"]').getByRole('button', { name: /So sánh 2 vendor/ }).click();
    await pg.waitForSelector('[data-card="3"]'); await pg.waitForTimeout(500);
    S.delayMatchMs = 1500;
    await goBudget(pg); await dragTo(pg, 40); let t0 = Date.now(); while (S.venue !== 40 && Date.now() - t0 < 6000) await sleep(50);
    if (S.venue !== 40) bad('(A) khung: lưu 40 không tới server giả');
    await goChat(pg); await sleep(300);
    let done = false; t0 = Date.now();
    while (Date.now() - t0 < 6000) {
      const a = await rowOf(pg, 'Alpha Hall'), d = (await cardText(pg, 1)) || '', c = (await cardText(pg, 3)) || '';
      if (a.pct === '100') bad('(A) sau khi đã lưu 40tr, thẻ danh sách còn hiện Alpha 100% (điểm theo 90tr)');
      if (/so với 90tr/.test(d) || /100% phù hợp/.test(d)) bad('(A) sau khi đã lưu 40tr, thẻ chi tiết còn hiện điểm hoặc "so với 90tr"');
      if (a.pct === '70' && /so với 40tr tiệc cưới/.test(d) && /70%/.test(c) && !/100%/.test(c)) { done = true; break; }
      await sleep(100);
    }
    if (!done) bad('(A) trong 6s sau khi lưu 40tr, không phải mọi thẻ đều theo 40tr (danh sách Alpha 70%, chi tiết "so với 40tr tiệc cưới", bảng so sánh 70%)');
    await ctx.close();
  }
  { // (B)
    const S = newServer(); const { ctx, pg } = await mount(br, S); await open(dev, pg);
    await openDetail(pg, 'Alpha Hall', 1); await pg.waitForTimeout(600);
    const m0 = S.calls.match, d0 = S.calls.detail;
    S.matchDelays = { [m0]: 2500 }; S.detailDelays = { [d0]: 2500 };
    await goBudget(pg); await dragTo(pg, 40); let t0 = Date.now(); while (S.venue !== 40 && Date.now() - t0 < 6000) await sleep(100);
    t0 = Date.now(); while (S.calls.match <= m0 && Date.now() - t0 < 5000) await sleep(50);
    await sleep(1000);
    await dragTo(pg, 70); t0 = Date.now(); while (S.venue !== 70 && Date.now() - t0 < 6000) await sleep(100);
    await goChat(pg); await sleep(5000);
    const a = await rowOf(pg, 'Alpha Hall'), d = (await cardText(pg, 1)) || '';
    if (a.pct !== '83' || a.order.join() !== 'Alpha,Beta') bad(`(B) lưu 40 rồi 70: danh sách cuối cùng phải theo 70tr (Alpha 83%, Alpha>Beta), thấy Alpha ${a.pct}% ${a.order.join('>')}`);
    if (!/so với 70tr tiệc cưới/.test(d)) bad('(B) lưu 40 rồi 70: chi tiết cuối cùng phải ghi "so với 70tr tiệc cưới"');
    await ctx.close();
  }
  { // (C)
    const S = newServer(); const { ctx, pg } = await mount(br, S); await open(dev, pg);
    await openDetail(pg, 'Alpha Hall', 1); await pg.waitForTimeout(800);
    const m0 = S.calls.match, d0 = S.calls.detail;
    for (let i = 0; i < 3; i++) { await goBudget(pg); await goChat(pg); }
    await goBudget(pg); await dragTo(pg, 95); await dragTo(pg, 90); await sleep(2200); await goChat(pg); await sleep(1200);
    if (S.calls.match !== m0 || S.calls.detail !== d0) bad(`(C) không có gì đổi (chuyển tab, kéo về đúng 90 đã lưu) mà gọi lại: match +${S.calls.match - m0}, chi tiết +${S.calls.detail - d0}`);
    await ctx.close();
  }
});
