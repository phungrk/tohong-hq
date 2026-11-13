// T-140 tiêu chí 5 (MMR đa dạng, so với chuẩn Python): trên các hồ sơ mẫu mà cả hai bên đều trả đủ 5,
// (i) độ đa dạng gu trung bình (khoảng cách Jaccard trung bình từng cặp trong top 5) của chat >= của Python - 0,04 (không có MMR ~0,68; Python ~0,85);
// (ii) R8 (T-072) giữ nguyên sau MMR: với hai ứng viên khác nhóm (khớp gu / không khớp) ở thứ tự i<j thì final_score_i >= final_score_j, bằng điểm thì vendor khớp đứng trên.
import { sample, meanPairDist, mean, done } from "./_lib.mjs";
const { rows, byId, M } = await sample(); const fails = [];
const both5 = rows.filter((r) => r.c.ids.length === 5 && r.ref.ids.length === 5);
if (both5.length < 60) fails.push(`tín hiệu thử hỏng: chỉ ${both5.length} hồ sơ có đủ 5 ở cả hai bên`);
else {
  const dj = mean(both5.map((r) => meanPairDist(r.c.ids.map((i) => byId.get(i))))), dp = mean(both5.map((r) => meanPairDist(r.ref.ids.map((i) => byId.get(i)))));
  if (!(dj >= dp - 0.04)) fails.push(`đa dạng gu chat ${dj.toFixed(3)} < Python ${dp.toFixed(3)} - 0,04`);
}
for (const [k, r] of rows.entries()) {
  const ms = r.c.md?.matches || [], grp = ms.map((m) => M.satisfiedStyles(r.p.styles, byId.get(m.vendor_id)?.styles).length > 0);
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
    if (grp[i] === grp[j]) continue;
    if (ms[i].final_score < ms[j].final_score || (ms[i].final_score === ms[j].final_score && !grp[i])) fails.push(`hồ sơ ${k}: R8 đảo thứ tự theo điểm (vị trí ${i + 1} vs ${j + 1})`);
  }
}
done(fails.slice(0, 8));
