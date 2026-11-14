// T-165 adv-02 (Code Gate, tầng 3). Spec T-164 H7.2: số khách hiệu lực = budget.json.guests khi "là số nguyên > 0", ngược lại guest_count hồ sơ
// (đúng số GET /budget seed: max(0, parseInt(...))), ngược lại "không có" => tab điểm venue 0,5, không chip bàn; chat hỏi số khách (missing_field).
// Input phá: guests lạ trong bảng dự toán (chuỗi, thập phân, âm, null, rất lớn) và trong hồ sơ (chuỗi số, âm, chữ). Không được ném; số bàn đúng luật.
import { stampedBack, loadModules, setNow, restoreNow } from "../T-164/_lib.mjs";
import { tab, chat, coupleProfile, CID, doc } from "../T-159/_lib.mjs";
const fails = []; const bad = (m) => fails.push(m);
const ids = {};
const dir = stampedBack({ mut: (arr) => {
  const tw = arr.filter((v) => v.category === "venue" && v.isVerified && v.rating === 0 && v.styles.length === 0 && v.availability.length === 12 && v.city === "HCMC").slice(0, 1);
  Object.assign(tw[0], { priceMin: 4, priceMax: 4.6, priceSource: "legacy_marry", priceAsOf: "2026-06", capacity: { min: 50, max: 500 } }); ids.R1 = tw[0].id;
} });
const M = await loadModules(dir);
const ov = Object.fromEntries(M.POOL.filter((v) => v.category === "venue" && v.id !== ids.R1).map((v) => [v.id, { hidden: true, hidden_reason: "eval T-165" }]));
setNow("2026-11-14T08:00:00Z");
const P = (g) => coupleProfile({ budget: 300, ...(g === undefined ? {} : { guest_count: g }), budget_by_category: { venue: 200 } });
const B = (g) => ({ ...doc({ venue: 0 }), guests: g });
const chipT = (r) => { const l = (r.body?.vendors?.find((v) => v.id === ids.R1)?.match?.reasons || []).map((x) => x.label).find((x) => /bàn$/.test(x)); const m = /× (\d+(?:e\+\d+)?) bàn/.exec(l || ""); return m ? Number(m[1]) : null; };
const bsc = (r) => r.body?.vendors?.find((v) => v.id === ids.R1)?.match?.scoreBreakdown?.budget;
// [nhãn, hồ sơ guest_count, bảng guests (undefined = không có bảng), số bàn mong (null = không có số khách)]
const cases = [
  ["bảng guests chuỗi '300', hồ sơ 100", 100, "300", 10],
  ["bảng guests 300.5, hồ sơ 100", 100, 300.5, 10],
  ["bảng guests -300, hồ sơ 100", 100, -300, 10],
  ["bảng guests null, hồ sơ 100", 100, null, 10],
  ["bảng guests 301, hồ sơ 100", 100, 301, 31],
  ["hồ sơ chuỗi '300', không bảng", "300", undefined, 30],
  ["hồ sơ âm -50, không bảng", -50, undefined, null],
  ["hồ sơ chữ 'abc', không bảng", "abc", undefined, null],
];
for (const [label, pg, bg, wantT] of cases) {
  const profile = P(pg); const budgetDoc = bg === undefined ? undefined : B(bg);
  const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=venue&limit=50`, profile, budgetDoc, overlay: ov });
  if (r.err || r.status !== 200) { bad(`${label}: tab lỗi ${r.err?.message || r.status}`); continue; }
  if (wantT === null) { if (bsc(r) !== 0.5 || chipT(r) !== null) bad(`${label}: tab không có số khách => điểm 0,5 và không chip bàn, thấy ${bsc(r)} / ${chipT(r)} bàn`); }
  else if (chipT(r) !== wantT) bad(`${label}: tab mong "× ${wantT} bàn", thấy ${chipT(r)}`);
  const c = await chat(M, { message: "Tìm nhà hàng tiệc cưới giúp anh chị 200tr", profile, budgetDoc, overlay: ov });
  if (c.err) { bad(`${label}: chat ném ${c.err.message}`); continue; }
  if (wantT === null) { if (c.md?.error !== "missing_field" && !(c.md && c.md.error)) bad(`${label}: chat không có số khách hiệu lực => phải hỏi số khách (missing_field), thấy ${c.ids.length} ứng viên`); }
  else { const m = /Theo số bàn: ≈ [\d.]+tr\/bàn × (\d+) bàn/.exec(c.sp || ""); if (!m || Number(m[1]) !== wantT) bad(`${label}: chat mong "× ${wantT} bàn", thấy ${m ? m[1] : "(không có)"}`); }
}
// Rất lớn: 10^9 khách, không được ném.
{ const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=venue&limit=50`, profile: P(100), budgetDoc: B(1e9), overlay: ov });
  if (r.err || r.status !== 200) bad(`bảng guests 1e9: tab lỗi ${r.err?.message || r.status}`);
  const c = await chat(M, { message: "Tìm nhà hàng tiệc cưới giúp anh chị 200tr", profile: P(100), budgetDoc: B(1e9), overlay: ov }); if (c.err) bad(`bảng guests 1e9: chat ném ${c.err.message}`); }
restoreNow();
if (fails.length) { console.log("FAIL " + fails.join("; ")); process.exit(1); }
console.log("PASS");
