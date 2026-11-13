// T-140 tiêu chí 3: nới điều kiện đúng các bước của Python (matcher/matcher.py _relax_and_retry), kiểm bằng pool điều khiển (overlay ẩn hết trừ vài vendor có giá admin):
//  - chỉ nới khi số vendor qua lọc cứng < 5; nới MỘT bước duy nhất: ngân sách x 1,2 (cắt phần thập phân, so priceMin <= ngân sách mới, dấu bằng được);
//  - chỉ nhận bước nới khi nó thêm được vendor; nới rồi vẫn thiếu thì trả những gì có, không lỗi;
//  - đã nới thì relaxations_applied == ["budget +20%"] và prompt có lời nhắc 'nới lỏng'; không nới thì không có cả hai.
import { frozenRoot, load, chat, candidates, overlayKeep, eligible, done } from "./_lib.mjs";
const M = await load(frozenRoot()); const fails = [];
const el = eligible(M, "photography");
const mk = (specs) => specs.map(([pmin, pmax], i) => ({ id: el[i].id, priceMin: pmin, priceMax: pmax }));
async function scen(label, specs, expect) {
  const keep = mk(specs);
  const r = await chat(M, { category: "photography", budgetTr: 10, overlay: overlayKeep(M, "photography", keep) });
  const ids = new Set(r.ids), want = new Set((expect.ids || []).map((i) => keep[i].id));
  if (r.ids.length !== expect.count) fails.push(`${label}: ${r.ids.length} ứng viên, mong ${expect.count}`);
  if (expect.ids && !(ids.size === want.size && [...ids].every((x) => want.has(x)))) fails.push(`${label}: tập ứng viên lệch (mong chỉ các vendor số ${expect.ids.join(",")})`);
  if (expect.within) for (const id of ids) { const k = keep.find((q) => q.id === id); if (!expect.within.includes(keep.indexOf(k))) fails.push(`${label}: vendor số ${keep.indexOf(k)} không được vào`); }
  const rl = JSON.stringify(r.md?.relaxations_applied ?? null);
  if (rl !== JSON.stringify(expect.relax)) fails.push(`${label}: relaxations_applied ${rl}, mong ${JSON.stringify(expect.relax)}`);
  const noted = /nới lỏng/.test(r.sp);
  if (noted !== expect.relax.length > 0) fails.push(`${label}: lời nhắc 'nới lỏng' ${noted ? "có" : "không có"}, mong ${expect.relax.length ? "có" : "không"}`);
}
const R = ["budget +20%"];
// R1: 3 vendor <=10, 4 vendor 11-13, 1 vendor 12,01 -> nới còn 7 qua, trả 5 trong 7 (không có vendor 12,01)
await scen("R1 thiếu -> nới đủ", [[10, 12], [10, 12], [10, 12], [11, 13], [11, 13], [11, 13], [11, 13], [12.01, 14]], { count: 5, relax: R, within: [0, 1, 2, 3, 4, 5, 6] });
// R2: 2 vendor <=10, còn lại 20 -> nới không thêm ai: không nhận bước nới, trả 2, không lời nhắc
await scen("R2 nới không thêm ai", [[10, 12], [10, 12], [20, 22], [20, 22], [20, 22], [20, 22]], { count: 2, ids: [0, 1], relax: [] });
// R3: đủ 5 vendor <=10 thì không nới dù nới sẽ thêm 4 vendor 11tr
await scen("R3 đủ 5 thì không nới", [[10, 12], [10, 12], [10, 12], [10, 12], [10, 12], [11, 13], [11, 13], [11, 13], [11, 13]], { count: 5, ids: [0, 1, 2, 3, 4], relax: [] });
// R4: 0 vendor <=10, 3 vendor 11tr -> nới ra 3
await scen("R4 không ai -> nới ra 3", [[11, 13], [11, 13], [11, 13], [20, 22]], { count: 3, ids: [0, 1, 2], relax: R });
// R5: mép: priceMin 12 (= 10tr x 1,2) qua, 12,01 không qua
await scen("R5 mép 12tr", [[12, 13], [12.01, 13]], { count: 1, ids: [0], relax: R });
// R6: ngân sách lẻ, int(8.333.333 x 1,2) = 9.999.999 -> priceMin 10 (10.000.000) KHÔNG qua
{
  const keep = mk([[10, 12], [9.9, 12]]);
  const r = await chat(M, { category: "photography", message: "Tìm photographer chụp ảnh cưới giúp anh chị 8.333.333 đồng", overlay: overlayKeep(M, "photography", keep) });
  if (r.ids.includes(keep[0].id) || !r.ids.includes(keep[1].id)) fails.push(`R6 cắt phần thập phân: ứng viên ${JSON.stringify(r.ids.map((i) => (i === keep[0].id ? "10tr" : "9,9tr")))} (mong chỉ 9,9tr)`);
}
done(fails);
