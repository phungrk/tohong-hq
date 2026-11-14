// T-161 adv-03 (Code Gate, tầng 3). Spec T-159 H1, H7: chat với bảng lạ không ném (inv-040) và đọc tối đa 1 lần;
// số trong tin nhắn thắng phân bổ; coupleId lạ/không quyền thì tab không đọc bảng; bảng rất lớn không làm chậm (< 3s).
import { loadBack, chat, tab, tabMatch, CID, eligible, overlayKeep, keepPrice, doc, coupleProfile, done } from "../T-159/_lib.mjs";
const M = await loadBack(); const fails = [];
const six = eligible(M, "photography").slice(0, 6);
const P = coupleProfile({ budget: 300 });
const cat = (id, a) => ({ id, name: id, allocated_tr: a, items: [] });
const odd = [
  ["categories object", { categories: { photography: 20 }, total_tr: 300 }],
  ["phần tử rác + __proto__", { categories: [null, 1, "x", { id: "__proto__", allocated_tr: 50 }, { id: { a: 1 }, allocated_tr: 9 }, cat("photography", "Infinity")], total_tr: 300 }],
  ["total_tr âm", { categories: [cat("photography", 20)], total_tr: -5 }],
];
for (const [label, d] of odd) {
  const r = await chat(M, { profile: P, budgetDoc: d, overlay: overlayKeep(M, "photography", keepPrice(six, 28, 29)) });
  if (r.err) fails.push(`chat ${label}: ném ${r.err.message}`);
  else if (r.reads > 1) fails.push(`chat ${label}: đọc bảng ${r.reads} lần`);
}
// số trong tin nhắn thắng: phân bổ 100tr, tin "15tr" -> vendor priceMin 28 bị loại (nới x1,2 = 18tr) dù phân bổ cho qua.
{
  const r = await chat(M, { profile: P, budgetDoc: doc({ photography: 100 }), message: "Tìm photographer chụp ảnh cưới giúp anh chị tầm 15tr", overlay: overlayKeep(M, "photography", keepPrice(six, 28, 29)) });
  if (r.err) fails.push(`chat tin có số: ném ${r.err.message}`); else if (r.ids.length !== 0) fails.push(`chat tin có số 15tr, phân bổ 100tr: ${r.ids.length} ứng viên giá 28tr, mong 0 (số trong tin thắng)`);
}
// tab: coupleId lạ
for (const [label, url] of [["coupleId path traversal", `/api/vendors/match?coupleId=..%2Fc1&category=photography`], ["coupleId couple khác (không tồn tại members)", `/api/vendors/match?coupleId=c2&category=photography`]]) {
  const r = await tab(M, { url, profile: P, budgetDoc: doc({ photography: 20 }) });
  if (r.err || r.status !== 200) fails.push(`${label}: lỗi ${r.err?.message || r.status}`);
  if (r.reads !== 0) fails.push(`${label}: đọc bảng c1 ${r.reads} lần`);
}
// bảng lớn: 200k hạng mục tự thêm + ảnh 20tr
{
  const big = doc({ photography: 20 }, { extra: Array.from({ length: 200000 }, (_, i) => cat("c" + (1700000000000 + i), i % 7)) });
  const t0 = Date.now();
  const r = await tabMatch(M, "photography", { profile: P, budgetDoc: big, overlay: overlayKeep(M, "photography", [{ id: six[0].id, priceMin: 10, priceMax: 15 }]) });
  const ms = Date.now() - t0;
  if (r.err || r.status !== 200) fails.push(`bảng lớn: lỗi ${r.err?.message || r.status}`);
  else if (!String(r.body.whyThoseVendors).includes("khoảng 20tr")) fails.push(`bảng lớn: câu "${r.body.whyThoseVendors}"`);
  if (ms > 3000) fails.push(`bảng lớn: ${ms}ms`);
}
done(fails);
