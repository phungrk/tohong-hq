// T-217 (ADR-138): khung chạy hành vi back (api/vendors.js, buildChatContext) trên bản sao tạm của TOHONG_BACK_REPO (mặc định ../tohong-back) với pool THẬT
// cộng vài vendor venue "sinh đôi" được đặt nguồn giá verified (đúng dạng generator ghi: priceSource "verified", KHÔNG có priceAsOf). Không mạng, không ghi repo thật.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HQ = path.resolve(HERE, "..", "..");
export const BACK = [process.env.TOHONG_BACK_REPO, path.join(HQ, "..", "tohong-back")].filter(Boolean).map((p) => path.resolve(p)).find((p) => fs.existsSync(path.join(p, "lib", "contextBuilder.js")));
if (!BACK) { console.log("FAIL không thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); process.exit(2); }
const tmps = [];
process.on("exit", () => { for (const t of tmps) fs.rmSync(t, { recursive: true, force: true }); });

export const CID = "c1";
export const AUTH = { userId: "u1" };
export const coupleProfile = (extra = {}) => ({ couple: { city: "HCMC", wedding_date: "2029-03-20" }, preferences: { style_tags: [] }, ...extra });
export const ids = {};

/** Nạp back từ bản sao tạm; pool = pool thật + 4 venue sinh đôi: VA (Bạch Kim: 3,4tr/bàn, sức chứa 100-3000), VB (6,37168 tr/bàn như Bình Quới 2) đều priceSource "verified" không priceAsOf;
 *  LC (legacy_marry 4,6 2026-06) và EC (estimate_category 4,6) làm đối chứng. */
export async function loadBack() {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), "t217-back-")); tmps.push(t);
  for (const d of ["lib", "providers", "api"]) if (fs.existsSync(path.join(BACK, d))) fs.cpSync(path.join(BACK, d), path.join(t, d), { recursive: true });
  fs.cpSync(path.join(BACK, "test", "helpers"), path.join(t, "test", "helpers"), { recursive: true });
  fs.cpSync(path.join(BACK, "package.json"), path.join(t, "package.json"));
  fs.symlinkSync(fs.realpathSync(path.join(BACK, "node_modules")), path.join(t, "node_modules"));
  const f = path.join(t, "lib", "vendorPool.generated.js"); const txt = fs.readFileSync(f, "utf8");
  const k = "export const GENERATED_VENDOR_POOL = "; const i = txt.indexOf(k) + k.length; const e = txt.indexOf("];", i) + 1; const arr = JSON.parse(txt.slice(i, e));
  const tw = arr.filter((v) => v.category === "venue" && v.isVerified && v.city === "HCMC" && v.priceSource !== "verified").slice(0, 4);
  for (const v of tw) Object.assign(v, { rating: 0, reviewCount: 0, styles: [], tags: [], availability: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] });   // sinh đôi: điểm chỉ khác ở giá
  const set = (v, p) => { for (const x of ["priceMin", "priceMax", "priceSource", "priceAsOf"]) delete v[x]; Object.assign(v, p); };
  set(tw[0], { priceMin: 3.4, priceMax: 3.4, priceSource: "verified" }); tw[0].capacity = { min: 100, max: 3000 }; ids.VA = tw[0].id;
  set(tw[1], { priceMin: 6.37168, priceMax: 6.37168, priceSource: "verified" }); ids.VB = tw[1].id;
  set(tw[2], { priceMin: 4.6, priceMax: 4.6, priceSource: "legacy_marry", priceAsOf: "2026-06" }); ids.LC = tw[2].id;
  set(tw[3], { priceMin: 4.6, priceMax: 4.6, priceSource: "estimate_category", priceAsOf: "2026-06" }); ids.EC = tw[3].id;
  for (const v of tw) v.capacity = v.capacity || { min: 100, max: 3000 };
  fs.writeFileSync(f, txt.slice(0, i) + JSON.stringify(arr) + txt.slice(e));
  const imp = (p) => import(pathToFileURL(path.join(t, p)).href);
  const [cc, mb, vm, vo, vapi] = await Promise.all([imp("lib/contextBuilder.js"), imp("test/helpers/memoryBucket.js"), imp("lib/vendorMatcher.js"), imp("lib/vendorOverlay.js"), imp("api/vendors.js")]);
  return { buildChatContext: cc.buildChatContext, MemoryBucket: mb.MemoryBucket, POOL: vm.VENDOR_POOL, resetOverlayCache: vo.resetOverlayCache, handleVendors: vapi.handleVendors };
}

const seed = (M, { profile, overlay }) => {
  const b = new M.MemoryBucket();
  if (profile) b.data.set(`data/couples/${CID}/profile.yaml`, JSON.stringify(profile));
  if (overlay) b.data.set("data/admin/vendor_overrides.json", JSON.stringify({ seq: 1, vendors: overlay }));
  b.data.set(`data/couples/${CID}/members.json`, JSON.stringify([{ user_id: AUTH.userId, role: "owner" }]));
  return b;
};
const guard = async (fn) => { const of = globalThis.fetch, ow = console.warn; globalThis.fetch = async (u) => { throw new Error("không được gọi mạng: " + u); }; console.warn = () => {}; try { return await fn(); } finally { globalThis.fetch = of; console.warn = ow; } };

/** Một request vào api/vendors.js: method GET/POST, url, body. Trả { status, body }. */
export async function api(M, { method = "GET", url, body, profile = coupleProfile(), overlay = null }) {
  const b = seed(M, { profile, overlay }); M.resetOverlayCache();
  const u = new URL("http://localhost" + url);
  const segs = u.pathname.replace(/^\/api\/vendors\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  return guard(async () => {
    try {
      const res = await M.handleVendors(new Request(u, { method, ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}) }), { CHAT_DATA: b }, AUTH, segs);
      return { status: res.status, body: await res.json() };
    } catch (err) { return { err, status: 0, body: null }; }
  });
}
export const match = (M, category, o = {}) => api(M, { url: `/api/vendors/match?coupleId=${CID}&category=${category}&limit=50`, ...o });
export async function chat(M, { message, profile, overlay = null }) {
  const b = seed(M, { profile, overlay }); M.resetOverlayCache();
  return guard(async () => {
    try { const r = await M.buildChatContext({ CHAT_DATA: b }, CID, null, message, null, AUTH.userId); return { ids: (r.matchMetadata?.matches || []).map((m) => m.vendor_id), md: r.matchMetadata, sp: r.systemPrompt }; }
    catch (err) { return { err, ids: [], md: null, sp: "" }; }
  });
}
export const hide = (M, keep) => Object.fromEntries(M.POOL.filter((v) => v.category === "venue" && !keep.includes(v.id)).map((v) => [v.id, { hidden: true, hidden_reason: "eval T-217" }]));
export const near = (x, y) => typeof x === "number" && Math.abs(x - y) < 0.011;
export function done(fails) { if (fails.length) { console.log("FAIL " + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : "")); process.exit(1); } console.log("PASS"); }
