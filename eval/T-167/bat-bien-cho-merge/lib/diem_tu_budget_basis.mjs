// Nguồn: T-167 (spec products/T-167-dong-ngan-sach-hien-phep-so.md, H1 "Bất biến nội bộ bắt buộc" + H4 "Khớp số", và "Bất biến đề xuất"), rút bởi spec-critic khi spec v3 qua Spec Gate 2026-11-14.
// Bất biến: điểm Ngân sách suy ra từ budgetBasis, một nguồn số. Pool THẬT (không đóng dấu, không overlay), 10 hạng mục, 9 hồ sơ.
// Đo qua hành vi công khai GET /api/vendors/match và GET /api/vendors/:id (handleVendors), R2 giả trong bộ nhớ, không mạng.
import { existsSync as ex } from "fs"; import { fileURLToPath as f, pathToFileURL as u } from "url"; import p from "path";
// ADR-070: tìm gốc HQ bằng cách đi lên tới scripts/gate.py.
let hq = p.dirname(f(import.meta.url)); while (!ex(p.join(hq, "scripts", "gate.py")) && p.dirname(hq) !== hq) hq = p.dirname(hq);
const L = (t) => import(u(p.join(hq, "eval", t, "_lib.mjs")).href);
const { stampedBack, loadModules, setNow, restoreNow } = await L("T-164");
const { tab, coupleProfile, CID, done } = await L("T-159");
const fails = []; const bad = (m) => { if (fails.length < 12) fails.push(m); };
const near = (x, y) => typeof x === "number" && typeof y === "number" && Math.abs(x - y) < 1e-9;
const M = await loadModules(stampedBack({ stamp: () => {} })); // bản sao back, pool giữ nguyên
setNow("2026-11-14T08:00:00Z");
const CATS = ["venue", "photography", "decor", "attire", "makeup", "ceremony", "jewelry", "transport", "stationery", "honeymoon"];
const doc = (alloc, { total_tr = 200, guests = 0 } = {}) => ({ categories: Object.entries(alloc).map(([id, a]) => ({ id, name: id, allocated_tr: a, items: [] })), total_tr, guests, mung_tr: 0, updated_at: "2026-11-14T00:00:00.000Z" });
const A = { venue: 90, photography: 20, decor: 10, attire: 14, makeup: 4, ceremony: 22, jewelry: 16, transport: 4, stationery: 2 };
const CASES = [
  ["Capu 200 khách, bảng 90tr", coupleProfile({ budget: 200, guest_count: 200 }), doc(A, { guests: 200 })],
  ["bảng 300 khách thắng hồ sơ 200", coupleProfile({ budget: 200, guest_count: 200 }), doc(A, { guests: 300 })],
  ["tổng hồ sơ 100 lệch bảng 200 (co giãn)", coupleProfile({ budget: 100, guest_count: 200 }), doc(A, { guests: 0 })],
  ["không bảng, ước theo tổng 123", coupleProfile({ budget: 123, guest_count: 157 }), undefined],
  ["hồ sơ cũ có hạng mục, có hạng mục 0", coupleProfile({ budget: 300, guest_count: 120, budget_by_category: { venue: 70, photography: 0, honeymoon: 5 } }), undefined],
  ["bảng + hồ sơ cũ đè nhau", coupleProfile({ budget: 200, guest_count: 80, budget_by_category: { venue: 30, decor: 50 } }), doc({ venue: 60 }, { guests: 0 })],
  ["có ngân sách, không số khách", coupleProfile({ budget: 250 }), doc(A, { guests: 0 })],
  ["có số khách, không ngân sách", coupleProfile({ guest_count: 250 }), undefined],
  ["hồ sơ rỗng", coupleProfile({}), undefined],
];
const KINDS = new Set(["per_table", "total", "no_guests", "no_budget"]);
let seen = 0;
for (const [label, profile, budgetDoc] of CASES) for (const cat of CATS) {
  const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=${cat}&limit=50`, profile, budgetDoc, countFetch: { n: 0 } });
  if (r.err || r.status !== 200) { bad(`${label}/${cat}: match lỗi ${r.err?.message || r.status}`); continue; }
  const s = r.body?.profileSnapshot || {}; const vs = r.body?.vendors || [];
  for (const v of vs) {
    if (!v.match) continue; seen++;
    const bb = v.match.budgetBasis, sc = v.match.scoreBreakdown?.budget, tag = `${label}/${cat}/${v.id}`;
    if (!bb || !KINDS.has(bb.kind)) { bad(`${tag}: thiếu budgetBasis hoặc kind lạ (${bb?.kind})`); continue; }
    // (1) điểm suy ra từ chính số in ra
    if (bb.kind === "no_budget" || bb.kind === "no_guests") { if (sc !== 0.5) bad(`${tag}: ${bb.kind} mà điểm ${sc}, mong 0,5`); }
    else {
      const t = bb.totalTr, c = bb.categoryBudgetTr;
      if (!(typeof t === "number" && typeof c === "number" && c > 0)) { bad(`${tag}: ${bb.kind} thiếu totalTr/categoryBudgetTr số (${t}, ${c})`); continue; }
      const ex2 = (t - c) / c, want = t <= c ? 1 : ex2 > 0.2 ? 0 : 1 - ex2 / 0.2;
      if (!(Math.abs(sc - want) < 1e-9)) bad(`${tag}: điểm ${sc} không suy ra từ ${t} so với ${c} (mong ${want})`);
    }
    // (2) một nguồn số khách: per_table dùng đúng số khách của snapshot và số bàn = ceil(khách/10)
    if (bb.kind === "per_table") {
      if (bb.guests !== s.guestCount) bad(`${tag}: budgetBasis.guests ${bb.guests} khác profileSnapshot.guestCount ${s.guestCount}`);
      if (bb.tables !== Math.ceil(bb.guests / 10)) bad(`${tag}: tables ${bb.tables} khác ceil(${bb.guests}/10)`);
      if (!near(bb.totalTr, bb.pricePerTableTr * bb.tables) || !near(bb.pricePerTableTr, v.priceMax)) bad(`${tag}: totalTr ${bb.totalTr} khác priceMax ${v.priceMax} x ${bb.tables}`);
    }
    if (bb.kind === "total" && !near(bb.totalTr, v.priceMax)) bad(`${tag}: total mà totalTr ${bb.totalTr} khác priceMax ${v.priceMax}`);
    // (3) một nguồn ngân sách hạng mục: khớp profileSnapshot
    const snapCat = s.budgetByCategory?.[cat];
    if (bb.kind === "per_table" || bb.kind === "total" || bb.kind === "no_guests") {
      if (bb.categoryBudgetSource === "allocation" || bb.categoryBudgetSource === "legacy_profile") {
        if (!near(snapCat, bb.categoryBudgetTr)) bad(`${tag}: categoryBudgetTr ${bb.categoryBudgetTr} khác profileSnapshot.budgetByCategory.${cat} ${snapCat}`);
        if (s.sources?.budgetByCategory?.[cat] !== bb.categoryBudgetSource) bad(`${tag}: nguồn ${bb.categoryBudgetSource} khác sources.budgetByCategory.${cat} ${s.sources?.budgetByCategory?.[cat]}`);
      } else if (bb.categoryBudgetSource === "total_share") {
        if (snapCat !== undefined) bad(`${tag}: total_share mà budgetByCategory.${cat} có ${snapCat}`);
        if (!near(bb.categoryBudgetTr, s.budgetTotal * bb.sharePct / 100)) bad(`${tag}: total_share ${bb.categoryBudgetTr} khác budgetTotal ${s.budgetTotal} x ${bb.sharePct}%`);
      } else bad(`${tag}: categoryBudgetSource lạ ${bb.categoryBudgetSource}`);
    }
  }
  // (4) chi tiết vendor cho đúng budgetBasis như danh sách (vendor đầu)
  const v0 = vs.find((x) => x.match);
  if (v0) {
    const d = await tab(M, { url: `/api/vendors/${v0.id}?coupleId=${CID}`, profile, budgetDoc, countFetch: { n: 0 } });
    if (d.err || d.status !== 200) bad(`${label}/${cat}: chi tiết lỗi ${d.err?.message || d.status}`);
    else if (d.body?.match && JSON.stringify(d.body.match.budgetBasis) !== JSON.stringify(v0.match.budgetBasis)) bad(`${label}/${cat}/${v0.id}: chi tiết và danh sách khác budgetBasis`);
  }
}
restoreNow();
if (!seen) bad("không vendor nào có match (khung hỏng)");
done(fails);
