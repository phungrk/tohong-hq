// T-138 adv-01 (tầng 3, adversary). Spec T-136 A2: match qua cổng pool lấy giá THEO POOL; pool không có giá (priceMin, priceMax không > 0)
// thì price_range = null và prompt in "Liên hệ để hỏi báo giá"; "không dùng giá của matcher, vì có thể là giá cũ". A2 cũng nói ghi vào
// "chỗ formatter đọc"; formatter đọc `vendor.price_range || item.price_range` nên ở dạng lồng giá cũ ở cấp item vẫn lọt.
// Input phá: dạng lồng `{vendor:{id:<id pool không giá>, name}, price_range:<giá matcher cũ>}` (và đối chứng: dạng phẳng).
// Mong đợi: khối ứng viên có tên pool, dòng giá "Liên hệ để hỏi báo giá", không có con số giá của matcher (777-888tr).
import { chat, POOL, done } from "../T-136/_lib.mjs";
const fails = [];
const np = POOL.find((v) => !(Number(v.priceMin) > 0) && !(Number(v.priceMax) > 0));
if (!np) { console.log("PASS chưa áp dụng (pool không có vendor thiếu giá)"); process.exit(0); }
const STALE = { min_vnd: 777e6, max_vnd: 888e6 };
const cand = (sp) => { const i = sp.search(/^\[VENDOR CANDIDATES —/m); if (i < 0) return ""; const r = sp.slice(i); const e = r.indexOf("\n\n## "); return e < 0 ? r : r.slice(0, e); };
const cases = {
  "lồng + giá cấp item": { vendor: { id: np.id, name: "TEN_CU_ZZ" }, price_range: STALE, final_score: 80 },
  "lồng + giá cả hai cấp": { vendor: { id: np.id, name: "TEN_CU_ZZ", price_range: STALE }, price_range: STALE, final_score: 80 },
  "phẳng (đối chứng)": { vendor_id: np.id, name: "TEN_CU_ZZ", price_range: STALE, final_score: 80 },
};
for (const [label, it] of Object.entries(cases)) {
  const b = cand((await chat({ matches: [it], total_pool: 1, passed_filters: 1 })).systemPrompt);
  if (!b) { fails.push(`${label}: không có khối ứng viên dù id thuộc pool`); continue; }
  if (!b.includes(np.name)) fails.push(`${label}: thiếu tên pool`);
  if (b.includes("TEN_CU_ZZ")) fails.push(`${label}: lọt tên của matcher`);
  if (/777|888/.test(b)) fails.push(`${label}: lọt giá cũ của matcher (pool không có giá phải in "Liên hệ để hỏi báo giá"): ` + (b.match(/Giá:[^\n]*/) || [""])[0]);
  else if (!b.includes("Liên hệ để hỏi báo giá")) fails.push(`${label}: thiếu "Liên hệ để hỏi báo giá"`);
}
done(fails);
