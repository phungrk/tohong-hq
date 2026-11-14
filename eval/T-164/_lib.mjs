// T-164: khung chung cho eval back và generator. Chạy từ gốc tohong-hq. Biến: TOHONG_REPO (tohong), TOHONG_BACK_REPO (tohong-back); mặc định cạnh tohong-hq.
// Không mạng, không Google, không ghi vào repo thật: generator chạy tại chỗ với --in/--out ở thư mục tạm; back được chép sang thư mục tạm với pool đã "đóng dấu giá" theo
// fixtures/expected-prices.json (đầu ra ĐÚNG theo spec), nên eval 3-6 không phụ thuộc generator.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { copyBack, load, embedded, BACK, reporter } from "../T-147/lib/back147.mjs";
export { BACK, load, reporter, embedded };

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const HQ = path.resolve(HERE, "..", "..");
export const FIX = path.join(HERE, "fixtures");
export const EXPECTED = JSON.parse(fs.readFileSync(path.join(FIX, "expected-prices.json"), "utf8"));
export const INPUTS = JSON.parse(fs.readFileSync(path.join(FIX, "price-inputs.json"), "utf8"));
export const TOHONG = [process.env.TOHONG_REPO, path.join(HQ, "..", "tohong")].filter(Boolean).map((p) => path.resolve(p)).find((p) => fs.existsSync(path.join(p, "tools", "generate-vendor-pool.js")));

const TMPS = [];
process.on("exit", () => { if (process.env.T164_KEEP) return; for (const d of TMPS) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* */ } } });
export const tmpdir = (tag) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), `t164-${tag}-`)); TMPS.push(d); return d; };
export const near = (x, y) => typeof x === "number" && Math.abs(x - y) < 1e-9;

/* ---------- generator ---------- */
export function gen(args, { stdin } = {}) {
  if (!TOHONG) { console.log("FAIL không thấy repo tohong (đặt TOHONG_REPO)"); process.exit(2); }
  const r = spawnSync("node", [path.join(TOHONG, "tools", "generate-vendor-pool.js"), ...args], { encoding: "utf8", cwd: tmpdir("cwd"), timeout: 120000 });
  return { status: r.status, out: (r.stdout || "") + (r.stderr || "") };
}
export const readPool = (file) => { const t = fs.readFileSync(file, "utf8"); const i = t.indexOf("= [") + 2; return JSON.parse(t.slice(i, t.lastIndexOf("]") + 1)); };
/** Chạy sinh đầy đủ trên một mảng bản ghi đầu vào; trả { ok, pool(Map id→vendor), msg }. */
export function genFull(records, asOf = EXPECTED.as_of, extra = []) {
  const d = tmpdir("gen"); const inF = path.join(d, "pool-vendors.json"); const outF = path.join(d, "pool.js");
  fs.writeFileSync(inF, JSON.stringify(records));
  const r = gen(["--in", inF, "--out", outF, "--as-of", asOf, ...extra]);
  if (r.status !== 0 || !fs.existsSync(outF)) return { ok: false, msg: "generator thoát " + r.status + ": " + r.out.slice(-200).replace(/\n/g, " "), dir: d, inF, outF };
  return { ok: true, pool: new Map(readPool(outF).map((v) => [v.id, v])), dir: d, inF, outF, msg: r.out };
}
export const PRICE_FIELDS = ["priceMin", "priceMax", "priceSource", "priceAsOf"];
export const priceOf = (v) => ({ priceMin: v?.priceMin, priceMax: v?.priceMax, priceSource: v?.priceSource, priceAsOf: v?.priceAsOf ?? null });
export function sameExpected(v, e) {
  return v && near(v.priceMin, e.priceMin) && near(v.priceMax, e.priceMax) && v.priceSource === e.priceSource && (v.priceAsOf ?? null) === (e.priceAsOf ?? null);
}

/* ---------- bảng ngưỡng và công thức của spec (viết lại độc lập với code) ---------- */
export const BANDS = EXPECTED.bands_trieu; // triệu VND, theo hạng mục
export const UNIT = Object.fromEntries(Object.keys(BANDS).map((c) => [c, c === "venue" ? "per_table" : "package"]));
export const DEFAULTS = { photography: [15, 30], venue: [5, 15], decor: [10, 50], attire: [8, 25], makeup: [3, 8], ceremony: [5, 15], jewelry: [10, 40], transport: [3, 8], stationery: [2, 6], honeymoon: [20, 60] };
export const r1 = (x) => Math.round(x * 10) / 10;
export function pct(arr, p) { const a = [...arr].sort((x, y) => x - y); const k = (a.length - 1) * p; const f = Math.floor(k); const c = Math.min(f + 1, a.length - 1); return a[f] + (a[c] - a[f]) * (k - f); }
/** Bản ghi đầu vào giả cho một vendor có giá. */
export const rec = (id, category, min_vnd, max_vnd, { unit, last = "2026-06-24T23:16:38.377477+00:00", noPrice = false } = {}) => ({
  id, name: "V " + id, categories: [category], city: "HCMC", style_tags: [], description: "",
  price_range: noPrice ? null : { min_vnd, max_vnd, unit: unit === undefined ? UNIT[category] : unit }, last_scraped: last });

/* ---------- back với pool đã đóng dấu giá ---------- */
/** Chép back sang thư mục tạm, thay giá + nguồn giá của mọi vendor theo EXPECTED (hoặc theo hàm `stamp(vendor, expectedRow)`), rồi cho `mut(pool)` sửa thêm. */
export function stampedBack({ stamp = null, mut = null } = {}) {
  const out = copyBack((dir) => {
    const f = path.join(dir, "lib", "vendorPool.generated.js");
    const t = fs.readFileSync(f, "utf8"); const k = "export const GENERATED_VENDOR_POOL = ";
    const i = t.indexOf(k) + k.length; const e = t.indexOf("];", i) + 1; const arr = JSON.parse(t.slice(i, e));
    for (const v of arr) { const x = EXPECTED.vendors[v.id]; if (!x) continue; if (stamp) stamp(v, x); else Object.assign(v, x); }
    if (mut) mut(arr);
    fs.writeFileSync(f, t.slice(0, i) + JSON.stringify(arr) + t.slice(e));
  });
  TMPS.push(out);
  return out;
}
export const imp = (dir, rel) => import(pathToFileURL(path.join(dir, rel)).href);
export async function loadModules(dir) {
  const [cc, mb, vm, vo, vapi] = await Promise.all([imp(dir, "lib/contextBuilder.js"), imp(dir, "test/helpers/memoryBucket.js"), imp(dir, "lib/vendorMatcher.js"), imp(dir, "lib/vendorOverlay.js"), imp(dir, "api/vendors.js")]);
  return { buildChatContext: cc.buildChatContext, MemoryBucket: mb.MemoryBucket, POOL: vm.VENDOR_POOL, CATEGORIES: vm.CATEGORIES, resetOverlayCache: vo.resetOverlayCache, handleVendors: vapi.handleVendors, computeMatches: vm.computeMatches };
}

/* ---------- đồng hồ giả (chỉ Date; mã đo tuổi giá phải dùng đồng hồ hệ thống tại lúc xử lý request) ---------- */
const RealDate = Date;
export function setNow(iso) { const t = new RealDate(iso).getTime(); globalThis.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(t); } static now() { return t; } }; }
export function restoreNow() { globalThis.Date = RealDate; }

export const lowerFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
export const LABEL = {
  verified: "Giá đã xác minh",
  admin: "Giá do Tơ Hồng cập nhật",
  estimate: "Ước tính theo hạng mục",
  unknown: "Giá ước tính",
  legacy: (mmYYYY, old) => `${old ? "Giá cũ" : "Giá"} marry.vn · ${mmYYYY}`,
};
export const ESTIMATE_BASES = ["estimate_category", "estimate_default"];
