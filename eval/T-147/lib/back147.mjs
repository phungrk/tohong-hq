// T-147: khung chạy API admin thật (worker.fetch) của một repo back (hoặc bản sao tạm) với R2 giả trong bộ nhớ. Không mạng thật: fetch toàn cục bị chặn và ghi lại.
// Repo back: TOHONG_BACK_REPO, rồi ../tohong-back cạnh tohong-hq. Không thấy thì in FAIL và thoát 2.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HQ = path.resolve(HERE, "..", "..", "..");
export const BACK = [process.env.TOHONG_BACK_REPO, path.join(HQ, "..", "tohong-back")]
  .filter(Boolean).map((p) => path.resolve(p)).find((p) => fs.existsSync(path.join(p, "worker.js")));
if (!BACK) { console.log("FAIL không thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); process.exit(2); }

export const outbound = [];
globalThis.fetch = async (input) => {
  const u = typeof input === "string" ? input : input?.url || String(input);
  outbound.push(u);
  throw new Error("eval T-147: mạng bị chặn (" + u + ")");
};

export const ADMIN = "user_admin";
export const CAPU = "user_capu";
export const OVERLAY_KEY = "data/admin/vendor_overrides.json";

/** Nạp worker của một thư mục back (mỗi thư mục một đồ thị module riêng nên bản sao tạm không lẫn với repo thật). */
export async function load(dir = BACK) {
  const imp = (rel) => import(pathToFileURL(path.join(dir, rel)).href);
  const { default: worker } = await imp("worker.js");
  const { MemoryBucket } = await imp("test/helpers/memoryBucket.js");
  async function call(env, method, p, { token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const pend = [];
    const res = await worker.fetch(new Request(`http://localhost${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil: (x) => pend.push(x) });
    const text = await res.text();
    await Promise.allSettled(pend);
    let json = null; try { json = JSON.parse(text); } catch { /* không phải JSON */ }
    return { status: res.status, json, text, headers: res.headers };
  }
  // Capu = trong cả ADMIN_USER_IDS lẫn CAPU_USER_IDS; mặc định một người vừa admin vừa Capu.
  const makeEnv = (bucket, extra = {}) => ({ CHAT_DATA: bucket, DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: `${ADMIN},${CAPU}`, CAPU_USER_IDS: CAPU, ...extra });
  return { worker, MemoryBucket, call, makeEnv, asCapu: (env, method, p, body) => call(env, method, p, { token: `dev:${CAPU}`, body }) };
}

/** Đọc JSON nhúng `export const <NAME> = <JSON>;` trong một file lib/*.generated.js. */
export function embedded(dir, file, name) {
  const t = fs.readFileSync(path.join(dir, "lib", file), "utf8");
  const i = t.indexOf("=", t.indexOf("export const " + name)) + 1;
  return JSON.parse(t.slice(i).trim().replace(/;\s*$/, ""));
}

/** Bản sao tạm của repo back (không node_modules, không .git), node_modules nối symlink; trả thư mục. */
export function copyBack(patch) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t147-back-"));
  fs.cpSync(BACK, tmp, { recursive: true, filter: (s) => !/[\\/](\.git|node_modules|\.wrangler)([\\/]|$)/.test(s) });
  const nm = path.join(BACK, "node_modules");
  if (fs.existsSync(nm)) fs.symlinkSync(fs.realpathSync(nm), path.join(tmp, "node_modules"));
  if (patch) patch(tmp);
  return tmp;
}

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
