// T-125 adv-04 (trợ giúp): khoá R2 data/admin/vendor_enrich_reviews.json là JSON ĐÚNG cú pháp nhưng SAI schema.
// Với mỗi ca: gọi danh sách, export, PUT, DELETE bằng admin; in JSON {ca: {list, export, put, del, unchanged}} ra stdout. Không ghi file nào.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const L = await import(pathToFileURL(path.join(HERE, "..", "..", "T-124", "lib", "back.mjs")).href);
const rep = JSON.parse(fs.readFileSync(path.join(L.BACK, "lib", "vendorEnrichReport.generated.js"), "utf8").match(/VENDOR_ENRICH_REPORT\s*=\s*([\s\S]*?);\s*$/)[1]);
const ap = rep.vendors.filter((r) => r.approvable && !r.override).map((r) => r.id);
const KEY = "data/admin/vendor_enrich_reviews.json";
const CASES = {
  "{}": "{}",
  "vendors mảng": '{"vendors":[{"vendor_id":"' + ap[1] + '"}]}',
  "vendors chuỗi": '{"vendors":"bad"}',
  "vendors null": '{"vendors":null}',
  "gốc là mảng": "[]",
  "gốc là null": "null",
  "gốc là số": "42",
  "khoá vendor lệch tên": '{"reviews":{"' + ap[1] + '":{"state":"pending","decision":"approve","action":"accept_place","place_id":"ChIJxxxxxxxx"}}}',
};
const base = "/api/admin/vendor-enrich";
const out = {};
for (const [name, text] of Object.entries(CASES)) {
  const bucket = new L.MemoryBucket();
  bucket.data.set(KEY, text);
  const env = L.makeEnv(bucket);
  const s = (r) => ({ status: r.status, error: r.json?.error ?? null, count: r.json?.count ?? null });
  const list = s(await L.asAdmin(env, "GET", `${base}?limit=1`));
  const exp = s(await L.asAdmin(env, "GET", `${base}/export`));
  const put = s(await L.asAdmin(env, "PUT", `${base}/${ap[0]}/review`, { decision: "approve" }));
  const del = s(await L.asAdmin(env, "DELETE", `${base}/${ap[1]}/review`));
  out[name] = { list, export: exp, put, del, unchanged: bucket.data.get(KEY) === text };
}
console.log(JSON.stringify(out));
process.exit(0);
