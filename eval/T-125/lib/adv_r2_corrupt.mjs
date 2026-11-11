// T-125 adv-02 (trợ giúp): khoá R2 data/admin/vendor_enrich_reviews.json chứa JSON hỏng; một admin, không ai ghi đồng thời.
// In JSON {export:{status,count}, put:{status,error}, export2:{status,count,has}} ra stdout. Không ghi file nào.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const L = await import(pathToFileURL(path.join(HERE, "..", "..", "T-124", "lib", "back.mjs")).href);
const rep = JSON.parse(fs.readFileSync(path.join(L.BACK, "lib", "vendorEnrichReport.generated.js"), "utf8").match(/VENDOR_ENRICH_REPORT\s*=\s*([\s\S]*?);\s*$/)[1]);
const id = rep.vendors.find((r) => r.approvable && !r.override).id;
const out = {};
for (const [name, text] of [["cụt", '{"vendors":{"marry_x":{"state":"pend'], ["rác", "not json"]]) {
  const bucket = new L.MemoryBucket();
  bucket.data.set("data/admin/vendor_enrich_reviews.json", text);
  const env = L.makeEnv(bucket);
  const ex = await L.asAdmin(env, "GET", "/api/admin/vendor-enrich/export");
  const put = await L.asAdmin(env, "PUT", `/api/admin/vendor-enrich/${id}/review`, { decision: "approve" });
  const ex2 = await L.asAdmin(env, "GET", "/api/admin/vendor-enrich/export");
  out[name] = { export: { status: ex.status, count: ex.json?.count ?? null }, put: { status: put.status, error: put.json?.error ?? null },
    export2: { status: ex2.status, count: ex2.json?.count ?? null, has: !!ex2.json?.entries?.some((e) => e.vendor_id === id) } };
}
console.log(JSON.stringify(out));
process.exit(0);
