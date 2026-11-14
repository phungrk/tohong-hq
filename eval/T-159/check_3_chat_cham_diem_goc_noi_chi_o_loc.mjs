// T-159 tiêu chí 3 (chat, giữ inv-041 / ADR-026): ngân sách hạng mục lấy từ allocated_tr; nới x1,2 CHỈ ở bước lọc, chấm điểm bằng allocated_tr gốc chưa nới.
// (i) allocated 10tr, 4 vendor priceMax 12 (đứng trước trong pool) + 3 vendor priceMax 10: ít hơn 5 qua lọc -> nới ("budget +20%"), 3 vendor trong ngân sách đứng đầu, điểm cao hơn >= 15.
// (ii) allocated 10tr, 5 vendor trong ngân sách + 2 vendor priceMin 11: đủ 5 -> KHÔNG nới, vendor priceMin 11 vắng mặt.
// Hồ sơ tổng 300tr để tổng x tỷ lệ (30tr) cho kết quả khác hẳn nếu allocated bị bỏ qua.
import { loadBack, chat, twins, overlayKeep, doc, coupleProfile, done } from "./_lib.mjs";
const M = await loadBack(); const fails = [];
const t = twins(M, "photography", 7);
if (!t) { console.log("PASS chưa áp dụng (pool đông cứng thiếu 7 vendor giống nhau)"); process.exit(0); }
const D = doc({ photography: 10 });
{
  const relaxed = t.slice(0, 4), inb = t.slice(4);
  const keep = [...relaxed.map((v) => ({ id: v.id, priceMin: 11, priceMax: 12 })), ...inb.map((v) => ({ id: v.id, priceMin: 5, priceMax: 10 }))];
  const r = await chat(M, { budgetDoc: D, profile: coupleProfile({ budget: 300 }), overlay: overlayKeep(M, "photography", keep) });
  if (r.err) fails.push("(i) ném " + r.err.message);
  else {
    if (JSON.stringify(r.md?.relaxations_applied) !== '["budget +20%"]') fails.push(`(i) mong nới đúng một lần, relaxations_applied=${JSON.stringify(r.md?.relaxations_applied)}`);
    const f3 = r.ids.slice(0, 3);
    if (r.ids.length !== 5 || !inb.every((v) => f3.includes(v.id))) fails.push("(i) 3 vendor trong allocated 10tr không đứng đầu (chấm bằng ngân sách đã nới?)");
    const sc = Object.fromEntries((r.md?.matches || []).map((m) => [m.vendor_id, m.final_score]));
    const lo = Math.min(...inb.map((v) => sc[v.id] ?? -1)), hi = Math.max(...relaxed.map((v) => sc[v.id] ?? -Infinity).filter((x) => x > -Infinity), -Infinity);
    if (r.ids.length === 5 && hi > -Infinity && lo - hi < 15) fails.push(`(i) điểm vendor trong ngân sách (${lo}) không cao hơn vendor priceMax 12 (${hi}) tối thiểu 15`);
  }
}
{
  const inb = t.slice(0, 5), out = t.slice(5);
  const keep = [...inb.map((v) => ({ id: v.id, priceMin: 5, priceMax: 10 })), ...out.map((v) => ({ id: v.id, priceMin: 11, priceMax: 12 }))];
  const r = await chat(M, { budgetDoc: D, profile: coupleProfile({ budget: 300 }), overlay: overlayKeep(M, "photography", keep) });
  if (r.err) fails.push("(ii) ném " + r.err.message);
  else {
    if ((r.md?.relaxations_applied || []).length) fails.push("(ii) đủ 5 vendor trong ngân sách mà vẫn nới");
    if (r.ids.some((i) => out.some((v) => v.id === i))) fails.push("(ii) có vendor priceMin 11 (vượt allocated 10tr) lọt vào dù chưa cần nới");
  }
}
done(fails);
