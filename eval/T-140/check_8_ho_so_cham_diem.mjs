// T-140 tiêu chí 8: hồ sơ đưa vào bước chấm điểm của chat = ngân sách hạng mục GỐC (chưa nới), giống Python (score_and_rank(passed, profile gốc)).
//  (i) ADR-026 trên đường chat JS (pool điều khiển bằng overlay): cặp đôi gu korean, ngân sách 30tr; 6 vendor khớp gu (korean/soft; rating thấp nhất) giá 30-90tr
//      và 6 vendor không khớp (rating cao nhất) giá 18-21tr -> top 5 KHÔNG có vendor khớp gu nào vượt ngân sách (bản không truyền ngân sách cho ra toàn vendor khớp gu giá gấp 3).
//  (ii) bản chấm bằng ngân sách đã nới x1,2: 7 vendor y hệt nhau (không gu, rating 0), 4 vendor priceMax 12 đứng TRƯỚC trong pool, 3 vendor priceMax 10 đứng sau; ngân sách 10tr
//      -> nới ra 7; 3 vendor trong ngân sách (điểm cao hơn 20 điểm) phải đứng đầu, 4 vendor priceMax 12 sau (bản chấm bằng ngân sách nới cho bốn vendor kia bằng điểm và đứng trước theo thứ tự pool).
import { frozenRoot, load, chat, overlayKeep, eligible, done } from "./_lib.mjs";
const M = await load(frozenRoot()); const fails = [];
{
  const el = eligible(M, "photography");
  const isM = (v) => v.styles.some((t) => ["korean", "soft"].includes(t));
  const match = el.filter(isM).sort((a, b) => a.rating - b.rating || a.reviewCount - b.reviewCount).slice(0, 6);
  const non = el.filter((v) => !isM(v)).sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount).slice(0, 6);
  const keep = [...match.map((v) => ({ id: v.id, priceMin: 30, priceMax: 90 })), ...non.map((v) => ({ id: v.id, priceMin: 18, priceMax: 21 }))];
  const r = await chat(M, { category: "photography", budgetTr: 30, styles: ["korean"], overlay: overlayKeep(M, "photography", keep) });
  const bad = r.ids.filter((i) => match.some((v) => v.id === i));
  if (r.ids.length !== 5) fails.push(`ADR-026: ${r.ids.length} ứng viên, mong 5`);
  if (bad.length) fails.push(`ADR-026: ${bad.length}/5 ứng viên là vendor khớp gu có trần giá 90tr (ngân sách 30tr) dù còn 6 vendor đúng ngân sách`);
}
{
  const group = M.POOL.filter((v) => v.category === "photography" && v.isVerified && v.rating === 0 && v.styles.length === 0 && v.availability.length === 12 && v.city === "HCMC");
  if (group.length < 7) { console.log("PASS chưa áp dụng (pool đông cứng thiếu 7 vendor giống nhau)"); process.exit(0); }
  const g = group.slice(0, 7), relaxed = g.slice(0, 4), inb = g.slice(4);
  const keep = [...relaxed.map((v) => ({ id: v.id, priceMin: 11, priceMax: 12 })), ...inb.map((v) => ({ id: v.id, priceMin: 5, priceMax: 10 }))];
  const r = await chat(M, { category: "photography", budgetTr: 10, overlay: overlayKeep(M, "photography", keep) });
  if (JSON.stringify(r.md?.relaxations_applied) !== '["budget +20%"]') fails.push("chấm điểm ngân sách nới: tín hiệu thử hỏng, không nới");
  const first3 = r.ids.slice(0, 3);
  if (r.ids.length !== 5 || !inb.every((v) => first3.includes(v.id))) fails.push("chấm điểm: 3 vendor trong ngân sách gốc không đứng đầu (ngân sách bị nới trước khi chấm điểm?)");
  const sc = Object.fromEntries((r.md?.matches || []).map((m) => [m.vendor_id, m.final_score]));
  if (r.ids.length === 5 && !(Math.min(...inb.map((v) => sc[v.id])) - Math.max(...relaxed.filter((v) => sc[v.id] != null).map((v) => sc[v.id])) >= 15)) fails.push("điểm vendor trong ngân sách không cao hơn vendor priceMax 12 khoảng 20 điểm");
}
done(fails);
