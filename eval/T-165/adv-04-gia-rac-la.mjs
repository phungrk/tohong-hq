// T-165 adv-04 (Code Gate, tầng 3). Spec T-164 H1: giá riêng hợp lệ chỉ khi đủ (a)-(e). Input phá ngoài eval 1: kiểu dữ liệu lạ của price_range
// (chuỗi số, NaN/Infinity qua JSON không có nên dùng chuỗi, boolean, âm, unit viết hoa/thừa dấu cách, ngày không tồn tại, last_scraped là số),
// số trong tên có số 0 ở đầu ("Studio 007" với 7tr), và sát trần + 1 đồng. Mọi ca rác phải rơi về ước tính, không bao giờ thành legacy_marry; ca hợp lệ giữ.
import { genFull, rec, INPUTS } from "../T-164/_lib.mjs";
const fails = []; const bad = (m) => fails.push(m);
// nền: đủ 12 giá hợp lệ photography để khung có nghĩa (n >= 10)
const base = Array.from({ length: 12 }, (_, i) => rec(`base_ph_${i}`, "photography", (5 + i) * 1e6, (8 + i) * 1e6));
const junk = [
  ["min chuỗi số", rec("j1", "photography", "5000000", 8e6)],
  ["max boolean", rec("j2", "photography", 5e6, true)],
  ["min âm", rec("j3", "photography", -5e6, 8e6)],
  ["unit viết hoa", rec("j4", "photography", 5e6, 8e6, { unit: "PACKAGE" })],
  ["unit thừa dấu cách", rec("j5", "photography", 5e6, 8e6, { unit: "package " })],
  ["venue unit package", rec("j6", "venue", 4e6, 5e6, { unit: "package" })],
  ["ngày 2026-02-30", rec("j7", "photography", 5e6, 8e6, { last: "2026-02-30T00:00:00Z" })],
  ["last_scraped là số", rec("j8", "photography", 5e6, 8e6, { last: 1750000000 })],
  ["tên 'Studio 007' giá 7tr", rec("j9", "photography", 7e6, 9e6, { name: "Studio 007" })],
  ["vượt trần 1 đồng", rec("j10", "photography", 5e6, 150e6 + 1)],
  ["dưới sàn venue 1 đồng", rec("j11", "venue", 2e6 - 1, 5e6)],
  ["min > max", rec("j12", "photography", 9e6, 8e6)],
  ["max 0", rec("j13", "photography", 0, 0)],
];
const okc = [
  ["đúng sàn venue 2tr", rec("k1", "venue", 2e6, 5e6)],
  ["đúng trần photography 150tr", rec("k2", "photography", 100e6, 150e6)],
];
const tpl = INPUTS.find((r) => (r.categories || [])[0] === "photography") || null;
const fill = (r) => (tpl ? { ...tpl, ...r, categories: r.categories } : r);
const all = [...base, ...junk.map((x) => x[1]), ...okc.map((x) => x[1])].map(fill);
const g = genFull(all, "2026-11-14");
if (!g.ok) { console.log("FAIL generator: " + g.msg); process.exit(1); }
for (const [label, r] of junk) { const v = g.pool.get(r.id); if (!v) bad(`${label}: vendor mất khỏi pool`); else if (v.priceSource === "legacy_marry") bad(`${label}: giá rác lọt thành legacy_marry ${v.priceMin}-${v.priceMax}`); }
for (const [label, r] of okc) { const v = g.pool.get(r.id); if (!v || v.priceSource !== "legacy_marry") bad(`${label}: giá hợp lệ phải giữ (legacy_marry), thấy ${v?.priceSource}`); }
if (fails.length) { console.log("FAIL " + fails.join("; ")); process.exit(1); }
console.log("PASS");
