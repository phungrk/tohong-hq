// T-203: khung chung cho eval. Worker thật của tohong-back + R2 giả của chính repo; mạng bị chặn; không ghi gì vào repo.
// Repo back: TOHONG_BACK_REPO, rồi ../tohong-back cạnh gốc HQ (dò ngược tới scripts/gate.py, ADR-070). Không thấy -> in FAIL, thoát 2.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let HQ = HERE; while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
export const BACK = [process.env.TOHONG_BACK_REPO, path.join(HQ, "..", "tohong-back")].filter(Boolean).map((p) => path.resolve(p)).find((p) => fs.existsSync(path.join(p, "worker.js")));
if (!BACK) { console.log("FAIL không thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); process.exit(2); }

export const outbound = [];
globalThis.fetch = async (input) => { const u = typeof input === "string" ? input : input?.url || String(input); outbound.push(u); throw new Error("eval T-203: mạng bị chặn (" + u + ")"); };
const imp = (rel) => import(pathToFileURL(path.join(BACK, rel)).href);
export const { default: worker } = await imp("worker.js");
export const { MemoryBucket } = await imp("test/helpers/memoryBucket.js");
export const { VENDOR_POOL } = await imp("lib/vendorMatcher.js");
export const { resetOverlayCache, loadOverlay } = await imp("lib/vendorOverlay.js");
export const { chatMatch } = await imp("lib/chatMatcher.js");
export const { buildMatchProfile } = await imp("lib/profileBuilder.js");
export const { AUDIT_PREFIX } = await imp("lib/adminStore.js").catch(() => ({ AUDIT_PREFIX: "data/admin/audit/" }));
export const OVERLAY_KEY = "data/admin/vendor_overrides.json";

export const ADMIN = "admin", COUPLE = "couple_1";
export const makeEnv = (bucket, extra = {}) => ({ CHAT_DATA: bucket, DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: ADMIN, CAPU_USER_IDS: "user_capu", ...extra });
export async function call(env, method, p, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const pend = [];
  const res = await worker.fetch(new Request(`http://localhost${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil: (x) => pend.push(x) });
  const text = await res.text();
  await Promise.allSettled(pend);
  let json = null; try { json = JSON.parse(text); } catch { /* không phải JSON */ }
  return { status: res.status, json, text };
}
export const asAdmin = (env) => (method, p, body) => call(env, method, p, { token: `dev:${ADMIN}`, body });
export const asCouple = (env) => (method, p, body) => call(env, method, p, { token: `dev:${COUPLE}`, body });

// Môi trường mới: bucket trống, cache overlay sạch, vài khoá "dữ liệu người dùng" gieo sẵn (nội dung tuỳ ý; eval chỉ so từng byte).
export function fresh() {
  resetOverlayCache();
  const bucket = new MemoryBucket();
  const guard = {
    "couples/couple_1/profile.json": JSON.stringify({ confirmed: { photography: "VENDOR_ID" }, note: "đã lưu" }),
    "couples/couple_1/budget.json": JSON.stringify({ allocations: { photography: 20 } }),
    "conversations/couple_1/c1.json": JSON.stringify({ messages: [{ role: "assistant", text: "gợi ý VENDOR_ID" }] }),
  };
  return { bucket, env: makeEnv(bucket), guard };
}
export const snapshot = (bucket) => new Map(bucket.data);
// Khác biệt khoá giữa hai ảnh chụp: { added, removed, changed }
export function diff(a, b) {
  const added = [...b.keys()].filter((k) => !a.has(k)), removed = [...a.keys()].filter((k) => !b.has(k));
  const changed = [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k));
  return { added, removed, changed };
}

// Chọn vendor mục tiêu: ứng viên đầu của bộ ghép chat (thuộc pool, đủ điều kiện hiện ra với cặp đôi). Cần overlay đã nạp.
export async function pickTarget(env, category = "photography") {
  await loadOverlay(env, { force: true });
  const mp = buildMatchProfile({ coupleState: {}, userMessage: "", intent: { category }, guests: null });
  const r = chatMatch(mp);
  const ids = (r.matches || []).map((m) => m.vendor_id || m.vendor?.id).filter(Boolean);
  const uniq = ids.filter((id) => VENDOR_POOL.filter((v) => v.name === VENDOR_POOL.find((x) => x.id === id)?.name).length === 1);
  return { ids, id: uniq[0] || ids[0], category, mp };
}
export const chatIds = async (env, mp) => { await loadOverlay(env, { force: true }); return (chatMatch(mp).matches || []).map((m) => m.vendor_id || m.vendor?.id); };

export function reporter() {
  const fails = [];
  return {
    check(name, ok, extra) { console.log(`${ok ? "  ok " : "  XX "} ${name}${!ok && extra !== undefined ? "  :: " + String(JSON.stringify(extra) ?? extra).slice(0, 200) : ""}`); if (!ok) fails.push(name + (extra !== undefined ? " [" + String(JSON.stringify(extra) ?? extra).slice(0, 140) + "]" : "")); },
    done() {
      if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ""}`); process.exit(1); }
      console.log("PASS"); process.exit(0);
    },
  };
}
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ khi chạy (hành vi chưa đúng?): " + String(e && e.message).slice(0, 200)); process.exit(1); });
process.on("unhandledRejection", (e) => { console.log("FAIL từ chối chưa xử lý (hành vi chưa đúng?): " + String(e && e.message).slice(0, 200)); process.exit(1); });

// Hợp đồng API (spec products/T-203-xoa-vendor-khoi-phuc.md §Hợp đồng)
export const DEL = (id) => `/api/admin/vendors/${id}/delete`;
export const RES = (id) => `/api/admin/vendors/${id}/restore`;
export const DETAIL = (id) => `/api/admin/vendors/${id}`;
export const LIST = (qs = "") => `/api/admin/vendors?limit=200${qs ? "&" + qs : ""}`;
export async function listAll(A, qs = "") { // đọc hết mọi trang (limit 200)
  const rows = []; let total = 0;
  for (let off = 0; ; off += 200) {
    const r = await A("GET", `/api/admin/vendors?limit=200&offset=${off}${qs ? "&" + qs : ""}`);
    if (r.status !== 200) return { status: r.status, rows, total: null, json: r.json };
    total = r.json.total; rows.push(...r.json.vendors);
    if (r.json.vendors.length === 0 || rows.length >= total) break;
  }
  return { status: 200, rows, total };
}
// Bản sửa của vendor bỏ metadata (version, updated_*) và mọi khoá deleted* (cờ xoá không thuộc "trạng thái trước").
export const meta = (o) => { if (!o) return o; const out = {}; for (const [k, v] of Object.entries(o)) if (!["version", "updated_at", "updated_by"].includes(k) && !k.startsWith("deleted")) out[k] = v; return out; };
