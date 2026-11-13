// T-152: khung dùng chung cho eval back (worker thật + R2 giả trong bộ nhớ; mạng bị chặn). Dựa trên eval/T-147/lib/back147.mjs.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BACK, load, embedded, outbound, reporter, OVERLAY_KEY, copyBack } from "../../T-147/lib/back147.mjs";
export { BACK, load, embedded, outbound, reporter, OVERLAY_KEY, copyBack };

export const A1 = "user_sua_1", A2 = "user_sua_2", OUT = "user_ngoai";
export const STYLES = ["luxury", "rustic", "natural", "modern", "traditional", "minimalist", "soft", "simple", "editorial", "korean"];
export const pool = () => embedded(BACK, "vendorPool.generated.js", "GENERATED_VENDOR_POOL");
export const env = (bucket, extra = {}) => ({ CHAT_DATA: bucket, DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: `${A1},${A2}`, CAPU_USER_IDS: "user_capu", ...extra });
export const tok = (u) => `dev:${u}`;

/** Vendor thử: một venue (có capacity) và một vendor có ảnh Google (kèm attribution) khác venue. */
export function pick(P = pool()) {
  const venue = P.find((v) => v.category === "venue" && v.capacity && v.photos?.length && !v.photos.some((p) => p.source === "google"));
  const googleV = P.find((v) => v.category !== "venue" && v.photos?.some((p) => p.source === "google" && p.attribution));
  const photog = P.find((v) => v.category === "photography" && v.id !== googleV?.id);
  return { venue, googleV, photog };
}
export async function boot() {
  const B = await load(BACK);
  const bucket = new B.MemoryBucket();
  const e = env(bucket);
  const put = (id, body, u = A1, ev = e) => B.call(ev, "PUT", `/api/admin/vendors/${id}/override`, { token: tok(u), body });
  const del = (id, body, u = A1, ev = e) => B.call(ev, "DELETE", `/api/admin/vendors/${id}/override`, { token: tok(u), body });
  const info = (id, u = A1, ev = e) => B.call(ev, "GET", `/api/admin/vendors/${id}`, { token: tok(u) });
  const pub = (p, ev = e) => B.call(ev, "GET", p, { token: tok("user_khach") });
  return { B, bucket, e, put, del, info, pub };
}
export async function lib(rel, dir = BACK) { return import(pathToFileURL(path.join(dir, rel)).href); }
export const readText = (p) => fs.readFileSync(p, "utf8");

/** Bản sao repo back với pool đã "sinh lại" (mut nhận mảng pool, sửa tại chỗ); trả thư mục tạm. Dùng chung R2 qua env của bản gốc. */
export function copyWithPool(mut) {
  return copyBack((dir) => {
    const f = path.join(dir, "lib", "vendorPool.generated.js");
    const t = fs.readFileSync(f, "utf8"); const k = "export const GENERATED_VENDOR_POOL = ";
    const i = t.indexOf(k) + k.length; const e = t.indexOf("];", i) + 1; const arr = JSON.parse(t.slice(i, e));
    mut(arr);
    fs.writeFileSync(f, t.slice(0, i) + JSON.stringify(arr) + t.slice(e));
  });
}
export const hasCtl = (s) => /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(s);
