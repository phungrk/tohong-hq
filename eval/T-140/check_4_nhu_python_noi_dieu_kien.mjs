// T-140 tiêu chí 4 (so với chuẩn Python): trên 82 hồ sơ mẫu (fixtures/profiles.json, pool đông cứng), với mỗi hồ sơ đường chat phải
// (i) trả đúng SỐ ứng viên mà matcher Python trả, (ii) báo relaxations_applied giống Python. Mẫu có >= 8 hồ sơ mà Python phải nới (kiểm tín hiệu thử).
import { sample, done } from "./_lib.mjs";
const { rows } = await sample(); const fails = [];
let relaxedPy = 0;
rows.forEach((r, i) => {
  const js = r.c.ids, rl = r.c.md?.relaxations_applied ?? [];
  if (r.ref.relax.length) relaxedPy++;
  if (js.length !== r.ref.ids.length) fails.push(`hồ sơ ${i} (${r.p.category} ${r.p.budget_tr}tr [${r.p.styles}]): chat ${js.length} ứng viên, Python ${r.ref.ids.length}`);
  if (JSON.stringify(rl) !== JSON.stringify(r.ref.relax)) fails.push(`hồ sơ ${i}: relaxations_applied ${JSON.stringify(rl)} khác Python ${JSON.stringify(r.ref.relax)}`);
});
if (relaxedPy < 8) fails.push(`tín hiệu thử hỏng: chỉ ${relaxedPy} hồ sơ Python phải nới`);
done(fails.slice(0, 8));
