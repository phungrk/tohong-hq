// T-165 adv-03 (Code Gate, tầng 3). Spec T-164 H5: giá ước tính không là bằng chứng cho lời khẳng định về ngân sách, ở MỌI câu sinh ra từ dữ liệu
// (không chỉ chip): tab danh sách chỉ có vendor ước tính, điểm ngân sách = 1 (ngân sách rất rộng), có số khách; venue lẫn hạng mục gói.
// Input phá: (a) câu whyThisVendor của từng thẻ (không phải AI) không được nói "ngân sách"/"Rẻ hơn"; (b) whyThoseVendors không "nằm trong tầm giá",
// không "giá dao động"; (c) chat: dòng "Phù hợp vì" không "ngân sách", không dòng "Theo số bàn"; (d) chi tiết: match.reasons không chip ví.
import { stampedBack, loadModules, setNow, restoreNow } from "../T-164/_lib.mjs";
import { tab, chat, coupleProfile, CID } from "../T-159/_lib.mjs";
const fails = []; const bad = (m) => fails.push(m);
const pick = {};
const dir = stampedBack({ mut: (arr) => {
  for (const cat of ["venue", "photography"]) {
    const tw = arr.filter((v) => v.category === cat && v.isVerified && v.rating === 0 && v.styles.length === 0 && v.availability.length === 12 && v.city === "HCMC").slice(0, 3);
    tw.forEach((v) => Object.assign(v, { priceMin: 3, priceMax: 4, priceSource: "estimate_category", priceAsOf: "2026-06" }, cat === "venue" ? { capacity: { min: 50, max: 500 } } : {}));
    pick[cat] = tw.map((v) => v.id);
  }
} });
const M = await loadModules(dir);
setNow("2026-11-14T08:00:00Z");
const MSG = { venue: "Tìm nhà hàng tiệc cưới giúp anh chị 900tr", photography: "Tìm photographer chụp ảnh cưới giúp anh chị 900tr" };
for (const cat of ["venue", "photography"]) {
  const ov = Object.fromEntries(M.POOL.filter((v) => v.category === cat && !pick[cat].includes(v.id)).map((v) => [v.id, { hidden: true, hidden_reason: "eval T-165" }]));
  const profile = coupleProfile({ budget: 3000, guest_count: 200, budget_by_category: { [cat]: 900 } });
  const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=${cat}&limit=50`, profile, overlay: ov });
  if (r.err || r.status !== 200) { bad(`${cat}: tab lỗi ${r.err?.message || r.status}`); continue; }
  const vs = (r.body?.vendors || []).filter((v) => pick[cat].includes(v.id));
  if (vs.length !== 3) bad(`${cat}: mong 3 vendor ước tính trong danh sách, thấy ${vs.length}`);
  for (const v of vs) {
    if (v.match?.scoreBreakdown?.budget !== 1) bad(`${cat} ${v.id}: ca này cần điểm ngân sách = 1 (ngân sách rộng), thấy ${v.match?.scoreBreakdown?.budget}`);
    const w = String(v.match?.whyThisVendor || "");
    if (/ngân sách|Rẻ hơn/i.test(w)) bad(`${cat} ${v.id}: whyThisVendor của vendor ước tính khẳng định ngân sách: "${w}"`);
    const labels = (v.match?.reasons || []).map((x) => x.label);
    if (labels.some((l) => /ngân sách|^Rẻ hơn|bàn/.test(l))) bad(`${cat} ${v.id}: chip ngân sách cho vendor ước tính: ${JSON.stringify(labels)}`);
  }
  const why = String(r.body?.whyThoseVendors || "");
  if (/tầm giá/.test(why)) bad(`${cat}: whyThoseVendors đếm vendor ước tính vào "tầm giá": "${why}"`);
  if (/giá dao động/i.test(why)) bad(`${cat}: whyThoseVendors có "giá dao động" chỉ từ vendor ước tính: "${why}"`);
  const d = await tab(M, { url: `/api/vendors/${pick[cat][0]}?coupleId=${CID}`, profile, overlay: ov });
  if ((d.body?.match?.reasons || []).some((x) => /ngân sách|^Rẻ hơn|bàn/.test(x.label))) bad(`${cat}: chi tiết có chip ngân sách cho vendor ước tính`);
  if (d.body?.vendor?.price_label !== "Ước tính theo hạng mục") bad(`${cat}: chi tiết thiếu nhãn ước tính, thấy ${JSON.stringify(d.body?.vendor?.price_label)}`);
  const c = await chat(M, { message: MSG[cat], profile, overlay: ov });
  if (c.err || !c.ids.length) { bad(`${cat}: chat lỗi/không ứng viên: ${c.err?.message || c.md?.error}`); continue; }
  const fit = (c.sp || "").split("\n").filter((l) => /^\s*Phù hợp vì:/.test(l));
  if (!fit.length || fit.some((l) => /ngân sách/.test(l))) bad(`${cat}: chat "Phù hợp vì" của vendor ước tính nói ngân sách hoặc thiếu: ${JSON.stringify(fit)}`);
  if (/Theo số bàn/.test(c.sp || "")) bad(`${cat}: chat có dòng "Theo số bàn" cho vendor ước tính`);
  if (!/không khẳng định vendor hợp hoặc nằm trong ngân sách/.test(c.sp || "")) bad(`${cat}: chat thiếu hướng dẫn không khẳng định ngân sách cho vendor ước tính`);
}
restoreNow();
if (fails.length) { console.log("FAIL " + fails.join("; ")); process.exit(1); }
console.log("PASS");
