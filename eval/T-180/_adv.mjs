// T-180 adversary: khung chung. Gọi computeMatches trực tiếp (pool tự dựng, không mạng). Repo: TOHONG_BACK_REPO hoặc ../tohong-back.
import p from "path"; import { pathToFileURL as u, fileURLToPath as f } from "url";
const hq = p.resolve(p.dirname(f(import.meta.url)), "..", "..");
const back = process.env.TOHONG_BACK_REPO || p.join(hq, "..", "tohong-back");
export const { computeMatches } = await import(u(p.join(back, "lib", "vendorMatcher.js")).href);
export const r1 = (x) => String(Math.round(x * 10) / 10);   // khuôn chấm, viết độc lập với mã
export const venue = (v = {}) => ({ id: "x", name: "Nhà hàng X", category: "venue", city: "HCMC", isVerified: true, rating: 0, reviewCount: 0, styles: [], availability: [], tags: [],
  priceMin: 3, priceMax: 3, priceSource: "legacy_marry", priceAsOf: "2026-06", price_basis: "legacy_marry", capacity: { min: 1, max: 2e9 }, ...v });
export const run = (profile, v, category = "venue") => computeMatches(profile, { category, pool: [v] }).vendors[0];
export const labels = (x) => (x?.match?.reasons || []).map((r) => (typeof r === "string" ? r : r.label));
export const tableChip = (x) => labels(x).filter((l) => /\/bàn/.test(l));
export const SHAPE = /^≈ \d+(\.\d)?tr\/bàn × \d+ bàn = \d+(\.\d)?tr$/;
const fails = []; export const bad = (m) => fails.push(m);
export const done = (n) => { if (fails.length) { console.log("FAIL\n" + fails.slice(0, 15).join("\n")); process.exit(1); } console.log(`PASS (${n} phép thử)`); };
