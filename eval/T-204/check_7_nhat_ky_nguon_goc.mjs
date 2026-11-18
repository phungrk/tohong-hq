// T-204 tiêu chí 7: nhật ký phân biệt được thao tác qua cờ mở admin. Cờ "1": mỗi dòng nhật ký vendor_enrich.review có admin_id cố định, after.by_capu=true, after.via="admin_open"; dòng rút (review_withdraw) admin_id cố định.
// Cờ tắt: Capu thật ghi -> dòng nhật ký không có via. `via` chỉ để tra cứu, KHÔNG quyết định quyền (bản ghi cũ không có via vẫn tính khi cờ bật: xem check_1).
import { reporter, mkEnv, MemoryBucket, pickIds, review, withdraw, call, FIXED, CAPU, VIA } from "./lib/common.mjs";
const R = reporter();
const [a, b, c] = pickIds(3);
const bk = new MemoryBucket();
const on = mkEnv(bk, "1");
const w = await review(on, a, { decision: "approve" });
const w2 = await review(on, b, { decision: "manual", action: "remove", note: "Không có trên Maps" });
await withdraw(on, b);
const log = (await call(on, "GET", "/api/admin/audit?limit=50")).json?.entries || [];
const rev = log.filter((x) => x.action === "vendor_enrich.review");
const wd = log.filter((x) => x.action === "vendor_enrich.review_withdraw");
R.check("2 lần ghi cờ bật thành công", w.status === 200 && w2.status === 200, [w.status, w2.status]);
R.check("2 dòng vendor_enrich.review: admin_id cố định, after.by_capu=true, after.via=admin_open", rev.length === 2 && rev.every((x) => x.admin_id === FIXED && x.after?.by_capu === true && x.after?.via === VIA), rev.map((x) => [x.admin_id, x.after?.by_capu, x.after?.via]));
R.check("dòng rút: admin_id cố định", wd.length === 1 && wd[0].admin_id === FIXED, wd.map((x) => x.admin_id));
const off = mkEnv(bk, undefined);
await review(off, c, { decision: "approve" }, "dev:" + CAPU);
const log2 = (await call(off, "GET", "/api/admin/audit?limit=50", { token: "dev:" + CAPU })).json?.entries || [];
const cap = log2.find((x) => x.action === "vendor_enrich.review" && x.target_id === c);
R.check("cờ tắt, Capu thật ghi: dòng nhật ký có admin_id của Capu, by_capu=true, KHÔNG có via", !!cap && cap.admin_id === CAPU && cap.after?.by_capu === true && !("via" in (cap.after || {})), cap);
R.done();
