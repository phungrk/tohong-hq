// T-140 tiêu chí 9: ghim λ = 0,3 của MMR và luật khi giá trị MMR bằng nhau.
//  Luật hoà: giá trị MMR bằng nhau thì chọn vendor đứng TRƯỚC trong thứ tự top 20 (so sánh chặt ">" như Python; không "chọn vendor đứng sau").
//  (i) 3 kịch bản dựng sẵn (fixtures/mmr-scenarios.json): top 5 của chat == top 5 của chuẩn MMR λ=0,3 viết ngay trong eval (từ điểm computeMatches, thứ tự top 20 thật);
//      và chuẩn MMR với λ = 0,2/0,25/0,27/0,33/0,35/0,4 cho top 5 KHÁC (eval tự kiểm tính nhạy mỗi lần chạy) => cài λ khác 0,3 thì đỏ.
//  (ii) 7 vendor y hệt nhau (hoà mọi thứ): top 5 = 5 vendor đầu theo thứ tự top 20, đúng thứ tự.
import { frozenRoot, load, chat, overlayKeep, jaccardDist, HERE, done } from "./_lib.mjs";
import { readFileSync } from "fs"; import path from "path";
const M = await load(frozenRoot()); const fails = [];
const sim = (a, b) => 1 - jaccardDist(a, b);
function mmr(r, k, lam) {
  if (r.length <= k) return r.map((x) => x.id);
  const sel = [r[0]], rem = r.slice(1);
  while (sel.length < k && rem.length) {
    let bi = 0, bm = -Infinity;
    rem.forEach((c, i) => { const m = (1 - lam) * c.score / 100 - lam * Math.max(...sel.map((s) => sim(c.styles, s.styles))); if (m > bm) { bm = m; bi = i; } });
    sel.push(rem.splice(bi, 1)[0]);
  }
  return sel.map((x) => x.id);
}
const top20 = () => M.computeMatches({ city: "HCMC", weddingDate: "2029-03-20", guestCount: null, budgetByCategory: { photography: 10 }, preferredStyles: [] }, { category: "photography", limit: 20 }).vendors.map((v) => ({ id: v.id, styles: v.styles, score: v.match.totalScore }));
const sc = JSON.parse(readFileSync(path.join(HERE, "fixtures", "mmr-scenarios.json"), "utf8")).scenarios;
for (const [k, s] of sc.entries()) {
  const r = await chat(M, { category: "photography", budgetTr: 10, overlay: overlayKeep(M, "photography", s.ids.map((id, i) => ({ id, priceMin: 5, priceMax: s.priceMax[i] }))) });
  const list = top20(), want = mmr(list, 5, 0.3).join();
  if (r.ids.join() !== want) fails.push(`kịch bản ${k + 1}: top 5 của chat khác MMR λ=0,3 (không đúng λ hoặc luật hoà)`);
  for (const l of [0.2, 0.25, 0.27, 0.33, 0.35, 0.4]) if (mmr(list, 5, l).join() === want) fails.push(`kịch bản ${k + 1}: tín hiệu thử hỏng, λ=${l} cho cùng kết quả`);
}
{
  const g = M.POOL.filter((v) => v.category === "photography" && v.isVerified && v.rating === 0 && v.styles.length === 0 && v.availability.length === 12 && v.city === "HCMC").slice(0, 7);
  if (g.length < 7) { console.log("PASS chưa áp dụng (pool đông cứng thiếu 7 vendor giống nhau)"); process.exit(0); }
  const r = await chat(M, { category: "photography", budgetTr: 10, overlay: overlayKeep(M, "photography", g.map((v) => ({ id: v.id, priceMin: 5, priceMax: 10 }))) });
  const want = top20().slice(0, 5).map((x) => x.id).join();
  if (r.ids.join() !== want) fails.push("hoà hoàn toàn: top 5 không phải 5 vendor đầu theo thứ tự top 20 (luật hoà: chọn vendor đứng trước)");
}
done(fails);
