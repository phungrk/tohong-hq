// Chạy hợp đồng style qua đường JS. Dùng: node run_js.mjs <repo> <cases.json> <mode>
// mode: cases | twins | pool | text ; in một JSON ra stdout. Không sửa repo sản phẩm.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [repo, casesPath, mode] = process.argv.slice(2);
const C = JSON.parse(fs.readFileSync(casesPath, "utf8"));
const vm = await import(pathToFileURL(path.join(repo, "lib/vendorMatcher.js")).href);
const fmt = await import(pathToFileURL(path.join(repo, "lib/matchFormatter.js")).href);
const { computeMatches, VENDOR_POOL } = vm;

const BASE_PROFILE = { city: "HCMC", weddingDate: "2027-03-15", budgetTotal: 300, guestCount: 200 };
const mk = (id, tags, over = {}) => ({
  id, name: "Vendor Thử " + id, category: "photography", catLabel: "Chụp ảnh", catIcon: "camera",
  description: "", styles: tags, tags, priceMin: 10, priceMax: 20, city: "HCMC", rating: 4.5,
  reviewCount: 60, photos: [], availability: [1,2,3,4,5,6,7,8,9,10,11,12], isVerified: true, ...over,
});
const norm = (a) => a.map((s) => String(s).toLowerCase().trim());
const expandSet = (couple) => new Set(norm(couple).flatMap((s) => C.expansion[s] || [s]));
const isMatched = (couple, tags) => { const e = expandSet(couple); return norm(tags || []).some((t) => e.has(t)); };
const run = (couple, pool, opts) => computeMatches({ ...BASE_PROFILE, preferredStyles: couple }, { pool, ...opts });
const out = (o) => console.log(JSON.stringify(o));

if (mode === "cases") {
  const res = [];
  for (const c of C.cases) {
    const pool = [mk("t1", c.vendor)];
    const r = run(c.couple, pool, { category: "photography", limit: 5 });
    const v = r.vendors.find((x) => x.id === "t1");
    if (!v) { res.push({ id: c.id, error: "pool_opt_unsupported_or_vendor_dropped" }); continue; }
    res.push({ id: c.id, style: v.match.scoreBreakdown.style, coverage: v.match.styleCoverage ?? null });
  }
  out(res);
} else if (mode === "twins") {
  // Anh em sinh đôi từ vendor THẬT của pool: chỉ khác tag. Lệch = "editorial" (không thuộc phần mở rộng của style nào).
  const res = [];
  const cats = [...new Set(VENDOR_POOL.map((v) => v.category))];
  for (const cat of cats) {
    const base = VENDOR_POOL.filter((v) => v.category === cat && v.isVerified && v.city === "HCMC" && (v.rating === 0 || v.rating >= 3.5)).slice(0, 6);
    for (const couple of C.pool_styles.map((s) => [s])) {
      for (const b of base) {
        const A = { ...b, id: "twin_a", styles: ["editorial"], tags: ["editorial"] };
        const B = { ...b, id: "twin_b", styles: [], tags: [] };
        const M = { ...b, id: "twin_m", styles: [couple[0]], tags: [couple[0]] };
        const r = run(couple, [A, B, M], { category: cat, limit: 10 });
        const get = (id) => r.vendors.find((x) => x.id === id);
        if (!get("twin_a") || !get("twin_b") || !get("twin_m")) { res.push({ error: "pool_opt_unsupported_or_vendor_dropped", cat }); continue; }
        res.push({ cat, base: b.id, style: couple[0], lech: get("twin_a").match.totalScore, khong_tag: get("twin_b").match.totalScore, khop: get("twin_m").match.totalScore,
          order: r.vendors.map((x) => x.id) });
      }
    }
  }
  out(res);
} else if (mode === "pool") {
  const res = [];
  for (const p of C.pool_profiles) for (const st of C.pool_styles) for (const cat of C.pool_categories) {
    const eligible = VENDOR_POOL.filter((v) => v.category === cat && v.isVerified && v.city === "HCMC" && (!(v.rating > 0) || v.rating >= 3.5));
    const byId = new Map(VENDOR_POOL.map((v) => [v.id, v]));
    const M = eligible.filter((v) => isMatched([st], v.styles)).length;
    const top = computeMatches({ ...p, city: "HCMC", preferredStyles: [st] }, { category: cat, limit: 10 });
    const got = top.vendors.filter((v) => isMatched([st], byId.get(v.id)?.styles)).length;
    const all = computeMatches({ ...p, city: "HCMC", preferredStyles: [st] }, { category: cat, limit: 5000 });
    let seenUnmatched = false, violated = false;
    for (const v of all.vendors) { const m = isMatched([st], byId.get(v.id)?.styles); if (!m) seenUnmatched = true; else if (seenUnmatched) { violated = true; break; } }
    res.push({ profile: JSON.stringify(p), style: st, cat, eligible_matched: M, expected: Math.min(10, M), got, tier_violated: violated });
  }
  out(res);
} else if (mode === "text") {
  const res = { vendors: [], lists: [], formatter: [] };
  const cases = [];
  for (const cat of C.pool_categories) {
    for (const couple of [["korean"], ["luxury"], ["rustic"], ["modern"], ["natural"], ["traditional"], ["korean", "luxury"], []]) {
      cases.push({ couple, cat, pool: undefined });
    }
  }
  cases.push({ couple: ["gothic"], cat: "photography", pool: [mk("g1", ["gothic"]), mk("g2", ["luxury"]), mk("g3", [])] });
  for (const c of cases) {
    const r = computeMatches({ ...BASE_PROFILE, preferredStyles: c.couple }, { category: c.cat, limit: 10, ...(c.pool ? { pool: c.pool } : {}) });
    const anyMatched = r.vendors.some((v) => (v.match.styleCoverage?.matched ?? 0) > 0);
    res.lists.push({ couple: c.couple, cat: c.cat, text: r.whyThoseVendors, anyMatched });
    for (const v of r.vendors) {
      res.vendors.push({
        couple: c.couple, cat: c.cat, name: v.name, coverage: v.match.styleCoverage ?? null,
        labels: v.match.reasons.map((x) => x.label), why: v.match.whyThisVendor,
        truth_matched: isMatched(c.couple, v.styles),
      });
    }
  }
  const prof = { category: "photography" };
  const mkm = (name, tags) => ({ vendor_id: name, name, final_score: 80, score_detail: "80.0 [style=1.00(→25.0)]", boost_detail: "", price_range: { min_vnd: 10e6, max_vnd: 20e6 }, style_tags: tags, phone: "0900000000" });
  for (const f of [
    { pref: ["korean"], tags: ["soft"] }, { pref: ["korean"], tags: ["korean", "luxury"] }, { pref: ["korean"], tags: ["rustic"] },
    { pref: ["korean"], tags: [] }, { pref: [], tags: ["luxury"] }, { pref: ["modern"], tags: ["minimalist", "simple"] },
  ]) {
    const text = fmt.formatMatchBlock({ matches: [mkm("Studio Mẫu", f.tags)] }, { ...prof, style_preferences: f.pref });
    res.formatter.push({ ...f, text: text.split("Hướng dẫn trả lời")[0], truth_matched: isMatched(f.pref, f.tags) });
  }
  out(res);
} else { out({ error: "mode?" }); }
