// T-140 tiêu chí 7: tab Vendor không đổi hành vi: computeMatches với tham số cũ (category/limit/offset/minScore) trả đúng như trước T-140
// (ảnh chụp fixtures/tab-golden.json lấy từ main @ 2026-11-13, pool đông cứng): không nới điều kiện, không MMR, thứ tự/total/whyThoseVendors y nguyên.
import { frozenRoot, load, HERE, done } from "./_lib.mjs";
import { readFileSync } from "fs"; import { createHash } from "crypto"; import path from "path";
const M = await load(frozenRoot());
const golden = JSON.parse(readFileSync(path.join(HERE, "fixtures", "tab-golden.json"), "utf8")); const fails = [];
for (const g of golden.cases) {
  M.resetOverlayCache();
  const out = M.computeMatches(g.profile, g.opts);
  const h = createHash("sha256").update(JSON.stringify(out)).digest("hex");
  if (h !== g.sha256) fails.push(`${g.label}: kết quả tab đổi (ids ${out.vendors.slice(0, 3).map((v) => v.id).join(",")}…, total ${out.total}; trước ${g.total})`);
}
done(fails);
