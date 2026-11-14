// Dùng chung cho eval T-159 (chạy từ gốc tohong-hq; TOHONG_BACK_REPO mặc định ../tohong-back). Không mạng, không Google, không ghi vào repo back.
// Chép lib/ providers/ api/ test/helpers của back sang thư mục tạm, thay pool bằng eval/T-140/fixtures/pool-frozen.json (867 vendor chụp 2026-11-13).
// Chỉ gọi hành vi công khai: buildChatContext (chat), handleVendors (tab Vendor), handleBudget (bảng dự toán) trên R2 giả trong bộ nhớ.
import { pathToFileURL, fileURLToPath } from "url";
import { existsSync, mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync, symlinkSync, realpathSync } from "fs";
import { tmpdir } from "os";
import path from "path";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const HQ = path.resolve(HERE, "..", "..");
export const BACK = [process.env.TOHONG_BACK_REPO, path.join(HQ, "..", "tohong-back")].find((c) => c && existsSync(path.join(c, "lib", "contextBuilder.js")));
if (!BACK) { console.log("PASS chưa áp dụng (thiếu tohong-back)"); process.exit(0); }
export const FROZEN = JSON.parse(readFileSync(path.join(HQ, "eval", "T-140", "fixtures", "pool-frozen.json"), "utf8")).vendors;

const tmps = [];
process.on("exit", () => { for (const t of tmps) rmSync(t, { recursive: true, force: true }); });

export async function loadBack() {
  const t = mkdtempSync(path.join(tmpdir(), "t159-")); tmps.push(t);
  for (const d of ["lib", "providers", "api"]) if (existsSync(path.join(BACK, d))) cpSync(path.join(BACK, d), path.join(t, d), { recursive: true });
  cpSync(path.join(BACK, "test", "helpers"), path.join(t, "test", "helpers"), { recursive: true });
  cpSync(path.join(BACK, "package.json"), path.join(t, "package.json"));
  symlinkSync(realpathSync(path.join(BACK, "node_modules")), path.join(t, "node_modules"));
  writeFileSync(path.join(t, "lib", "vendorPool.generated.js"), "export const GENERATED_VENDOR_POOL = " + JSON.stringify(FROZEN) + ";\n");
  const imp = (p) => import(pathToFileURL(path.join(t, p)).href);
  const [cc, mb, vm, vo, vapi, bapi, bc] = await Promise.all([imp("lib/contextBuilder.js"), imp("test/helpers/memoryBucket.js"), imp("lib/vendorMatcher.js"),
    imp("lib/vendorOverlay.js"), imp("api/vendors.js"), imp("api/budget.js"), imp("lib/budgetCategories.js")]);
  return { buildChatContext: cc.buildChatContext, MemoryBucket: mb.MemoryBucket, POOL: vm.VENDOR_POOL, CATEGORIES: vm.CATEGORIES,
    resetOverlayCache: vo.resetOverlayCache, handleVendors: vapi.handleVendors, handleBudget: bapi.handleBudget,
    BUDGET_TEMPLATE: bc.BUDGET_TEMPLATE, BUDGET_TO_VENDOR_CATEGORIES: bc.BUDGET_TO_VENDOR_CATEGORIES };
}

export const CID = "c1";
export const AUTH = { userId: "u1" };
export const BUDGET_KEY = `data/couples/${CID}/budget.json`;
export const MSG_PHOTO = "Tìm photographer chụp ảnh cưới giúp anh chị";   // không có số tiền
export const MSG_BY_CAT = {
  photography: MSG_PHOTO, attire: "Tìm áo cưới đẹp giúp anh chị", makeup: "Gợi ý makeup cô dâu giúp anh chị", decor: "Kiếm hoa cưới cầm tay giúp anh chị",
  transport: "Tìm xe hoa giúp anh chị", stationery: "Tìm thiệp cưới giúp anh chị", jewelry: "Tìm nhẫn cưới giúp anh chị", venue: "Tìm nhà hàng tiệc cưới giúp anh chị",
};

export const eligible = (M, category) => M.POOL.filter((v) => v.category === category && v.isVerified && !(v.rating > 0 && v.rating < 3.5) && v.city === "HCMC");

// Pool điều khiển bằng overlay admin: ẩn mọi vendor của hạng mục trừ `keep` = [{id, priceMin, priceMax}].
export function overlayKeep(M, category, keep) {
  const ov = {}; const ids = new Set(keep.map((k) => k.id));
  for (const v of M.POOL) if (v.category === category && !ids.has(v.id)) ov[v.id] = { hidden: true, hidden_reason: "eval T-159" };
  for (const k of keep) ov[k.id] = { priceMin: k.priceMin, priceMax: k.priceMax, price_verified: true };
  return ov;
}
// n vendor giống hệt nhau (không gu, rating 0, đủ 12 tháng) để điểm chỉ khác nhau ở ngân sách; null nếu pool không đủ.
export function twins(M, category, n) {
  const g = M.POOL.filter((v) => v.category === category && v.isVerified && v.rating === 0 && v.styles.length === 0 && v.availability.length === 12 && v.city === "HCMC");
  return g.length >= n ? g.slice(0, n) : null;
}
export const keepPrice = (vs, priceMin, priceMax) => vs.map((v) => ({ id: v.id, priceMin, priceMax }));

function seed(M, { profile, budgetDoc, overlay, members }) {
  const b = new M.MemoryBucket();
  if (profile) b.data.set(`data/couples/${CID}/profile.yaml`, JSON.stringify(profile));
  if (budgetDoc !== undefined) b.data.set(BUDGET_KEY, typeof budgetDoc === "string" ? budgetDoc : JSON.stringify(budgetDoc));
  if (overlay) b.data.set("data/admin/vendor_overrides.json", JSON.stringify({ seq: 1, vendors: overlay }));
  if (members) b.data.set(`data/couples/${CID}/members.json`, JSON.stringify([{ user_id: AUTH.userId, role: "owner" }]));
  return b;
}
export const coupleProfile = (extra = {}) => ({ couple: { city: "HCMC", wedding_date: "2029-03-20" }, preferences: { style_tags: [] }, ...extra });
// Bảng dự toán dạng lưu trong R2: allocations = { photography: 40, ... } (triệu).
export const doc = (allocations, { total_tr = 300, extra = [] } = {}) => ({
  categories: [...Object.entries(allocations).map(([id, a]) => ({ id, name: id, allocated_tr: a, items: [] })), ...extra], total_tr, guests: 0, mung_tr: 0, updated_at: "2026-11-14T00:00:00.000Z",
});

function guard(fn) {
  return async () => {
    const origFetch = globalThis.fetch, origWarn = console.warn; let net = 0;
    globalThis.fetch = async (u) => { net++; throw new Error("không được gọi mạng: " + u); };
    console.warn = () => {};
    try { return await fn(() => net); } finally { globalThis.fetch = origFetch; console.warn = origWarn; }
  };
}

/** Một lượt chat như production. onGet(key) có thể ném để giả lập lỗi R2. Trả { ids, md, sp, reads, err }. */
export async function chat(M, { message = MSG_PHOTO, profile = coupleProfile({ budget: 300 }), budgetDoc, overlay = null, onGet = null }) {
  const b = seed(M, { profile, budgetDoc, overlay });
  if (onGet) { const g = b.get.bind(b); b.get = async (k, ...r) => { onGet(k); return g(k, ...r); }; }
  M.resetOverlayCache();
  return guard(async () => {
    try {
      const r = await M.buildChatContext({ CHAT_DATA: b }, CID, null, message, null, AUTH.userId);
      return { ids: (r.matchMetadata?.matches || []).map((m) => m.vendor_id), md: r.matchMetadata, sp: r.systemPrompt, reads: b.reads.filter((k) => k === BUDGET_KEY).length };
    } catch (err) { return { err, ids: [], md: null, reads: b.reads.filter((k) => k === BUDGET_KEY).length }; }
  })();
}

/** Một request HTTP vào api/vendors.js (tab Vendor). Trả { status, body, reads, err }. */
export async function tab(M, { url, profile = coupleProfile(), budgetDoc, overlay = null, onGet = null }) {
  const b = seed(M, { profile, budgetDoc, overlay, members: true });
  if (onGet) { const g = b.get.bind(b); b.get = async (k, ...r) => { onGet(k); return g(k, ...r); }; }
  M.resetOverlayCache();
  const u = new URL("http://localhost" + url);
  const segs = u.pathname.replace(/^\/api\/vendors\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  return guard(async () => {
    try {
      const res = await M.handleVendors(new Request(u, { method: "GET" }), { CHAT_DATA: b }, AUTH, segs);
      return { status: res.status, body: await res.json(), reads: b.reads.filter((k) => k === BUDGET_KEY).length };
    } catch (err) { return { err, status: 0, body: null, reads: b.reads.filter((k) => k === BUDGET_KEY).length }; }
  })();
}
export const tabMatch = (M, category, o = {}) => tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=${category}&limit=50`, ...o });
export const budgetScoreOf = (r, id) => r.body?.vendors?.find((v) => v.id === id)?.match?.scoreBreakdown?.budget;

/** GET /api/couples/:id/budget (bảng người dùng nhìn thấy). */
export async function getBudgetDoc(M, { profile = coupleProfile({ budget: 300 }), budgetDoc }) {
  const b = seed(M, { profile, budgetDoc, members: true }); M.resetOverlayCache();
  const res = await M.handleBudget(new Request("http://localhost/api/couples/c1/budget"), { CHAT_DATA: b }, AUTH, CID, "");
  return res.json();
}

export function done(fails) { if (fails.length) { console.log("FAIL " + fails.join("; ")); process.exit(1); } console.log("PASS"); }
