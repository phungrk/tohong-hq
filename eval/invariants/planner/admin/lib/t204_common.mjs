// T-204: khung chung cho eval. Worker thật + R2 giả của chính repo tohong-back; mạng bị chặn; không ghi gì vào repo.
// Dò ngược tới gốc HQ (thư mục có scripts/gate.py, ADR-070), không đếm cấp. Repo back: TOHONG_BACK_REPO, rồi ../tohong-back cạnh gốc HQ.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let HQ = path.dirname(fileURLToPath(import.meta.url));
while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
export { HQ };
export const BACK = [process.env.TOHONG_BACK_REPO, path.join(HQ, "..", "tohong-back")].filter(Boolean).map((p) => path.resolve(p)).find((p) => fs.existsSync(path.join(p, "worker.js")));
if (!BACK) { console.log("FAIL không thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); process.exit(2); }

export const outbound = [];
globalThis.fetch = async (input) => { const u = typeof input === "string" ? input : input?.url || String(input); outbound.push(u); throw new Error("eval T-204: mạng bị chặn (" + u + ")"); };
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ khi chạy (hành vi chưa đúng?): " + String(e && e.message).slice(0, 200)); process.exit(1); });
const imp = (rel) => import(pathToFileURL(path.join(BACK, rel)).href);
export const { default: worker } = await imp("worker.js");
export const { MemoryBucket } = await imp("test/helpers/memoryBucket.js");
export const { REVIEWS_KEY } = await imp("lib/vendorEnrichReviews.js");

export const FIXED = "admin-khong-dang-nhap";
// Nhãn người duyệt của danh tính cố định: "admin:" + 8 hex đầu của SHA-256("admin-khong-dang-nhap") (tính độc lập ở đây, không đọc từ code back).
export const labelOf = (u) => "admin:" + crypto.createHash("sha256").update(u).digest("hex").slice(0, 8);
export const FIXED_LABEL = labelOf(FIXED);
export const VIA = "admin_open";
export const ADM = "user_admin_that", CAPU = "user_capu_that"; // Clerk id giả, dạng thật
export const TOK = "t204-khoa-may-0123456789abcdef";

const rep = JSON.parse(fs.readFileSync(path.join(BACK, "lib", "vendorEnrichReport.generated.js"), "utf8").match(/VENDOR_ENRICH_REPORT\s*=\s*([\s\S]*?);\s*$/)[1]);
export const FREE = rep.vendors.filter((r) => !r.override);
export const APPR = FREE.filter((r) => r.approvable);
export const pickIds = (n, arr = APPR, skip = 0) => arr.slice(skip, skip + n).map((r) => r.id);

const keyPair = crypto.generateKeyPairSync("ed25519");
export const PUB = keyPair.publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("base64");
export const SIGN = { ENRICH_EXPORT_TOKEN: TOK, ENRICH_SIGNING_KEY: keyPair.privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"), ENRICH_SIGNING_KEY_ID: "k204" };
// flag: undefined = thiếu biến; chuỗi = giá trị đúng như Cloudflare đưa vào.
export const mkEnv = (bucket, flag, extra = {}) => ({ CHAT_DATA: bucket, DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: ADM + "," + CAPU, CAPU_USER_IDS: CAPU, ...SIGN, ...(flag === undefined ? {} : { ADMIN_OPEN: flag }), ...extra });

export async function call(env, method, p, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = "Bearer " + token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const pend = [];
  const res = await worker.fetch(new Request("http://localhost" + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil: (x) => pend.push(x) });
  const text = await res.text();
  await Promise.allSettled(pend);
  let json = null; try { json = JSON.parse(text); } catch { /* không phải JSON */ }
  return { status: res.status, json, text };
}
export const BASE = "/api/admin/vendor-enrich";
export const review = (env, id, body, token) => call(env, "PUT", `${BASE}/${id}/review`, { token, body });
export const withdraw = (env, id, token) => call(env, "DELETE", `${BASE}/${id}/review`, { token });
export const exportOf = (env) => call(env, "GET", "/api/internal/vendor-enrich/export", { token: TOK });
export async function listAll(env, status, token) {
  const out = [];
  for (let off = 0; ; off += 100) {
    const r = await call(env, "GET", `${BASE}?status=${status}&limit=100&offset=${off}`, { token });
    if (r.status !== 200) return { status: r.status, rows: out };
    out.push(...r.json.rows);
    if (!r.json.rows.length || out.length >= r.json.total) return { status: 200, rows: out };
  }
}

// ---- gieo kho review như TRƯỚC T-204 (bản ghi đã nằm trong R2) ----
export const T0 = "2026-11-18T10:00:00.000Z";
export function stored(id, by, byCapu, extra = {}) {
  const row = rep.vendors.find((r) => r.id === id);
  const rv = { state: "pending", decision: "approve", action: "accept_place", place_id: row.google.place_id, reason: `Admin duyệt nhận khớp Google: ${row.google.name || row.google.place_id}`, reviewed_by: by, reviewed_at: T0, ...extra };
  if (byCapu !== undefined) rv.by_capu = byCapu;
  return rv;
}
export const seedReviews = (bucket, vendors) => bucket.seedJson(REVIEWS_KEY, { vendors });

export const fixedOf = (items) => items.filter((e) => e);
export function reporter() {
  const fails = [];
  const check = (n, ok, x) => {
    console.log(`${ok ? "  ok " : "  XX "} ${n}${!ok && x !== undefined ? "  :: " + String(typeof x === "string" ? x : JSON.stringify(x)).slice(0, 240) : ""}`);
    if (!ok) fails.push(n + (x === undefined ? "" : " [" + String(typeof x === "string" ? x : JSON.stringify(x)).slice(0, 140) + "]"));
  };
  const done = () => {
    check("không gọi mạng ra ngoài", outbound.length === 0, outbound);
    if (fails.length) { console.log("FAIL " + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : "")); process.exit(1); }
    console.log("PASS"); process.exit(0);
  };
  return { check, done };
}
// Kiểm chữ ký một entry export theo định nghĩa chuẩn (eval/lib/capu_decision.py): "tohong-enrich-review-v1|" + len:utf8, ...
export function sigOk(e) {
  const enc = new TextEncoder();
  const parts = [enc.encode("tohong-enrich-review-v1|")];
  for (const f of [e.key_id, e.vendor_id, e.action, e.maps_link ? "" : e.place_id || "", e.maps_link || "", e.reason, e.reviewer_label, e.reviewed_at]) { const b = enc.encode(String(f)); parts.push(enc.encode(`${b.length}:`), b, enc.encode(",")); }
  const data = Buffer.concat(parts);
  const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(PUB, "base64")]);
  try { return crypto.verify(null, data, crypto.createPublicKey({ key: spki, format: "der", type: "spki" }), Buffer.from(String(e.sig), "base64url")); } catch { return false; }
}
