// T-218 adversary 03 (tầng 3): spec T-217 Hành vi 6, vi phân với code main trên CÙNG pool (pool sau Sync, 65 vendor verified):
// - Mọi dòng GET /api/admin/vendors của vendor pool KHÔNG verified: y nguyên từng byte so với code main ("dòng admin y nguyên từng byte").
// - Dòng của vendor pool verified: chỉ price_basis/price_label/price_as_of/price_source khác main, và bằng source_verified / "Giá đã xác minh (nguồn)" / null / "source_verified".
// - Mỗi bộ lọc ?label=: total của PR = total của main trừ đúng tập vendor verified (estimated, legacy_marry, estimate_category), bằng nhau với verified và các nhãn khác.
//   Với 3 trạng thái overlay toàn cục: không overlay, overlay price_verified:false cho mọi vendor verified, overlay giá chưa xác minh cho một nửa.
// Biến: TOHONG_BACK_REPO (back PR, đã Sync hoặc chưa), ADV_MAIN_BACK (code main, mặc định <gốc HQ>/../tohong-back). Sau khi PR back merge, main = PR: phép vi phân tự hết nghĩa (vẫn PASS khi đúng hành vi; chỉ có nghĩa ở Code Gate T-218). Không mạng, R2 giả.
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { BACK, load, embedded, OVERLAY_KEY, ADMIN } from "../T-147/lib/back147.mjs";
import { fileURLToPath } from "node:url";
const HQ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MAIN = path.resolve(process.env.ADV_MAIN_BACK || path.join(HQ, "..", "tohong-back"));
if (!fs.existsSync(path.join(MAIN, "worker.js"))) { console.log("FAIL không thấy code main của tohong-back (đặt ADV_MAIN_BACK)"); process.exit(2); }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t218-adv03-")); process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
for (const e of fs.readdirSync(MAIN)) { if ([".git", "node_modules", "tohong"].includes(e)) continue; fs.cpSync(path.join(MAIN, e), path.join(tmp, e), { recursive: true }); }
fs.symlinkSync(fs.realpathSync(path.join(MAIN, "node_modules")), path.join(tmp, "node_modules"));
for (const f of ["vendorPool.generated.js", "vendorEnrichReport.generated.js"]) fs.copyFileSync(path.join(BACK, "lib", f), path.join(tmp, "lib", f));
const P = await load(BACK), Mn = await load(tmp);
const pool = embedded(BACK, "vendorPool.generated.js", "GENERATED_VENDOR_POOL");
const SV = new Set(pool.filter((v) => v.priceSource === "verified").map((v) => v.id));
const fails = []; const bad = (m) => { if (fails.length < 30) fails.push(m); };
const tok = { token: `dev:${ADMIN}` };
async function all(B, env, label) {
  const out = []; let off = 0;
  for (;;) { const r = await B.call(env, "GET", `/api/admin/vendors?limit=200&offset=${off}${label ? `&label=${label}` : ""}`, tok); if (r.status !== 200) { bad(`HTTP ${r.status} label=${label}`); return out; } out.push(...r.json.vendors); off += 200; if (off >= r.json.total) return out; }
}
const half = [...SV].filter((_, i) => i % 2 === 0);
const states = {
  "không overlay": {},
  "price_verified:false cho mọi vendor verified": Object.fromEntries([...SV].map((i) => [i, { price_verified: false }])),
  "giá chưa xác minh cho một nửa": Object.fromEntries(half.map((i) => [i, { priceMin: 7, priceMax: 9 }])),
};
const PRICE = ["price_basis", "price_label", "price_as_of", "price_source"];
for (const [name, ov] of Object.entries(states)) {
  const mk = (B) => { const b = new B.MemoryBucket(); if (Object.keys(ov).length) b.data.set(OVERLAY_KEY, JSON.stringify({ seq: 1, vendors: ov })); return B.makeEnv(b); };
  const eP = mk(P), eM = mk(Mn);
  const rp = await all(P, eP, ""), rm = await all(Mn, eM, "");
  if (rp.length !== rm.length) bad(`[${name}] số dòng PR ${rp.length} ≠ main ${rm.length}`);
  const mById = new Map(rm.map((r) => [r.id, r]));
  const changed = new Set();
  for (const r of rp) {
    const m = mById.get(r.id); if (!m) { bad(`[${name}] ${r.id} không có ở main`); continue; }
    const priced = ov[r.id] && (typeof ov[r.id].priceMin === "number" || typeof ov[r.id].priceMax === "number") && ov[r.id].price_verified !== true;
    const srcV = SV.has(r.id) && !priced && !(ov[r.id]?.price_verified === true);
    if (SV.has(r.id) && priced) { // bảng Hành vi 6 dòng 2: admin / "Giá do Tơ Hồng cập nhật" / null / estimated (main: không có basis vì nguồn lạ)
      const a = { ...r }, b = { ...m }; for (const k of PRICE) { delete a[k]; delete b[k]; }
      if (JSON.stringify(a) !== JSON.stringify(b)) bad(`[${name}] dòng ${r.id} (overlay giá): trường ngoài giá khác main`);
      for (const [k, w] of Object.entries({ price_basis: "admin", price_label: "Giá do Tơ Hồng cập nhật", price_as_of: null, price_source: "estimated" })) if (r[k] !== w) bad(`[${name}] dòng ${r.id} (overlay giá): ${k} mong ${JSON.stringify(w)}, thấy ${JSON.stringify(r[k])}`);
      continue;
    }
    if (!srcV) { if (JSON.stringify(r) !== JSON.stringify(m)) bad(`[${name}] dòng ${r.id} (không nguồn verified) khác main: ${JSON.stringify(r).slice(0, 120)} vs ${JSON.stringify(m).slice(0, 120)}`); continue; }
    changed.add(r.id);
    const a = { ...r }, b = { ...m }; for (const k of PRICE) { delete a[k]; delete b[k]; }
    if (JSON.stringify(a) !== JSON.stringify(b)) bad(`[${name}] dòng ${r.id}: trường ngoài giá khác main`);
    const want = { price_basis: "source_verified", price_label: "Giá đã xác minh (nguồn)", price_as_of: null, price_source: "source_verified" };
    for (const [k, w] of Object.entries(want)) if (r[k] !== w) bad(`[${name}] dòng ${r.id}: ${k} mong ${JSON.stringify(w)}, thấy ${JSON.stringify(r[k])}`);
  }
  for (const lb of ["estimated", "legacy_marry", "estimate_category", "verified", "overridden", "hidden", "missing_contact"]) {
    const sp = new Set((await all(P, eP, lb)).map((r) => r.id)), sm = new Set((await all(Mn, eM, lb)).map((r) => r.id));
    const want = new Set([...sm].filter((i) => !(changed.has(i) && ["estimated", "legacy_marry", "estimate_category"].includes(lb))));
    const extra = [...sp].filter((i) => !want.has(i)), miss = [...want].filter((i) => !sp.has(i));
    if (extra.length || miss.length) bad(`[${name}] bộ lọc ${lb}: PR ${sp.size}, mong ${want.size} (main ${sm.size} trừ vendor nguồn verified); thừa ${extra.slice(0, 3)}, thiếu ${miss.slice(0, 3)}`);
  }
  if (name === "không overlay") console.error(`info: ${SV.size} vendor pool verified, ${changed.size} dòng đổi`);
}
if (fails.length) { console.log("FAIL " + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : "")); process.exit(1); }
console.log("PASS"); process.exit(0);
