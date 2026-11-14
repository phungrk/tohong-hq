// T-165 adv-06 (Code Gate, tầng 3, vòng 2). Spec T-164 H7.2: không có bảng dự toán thì số khách hiệu lực = số GET /budget seed. Input phá cho hàm chung
// mới (profileGuests): 0, chuỗi "300", 300.5, 1e9, mảng, object, preferences hợp lệ nhưng guest_count rác, chỉ couple.guest_count, mọi trường rác.
// Mong đợi: tab Vendor (chip "× T bàn" / điểm 0,5) và chat (dòng "Theo số bàn" / missing_field) cùng dùng đúng số seed; không ném.
import { stampedBack, loadModules, setNow, restoreNow, imp } from "../T-164/_lib.mjs";
import { tab, chat, coupleProfile, CID, AUTH } from "../T-159/_lib.mjs";
const fails = []; const bad = (m) => fails.push(m);
const ids = {};
const dir = stampedBack({ mut: (arr) => {
  const tw = arr.filter((v) => v.category === "venue" && v.isVerified && v.rating === 0 && v.styles.length === 0 && v.availability.length === 12 && v.city === "HCMC").slice(0, 1);
  Object.assign(tw[0], { priceMin: 2, priceMax: 2, priceSource: "legacy_marry", priceAsOf: "2026-06", capacity: { min: 1, max: 2e9 } }); ids.R1 = tw[0].id;
} });
const M = await loadModules(dir);
const B = await imp(dir, "api/budget.js");
const ov = Object.fromEntries(M.POOL.filter((v) => v.category === "venue" && v.id !== ids.R1).map((v) => [v.id, { hidden: true, hidden_reason: "eval T-165" }]));
setNow("2026-11-14T08:00:00Z");
const cases = [
  ["guest_count 0, preferences 150", { guest_count: 0, preferences: { style_tags: [], guest_count: 150 } }],
  ["guest_count chuỗi '300'", { guest_count: "300" }],
  ["guest_count 300.5", { guest_count: 300.5 }],
  ["guest_count 1e9", { guest_count: 1e9 }],
  ["guest_count mảng [300]", { guest_count: [300] }],
  ["guest_count object", { guest_count: { n: 300 } }],
  ["guest_count 'abc', preferences 150", { guest_count: "abc", preferences: { style_tags: [], guest_count: 150 } }],
  ["guest_count -50, preferences 150", { guest_count: -50, preferences: { style_tags: [], guest_count: 150 } }],
  ["chỉ couple.guest_count 80", { couple: { city: "HCMC", wedding_date: "2029-03-20", guest_count: 80 } }],
  ["mọi trường rác", { guest_count: null, preferences: { style_tags: [], guest_count: "x" } }],
];
for (const [label, extra] of cases) {
  const profile = coupleProfile({ budget: 3000, budget_by_category: { venue: 2000 }, ...extra });
  const bk = new M.MemoryBucket();
  bk.data.set(`data/couples/${CID}/profile.yaml`, JSON.stringify(profile));
  bk.data.set(`data/couples/${CID}/members.json`, JSON.stringify([{ user_id: AUTH.userId, role: "owner" }]));
  let G;
  try { G = Number((await (await B.handleBudget(new Request(`http://localhost/api/couples/${CID}/budget`), { CHAT_DATA: bk }, AUTH, CID, "")).json())?.guests) || 0; }
  catch (e) { bad(`${label}: GET /budget ném ${e.message}`); continue; }
  const T = G > 0 ? Math.ceil(G / 10) : null;
  const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=venue&limit=50`, profile, overlay: ov });
  if (r.err || r.status !== 200) { bad(`${label}: tab lỗi ${r.err?.message || r.status}`); continue; }
  const v = r.body?.vendors?.find((x) => x.id === ids.R1);
  const chip = (v?.match?.reasons || []).map((x) => x.label).find((l) => /bàn$/.test(l)) || null;
  const tabT = chip ? Number(/× (\S+) bàn/.exec(chip)[1]) : null;
  if (T === null) { if (v?.match?.scoreBreakdown?.budget !== 0.5 || chip) bad(`${label}: seed 0 => tab phải 0,5 không chip, thấy ${v?.match?.scoreBreakdown?.budget} / ${chip}`); }
  else if (T * 2 <= 2000 && tabT !== T) bad(`${label}: seed ${G} => tab mong × ${T} bàn, thấy ${chip}`);
  const c = await chat(M, { message: "Tìm nhà hàng tiệc cưới giúp anh chị 2000tr", profile, overlay: ov });
  if (c.err) { bad(`${label}: chat ném ${c.err.message}`); continue; }
  if (T === null) { if (!c.md?.error) bad(`${label}: seed 0 => chat phải hỏi số khách, thấy ${c.ids.length} ứng viên`); }
  else if (T * 2 <= 2000) { const m = /Theo số bàn: ≈ [\d.]+tr\/bàn × (\S+) bàn/.exec(c.sp || ""); if (!m || Number(m[1]) !== T) bad(`${label}: seed ${G} => chat mong × ${T} bàn, thấy ${m ? m[1] : c.md?.error || "(không có)"}`); }
  else if (c.ids.includes(ids.R1)) bad(`${label}: seed ${G} (${T} bàn × 2tr > 2000tr) => chat phải lọc R1`);
}
restoreNow();
if (fails.length) { console.log("FAIL " + fails.join("; ")); process.exit(1); }
console.log("PASS");
