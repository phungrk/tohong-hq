#!/usr/bin/env node
/* T-174 adversary 04 (tohong-front, spec T-171 H2 "phản hồi tới trễ của lần gọi trước không được ghi đè"): như eval 8 nhưng trễ LỚN (6s, máy/mạng chậm) và thêm ca
 * lần tải ĐẦU của thẻ (mount) còn đang bay thì đã có sự kiện. Lấy mẫu chữ thẻ mỗi 100ms suốt quá trình: không khung nào được hiện điểm của lần cũ sau khi đã hiện điểm mới.
 * Input A: mở chi tiết Alpha; lưu 90 -> 40 (match + chi tiết trễ 6s), rồi 40 -> 70 (nhanh). Mong đợi: cuối cùng Alpha 83%, Alpha>Beta, chi tiết "so với 70tr"; sau lần đầu thấy 83% không bao giờ thấy 70%.
 * Input B: thẻ danh sách mới (mount) mà lần tải đầu trễ 5s (theo 90tr), trong lúc đó lưu 90 -> 40. Mong đợi: cuối cùng Alpha 70%, Beta>Alpha; không bao giờ hiện 100%.
 * Chạy từ gốc tohong-hq: node eval/T-174/adv-04-phan-hoi-rat-tre-va-tai-dau-cham.cjs [--repo <tohong-front>] */
const { run, sleep } = require('../T-171/_lib.cjs');
run(async ({ dev, br, bad, newServer, mount, open, goBudget, goChat, dragTo, rowOf, cardText, openDetail }) => {
  { // A
    const S = newServer(); const { ctx, pg } = await mount(br, S); await open(dev, pg);
    await openDetail(pg, 'Alpha Hall', 1); await pg.waitForTimeout(600);
    const m0 = S.calls.match, d0 = S.calls.detail;
    S.matchDelays = { [m0]: 6000 }; S.detailDelays = { [d0]: 6000 };
    const seen = []; let stop = false;
    const sampler = (async () => { while (!stop) { try { seen.push((await rowOf(pg, 'Alpha Hall')).pct); } catch (e) { /* */ } await sleep(100); } })();
    await goBudget(pg); await dragTo(pg, 40); let t0 = Date.now(); while (S.venue !== 40 && Date.now() - t0 < 6000) await sleep(100);
    t0 = Date.now(); while (S.calls.match <= m0 && Date.now() - t0 < 5000) await sleep(50);
    await sleep(1000); await dragTo(pg, 70); t0 = Date.now(); while (S.venue !== 70 && Date.now() - t0 < 6000) await sleep(100);
    await goChat(pg); await sleep(8000); stop = true; await sampler;
    const a = await rowOf(pg, 'Alpha Hall'), d = await cardText(pg, 1);
    if (a.pct !== '83' || a.order.join() !== 'Alpha,Beta') bad(`[A] cuối cùng phải Alpha 83%, Alpha>Beta; thấy ${a.pct}% ${a.order.join('>')}`);
    if (!/so với 70tr tiệc cưới/.test(d || '')) bad('[A] chi tiết cuối cùng phải "so với 70tr", thấy ' + (d || '').slice(0, 200));
    const i83 = seen.indexOf('83'); if (i83 >= 0 && seen.slice(i83).some((p) => p && p !== '83')) bad('[A] sau khi đã hiện 83% lại hiện ' + seen.slice(i83).filter((p) => p && p !== '83').join(','));
    if (seen.includes('100')) bad('[A] có khung hiện 100% (điểm theo 90tr) sau khi đã lưu');
    await ctx.close();
  }
  { // B
    const S = newServer(); S.matchDelays = { 0: 5000 }; const { ctx, pg } = await mount(br, S);
    await pg.goto(`http://127.0.0.1:${dev.port}/__t171.html`, { waitUntil: 'domcontentloaded' });
    await goBudget(pg); await dragTo(pg, 40); let t0 = Date.now(); while (S.venue !== 40 && Date.now() - t0 < 6000) await sleep(100);
    await goChat(pg);
    const seen = []; t0 = Date.now(); while (Date.now() - t0 < 8000) { seen.push((await rowOf(pg, 'Alpha Hall')).pct); await sleep(100); }
    const a = await rowOf(pg, 'Alpha Hall');
    if (a.pct !== '70' || a.order.join() !== 'Beta,Alpha') bad(`[B] lần tải đầu trễ + đã lưu 40: cuối cùng phải Alpha 70%, Beta>Alpha; thấy ${a.pct}% ${a.order.join('>')}`);
    if (seen.includes('100')) bad('[B] có khung hiện 100% (phản hồi tải đầu theo 90tr) sau khi đã lưu 40');
    await ctx.close();
  }
});
