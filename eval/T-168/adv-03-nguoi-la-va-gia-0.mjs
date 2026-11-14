// T-168 adv-03 (adversary, tầng 3). (a) Người KHÔNG thuộc cặp đôi gọi match/chi tiết với coupleId thật: profileSnapshot chỉ có giá trị rỗng
// (guestCountSource null, budgetByCategory null, sources toàn null, budgetByCategory nguồn rỗng), không budgetBasis nào mang số của cặp đôi, chi tiết match null.
// (b) Overlay admin đặt giá 0 (mergeOverride cho phép priceMin/priceMax = 0): điểm Ngân sách vẫn 0,5 như main; nếu có budgetBasis thì câu không có "undefined"/"NaN".
// Chạy từ gốc tohong-hq: node eval/T-168/adv-03-nguoi-la-va-gia-0.mjs (TOHONG_BACK_REPO)
import { setup, matchOne, budgetDoc, coupleProfile, newBucket, restoreNow, done, ids, CID } from "../T-167/_lib.mjs";
const fails = []; const bad = (m) => fails.push(m);
const M = await setup();
const b = newBucket(M, { profile: { ...coupleProfile({ budget: 777, guest_count: 333, budget_by_category: { photography: 55 } }), wedding_date: "2030-01-01" }, budgetDoc: budgetDoc(321, { guests: 444, total_tr: 777 }), members: true, overlay: M.overlayFor("venue", [ids.R1]) });
const as = async (uid, url) => { M.resetOverlayCache(); const of = globalThis.fetch; globalThis.fetch = async () => { throw new Error("không mạng"); };
  try { const u = new URL("http://localhost" + url); const segs = u.pathname.replace(/^\/api\/vendors\/?/, "").split("/").filter(Boolean); const r = await M.handleVendors(new Request(u), { CHAT_DATA: b }, { userId: uid }, segs); return await r.json(); } catch (e) { return { __err: e.message }; } finally { globalThis.fetch = of; } };
for (const cat of ["venue", "photography", ""]) {
  const r = await as("u-la", `/api/vendors/match?coupleId=${CID}${cat ? "&category=" + cat : ""}&limit=50`);
  if (r.__err) { bad(`người lạ ${cat}: ném ${r.__err}`); continue; }
  const s = r.profileSnapshot || {};
  if (s.guestCountSource !== null || s.budgetByCategory !== null) bad(`người lạ ${cat}: guestCountSource/budgetByCategory mong null, thấy ${JSON.stringify([s.guestCountSource, s.budgetByCategory])}`);
  const src = s.sources || {};
  if (src.weddingDate !== null || src.guestCount !== null || src.budgetTotal !== null || JSON.stringify(src.budgetByCategory ?? {}) !== "{}") bad(`người lạ ${cat}: sources mong rỗng, thấy ${JSON.stringify(src)}`);
  if (s.guestCount != null || s.budgetTotal != null || s.weddingDate != null) bad(`người lạ ${cat}: snapshot có số ${JSON.stringify(s)}`);
  const bbs = (r.vendors || []).map((v) => v.match?.budgetBasis).filter(Boolean);
  const leak = JSON.stringify({ s, bbs }).match(/\b(777|333|321|444|55)\b|2030-01-01|\b(372[,.]96|159[,.]84|77[,.]7)\b/); if (leak) bad(`người lạ ${cat}: snapshot/budgetBasis chứa số của cặp đôi "${leak[0]}"`);
}
const d = await as("u-la", `/api/vendors/${ids.R1}?coupleId=${CID}`);
if (d.__err || d.match !== null) bad(`người lạ chi tiết: mong match null, thấy ${d.__err || JSON.stringify(d.match).slice(0, 120)}`);
// đối chứng: thành viên thấy số
const own = await as("u1", `/api/vendors/match?coupleId=${CID}&category=venue&limit=50`);
if (own.profileSnapshot?.guestCount !== 444 || own.profileSnapshot?.budgetByCategory?.venue !== 321) bad(`thành viên: mong 444 khách / 321tr, thấy ${JSON.stringify(own.profileSnapshot)}`);
// (b) giá 0 do admin
for (const [label, cat, id, prof, doc] of [["venue", "venue", ids.R1, coupleProfile({ budget: 200, guest_count: 200 }), budgetDoc(90)], ["photography", "photography", ids.P1, coupleProfile({ budget: 300, guest_count: 200 }), undefined]]) {
  const m = await matchOne(M, { category: cat, id, profile: prof, doc, overlay: { ...M.overlayFor(cat, [id]), [id]: { priceMin: 0, priceMax: 0 } } });
  if (!m.v) { bad(`giá 0 ${label}: vendor biến mất (${m.r.err?.message || m.r.status})`); continue; }
  if (m.v.match.scoreBreakdown.budget !== 0.5) bad(`giá 0 ${label}: điểm mong 0,5 như main, thấy ${m.v.match.scoreBreakdown.budget}`);
  const t = m.v.match.budgetBasis?.text; if (t !== undefined && /undefined|NaN|null/.test(t)) bad(`giá 0 ${label}: text lạ "${t}"`);
  console.error(`[info] giá 0 ${label}: budgetBasis = ${JSON.stringify(m.v.match.budgetBasis ?? null)}`);
}
restoreNow(); done(fails);
