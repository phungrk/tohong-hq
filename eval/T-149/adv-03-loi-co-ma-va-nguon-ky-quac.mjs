#!/usr/bin/env node
// T-149 adv-03 (tầng 3, adversary, Code Gate v2): hồi quy của phần sửa adv-01 ở tohong-back.
// Chạy từ gốc tohong-hq: node eval/T-149/adv-03-loi-co-ma-va-nguon-ky-quac.mjs   (repo back: TOHONG_BACK_REPO, rồi ../tohong-back)
// Input và mong đợi:
//  A. Một vendor trong pool có pool_input.record mang null ở MỌI trường cùng lúc; vendor khác mang kiểu lạ (description số, categories chuỗi,
//     reviews object, style_tags chuỗi, price_range chuỗi, reviews=[null]); pool_input.record = null. Detail của Capu: 200, đúng khoá, field_notes là mảng.
//  B. Lỗi có mã chủ ý giữ nguyên mã: file review R2 hỏng -> danh sách 500 {"error":"reviews_corrupt"}; export khi thiếu khoá ký -> 503 {"error":"signing_unavailable"}.
//  C. Lỗi bất ngờ (R2 ném Error không có status khi đọc review) -> 500 {"error":"internal_error"}, không lộ câu lỗi nội bộ.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { BACK, load, embedded, copyBack, reporter } = await import(pathToFileURL(path.join(HERE, "..", "T-147", "lib", "back147.mjs")).href);
const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ: " + String(e && e.message).slice(0, 200)); process.exit(1); });

const report = embedded(BACK, "vendorEnrichReport.generated.js", "VENDOR_ENRICH_REPORT");
const pool = embedded(BACK, "vendorPool.generated.js", "GENERATED_VENDOR_POOL");
const inPool = new Set(pool.map((v) => v.id));
const cands = report.vendors.filter((r) => inPool.has(r.id) && r.pool_input && r.pool_input.record);
if (cands.length < 3) { console.log("FAIL không đủ vendor trong pool có pool_input"); process.exit(1); }
const [allNull, odd, noRec] = cands;
const tmp = copyBack((dir) => {
  const f = path.join(dir, "lib", "vendorEnrichReport.generated.js");
  const t = fs.readFileSync(f, "utf8");
  const head = t.slice(0, t.indexOf("=", t.indexOf("export const VENDOR_ENRICH_REPORT")) + 1);
  const rep = JSON.parse(JSON.stringify(report));
  const by = (id) => rep.vendors.find((r) => r.id === id);
  const a = by(allNull.id).pool_input.record;
  for (const k of Object.keys(a)) a[k] = null;
  Object.assign(by(odd.id).pool_input.record, { description: 12345, categories: "venue", reviews: [null], style_tags: "luxury", price_range: "5-10tr", city: null });
  by(noRec.id).pool_input.record = null;
  fs.writeFileSync(f, head + " " + JSON.stringify(rep) + ";\n");
});
const B = await load(tmp);
const base = "/api/admin/vendor-enrich";
const KEYS = ["catalog", "data_as_of", "extra_inputs", "id", "name", "overlay", "pool", "source"];
for (const [label, id] of [["mọi trường null", allNull.id], ["kiểu lạ", odd.id], ["record=null", noRec.id]]) {
  const d = await B.asCapu(B.makeEnv(new B.MemoryBucket()), "GET", `${base}/${id}/detail`);
  R.check(`A ${label}: 200`, d.status === 200, { s: d.status, t: d.text.slice(0, 120) });
  if (d.status === 200) R.check(`A ${label}: đúng khoá, field_notes mảng`, JSON.stringify(Object.keys(d.json).sort()) === JSON.stringify(KEYS) && Array.isArray(d.json.pool.field_notes));
}

// B. lỗi có mã
{
  const bucket = new B.MemoryBucket();
  await bucket.put("data/admin/vendor_enrich_reviews.json", "{không phải json");
  const l = await B.asCapu(B.makeEnv(bucket), "GET", base);
  R.check("B review R2 hỏng: danh sách 500 reviews_corrupt", l.status === 500 && l.json?.error === "reviews_corrupt", { s: l.status, t: l.text.slice(0, 120) });
  const e = await B.asCapu(B.makeEnv(new B.MemoryBucket()), "GET", `${base}/export`);
  R.check("B thiếu khoá ký: export 503 signing_unavailable", e.status === 503 && e.json?.error === "signing_unavailable", { s: e.status, t: e.text.slice(0, 120) });
}
// C. lỗi bất ngờ
{
  const bucket = new B.MemoryBucket();
  const orig = bucket.get.bind(bucket);
  bucket.get = async (k, ...r) => { if (String(k).includes("vendor_enrich_reviews")) throw new Error("SECRET-INTERNAL-xyz"); return orig(k, ...r); };
  const l = await B.asCapu(B.makeEnv(bucket), "GET", base);
  R.check("C lỗi bất ngờ: 500 internal_error, không lộ câu lỗi", l.status === 500 && l.text === JSON.stringify({ error: "internal_error" }), { s: l.status, t: l.text.slice(0, 120) });
}
fs.rmSync(tmp, { recursive: true, force: true });
R.done();
