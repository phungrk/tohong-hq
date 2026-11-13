#!/usr/bin/env node
// T-152 tiêu chí 4 (tohong-back): xung đột khi nguồn đổi + không ghi ngược nguồn.
//  - Admin sửa name/description lúc pool có giá trị P1. Sau đó pool được sinh lại với giá trị P2 (≠ P1; mô phỏng bằng bản sao repo có pool đã đổi, dùng chung R2).
//    Quy tắc: bản sửa của admin THẮNG (giá trị hiệu lực vẫn là bản admin), và GET /api/admin/vendors/<id> báo source_changed = [{field, base: P1, now: P2}] cho đúng các trường đã sửa mà pool đã đổi
//    (trường pool không đổi hoặc không bị sửa thì không có mặt). Bỏ sửa trường đó (null) thì cờ biến mất và giá trị hiệu lực = P2.
//    Sửa lại một trường sau khi pool đổi thì base của trường đó cập nhật thành P2 (cờ biến mất).
//  - Không ghi ngược nguồn: mọi lần ghi R2 nằm dưới data/admin/; repo back không thay đổi byte nào (trừ bản sao tạm).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { boot, pick, pool, load, BACK, A1, env, tok, copyBack, readText, reporter, outbound } from "./lib/back152.mjs";
const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ khi chạy (hợp đồng chưa đúng?): " + String(e && e.message).slice(0, 200)); process.exit(1); });
const hashDir = (d) => { const h = crypto.createHash("sha256"); const walk = (p) => { for (const n of fs.readdirSync(p).sort()) { if (n === "node_modules" || n === ".git") continue; const f = path.join(p, n); const s = fs.statSync(f); if (s.isDirectory()) walk(f); else h.update(n).update(fs.readFileSync(f)); } }; walk(d); return h.digest("hex"); };
const h0 = hashDir(BACK);
const { bucket, put, info, doc } = await boot();
const { venue } = pick();
const r1 = await put(venue.id, { expected_version: 0, name: "Tên admin ZZ", description: "Mô tả admin ZZ", styles: ["soft"] });
R.check("sửa name, description, styles lúc pool = P1: 200", r1.status === 200, [r1.status, r1.text.slice(0, 100)]);
R.check("lúc pool chưa đổi: source_changed rỗng", ((await info(venue.id)).json?.source_changed || []).length === 0 && Array.isArray((await info(venue.id)).json?.source_changed));
// bản sao với pool đã sinh lại: name P2, description giữ P1, styles P2
const P2name = venue.name + " (đổi tên nguồn)";
const tmp = copyBack((dir) => {
  const f = path.join(dir, "lib", "vendorPool.generated.js");
  const t = readText(f); const i = t.indexOf("export const GENERATED_VENDOR_POOL = ") + "export const GENERATED_VENDOR_POOL = ".length;
  const e = t.indexOf("];", i) + 1; const arr = JSON.parse(t.slice(i, e));
  const x = arr.find((v) => v.id === venue.id); x.name = P2name; x.styles = ["modern"]; x.tags = ["modern"];
  fs.writeFileSync(f, t.slice(0, i) + JSON.stringify(arr) + t.slice(e));
});
const B2 = await load(tmp);
const e2 = env(bucket); // cùng R2
await bucket.put("data/admin/_noop", "{}");
const gi = async () => (await B2.call(e2, "GET", `/api/admin/vendors/${venue.id}`, { token: tok(A1) })).json || {};
let i2 = await gi();
const sc = i2.source_changed || [];
const byField = Object.fromEntries(sc.map((x) => [x.field, x]));
R.check("pool đổi: source_changed có name (base P1 -> now P2) và styles, KHÔNG có description (nguồn không đổi)", byField.name?.base === venue.name && byField.name?.now === P2name && JSON.stringify(byField.styles?.base) === JSON.stringify(venue.styles) && JSON.stringify(byField.styles?.now) === '["modern"]' && !byField.description && sc.length === 2, JSON.stringify(sc));
const vv = (await B2.call(e2, "GET", `/api/vendors/${venue.id}`, { token: tok("user_khach") })).json?.vendor || {};
R.check("bản admin thắng: tab Vendor vẫn hiện tên/mô tả/gu của admin dù pool đã đổi", vv.name === "Tên admin ZZ" && vv.description === "Mô tả admin ZZ" && JSON.stringify(vv.styles) === '["soft"]', JSON.stringify(vv).slice(0, 160));
const ver = i2.version;
const rr = await B2.call(e2, "PUT", `/api/admin/vendors/${venue.id}/override`, { token: tok(A1), body: { expected_version: ver, name: null } });
i2 = await gi();
R.check("bỏ sửa name: giá trị hiệu lực = P2 và cờ name biến mất, cờ styles còn", rr.status === 200 && (await B2.call(e2, "GET", `/api/vendors/${venue.id}`, { token: tok("user_khach") })).json?.vendor?.name === P2name && !(i2.source_changed || []).some((x) => x.field === "name") && (i2.source_changed || []).some((x) => x.field === "styles"), JSON.stringify(i2.source_changed));
const rs = await B2.call(e2, "PUT", `/api/admin/vendors/${venue.id}/override`, { token: tok(A1), body: { expected_version: i2.version, styles: ["rustic"] } });
i2 = await gi();
R.check("sửa lại styles sau khi pool đổi: cờ styles biến mất (base cập nhật = P2)", rs.status === 200 && (i2.source_changed || []).length === 0, JSON.stringify(i2.source_changed));
R.check("mọi lần ghi R2 nằm dưới data/admin/", bucket.putLog.every((k) => k.startsWith("data/admin/")), [...new Set(bucket.putLog)]);
R.check("repo back thật không đổi byte nào sau toàn bộ thao tác sửa", hashDir(BACK) === h0);
R.check("không gọi mạng", outbound.length === 0, outbound);
fs.rmSync(tmp, { recursive: true, force: true });
R.done();
