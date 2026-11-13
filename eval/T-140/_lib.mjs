// Dùng chung cho eval T-140 (chạy từ gốc tohong-hq; TOHONG_BACK_REPO mặc định ../tohong-back). Không mạng, không Google, không ghi vào repo back.
// Hai chế độ nạp: live = đọc thẳng repo back (pool thật); frozen = chép lib/ + providers/ + test/helpers vào thư mục tạm rồi thay pool bằng
// fixtures/pool-frozen.json (867 vendor chụp 2026-11-13), để số đo so với Python không trôi khi pool đổi.
import { pathToFileURL, fileURLToPath } from "url";
import { existsSync, mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync, symlinkSync, realpathSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { spawnSync } from "child_process";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const HQ = path.resolve(HERE, "..", "..");
export const BACK = [process.env.TOHONG_BACK_REPO, path.join(HQ, "..", "tohong-back")].find((c) => c && existsSync(path.join(c, "lib", "contextBuilder.js")));
if (!BACK) { console.log("PASS chưa áp dụng (thiếu tohong-back)"); process.exit(0); }
export const FROZEN = JSON.parse(readFileSync(path.join(HERE, "fixtures", "pool-frozen.json"), "utf8")).vendors;
export const PROFILES = JSON.parse(readFileSync(path.join(HERE, "fixtures", "profiles.json"), "utf8")).profiles;

const tmps = [];
process.on("exit", () => { for (const t of tmps) rmSync(t, { recursive: true, force: true }); });

export function frozenRoot() {
  const t = mkdtempSync(path.join(tmpdir(), "t140-")); tmps.push(t);
  for (const d of ["lib", "providers"]) if (existsSync(path.join(BACK, d))) cpSync(path.join(BACK, d), path.join(t, d), { recursive: true });
  cpSync(path.join(BACK, "test", "helpers"), path.join(t, "test", "helpers"), { recursive: true });
  cpSync(path.join(BACK, "package.json"), path.join(t, "package.json"));
  symlinkSync(realpathSync(path.join(BACK, "node_modules")), path.join(t, "node_modules"));
  writeFileSync(path.join(t, "lib", "vendorPool.generated.js"), "export const GENERATED_VENDOR_POOL = " + JSON.stringify(FROZEN) + ";\n");
  return t;
}

export async function load(root) {
  const imp = (p) => import(pathToFileURL(path.join(root, p)).href);
  const [cc, mb, vm, vo, pb, id, sc] = await Promise.all([imp("lib/contextBuilder.js"), imp("test/helpers/memoryBucket.js"), imp("lib/vendorMatcher.js"),
    imp("lib/vendorOverlay.js"), imp("lib/profileBuilder.js"), imp("lib/intentDetector.js"), imp("lib/styleContract.js")]);
  return { buildChatContext: cc.buildChatContext, MemoryBucket: mb.MemoryBucket, computeMatches: vm.computeMatches, POOL: vm.VENDOR_POOL,
    resetOverlayCache: vo.resetOverlayCache, buildMatchProfile: pb.buildMatchProfile, detectMatchIntent: id.detectMatchIntent, satisfiedStyles: sc.satisfiedStyles };
}

export const MSG = {
  photography: (b) => `Tìm photographer chụp ảnh cưới giúp anh chị ${b}tr`, attire: (b) => `Tìm áo cưới đẹp ${b}tr`, makeup: (b) => `Gợi ý makeup cô dâu ${b}tr`,
  decor: (b) => `Kiếm hoa cưới cầm tay ${b}tr`, transport: (b) => `Tìm xe hoa ${b}tr`, stationery: (b) => `Tìm thiệp cưới ${b}tr`,
  jewelry: (b) => `Tìm nhẫn cưới ${b}tr`, venue: (b) => `Tìm nhà hàng tiệc cưới ${b}tr`,
};

// Gọi buildChatContext như production: hồ sơ cặp đôi trong bucket giả, KHÔNG có MATCHER_URL/MATCHER_API_KEY (trừ khi env truyền vào), mọi fetch bị cấm.
export async function chat(M, { category = "photography", budgetTr = 30, styles = [], guests = null, city = "HCMC", dealbreakers = [], overlay = null, env = {}, message = null }) {
  const couple = { couple: { city, wedding_date: "2029-03-20" }, preferences: { style_tags: styles, dealbreakers }, ...(guests ? { guest_count: guests } : {}) };
  const bucket = new M.MemoryBucket();
  bucket.data.set("data/couples/c1/profile.yaml", JSON.stringify(couple));
  if (overlay) bucket.data.set("data/admin/vendor_overrides.json", JSON.stringify({ seq: 1, vendors: overlay }));
  M.resetOverlayCache();
  const origFetch = globalThis.fetch, origWarn = console.warn;
  let net = 0;
  globalThis.fetch = async (url) => { net++; throw new Error("không được gọi mạng: " + url); };
  console.warn = () => {};
  try {
    const r = await M.buildChatContext({ CHAT_DATA: bucket, ...env }, "c1", null, message ?? MSG[category](budgetTr), null, "u1");
    return { r, net, sp: r.systemPrompt, md: r.matchMetadata, ids: (r.matchMetadata?.matches || []).map((m) => m.vendor_id) };
  } finally { globalThis.fetch = origFetch; console.warn = origWarn; }
}

// Khối ứng viên trong prompt: [{name, priceLine}] theo thứ tự.
export function candidates(sp) {
  const i = sp.search(/^\[VENDOR CANDIDATES/m); if (i < 0) return [];
  const rest = sp.slice(i), e = rest.indexOf("\n\n## "), blk = e < 0 ? rest : rest.slice(0, e);
  const out = []; const lines = blk.split("\n");
  for (let k = 0; k < lines.length; k++) {
    const m = lines[k].match(/^\d+\. (.+)$/);
    if (m) out.push({ name: m[1], priceLine: ((lines[k + 1] || "").match(/^\s+Giá: (.*)$/) || [])[1] ?? "" });
  }
  return out;
}

// Controlled pool bằng overlay admin: ẩn mọi vendor của hạng mục trừ `keep` = [{id, priceMin, priceMax}] (giá admin ghi đè).
export function overlayKeep(M, category, keep) {
  const ov = {}; const keepIds = new Set(keep.map((k) => k.id));
  for (const v of M.POOL) if (v.category === category && !keepIds.has(v.id)) ov[v.id] = { hidden: true, hidden_reason: "eval T-140" };
  for (const k of keep) { ov[k.id] = {}; if (k.priceMin != null) ov[k.id].priceMin = k.priceMin; if (k.priceMax != null) ov[k.id].priceMax = k.priceMax; ov[k.id].price_verified = true; }
  return ov;
}
// Vendor đủ điều kiện (xác minh, không dưới 3,5 sao, HCMC) theo thứ tự pool.
export function eligible(M, category) {
  return M.POOL.filter((v) => v.category === category && v.isVerified && !(v.rating > 0 && v.rating < 3.5) && v.city === "HCMC");
}

export const jaccardDist = (a, b) => {
  const t1 = new Set((a || []).map((x) => String(x).toLowerCase())), t2 = new Set((b || []).map((x) => String(x).toLowerCase()));
  if (!t1.size && !t2.size) return 0; if (!t1.size || !t2.size) return 1;
  let i = 0; for (const x of t1) if (t2.has(x)) i++;
  return 1 - i / (t1.size + t2.size - i);
};
export const meanPairDist = (vs) => { let s = 0, n = 0; for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) { s += jaccardDist(vs[i].styles, vs[j].styles); n++; } return n ? s / n : null; };
export const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

// Chạy chuẩn: matcher Python (matcher/matcher.py của back) trên CÙNG pool đã đông cứng, hồ sơ do chính profileBuilder của back dựng.
export async function sample() {
  const root = frozenRoot(); const M = await load(root);
  const byId = new Map(M.POOL.map((v) => [v.id, v]));
  const rows = [];
  for (const p of PROFILES) {
    const c = await chat(M, { category: p.category, budgetTr: p.budget_tr, styles: p.styles, guests: p.guests });
    const mp = M.buildMatchProfile({ coupleState: { couple: { city: "HCMC", wedding_date: "2029-03-20" }, preferences: { style_tags: p.styles }, ...(p.guests ? { guest_count: p.guests } : {}) }, userMessage: MSG[p.category](p.budget_tr), intent: M.detectMatchIntent(MSG[p.category](p.budget_tr), [p.category === "venue" ? "venue" : "vendor"]) });
    rows.push({ p, c, mp });
  }
  const tmp = path.join(root, "_profiles.json"); writeFileSync(tmp, JSON.stringify(rows.map((r) => r.mp)));
  const py = spawnSync("python3", ["-W", "ignore", path.join(HERE, "ref_python.py"), path.join(BACK, "matcher"), path.join(HERE, "fixtures", "pool-frozen.json"), tmp], { encoding: "utf8", timeout: 300000 });
  if (py.status !== 0) { console.log("FAIL matcher Python chuẩn không chạy: " + (py.stderr || py.stdout).trim().split("\n").pop()); process.exit(1); }
  const ref = JSON.parse(py.stdout);
  return { M, byId, rows: rows.map((r, i) => ({ ...r, ref: ref[i] })) };
}
export function done(fails) { if (fails.length) { console.log("FAIL " + fails.join("; ")); process.exit(1); } console.log("PASS"); }
