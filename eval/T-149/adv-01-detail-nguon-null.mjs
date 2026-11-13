#!/usr/bin/env node
// T-149 adv-01 (tầng 3, adversary): API chi tiết không được sập khi nguồn có giá trị null mà schema cho phép.
// Chạy từ gốc tohong-hq: node eval/T-149/adv-01-detail-nguon-null.mjs   (repo back: TOHONG_BACK_REPO, rồi ../tohong-back)
// Spec products/T-147-drawer-vendor-enrich.md Hành vi 3: field_notes so pool với "giá trị sinh từ nguồn", trong đó
// description = cắt 220 (luật của generator: `(v.description || '').slice(0, 220)`), category/city/rating/reviewCount/styles có giá trị "thiếu".
// tools/scraper/schema.py: `description: Optional[str] = None`, `merchant_description: Optional[str] = None` => bản ghi vendors.json có thể mang null;
// build_enrich_report.project_record giữ nguyên null trong pool_input.record.
// Input: bản sao back, một vendor TRONG POOL có pool_input.record với description=null (và lần lượt: style_tags=null, categories=null,
// price_range=null, reviews=null, name=null). Mong đợi: GET /<id>/detail (Capu) trả 200 đúng khoá, field_notes là mảng, không 500.
// (%2E%2E không thử: WHATWG URL chuẩn hoá thành "..", đường dẫn thành /api/admin/detail, không chạm route chi tiết.)
// Cũng thử các id lạ với admin không phải Capu và người chưa đăng nhập: luôn 403 {"error":"forbidden"} (Capu kiểm trước id).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = pathToFileURL(path.join(HERE, "..", "T-147", "lib", "back147.mjs")).href;
const { BACK, ADMIN, load, embedded, copyBack, reporter } = await import(LIB);
const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ: " + String(e && e.message).slice(0, 200)); process.exit(1); });

const report = embedded(BACK, "vendorEnrichReport.generated.js", "VENDOR_ENRICH_REPORT");
const pool = embedded(BACK, "vendorPool.generated.js", "GENERATED_VENDOR_POOL");
const inPool = new Set(pool.map((v) => v.id));
const cands = report.vendors.filter((r) => inPool.has(r.id) && r.pool_input && r.pool_input.record);
if (cands.length < 6) { console.log("FAIL không đủ vendor trong pool có pool_input (cần PR tohong + back)"); process.exit(1); }
const CASES = [["description", null], ["style_tags", null], ["categories", null], ["price_range", null], ["reviews", null], ["name", null]];
const picks = CASES.map(([k, v], i) => ({ id: cands[i].id, k, v }));

const tmp = copyBack((dir) => {
  const f = path.join(dir, "lib", "vendorEnrichReport.generated.js");
  const t = fs.readFileSync(f, "utf8");
  const head = t.slice(0, t.indexOf("=", t.indexOf("export const VENDOR_ENRICH_REPORT")) + 1);
  const rep = JSON.parse(JSON.stringify(report));
  for (const p of picks) rep.vendors.find((r) => r.id === p.id).pool_input.record[p.k] = p.v;
  fs.writeFileSync(f, head + " " + JSON.stringify(rep) + ";\n");
});
const B = await load(tmp);
const base = "/api/admin/vendor-enrich";
const KEYS = ["catalog", "data_as_of", "extra_inputs", "id", "name", "overlay", "pool", "source"];
for (const p of picks) {
  const env = B.makeEnv(new B.MemoryBucket());
  const d = await B.asCapu(env, "GET", `${base}/${p.id}/detail`);
  R.check(`record.${p.k}=null: 200 (không sập)`, d.status === 200, { status: d.status, body: d.text.slice(0, 120) });
  if (d.status === 200) {
    R.check(`record.${p.k}=null: đúng khoá`, JSON.stringify(Object.keys(d.json).sort()) === JSON.stringify(KEYS), Object.keys(d.json));
    R.check(`record.${p.k}=null: field_notes là mảng`, Array.isArray(d.json.pool.field_notes));
  }
}

// id lạ: admin không phải Capu và người chưa đăng nhập luôn 403 forbidden (đúng một khoá)
const env = B.makeEnv(new B.MemoryBucket());
const ODD = ["..%2F..%2Fexport", "export", "A_B", "x".repeat(65), "%00", "a%20b", "%F0%9F%98%80", "vd'1", "__proto__", "constructor"];
for (const id of ODD) {
  for (const [who, token] of [["admin không Capu", `dev:${ADMIN}`], ["chưa đăng nhập", null]]) {
    const r = await B.call(env, "GET", `${base}/${id}/detail`, token ? { token } : {});
    R.check(`${who} id=${id}: 403 forbidden`, r.status === 403 && r.text === JSON.stringify({ error: "forbidden" }), { s: r.status, t: r.text.slice(0, 80) });
  }
  const c = await B.asCapu(env, "GET", `${base}/${id}/detail`);
  R.check(`Capu id=${id}: 400 hoặc 404, không 200/500`, c.status === 400 || c.status === 404, { s: c.status, t: c.text.slice(0, 80) });
}
fs.rmSync(tmp, { recursive: true, force: true });
R.done();
