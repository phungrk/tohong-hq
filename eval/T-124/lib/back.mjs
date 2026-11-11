// T-124: khung chạy API admin thật (worker.fetch) với bucket R2 giả trong bộ nhớ. Không mạng thật: fetch toàn cục bị chặn và ghi lại.
// Repo back: TOHONG_BACK_REPO, rồi ../tohong-back cạnh tohong-hq. In FAIL + thoát 2 nếu không tìm thấy.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HQ = path.resolve(HERE, "..", "..", "..");
export const BACK = [process.env.TOHONG_BACK_REPO, path.join(HQ, "..", "tohong-back")]
  .filter(Boolean).map((p) => path.resolve(p)).find((p) => fs.existsSync(path.join(p, "worker.js")));
export const TOHONG = [process.env.TOHONG_REPO, path.join(HQ, "..", "tohong")]
  .filter(Boolean).map((p) => path.resolve(p)).find((p) => fs.existsSync(path.join(p, "tools", "scraper", "enrich.py")));
if (!BACK) { console.log("FAIL không thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); process.exit(2); }

export const outbound = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const u = typeof input === "string" ? input : input?.url || String(input);
  outbound.push(u);
  throw new Error("eval T-124: mạng bị chặn (" + u + ")");
};
export const restoreFetch = () => { globalThis.fetch = realFetch; };

const imp = (rel) => import(pathToFileURL(path.join(BACK, rel)).href);
export const { default: worker } = await imp("worker.js");
export const { MemoryBucket } = await imp("test/helpers/memoryBucket.js");

export const ADMIN = "user_admin";
export const OTHER = "user_other";
export const REVIEWS_KEY_HINT = /vendor_enrich|enrich/i; // khoá R2 mới phải có "enrich" trong tên (spec: data/admin/vendor_enrich_reviews.json)
export function makeEnv(bucket, extra = {}) {
  return { CHAT_DATA: bucket, DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: ADMIN, ...extra };
}
export async function call(env, method, p, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const pend = [];
  const res = await worker.fetch(new Request(`http://localhost${p}`, { method, headers, body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)) }), env, { waitUntil: (x) => pend.push(x) });
  const text = await res.text();
  await Promise.allSettled(pend);
  let json = null; try { json = JSON.parse(text); } catch { /* không phải JSON */ }
  return { status: res.status, json, text };
}
export const asAdmin = (env, method, p, body) => call(env, method, p, { token: `dev:${ADMIN}`, body });

export function reporter() {
  const fails = [];
  return {
    check(name, ok, extra) { if (!ok) fails.push(name + (extra !== undefined ? " [" + String(JSON.stringify(extra) ?? extra).slice(0, 160) + "]" : "")); },
    done() {
      if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ""}`); process.exit(1); }
      console.log("PASS"); process.exit(0);
    },
  };
}
