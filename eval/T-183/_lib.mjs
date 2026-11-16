// T-183: khung chung cho eval back. Gọi computeMatches trực tiếp (pool tự dựng, không mạng, không ghi repo). Repo: TOHONG_BACK_REPO hoặc ../tohong-back (cạnh tohong-hq).
// Khuôn dấu phẩy viết ĐỘC LẬP với mã: làm tròn 1 chữ số, dấu phẩy, bỏ ",0", không phân cách hàng nghìn (khuôn budgetBasis.text của T-167).
import p from "path"; import { pathToFileURL as u, fileURLToPath as f } from "url";
const hq = p.resolve(p.dirname(f(import.meta.url)), "..", "..");
const back = process.env.TOHONG_BACK_REPO || p.join(hq, "..", "tohong-back");
export const { computeMatches } = await import(u(p.join(back, "lib", "vendorMatcher.js")).href);
export const vi = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
export const venue = (v = {}) => ({ id: "x", name: "Nhà hàng X", category: "venue", city: "HCMC", isVerified: true, rating: 0, reviewCount: 0, styles: [], availability: [], tags: [],
  priceMin: 3, priceMax: 3, priceSource: "legacy_marry", priceAsOf: "2026-06", price_basis: "legacy_marry", capacity: { min: 1, max: 2e9 }, ...v });
export const run = (profile, pool, category = "venue") => computeMatches(profile, { category, pool, limit: 50 });
export const labels = (x) => (x?.match?.reasons || []).map((r) => (typeof r === "string" ? r : r.label));
export const CHIP = /^≈ \d+(,\d)?tr\/bàn × \d+ bàn = \d+(,\d)?tr$/;   // khuôn chip theo bàn, dấu phẩy
export const DOT_MONEY = /\d\.\d+\s*tr/;                               // số tiền lẻ viết dấu chấm: không được thấy ở chữ người dùng
const fails = []; export const bad = (m) => fails.push(m);
export const done = (n) => { if (fails.length) { console.log("FAIL\n" + fails.slice(0, 15).join("\n")); process.exit(1); } console.log(`PASS (${n} phép thử)`); };
