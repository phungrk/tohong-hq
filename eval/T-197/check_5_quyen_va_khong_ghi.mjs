#!/usr/bin/env node
// T-197 tiêu chí 5 (repo tohong-back): tham số `status` không mở thêm quyền, không ghi dữ liệu, không đổi phản hồi khi không dùng.
//  (a) người không phải admin (không token, token rác, người thường, người chỉ có trong CAPU_USER_IDS) gọi list kèm status (hợp lệ HOẶC lạ) nhận 403 {"error":"forbidden"}, giống từng byte bản không có status;
//  (b) GET kèm status (mọi giá trị hợp lệ) không ghi R2, không gọi mạng; phản hồi có Cache-Control no-store; hàng trả về mang đúng `review` như bản không lọc (không đổi dữ liệu);
//  (c) POST/PUT/DELETE trên đường dẫn danh sách kèm status vẫn 405, như không có status.
// Chạy từ gốc tohong-hq: node eval/T-197/check_5_quyen_va_khong_ghi.mjs
import { STATUS, expected, MemoryBucket, makeEnv, call, as, seed, pickSeeds, reporter, outbound, ADMIN, OTHER } from "./lib/common.mjs";

const R = reporter();
const bucket = new MemoryBucket();
const env = makeEnv(bucket, { ADMIN_USER_IDS: ADMIN }); // CAPU_USER_IDS vẫn là user_capu, nhưng user_capu KHÔNG là admin ở env này
const env0 = makeEnv(bucket, { ADMIN_USER_IDS: `${ADMIN},user_capu` });
const st = await seed(env0, pickSeeds("small"));
const LIST = "/api/admin/vendor-enrich";
const WHO = [["không token", undefined], ["token rác", "khong-phai-token"], ["người thường", `dev:${OTHER}`], ["người chỉ là Capu, không phải admin", "dev:user_capu"]];
for (const [wn, token] of WHO) {
  const base = await call(env, "GET", LIST, { token });
  R.check(`${wn}: không status -> 403 {"error":"forbidden"}`, base.status === 403 && base.text === '{"error":"forbidden"}', [base.status, base.text.slice(0, 50)]);
  for (const s of ["pending_capu", "override", "full", "khong_co_gia_tri_nay", ""]) {
    const r = await call(env, "GET", `${LIST}?status=${s}`, { token });
    R.check(`${wn}: status=${JSON.stringify(s)} -> giống từng byte (403)`, r.status === 403 && r.text === base.text, [r.status, r.text.slice(0, 60)]);
  }
}
const puts0 = bucket.putLog.length, reads0 = bucket.reads.length;
const base = await as(ADMIN)(env0, "GET", `${LIST}?limit=100&offset=0`);
const byIdBase = new Map(); // review của từng hàng trong bản không lọc (cả 9 trang)
for (let off = 0; off < base.json.total; off += 100) { const p = await as(ADMIN)(env0, "GET", `${LIST}?limit=100&offset=${off}`); for (const x of p.json.rows) byIdBase.set(x.id, x); }
for (const [key] of STATUS) {
  const r = await as(ADMIN)(env0, "GET", `${LIST}?status=${key}&limit=100`);
  R.check(`admin, status=${key}: 200 và Cache-Control no-store`, r.status === 200 && /no-store/.test(r.headers.get("Cache-Control") || ""), [r.status, r.headers.get("Cache-Control")]);
  R.check(`admin, status=${key}: lọc có hiệu lực (total ${expected(st, { status: key }).length}), nên các kiểm dưới đo hàng đã lọc chứ không phải cả danh sách`, r.json.total === expected(st, { status: key }).length, r.json.total);
  R.check(`admin, status=${key}: mỗi hàng giống hệt hàng cùng id ở bản không lọc (không đổi dữ liệu)`, r.json.rows.every((x) => JSON.stringify({ ...x, n: 0 }) === JSON.stringify({ ...byIdBase.get(x.id), n: 0 })), r.json.rows[0]?.id);
}
R.check("đọc với mọi status không ghi R2", bucket.putLog.length === puts0, bucket.putLog.length - puts0);
R.check("(đã đọc kho review, không đọc nơi khác ngoài kho admin)", bucket.reads.length > reads0 && bucket.reads.every((k) => /^data\/admin\//.test(k) || /admin|enrich|overlay|vendor/i.test(k)), [...new Set(bucket.reads)].slice(0, 6));
for (const m of ["POST", "PUT", "DELETE", "PATCH"]) {
  const a = await as(ADMIN)(env0, m, LIST, m === "DELETE" ? undefined : {});
  const b = await as(ADMIN)(env0, m, `${LIST}?status=full`, m === "DELETE" ? undefined : {});
  R.check(`${m} trên đường dẫn danh sách kèm status: ${a.status}, giống không có status`, a.status === 405 && b.status === a.status && b.text === a.text, [a.status, b.status]);
}
R.check("không ghi R2 sau mọi lời gọi trên", bucket.putLog.length === puts0, bucket.putLog.length - puts0);
R.check("không gọi mạng ra ngoài", outbound.length === 0, outbound);
R.done();
