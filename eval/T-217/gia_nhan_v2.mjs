// Dùng bởi inv-proposed-002-v2-gia-hien-ra-luon-co-nhan.py (v2 của INV-B, T-217/ADR-138): thêm price_basis "source_verified", và vendor pool priceSource "verified" không overlay phải có đúng basis/nhãn "Giá đã xác minh". Pool thật + worker thật của back, R2 giả, mạng bị chặn. Không đóng dấu giá.
import { BACK, load } from "../T-147/lib/back147.mjs";
import { embedded } from "../T-147/lib/back147.mjs";
const pool = embedded(BACK, "vendorPool.generated.js", "GENERATED_VENDOR_POOL");
if (!pool.some((v) => "priceSource" in v)) { console.log("PASS chưa áp dụng (pool chưa có priceSource)"); process.exit(0); }
const B = await load(BACK); const fails = []; const bad = (m) => { if (fails.length < 6) fails.push(m); };
const BASES = new Set(["admin_verified", "source_verified", "admin", "legacy_marry", "estimate_category", "estimate_default"]);
const ok = (where, v) => { if ((v?.priceMin > 0 || v?.priceMax > 0) && !(typeof v.price_label === "string" && v.price_label.trim() && BASES.has(v.price_basis))) bad(`${where} ${v?.id ?? ""}: có giá mà thiếu price_label/price_basis hợp lệ (${v?.price_basis})`); };
const SV = pool.filter((v) => v.priceSource === "verified").map((v) => v.id);
{ // vendor verified của pool, không overlay: đúng nguồn và nhãn
  const env0 = { CHAT_DATA: new B.MemoryBucket(), DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: "u_admin", CAPU_USER_IDS: "u_capu" };
  for (const id of SV) { const r = await B.call(env0, "GET", `/api/vendors/${id}`, { token: "dev:u_khach" });
    if (r.status !== 200 || r.json.vendor?.price_basis !== "source_verified" || r.json.vendor?.price_label !== "Giá đã xác minh" || r.json.vendor?.price_as_of != null) bad(`chi tiết ${id} (pool verified): basis/label/as_of = ${r.json?.vendor?.price_basis}/${r.json?.vendor?.price_label}/${r.json?.vendor?.price_as_of}`); } }
const sample = [...new Set([...pool.filter((_, i) => i % 61 === 0).map((v) => v.id), ...SV])];
const variants = { none: {}, giaChuaXacMinh: Object.fromEntries(sample.map((id) => [id, { priceMin: 7, priceMax: 9 }])), xacMinh: Object.fromEntries(sample.map((id) => [id, { priceMin: 7, priceMax: 9, price_verified: true }])), chiXacMinh: Object.fromEntries(sample.map((id) => [id, { price_verified: true }])) };
for (const [name, ov] of Object.entries(variants)) {
  const bucket = new B.MemoryBucket(); if (Object.keys(ov).length) bucket.data.set("data/admin/vendor_overrides.json", JSON.stringify({ seq: 1, vendors: ov }));
  const env = { CHAT_DATA: bucket, DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: "u_admin", CAPU_USER_IDS: "u_capu" };
  for (let i = 0; i < pool.length; i += 50) {
    const r = await B.call(env, "POST", "/api/vendors/status", { token: "dev:u_khach", body: { ids: pool.slice(i, i + 50).map((v) => v.id) } });
    if (r.status !== 200) { bad(`status ${name}: HTTP ${r.status}`); break; }
    for (const [id, s] of Object.entries(r.json.vendors || {})) if (s) ok(`status[${name}]`, { id, ...s });
  }
  for (const id of sample) { const r = await B.call(env, "GET", `/api/vendors/${id}`, { token: "dev:u_khach" }); if (r.status === 200) ok(`chi tiết[${name}]`, r.json.vendor); else bad(`chi tiết ${id}: HTTP ${r.status}`); }
  for (const cat of ["venue", "photography", "stationery"]) { const r = await B.call(env, "GET", `/api/vendors/match?category=${cat}&limit=50`, { token: "dev:u_khach" }); for (const v of r.json?.vendors || []) ok(`match[${name}]`, v); }
}
if (fails.length) { console.log("FAIL " + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : "")); process.exit(1); }
console.log("PASS");
