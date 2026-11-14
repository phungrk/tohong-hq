// Dùng bởi inv-xxx-gia-hien-ra-luon-co-nhan.py. Pool thật + worker thật của back, R2 giả, mạng bị chặn. Không đóng dấu giá.
import { BACK, load } from "../../../T-147/lib/back147.mjs";
import { embedded } from "../../../T-147/lib/back147.mjs";
const pool = embedded(BACK, "vendorPool.generated.js", "GENERATED_VENDOR_POOL");
if (!pool.some((v) => "priceSource" in v)) { console.log("PASS chưa áp dụng (pool chưa có priceSource)"); process.exit(0); }
const B = await load(BACK); const fails = []; const bad = (m) => { if (fails.length < 6) fails.push(m); };
const BASES = new Set(["admin_verified", "admin", "legacy_marry", "estimate_category", "estimate_default"]);
const ok = (where, v) => { if ((v?.priceMin > 0 || v?.priceMax > 0) && !(typeof v.price_label === "string" && v.price_label.trim() && BASES.has(v.price_basis))) bad(`${where} ${v?.id ?? ""}: có giá mà thiếu price_label/price_basis hợp lệ (${v?.price_basis})`); };
const sample = pool.filter((_, i) => i % 61 === 0).map((v) => v.id);
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
