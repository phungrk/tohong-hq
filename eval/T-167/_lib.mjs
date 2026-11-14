// T-167: khung chung cho eval 1-3 (chạy từ gốc tohong-hq; TOHONG_BACK_REPO mặc định ../tohong-back). Không mạng, không Google, không ghi repo thật.
// Pool đóng dấu giá như T-164/T-165; một venue "R1" giá 3,9tr/bàn (nhãn legacy_marry, giống Bạch Kim) là vendor duy nhất hiện, mọi venue khác bị ẩn bằng overlay.
// Chỉ gọi hành vi công khai: GET /api/vendors/match và GET /api/vendors/:id (handleVendors) trên R2 giả trong bộ nhớ.
import { existsSync as ex } from "fs"; import { fileURLToPath as f, pathToFileURL as u } from "url"; import p from "path";
let hq = p.dirname(f(import.meta.url)); while (!ex(p.join(hq, "scripts", "gate.py")) && p.dirname(hq) !== hq) hq = p.dirname(hq);
const L = (t) => import(u(p.join(hq, "eval", t, "_lib.mjs")).href);
const T164 = await L("T-164"); const T159 = await L("T-159");
export const { stampedBack, loadModules, setNow, restoreNow } = T164;
export const { tab, newBucket, coupleProfile, CID, AUTH, BUDGET_KEY, done } = T159;
export const NOW = "2026-11-14T08:00:00Z";
export const ids = {};

/** Nạp back với R1 (venue 3,9tr/bàn, legacy_marry) và P1 (photography, giá 10-15tr, không theo bàn, nguồn legacy_marry) và E1 (venue giá ước tính estimate_category 3,9tr/bàn) và H1 (honeymoon giá 15tr; mẫu ngân sách có tỷ lệ 0%). */
export async function setup() {
  const dir = stampedBack({ mut: (arr) => {
    const pick = (cat, n) => arr.filter((v) => v.category === cat && v.isVerified && v.rating === 0 && v.styles.length === 0 && v.availability.length === 12 && v.city === "HCMC").slice(0, n);
    const [r1, e1] = pick("venue", 2); const [p1] = pick("photography", 1); const [h1] = pick("honeymoon", 1);
    Object.assign(r1, { priceMin: 3.9, priceMax: 3.9, priceSource: "legacy_marry", priceAsOf: "2026-06", capacity: { min: 1, max: 2e9 } }); ids.R1 = r1.id;
    Object.assign(e1, { priceMin: 3.9, priceMax: 3.9, priceSource: "estimate_category", priceAsOf: "2026-06", capacity: { min: 1, max: 2e9 } }); ids.E1 = e1.id;
    Object.assign(p1, { priceMin: 10, priceMax: 15, priceSource: "legacy_marry", priceAsOf: "2026-06" }); ids.P1 = p1.id;
    Object.assign(h1, { priceMin: 15, priceMax: 15, priceSource: "legacy_marry", priceAsOf: "2026-06" }); ids.H1 = h1.id;
  } });
  const M = await loadModules(dir);
  const hide = (cat, keep) => Object.fromEntries(M.POOL.filter((v) => v.category === cat && !keep.includes(v.id)).map((v) => [v.id, { hidden: true, hidden_reason: "eval T-167" }]));
  M.overlayFor = (cat, keep) => hide(cat, keep);
  setNow(NOW);
  return M;
}
export const budgetDoc = (venue, { total_tr = 200, guests = 0, extra = [] } = {}) => ({
  categories: [{ id: "venue", name: "Tiệc cưới (địa điểm + F&B)", allocated_tr: venue, items: [] }, ...extra], total_tr, guests, mung_tr: 0, updated_at: "2026-11-14T00:00:00.000Z" });

/** Gọi match (venue hoặc photography) và lấy vendor `id`; trả { v, body, err }. */
export async function matchOne(M, { category = "venue", id, profile, doc, overlay }) {
  const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=${category}&limit=50`, profile, budgetDoc: doc, overlay: overlay ?? M.overlayFor(category, [id]), countFetch: { n: 0 } });
  return { r, v: r.body?.vendors?.find((x) => x.id === id), body: r.body };
}
export async function detailOne(M, { id, profile, doc, overlay, category = "venue" }) {
  const r = await tab(M, { url: `/api/vendors/${id}?coupleId=${CID}`, profile, budgetDoc: doc, overlay: overlay ?? M.overlayFor(category, [id]), countFetch: { n: 0 } });
  return { r, m: r.body?.match };
}
// Điểm Ngân sách phải khớp phép so ghi trong dòng (luật cũ: <= ngân sách => 1; vượt > 20% => 0).
export const near = (x, y) => typeof x === "number" && Math.abs(x - y) < 1e-9;
// Điểm suy ra từ số CHƯA làm tròn (trường JSON giữ số đầy đủ; chỉ `text` làm tròn).
export const expectScore = (total, cat) => (total <= cat ? 1 : (total - cat) / cat > 0.2 ? 0 : null);
