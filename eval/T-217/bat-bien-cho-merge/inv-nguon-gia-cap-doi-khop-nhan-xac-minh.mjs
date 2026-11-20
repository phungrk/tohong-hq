#!/usr/bin/env node
// Bất biến đề xuất · ĐÍCH: eval/invariants/planner/vendor/ · nguồn: T-217 (spec products/T-217-venue-ai-mode-verified.md v2, Hành vi 5 và 7; ADR-139 phân xử D1 mục 1).
// Rút khi qua Spec Gate 2026-11-20 (spec-critic), viết tổng quát từ eval/T-217/check_8 (không ghim id vendor). Chief of Staff đặt số khi đưa vào bể.
// Nằm ở eval/T-217/bat-bien-cho-merge/ cho tới khi PR back của T-217 merge (ADR-028). Trên back main 0f69f10 ĐỎ (Bình Quới 2: pool verified mà chưa có price_basis); đó là đúng.
// INV-??? · Cờ "giá đã xác minh" mà cặp đôi (và sự kiện vendor_viewed của front) nhận KHỚP với nhãn giá:
//   trên POST /api/vendors/status và GET /api/vendors/:id, với năm trạng thái overlay (không có; chỉ price_verified=false; giá chưa xác minh; giá đã xác minh; chỉ xác minh):
//   (a) price_source chỉ là "verified" hoặc "estimated" (cặp đôi không bao giờ thấy "source_verified" hay giá trị lạ);
//   (b) có price_basis thì price_source == "verified" khi và chỉ khi price_basis ∈ {admin_verified, source_verified};
//   (c) mọi vendor pool priceSource "verified" mà không có overlay giá (không overlay, hoặc chỉ price_verified=false) ra price_basis "source_verified" và price_source "verified".
// Pool chưa có priceSource: PASS "chưa áp dụng". Thoát 0 = đạt, 1 = vi phạm. Repo: TOHONG_BACK_REPO hoặc ../tohong-back. Không mạng, R2 giả.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
// Dò ngược tới gốc tohong-hq (có scripts/gate.py), không đếm cấp thư mục (ADR-057/070, _shared/inv-004).
let HQ = path.dirname(fileURLToPath(import.meta.url)); while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
if (!fs.existsSync(path.join(HQ, "scripts", "gate.py"))) { console.log("FAIL không dò được gốc tohong-hq (scripts/gate.py)"); process.exit(1); }
const { BACK, load, embedded, OVERLAY_KEY } = await import(pathToFileURL(path.join(HQ, "eval", "T-147", "lib", "back147.mjs")).href);
const pool = embedded(BACK, "vendorPool.generated.js", "GENERATED_VENDOR_POOL");
if (!pool.some((v) => "priceSource" in v)) { console.log("PASS chưa áp dụng (pool chưa có priceSource)"); process.exit(0); }
const B = await load(BACK);
const fails = []; const bad = (m) => { if (fails.length < 8) fails.push(m); };
const SV = pool.filter((v) => v.priceSource === "verified").map((v) => v.id);
const sample = [...new Set([...SV, ...pool.filter((_, i) => i % 61 === 0).map((v) => v.id)])];
const XM = new Set(["admin_verified", "source_verified"]);
const all = (p) => Object.fromEntries(sample.map((id) => [id, p]));
const variants = {
  "không overlay": { ov: {}, nguon: true },
  "price_verified=false": { ov: all({ price_verified: false }), nguon: true },
  "giá chưa xác minh": { ov: all({ priceMin: 7, priceMax: 9 }), nguon: false },
  "giá đã xác minh": { ov: all({ priceMin: 7, priceMax: 9, price_verified: true }), nguon: false },
  "chỉ xác minh": { ov: all({ price_verified: true }), nguon: false },
};
const tok = { token: "dev:u_khach" };
const rule = (where, id, v, nguon) => {
  if (!v || v.hidden) return;
  if (v.price_source !== "verified" && v.price_source !== "estimated") bad(`${where} ${id}: price_source ${JSON.stringify(v.price_source)} (cặp đôi chỉ được thấy verified/estimated)`);
  if (v.price_basis && (v.price_source === "verified") !== XM.has(v.price_basis)) bad(`${where} ${id}: price_source ${v.price_source} lệch nhãn (basis ${v.price_basis})`);
  if (nguon && SV.includes(id) && (v.price_basis !== "source_verified" || v.price_source !== "verified")) bad(`${where} ${id}: pool verified không overlay giá phải ra source_verified/verified, thấy ${v.price_basis}/${v.price_source}`);
};
for (const [name, { ov, nguon }] of Object.entries(variants)) {
  const bucket = new B.MemoryBucket(); if (Object.keys(ov).length) bucket.data.set(OVERLAY_KEY, JSON.stringify({ seq: 1, vendors: ov }));
  const env = B.makeEnv(bucket);
  for (let i = 0; i < sample.length; i += 50) {
    const ids = sample.slice(i, i + 50);
    const r = await B.call(env, "POST", "/api/vendors/status", { ...tok, body: { ids } });
    if (r.status !== 200) { bad(`status[${name}]: HTTP ${r.status}`); continue; }
    for (const id of ids) rule(`status[${name}]`, id, r.json?.vendors?.[id], nguon);
  }
  for (const id of sample) {
    const r = await B.call(env, "GET", `/api/vendors/${id}`, tok);
    if (r.status !== 200) { bad(`chi tiết[${name}] ${id}: HTTP ${r.status}`); continue; }
    rule(`chi tiết[${name}]`, id, r.json?.vendor, nguon);
  }
}
if (fails.length) { console.log("FAIL " + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : "")); process.exit(1); }
console.log(`PASS ${sample.length} vendor x 5 trạng thái overlay: cờ xác minh của cặp đôi khớp nhãn (${SV.length} vendor pool verified)`); process.exit(0);
