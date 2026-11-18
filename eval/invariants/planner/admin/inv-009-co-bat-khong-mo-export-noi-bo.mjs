// T-205 adv-04 (adversary): danh tính cố định nay là Capu khi cờ "1" -> kiểm rằng việc đó KHÔNG mở /api/internal/vendor-enrich/export (ký) bằng đường khác ngoài ENRICH_EXPORT_TOKEN:
// cờ "1" + danh sách rỗng, kho có bản của danh tính cố định: không Bearer / Bearer sai / Bearer "dev:admin-khong-dang-nhap" / token đúng nhưng ENRICH_EXPORT_TOKEN thiếu hoặc < 16 ký tự -> 403, thân không có entries, không ghi R2.
import { reporter, mkEnv, MemoryBucket, seedReviews, stored, pickIds, call, FIXED, TOK } from "./lib/t204_common.mjs";
const R = reporter();
const [a] = pickIds(1);
const P = "/api/internal/vendor-enrich/export";
const CASES = [["không Bearer", {}, undefined], ["Bearer sai", {}, "sai-sai-sai-sai-sai-sai"], ["Bearer dev:danh tính cố định", {}, "dev:" + FIXED], ["Bearer danh tính cố định", {}, FIXED],
  ["ENRICH_EXPORT_TOKEN thiếu", { ENRICH_EXPORT_TOKEN: undefined }, TOK], ["ENRICH_EXPORT_TOKEN rỗng, Bearer rỗng", { ENRICH_EXPORT_TOKEN: "" }, ""], ["ENRICH_EXPORT_TOKEN ngắn", { ENRICH_EXPORT_TOKEN: "ngan" }, "ngan"]];
for (const [tag, extra, tok] of CASES) {
  const bk = new MemoryBucket();
  seedReviews(bk, { [a]: stored(a, FIXED, false) });
  const env = mkEnv(bk, "1", { ADMIN_USER_IDS: "", CAPU_USER_IDS: "", ...extra });
  for (const k of Object.keys(extra)) if (extra[k] === undefined) delete env[k];
  const puts = bk.putLog.length;
  const r = await call(env, "GET", P, { token: tok });
  R.check(`cờ "1", ${tag}: 403, không entries, không ghi R2`, r.status === 403 && !r.text.includes("entries") && !r.text.includes("sig") && bk.putLog.length === puts, [r.status, r.text.slice(0, 100)]);
}
{
  const bk = new MemoryBucket();
  seedReviews(bk, { [a]: stored(a, FIXED, false) });
  const r = await call(mkEnv(bk, "1", { ADMIN_USER_IDS: "", CAPU_USER_IDS: "" }), "GET", P, { token: TOK });
  R.check(`cờ "1", token đúng: 200 và có mục của danh tính cố định (đối chứng)`, r.status === 200 && (r.json?.entries || []).some((e) => e.vendor_id === a), [r.status, r.text.slice(0, 100)]);
}
R.done();
