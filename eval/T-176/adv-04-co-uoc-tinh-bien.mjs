// T-176 adv-04 (đối kháng, T-172 H4/H5, inv-003 + planner/vendor/inv-006 phía AI): các ca biên của cờ "Ngân sách: chưa đủ cơ sở" mà check_3/check_4 không chạm.
// (a) khối ứng viên: ước tính chỉ ở vị trí thứ 6 (ngoài top 5 được in) => không dòng cờ, không dòng hướng dẫn; (b) price_basis chỉ nằm ở item.vendor (dạng lồng)
//     => vẫn có cờ, "Phù hợp vì" không "ngân sách"; (c) estimate_default như estimate_category; (d) venue ước tính có số khách => cờ ngay sau "Giá:", không "Theo số bàn";
// (e) prompt câu "vì sao hợp" của vendor estimate_default có đúng 1 dòng cờ và câu cấm. Không chữ nguồn giá ở mọi nơi. Không mạng.
import { stampedBack, imp, twinBack, openDetail, coupleProfile, leaks, FLAG_LINE, GUIDE_LINE, WHY_FLAG, whyEcho, reporter, setNow } from "../T-172/_lib.mjs";
const { bad, end } = reporter();
setNow("2026-11-14T08:00:00Z");
const dir = stampedBack();
const { formatMatchBlock } = await imp(dir, "lib/matchFormatter.js");
const V = (name, basis, min, max, nested = false) => { const v = { name, price_range: { min_vnd: min * 1e6, max_vnd: max * 1e6 }, price_basis: basis, price_label: "x" }; return nested ? { vendor: v } : v; };
const flagIdx = (block) => block.split("\n").map((l, i) => (l === FLAG_LINE ? i : -1)).filter((i) => i >= 0);
{ // (a)
  const ms = [1, 2, 3, 4, 5].map((k) => V(`Real ${k}`, "legacy_marry", 5, 6)).concat([V("Est Six", "estimate_category", 5, 6)]);
  const t = formatMatchBlock({ matches: ms }, { category: "photography" });
  if (t.includes("Est Six")) bad("(a) eval sai: vendor thứ 6 được in");
  if (flagIdx(t).length) bad("(a) có dòng cờ dù không ứng viên ước tính nào được in");
  if (t.includes(GUIDE_LINE)) bad("(a) có dòng hướng dẫn cờ dù không ứng viên ước tính nào được in");
}
for (const [tag, basis, nested] of [["(b) lồng estimate_category", "estimate_category", true], ["(c) estimate_default", "estimate_default", false], ["(c) estimate_default lồng", "estimate_default", true]]) {
  const t = formatMatchBlock({ matches: [V("Real A", "legacy_marry", 6, 8, nested), V("Est B", basis, 6, 8, nested)] }, { category: "photography" });
  const lines = t.split("\n"); const iB = lines.findIndex((l) => /^\d+\. Est B$/.test(l));
  if (iB < 0) { bad(`${tag}: không thấy ứng viên`); continue; }
  if (lines[iB + 1] !== "   Giá: 6-8tr" || lines[iB + 2] !== FLAG_LINE) bad(`${tag}: mong "Giá: 6-8tr" rồi dòng cờ, thấy ${JSON.stringify(lines.slice(iB + 1, iB + 3))}`);
  const why = lines.slice(iB).find((l) => l.includes("Phù hợp vì")) || "";
  if (/ngân sách/.test(why)) bad(`${tag}: "Phù hợp vì" của ước tính nói ngân sách: ${why}`);
  if (flagIdx(t).length !== 1) bad(`${tag}: mong đúng 1 dòng cờ, thấy ${flagIdx(t).length}`);
  if (t.split("\n").filter((l) => l === GUIDE_LINE).length !== 1) bad(`${tag}: mong đúng 1 dòng hướng dẫn cờ`);
  if (leaks(t).length) bad(`${tag}: khối còn chữ nguồn giá ${leaks(t).join(" | ")}`);
}
{ // (d)
  const t = formatMatchBlock({ matches: [V("Venue Est", "estimate_category", 3, 4), V("Venue Real", "legacy_marry", 3, 4)] }, { category: "venue", guest_count: 200 });
  const L = t.split("\n"); const i = L.findIndex((l) => /^\d+\. Venue Est$/.test(l)); const j = L.findIndex((l) => /^\d+\. Venue Real$/.test(l));
  if (L[i + 1] !== "   Giá: 3-4tr/bàn" || L[i + 2] !== FLAG_LINE) bad(`(d) venue ước tính: ${JSON.stringify(L.slice(i + 1, i + 3))}`);
  if (L.slice(i + 1, j).some((l) => l.includes("Theo số bàn"))) bad("(d) venue ước tính có dòng Theo số bàn");
  if (!L.slice(j + 1, j + 3).some((l) => l.includes("Theo số bàn"))) bad("(d) venue giá riêng mất dòng Theo số bàn");
  if (L.slice(j + 1, j + 4).includes(FLAG_LINE)) bad("(d) venue giá riêng có dòng cờ");
}
{ // (e)
  const { M, ids, ov } = await twinBack([{ cat: "photography", price: { priceMin: 6, priceMax: 8, priceSource: "estimate_default" } }]);
  const r = await openDetail(M, ids[0], { overlay: ov, profile: coupleProfile({ budget: 300 }), reply: whyEcho });
  if (!r.calls.length) bad("(e) không thấy lượt LLM");
  else {
    const { system, user } = r.calls[0];
    if (user.split("\n").filter((l) => l.trim() === WHY_FLAG).length !== 1) bad("(e) estimate_default: prompt câu AI thiếu đúng 1 dòng cờ");
    if (!/không khẳng định vendor hợp hoặc nằm trong ngân sách/.test(system + user)) bad("(e) estimate_default: thiếu câu cấm khẳng định ngân sách");
    if (leaks(system + user).length) bad(`(e) prompt còn chữ nguồn giá ${leaks(system + user).join(" | ")}`);
  }
}
end();
