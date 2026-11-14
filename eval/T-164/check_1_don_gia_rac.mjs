// T-164 tiêu chí 1: giá rác bị loại theo quy tắc rõ (ngưỡng theo hạng mục và đơn vị) tại lúc sinh pool; đếm đúng; nguồn không bị ghi.
// Chạy generator của tohong trên fixtures/price-inputs.json (867 bản ghi giả: id, hạng mục, price_range, last_scraped) với --as-of 2026-11-14.
// Quy tắc (spec mục H1): giá riêng chỉ hợp lệ khi (a) unit đúng đơn vị của hạng mục (venue = per_table, còn lại = package), (b) min_vnd > 0 và max_vnd >= min_vnd,
// (c) CẢ HAI đầu nằm trong [thấp, cao] của hạng mục (triệu VND, đóng hai đầu), (d) có last_scraped đọc được. Không hợp lệ => priceSource khác legacy_marry (rơi về N4).
import fs from "node:fs";
import crypto from "node:crypto";
import { EXPECTED, genFull, rec, BANDS, UNIT, near } from "./_lib.mjs";
const fails = []; const bad = (m) => fails.push(m);
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

const INPUTS = INPUTS_LOCAL();
const g = genFull(INPUTS);
function INPUTS_LOCAL() { return JSON.parse(fs.readFileSync(new URL("./fixtures/price-inputs.json", import.meta.url), "utf8")); }
if (!g.ok) { console.log("FAIL " + g.msg); process.exit(1); }
const before = sha(g.inF);
/* A. đúng 57 vendor bị loại, đúng danh sách; 164 giữ legacy_marry */
const rejected = new Set(EXPECTED.rejected.map((r) => r.id));
let nLegacy = 0, nRej = 0, wrong = [];
for (const [id, e] of Object.entries(EXPECTED.vendors)) {
  const v = g.pool.get(id); if (!v) { wrong.push(id + " mất khỏi pool"); continue; }
  if (v.priceSource === "legacy_marry") nLegacy++;
  if (rejected.has(id)) { nRej++; if (v.priceSource === "legacy_marry") wrong.push(id + " (giá rác) vẫn là legacy_marry"); }
  else if (EXPECTED.vendors[id].priceSource === "legacy_marry" && v.priceSource !== "legacy_marry") wrong.push(id + " (giá hợp lệ) bị loại nhầm");
}
if (wrong.length) bad(`danh sách bị loại sai ${wrong.length} vendor, vd ${wrong.slice(0, 3).join("; ")}`);
if (nLegacy !== EXPECTED.counts.legacy_marry) bad(`legacy_marry ${nLegacy}, mong ${EXPECTED.counts.legacy_marry}`);
if (nRej !== EXPECTED.counts.bi_loai) bad(`bị loại ${nRej}, mong ${EXPECTED.counts.bi_loai}`);
/* B. không giá hợp lệ nào nằm ngoài ngưỡng; vendor bị loại không giữ số rác */
for (const v of g.pool.values()) {
  if (v.priceSource !== "legacy_marry") continue;
  const [lo, hi] = BANDS[v.category]; if (!(v.priceMin >= lo - 1e-9 && v.priceMax <= hi + 1e-9 && v.priceMin > 0 && v.priceMax >= v.priceMin)) { bad(`${v.id} legacy_marry ngoài ngưỡng: ${v.priceMin}-${v.priceMax} (${v.category} ${lo}-${hi})`); break; }
}
{ const junk = [...rejected].map((id) => g.pool.get(id)).find((v) => v && (v.priceMax > 1000 || v.priceMin < 0.1)); if (junk) bad(`${junk.id} bị loại nhưng pool vẫn mang số rác ${junk.priceMin}-${junk.priceMax}`); }
/* C. ca biên tổng hợp (mỗi ca một vendor; hạng mục photography trừ khi ghi khác) */
const C = [
  ["sát đáy 0,5tr", rec("t_lo", "photography", 500000, 3000000), true], ["dưới đáy 0,4999tr", rec("t_lo2", "photography", 499900, 3000000), false],
  ["sát trần 150tr", rec("t_hi", "photography", 3000000, 150000000), true], ["trên trần 150,1tr", rec("t_hi2", "photography", 3000000, 150100000), false],
  ["một điểm min=max trong ngưỡng", rec("t_pt", "photography", 8000000, 8000000), true], ["min_vnd = 0", rec("t_z", "photography", 0, 8000000), false],
  ["max < min", rec("t_ord", "photography", 9000000, 8000000), false], ["venue unit package (giá cả sự kiện)", rec("t_vp", "venue", 4000000, 4000000, { unit: "package" }), false],
  ["venue per_table 20tr (trần)", rec("t_v20", "venue", 20000000, 20000000), true], ["venue per_table 20,1tr", rec("t_v21", "venue", 20100000, 20100000), false],
  ["photography unit per_table", rec("t_pt2", "photography", 8000000, 8000000, { unit: "per_table" }), false], ["thiếu unit", rec("t_nu", "photography", 8000000, 8000000, { unit: null }), false],
  ["stationery 15.000đ (giá một thiệp)", rec("t_st", "stationery", 15000, 15000), false], ["stationery 0,3tr (đáy)", rec("t_st2", "stationery", 300000, 300000), true],
  ["decor 1,75 triệu tỉ (lỗi nhập)", rec("t_dc", "decor", 1000000, 3500000000000), false], ["không có last_scraped", rec("t_nd", "photography", 8000000, 8000000, { last: null }), false],
];
const g2 = genFull([...INPUTS, ...C.map((c) => c[1])]);
if (!g2.ok) bad("generator lỗi với ca biên: " + g2.msg);
else for (const [name, r, ok] of C) {
  const v = g2.pool.get(r.id); const isLegacy = v?.priceSource === "legacy_marry";
  if (!v) bad(`ca "${name}": vendor mất khỏi pool`);
  else if (isLegacy !== ok) bad(`ca "${name}": ${ok ? "phải giữ" : "phải loại"} giá riêng, thấy priceSource=${v.priceSource}`);
  else if (ok && !(near(v.priceMin, Math.round(r.price_range.min_vnd / 1e5) / 10) && near(v.priceMax, Math.round(r.price_range.max_vnd / 1e5) / 10))) bad(`ca "${name}": số đúng phải là giá nguồn làm tròn 0,1tr, thấy ${v.priceMin}-${v.priceMax}`);
}
/* D. không ghi vào nguồn */
if (sha(g.inF) !== before) bad("generator ghi đè file đầu vào (nguồn không được sửa)");
if (fails.length) { console.log("FAIL " + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : "")); process.exit(1); }
console.log(`PASS (loại ${nRej}/${EXPECTED.counts.co_gia_nguon} giá riêng, giữ ${nLegacy})`);
