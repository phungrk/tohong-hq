// Một lần: sinh fixtures/tab-golden.json từ computeMatches của main (chưa có code T-140). Không chạy trong gate.
import { frozenRoot, load, HERE } from "./_lib.mjs";
import { writeFileSync } from "fs"; import { createHash } from "crypto"; import path from "path";
const M = await load(frozenRoot());
const base = { city: "HCMC", weddingDate: "2029-03-20", guestCount: 150, budgetTotal: 300, budgetByCategory: null, preferredStyles: [], excludedVendorIds: [] };
const cases = [];
for (const cat of ["photography", "venue", "makeup", "decor", "attire", null]) for (const st of [[], ["korean", "luxury"], ["rustic"]]) {
  cases.push({ label: `${cat ?? "all"} gu[${st}]`, profile: { ...base, preferredStyles: st }, opts: { category: cat, limit: 20, offset: 0, minScore: 0 } });
}
cases.push({ label: "photography trang 2", profile: base, opts: { category: "photography", limit: 10, offset: 10, minScore: 0 } });
cases.push({ label: "photography minScore 70", profile: { ...base, preferredStyles: ["modern"] }, opts: { category: "photography", limit: 20, offset: 0, minScore: 70 } });
cases.push({ label: "ngân sách thấp 5tr/hạng mục", profile: { ...base, budgetByCategory: { photography: 5 } }, opts: { category: "photography", limit: 20 } });
cases.push({ label: "cặp đôi Hà Nội (tab nới sang HCMC)", profile: { ...base, city: "Hà Nội" }, opts: { category: "photography", limit: 20 } });
cases.push({ label: "hồ sơ rỗng", profile: {}, opts: {} });
for (const c of cases) { M.resetOverlayCache(); const out = M.computeMatches(c.profile, c.opts); c.total = out.total; c.sha256 = createHash("sha256").update(JSON.stringify(out)).digest("hex"); }
writeFileSync(path.join(HERE, "fixtures", "tab-golden.json"), JSON.stringify({ note: "computeMatches @ main 2026-11-13, pool đông cứng; sinh bằng eval/T-140/_make_golden.mjs", cases }, null, 1));
console.log(cases.length);
