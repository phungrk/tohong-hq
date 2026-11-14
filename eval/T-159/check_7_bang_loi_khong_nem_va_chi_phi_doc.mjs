// T-159 tiêu chí 7: đọc bảng dự toán lúc chạy từ R2 (data/couples/<id>/budget.json), đúng MỘT lần đọc mỗi request ghép vendor, không đọc ở request không ghép, không gọi mạng.
// Bảng lỗi / thiếu / R2 ném lỗi -> chat và tab rơi về tổng x tỷ lệ như cũ, không ném, không đổi mã trả (200).
import { loadBack, chat, tab, tabMatch, CID, BUDGET_KEY, eligible, overlayKeep, keepPrice, doc, coupleProfile, budgetScoreOf, done } from "./_lib.mjs";
const M = await loadBack(); const fails = [];
const six = eligible(M, "photography").slice(0, 6); const v = six[0];
const ovChat = overlayKeep(M, "photography", keepPrice(six, 28, 29));
const ovTab = overlayKeep(M, "photography", [{ id: v.id, priceMin: 10, priceMax: 30 }]);
const P = coupleProfile({ budget: 300 });
const boom = (k) => { if (k === BUDGET_KEY) throw new Error("R2 sập (eval)"); };
// Rơi về cách cũ: chat 5 ứng viên (30tr), tab điểm ngân sách 1 (vendor priceMax 30 vs 30tr).
for (const [label, o] of [["R2 ném lỗi khi đọc bảng", { onGet: boom }], ["bảng không phải JSON", { budgetDoc: "<<<" }], ["bảng là mảng", { budgetDoc: "[]" }], ["bảng rỗng", { budgetDoc: "" }]]) {
  const c = await chat(M, { profile: P, overlay: ovChat, ...o });
  if (c.err) fails.push(`chat, ${label}: ném ${c.err.message}`); else if (c.ids.length !== 5) fails.push(`chat, ${label}: ${c.ids.length} ứng viên, mong 5 (rơi về tổng x tỷ lệ)`);
  const t = await tabMatch(M, "photography", { profile: P, overlay: ovTab, ...o });
  if (t.err || t.status !== 200) fails.push(`tab, ${label}: lỗi ${t.err?.message || t.status}`); else if (budgetScoreOf(t, v.id) !== 1) fails.push(`tab, ${label}: điểm ngân sách ${budgetScoreOf(t, v.id)}, mong 1`);
}
// Chi phí đọc.
const D = doc({ photography: 40 });
const cost = [
  ["chat ghép vendor, tin không có số", await chat(M, { profile: P, overlay: ovChat, budgetDoc: D }), 1, 1],
  ["chat ghép vendor, tin có số tiền", await chat(M, { profile: P, overlay: ovChat, budgetDoc: D, message: "Tìm photographer chụp ảnh cưới giúp anh chị 30tr" }), 0, 1],
  ["chat không ghép vendor", await chat(M, { profile: P, budgetDoc: D, message: "Chào em, hôm nay anh chị hơi mệt" }), 0, 0],
  ["tab /match", await tabMatch(M, "photography", { profile: P, overlay: ovTab, budgetDoc: D }), 1, 1],
  ["tab /categories", await tab(M, { url: `/api/vendors/categories?coupleId=${CID}`, profile: P, budgetDoc: D }), 0, 0],
  ["tab /:id", await tab(M, { url: `/api/vendors/${v.id}?coupleId=${CID}`, profile: P, overlay: ovTab, budgetDoc: D }), 1, 1],
];
for (const [label, r, min, max] of cost) {
  if (r.err) fails.push(`${label}: ném ${r.err.message}`);
  else if (r.reads < min) fails.push(`${label}: không đọc bảng dự toán (đọc ${r.reads} lần, tối thiểu ${min})`);
  else if (r.reads > max) fails.push(`${label}: đọc bảng ${r.reads} lần, tối đa ${max}`);
}
done(fails);
