// T-140 tiêu chí 6 (chất lượng tổng "không kém" Python): trùng top-5 (recall@5 = |chat ∩ Python| / min(5, |Python|), trung bình trên 82 hồ sơ mẫu, cùng pool, cùng dữ liệu) >= 0,54.
// Đo trước khi viết: bản chỉ lọc + chấm điểm JS (không MMR) 0,471; bản lọc + nới + MMR theo spec 0,583. Trùng 100% không phải mục tiêu: công thức chấm điểm JS (T-080) khác Python và ADR-077 không đổi nó.
import { sample, mean, done } from "./_lib.mjs";
const { rows } = await sample();
const rec = mean(rows.map((r) => (r.ref.ids.length ? r.c.ids.filter((x) => r.ref.ids.includes(x)).length / Math.min(5, r.ref.ids.length) : 1)));
console.error(`recall@5 = ${rec.toFixed(3)}`);
done(rec >= 0.54 ? [] : [`recall@5 ${rec.toFixed(3)} < 0,54`]);
