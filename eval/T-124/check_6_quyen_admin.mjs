#!/usr/bin/env node
// T-124 tiêu chí 6 (repo tohong-back): chỉ admin nền tảng (ADMIN_USER_IDS) dùng được bảng enrich; mọi người khác nhận 403 {"error":"forbidden"} và không ghi gì.
// Chạy: node eval/T-124/check_6_quyen_admin.mjs   (TOHONG_BACK_REPO hoặc ../tohong-back). Đường dẫn: GET /api/admin/vendor-enrich, GET .../export, PUT và DELETE .../<id>/review.
// Người gọi bị chặn: không token; token rác; token dev của user không phải admin; admin hợp lệ nhưng ADMIN_USER_IDS rỗng hoặc thiếu; token dev khi DEV_AUTH_BYPASS tắt.
// Đo: mọi tổ hợp (đường dẫn x người gọi) trả đúng 403 + thân {"error":"forbidden"} (không lộ gì về dữ liệu); sau toàn bộ lần gọi R2 không có lần ghi nào; admin thật vẫn gọi được (200).
import fs from "node:fs";
import path from "node:path";
import { BACK, MemoryBucket, makeEnv, call, reporter, outbound } from "./lib/back.mjs";

const R = reporter();
const fp = path.join(BACK, "lib", "vendorEnrichReport.generated.js");
if (!fs.existsSync(fp)) { console.log("FAIL thiếu lib/vendorEnrichReport.generated.js ở tohong-back"); process.exit(1); }
const rep = JSON.parse(fs.readFileSync(fp, "utf8").match(/export\s+const\s+VENDOR_ENRICH_REPORT\s*=\s*([\s\S]*?);\s*$/)[1]);
const id = rep.vendors.find((r) => r.approvable && !r.override).id;
const base = "/api/admin/vendor-enrich";
const routes = [["GET", base], ["GET", `${base}?filter=full`], ["GET", `${base}/export`], ["PUT", `${base}/${id}/review`, { decision: "approve" }],
  ["PUT", `${base}/${id}/review`, { decision: "manual", action: "remove", note: "x" }], ["DELETE", `${base}/${id}/review`], ["GET", `${base}/khong-co-duong-nay`]];
const bucket = new MemoryBucket();
const callers = [
  ["không token", makeEnv(bucket), undefined],
  ["token rác", makeEnv(bucket), "khong-phai-token"],
  ["user không phải admin", makeEnv(bucket), "dev:user_other"],
  ["admin nhưng ADMIN_USER_IDS rỗng", makeEnv(bucket, { ADMIN_USER_IDS: "" }), "dev:user_admin"],
  ["admin nhưng ADMIN_USER_IDS thiếu", (() => { const e = makeEnv(bucket); delete e.ADMIN_USER_IDS; return e; })(), "dev:user_admin"],
  ["token dev khi DEV_AUTH_BYPASS tắt", makeEnv(bucket, { DEV_AUTH_BYPASS: "" }), "dev:user_admin"],
];
for (const [cn, env, token] of callers) {
  for (const [method, p, body] of routes) {
    const r = await call(env, method, p, { token, body });
    R.check(`${cn} · ${method} ${p.replace(base, "…")} -> 403 forbidden`, r.status === 403 && r.json?.error === "forbidden" && Object.keys(r.json).length === 1, [r.status, r.text.slice(0, 80)]);
  }
}
R.check("bị chặn thì R2 không có lần ghi nào", bucket.putLog.length === 0, bucket.putLog);
const ok = await call(makeEnv(bucket), "GET", base, { token: "dev:user_admin" });
R.check("admin trong ADMIN_USER_IDS vẫn gọi được (200)", ok.status === 200, ok.status);
const ex = await call(makeEnv(bucket), "GET", `${base}/export`, { token: "dev:user_admin" });
R.check("sau các lần bị chặn, export của admin trống (không review nào lọt vào)", ex.status === 200 && ex.json?.count === 0, ex.json);
R.check("không gọi mạng ra ngoài", outbound.length === 0, outbound);
R.done();
