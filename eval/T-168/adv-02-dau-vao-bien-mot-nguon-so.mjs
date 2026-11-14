// T-168 adv-02 (adversary, tầng 3). Đầu vào biên mà eval 1-3 không chạm; mỗi case kiểm cả số, câu và luật "một nguồn số" (H1 bất biến nội bộ, H4 khớp số):
//  (a) guest_count chuỗi "200 khách" ; (b) guests của bảng là chuỗi "300" (không phải số nguyên => bảng không thắng) ;
//  (c) budget_by_category cũ là chuỗi số "70" ; (d) budget_by_category cả khối là chuỗi rác ; (e) hạng mục lạ trong bảng/hồ sơ (reserve, foo) ;
//  (f) làm tròn biên 59,96 -> "60" ; (g) số lớn 3600 khách x 3,9 = 1404 so với 1440 ; (h) overlay admin giá min != max (2 - 4,25/bàn): so bằng priceMax, không ước tính.
// Chạy từ gốc tohong-hq: node eval/T-168/adv-02-dau-vao-bien-mot-nguon-so.mjs (TOHONG_BACK_REPO)
import { setup, matchOne, budgetDoc, coupleProfile, restoreNow, done, ids } from "../T-167/_lib.mjs";
const fails = []; const bad = (m) => fails.push(m);
const M = await setup();
const rule = (bb) => (bb.kind === "no_budget" || bb.kind === "no_guests") ? 0.5 : bb.totalTr <= bb.categoryBudgetTr ? 1 : (bb.totalTr - bb.categoryBudgetTr) / bb.categoryBudgetTr > 0.2 ? 0 : 1 - (bb.totalTr - bb.categoryBudgetTr) / bb.categoryBudgetTr / 0.2;
async function run(label, o, exp) {
  const m = await matchOne(M, o); const v = m.v; const s = m.body?.profileSnapshot; const bb = v?.match?.budgetBasis;
  if (!bb) return bad(`${label}: thiếu budgetBasis (${m.r.err?.message || m.r.status})`);
  const sc = v.match.scoreBreakdown.budget;
  if (!(typeof sc === "number" && Math.abs(sc - rule(bb)) < 1e-9)) bad(`${label}: điểm ${sc} không suy ra từ budgetBasis (${rule(bb)})`);
  if (/undefined|NaN|null|Infinity|\d\.\d/.test(bb.text || "")) bad(`${label}: text lạ "${bb.text}"`);
  if (bb.kind === "per_table" && (typeof bb.guests !== "number" || bb.guests !== s?.guestCount || bb.tables !== Math.ceil(bb.guests / 10))) bad(`${label}: guests/tables ${bb.guests}/${bb.tables} vs snapshot ${JSON.stringify(s?.guestCount)}`);
  if (["allocation", "legacy_profile"].includes(bb.categoryBudgetSource) && s?.budgetByCategory?.[bb.categoryId] !== bb.categoryBudgetTr) bad(`${label}: snapshot.budgetByCategory[${bb.categoryId}]=${JSON.stringify(s?.budgetByCategory?.[bb.categoryId])} ≠ ${bb.categoryBudgetTr}`);
  if (bb.categoryBudgetSource === "total_share" && s?.budgetByCategory?.[bb.categoryId] !== undefined) bad(`${label}: total_share nhưng snapshot có hạng mục`);
  if (s?.budgetByCategory) for (const [k, n] of Object.entries(s.budgetByCategory)) if (typeof n !== "number" || !(n > 0)) bad(`${label}: snapshot.budgetByCategory.${k} không phải số > 0: ${JSON.stringify(n)}`);
  for (const [k, want] of Object.entries(exp)) { const got = k.startsWith("snap.") ? s?.[k.slice(5)] : bb[k]; if (JSON.stringify(got) !== JSON.stringify(want)) bad(`${label}: ${k} mong ${JSON.stringify(want)}, thấy ${JSON.stringify(got)}`); }
}
const R1 = ids.R1, P = "photography";
await run("(a) guest_count chuỗi", { id: R1, profile: coupleProfile({ budget: 200, guest_count: "200 khách" }), doc: budgetDoc(90) },
  { kind: "per_table", guests: 200, tables: 20, totalTr: 78, "snap.guestCountSource": "profile", text: "≈ 3,9tr/bàn × 20 bàn = 78tr so với 90tr tiệc cưới" });
await run("(b) bảng guests chuỗi \"300\"", { id: R1, profile: coupleProfile({ budget: 200, guest_count: 200 }), doc: { ...budgetDoc(90), guests: "300" } },
  { kind: "per_table", guests: 200, tables: 20, "snap.guestCountSource": "profile" });
await run("(c) hạng mục cũ chuỗi \"70\"", { id: R1, profile: coupleProfile({ budget: 200, guest_count: 200, budget_by_category: { venue: "70" } }), doc: undefined },
  { kind: "per_table", categoryBudgetTr: 70, categoryBudgetSource: "legacy_profile", text: "≈ 3,9tr/bàn × 20 bàn = 78tr so với 70tr tiệc cưới" });
await run("(d) budget_by_category là chuỗi rác", { id: R1, profile: coupleProfile({ budget: 200, guest_count: 200, budget_by_category: "xyz" }), doc: undefined },
  { kind: "per_table", categoryBudgetSource: "total_share", sharePct: 48, text: "≈ 3,9tr/bàn × 20 bàn = 78tr so với 96tr tiệc cưới (ước theo tổng × 48%)" });
await run("(e) hạng mục lạ", { id: R1, profile: coupleProfile({ budget: 200, guest_count: 200, budget_by_category: { reserve: 50, foo: 9 } }), doc: budgetDoc(90, { extra: [{ id: "reserve", allocated_tr: 12, items: [] }, { id: "foo", allocated_tr: 3, items: [] }] }) },
  { kind: "per_table", categoryBudgetTr: 90, categoryBudgetSource: "allocation" });
await run("(f) làm tròn 59,96", { id: R1, profile: coupleProfile({ budget: 200, guest_count: 200 }), doc: budgetDoc(59.96, { total_tr: 200 }) },
  { categoryBudgetTr: 59.96, text: "≈ 3,9tr/bàn × 20 bàn = 78tr so với 60tr tiệc cưới" });
await run("(g) số lớn 3600 khách", { id: R1, profile: coupleProfile({ budget: 3000, guest_count: 3600 }), doc: budgetDoc(1440, { total_tr: 3000 }) },
  { tables: 360, totalTr: 3.9 * 360, text: `≈ 3,9tr/bàn × 360 bàn = ${String(Math.round(3.9 * 360 * 10) / 10).replace(".", ",")}tr so với 1440tr tiệc cưới` });
await run("(h) overlay admin min≠max", { id: R1, profile: coupleProfile({ budget: 200, guest_count: 200 }), doc: budgetDoc(90), overlay: { ...M.overlayFor("venue", [R1]), [R1]: { priceMin: 2, priceMax: 4.25 } } },
  { kind: "per_table", estimated: false, pricePerTableTr: 4.25, totalTr: 85, text: "≈ 4,3tr/bàn × 20 bàn = 85tr so với 90tr tiệc cưới" });
restoreNow(); done(fails);
