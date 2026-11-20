// T-217 tiêu chí 7 (ADR-139, phân xử D1 mục 1): ở API ADMIN, vendor có pool priceSource "verified" hiện ĐÚNG nguồn của pool, không giả làm "ước tính" và không giả làm giá admin duyệt tay.
// Bề mặt: GET /api/admin/vendors (dòng bảng), GET /api/admin/vendors/:id (trường effective), GET /api/admin/vendor-enrich/:id/detail (pool.vendor, tính từ pool, không overlay).
// Không overlay giá (kể cả overlay chỉ có price_verified=false): price_basis "source_verified", price_label "Giá đã xác minh (nguồn)" (khác chữ với bề mặt cặp đôi), price_as_of null, price_source "source_verified".
// Overlay giá chưa xác minh: basis "admin", nhãn "Giá do Tơ Hồng cập nhật", price_source "estimated". Overlay price_verified=true (có hoặc không kèm giá): basis "admin_verified", nhãn "Giá đã xác minh", price_source "verified".
// Bộ lọc ?label=: "verified" CHỈ gồm vendor có overlay price_verified=true (không gồm source_verified); "estimated" chỉ gồm price_source "estimated" (không gồm source_verified);
// "legacy_marry" và "estimate_category" không gồm vendor source_verified. Đối chứng: legacy_marry và estimate_category giữ nguyên basis, price_source "estimated".
// Pool thật (Bình Quới 2 marry_b92e8a86175d là vendor pool verified có sẵn; sau Sync có thêm các venue AI Mode). Chạy: node eval/T-217/<file> · Biến: TOHONG_BACK_REPO. Không mạng, R2 giả.
import { BACK, load, embedded, OVERLAY_KEY, ADMIN } from "../T-147/lib/back147.mjs";
const B = await load(BACK); const pool = embedded(BACK, "vendorPool.generated.js", "GENERATED_VENDOR_POOL");
const BQ2 = "marry_b92e8a86175d";
const fails = []; const bad = (m) => { if (fails.length < 30) fails.push(m); };
const SV = pool.filter((v) => v.priceSource === "verified").map((v) => v.id);
if (!SV.includes(BQ2)) bad("pool thật không còn Bình Quới 2 với priceSource verified (đối chứng mất)");
const sample = [...new Set([BQ2, ...SV.filter((_, i) => i % 11 === 0)])].slice(0, 7);
const LC = pool.find((v) => v.priceSource === "legacy_marry" && /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v.priceAsOf)) && v.category === "venue")?.id;
const EC = pool.find((v) => v.priceSource === "estimate_category" && v.category === "venue")?.id;
if (!LC || !EC) bad("pool thật thiếu venue legacy_marry hoặc estimate_category để làm đối chứng");
const tok = { token: `dev:${ADMIN}` };
const ids = [...sample, LC, EC].filter(Boolean);
const NGUON = { price_basis: "source_verified", price_label: "Giá đã xác minh (nguồn)", price_as_of: null, price_source: "source_verified" };
const CHUA = { price_basis: "admin", price_label: "Giá do Tơ Hồng cập nhật", price_source: "estimated" };
const DA = { price_basis: "admin_verified", price_label: "Giá đã xác minh", price_source: "verified" };
const variants = {
  "không overlay": { ov: {}, want: NGUON, inVerified: false, inEstimated: false },
  "overlay price_verified=false": { ov: Object.fromEntries(ids.map((i) => [i, { price_verified: false }])), want: NGUON, inVerified: false, inEstimated: false },
  "giá chưa xác minh": { ov: Object.fromEntries(ids.map((i) => [i, { priceMin: 7, priceMax: 9 }])), want: CHUA, inVerified: false, inEstimated: true },
  "giá đã xác minh": { ov: Object.fromEntries(ids.map((i) => [i, { priceMin: 7, priceMax: 9, price_verified: true }])), want: DA, inVerified: true, inEstimated: false },
  "chỉ xác minh": { ov: Object.fromEntries(ids.map((i) => [i, { price_verified: true }])), want: DA, inVerified: true, inEstimated: false },
};
const chk = (where, v, want) => { for (const [k, x] of Object.entries(want)) if (v?.[k] !== x) bad(`${where}: ${k} mong ${JSON.stringify(x)}, thấy ${JSON.stringify(v?.[k])}`); };
const inList = async (env, id, label) => { const r = await B.call(env, "GET", `/api/admin/vendors?q=${encodeURIComponent(id)}&limit=5${label ? `&label=${label}` : ""}`, tok); if (r.status !== 200) { bad(`danh sách ${label || "(không lọc)"} ${id}: HTTP ${r.status}`); return { r: null, hit: false }; } const row = (r.json.vendors || []).find((x) => x.id === id); return { r: row, hit: !!row }; };
for (const [name, { ov, want, inVerified, inEstimated }] of Object.entries(variants)) {
  const bucket = new B.MemoryBucket(); if (Object.keys(ov).length) bucket.data.set(OVERLAY_KEY, JSON.stringify({ seq: 1, vendors: ov }));
  const env = B.makeEnv(bucket);
  for (const id of sample) {
    const all = await inList(env, id, ""); if (!all.r) bad(`dòng admin[${name}] ${id}: không thấy trong danh sách`); else chk(`dòng admin[${name}] ${id}`, all.r, want);
    const d = await B.call(env, "GET", `/api/admin/vendors/${id}`, tok); if (d.status !== 200) bad(`chi tiết admin[${name}] ${id}: HTTP ${d.status}`); else chk(`chi tiết admin[${name}] ${id} (effective)`, d.json?.effective, want);
    if ((await inList(env, id, "verified")).hit !== inVerified) bad(`bộ lọc verified[${name}] ${id}: ${inVerified ? "phải có" : "KHÔNG được có"} (verified = overlay price_verified, không theo nguồn pool)`);
    if ((await inList(env, id, "estimated")).hit !== inEstimated) bad(`bộ lọc estimated[${name}] ${id}: ${inEstimated ? "phải có" : "KHÔNG được có"} (source_verified không là ước tính)`);
    for (const lb of ["legacy_marry", "estimate_category"]) if ((await inList(env, id, lb)).hit) bad(`bộ lọc ${lb}[${name}] ${id}: vendor nguồn verified KHÔNG được vào`);
  }
  if (name === "không overlay" || name === "giá đã xác minh") { // ngăn enrich: tính từ pool, không overlay
    const r = await B.call(env, "GET", `/api/admin/vendor-enrich/${BQ2}/detail`, tok);
    if (r.status !== 200) bad(`ngăn enrich[${name}] ${BQ2}: HTTP ${r.status}`); else chk(`ngăn enrich[${name}] ${BQ2} (pool.vendor)`, r.json?.pool?.vendor, { price_basis: "source_verified", price_label: "Giá đã xác minh (nguồn)", price_as_of: null });
  }
}
if (LC && EC) { // đối chứng: nguồn khác giữ nguyên, bộ lọc cũ vẫn tìm thấy
  const env = B.makeEnv(new B.MemoryBucket());
  const l = await inList(env, LC, "legacy_marry"); if (!l.hit) bad("đối chứng: bộ lọc legacy_marry mất venue legacy_marry"); else chk("đối chứng legacy_marry", l.r, { price_basis: "legacy_marry", price_source: "estimated" });
  const e = await inList(env, EC, "estimate_category"); if (!e.hit) bad("đối chứng: bộ lọc estimate_category mất venue ước tính"); else chk("đối chứng estimate_category", e.r, { price_basis: "estimate_category", price_label: "Ước tính theo hạng mục", price_source: "estimated" });
  for (const id of [LC, EC]) if (!(await inList(env, id, "estimated")).hit) bad(`đối chứng: bộ lọc estimated mất ${id}`);
}
if (fails.length) { console.log("FAIL " + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : "")); process.exit(1); }
console.log("PASS"); process.exit(0);
