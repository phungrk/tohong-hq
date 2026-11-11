// T-125 adv-01 (trợ giúp): gửi từng maps_link qua API thật của tohong-back (worker.fetch, R2 giả, mạng bị chặn)
// bằng PUT …/<id>/review {decision:"manual", action:"accept_place", maps_link}; in JSON {link: status} ra stdout.
// Đọc danh sách link từ argv[2] (file JSON). Không ghi file nào.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const L = await import(pathToFileURL(path.join(HERE, "..", "..", "T-124", "lib", "back.mjs")).href);
const rep = JSON.parse(fs.readFileSync(path.join(L.BACK, "lib", "vendorEnrichReport.generated.js"), "utf8").match(/VENDOR_ENRICH_REPORT\s*=\s*([\s\S]*?);\s*$/)[1]);
const id = rep.vendors.find((r) => !r.override).id;
const links = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const out = {};
for (const link of links) {
  const env = L.makeEnv(new L.MemoryBucket());
  const r = await L.asAdmin(env, "PUT", `/api/admin/vendor-enrich/${id}/review`, { decision: "manual", action: "accept_place", maps_link: link });
  out[link] = { status: r.status, stored: r.json?.review?.maps_link ?? null, error: r.json?.error ?? null };
}
console.log(JSON.stringify(out));
process.exit(0);
