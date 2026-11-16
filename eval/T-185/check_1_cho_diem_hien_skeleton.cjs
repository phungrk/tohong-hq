#!/usr/bin/env node
/* T-185 tiêu chí 1 (H1): GET chi tiết chưa về (trễ 1,8s) -> khối "Phân tích AI" hiện skeleton đủ bốn phần: phần trăm ở tiêu đề, ba thanh, dòng phép so (dưới thanh Ngân sách), câu AI;
 * ở MỌI thời điểm trước khi có điểm, chữ trong khối chỉ còn tiêu đề + ba nhãn tĩnh (không chữ số, không "%", không "Đang cập nhật điểm…", không câu mẫu của hàng, không "▌");
 * vùng chờ là aria-busy + role=status "Đang tải…"; danh sách vendor phía trên không đổi chữ nào. Khi điểm về: skeleton biến mất, hiện "80% phù hợp".
 * Chạy từ gốc tohong-hq: node eval/T-185/check_1_cho_diem_hien_skeleton.cjs [--repo <tohong-front>] */
const { run, sleep } = require('./_lib.cjs');
run(async (h) => {
  const { bad, setup, snap, watch, stopWatch, dynText, zones, zonesOk, zonesMsg, openBeta, lists, same } = h;
  const { ctx, pg } = await setup({ delay: 1800 });
  const before = (await lists(pg)).map((l) => l.text);
  await watch(pg); await openBeta(pg); await sleep(1000);
  const s = await snap(pg);
  if (!s) bad('bấm vendor mà không thấy khối "Phân tích AI" của thẻ chi tiết');
  else {
    if (!s.busy) bad('trong lúc chờ điểm, khối phải là vùng chờ (aria-busy) hiện skeleton');
    if (!s.status) bad('vùng chờ phải có role=status với tên "Đang tải…"');
    const z = zones(s); if (!zonesOk(z)) bad('skeleton thiếu phần: ' + zonesMsg(z));
    if (dynText(s.text)) bad('khối chỉ được còn tiêu đề + ba nhãn tĩnh lúc chờ, đang thấy thêm: "' + dynText(s.text) + '"');
  }
  await sleep(1500); const samples = await stopWatch(pg);
  const pre = samples.filter((x) => x.s && !/\d+% phù hợp/i.test(x.s.text)); // mọi mẫu chưa có điểm thật
  const dirty = pre.find((x) => dynText(x.s.text)); if (dirty) bad('có lúc trước khi có điểm khối hiện thêm chữ/số: "' + dynText(dirty.s.text) + '"');
  if (!same(before, (await lists(pg)).map((l) => l.text))) bad('danh sách vendor phía trên đổi chữ khi thẻ chi tiết chờ điểm (phải giữ nguyên)');
  await sleep(600); const f = await snap(pg);
  if (!f || f.busy) bad('điểm đã về thì skeleton phải biến mất');
  else if (!/80% phù hợp/i.test(f.text)) bad('điểm về phải hiện "Phân tích AI · 80% phù hợp"');
  await ctx.close();
});
