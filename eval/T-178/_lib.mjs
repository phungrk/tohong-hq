// T-178: khung chung cho eval back (chạy từ gốc tohong-hq; TOHONG_BACK_REPO mặc định ../tohong-back). Không mạng, không ghi repo thật; R2 giả trong bộ nhớ.
// Pool đóng dấu giá như T-164/T-167 (fixture), vài venue và một photography được đặt giá riêng; mọi venue khác bị ẩn bằng overlay theo từng phép đo.
import { stampedBack, loadModules, setNow, restoreNow } from "../T-164/_lib.mjs";
import { tab, chat, coupleProfile, CID, done } from "../T-159/_lib.mjs";
import { budgetDoc } from "../T-167/_lib.mjs";
export { tab, chat, coupleProfile, CID, done, budgetDoc, setNow, restoreNow };
export const ids = {};
export const NOW = "2026-11-14T08:00:00Z";
const REAL = (a, b) => ({ priceMin: a, priceMax: b, priceSource: "legacy_marry", priceAsOf: "2026-06" });
const EST = (a, b) => ({ priceMin: a, priceMax: b, priceSource: "estimate_category", priceAsOf: "2026-06" });

/** Venue: A=3 (ví dụ của Capu), B=3,9, C=4,25 (tròn lên ở chip), D=4,6 (chat: giống T-164), E=ước tính 3. P=photography 10-15. Mọi venue sức chứa rộng, không gu, đủ lịch. */
export async function setup() {
  const dir = stampedBack({ mut: (arr) => {
    const pick = (cat, n) => arr.filter((v) => v.category === cat && v.city === "HCMC").slice(0, n);
    const neutral = (v) => Object.assign(v, { isVerified: true, rating: 0, reviewCount: 0, styles: [], availability: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] });
    const vs = pick("venue", 5); const [p] = pick("photography", 1);
    [["A", REAL(3, 3)], ["B", REAL(3.9, 3.9)], ["C", REAL(4.25, 4.25)], ["D", REAL(4, 4.6)], ["E", EST(3, 3)]].forEach(([k, pr], i) => {
      neutral(vs[i]); Object.assign(vs[i], pr, { capacity: { min: 1, max: 2e9 } }); ids[k] = vs[i].id; });
    neutral(p); Object.assign(p, REAL(10, 15)); ids.P = p.id;
  } });
  const M = await loadModules(dir);
  M.hideExcept = (cat, keep) => Object.fromEntries(M.POOL.filter((v) => v.category === cat && !keep.includes(v.id)).map((v) => [v.id, { hidden: true, hidden_reason: "eval T-178" }]));
  setNow(NOW);
  return M;
}
/** Gọi match; trả { r, vs: Map id -> vendor, order: [id...] } */
export async function match(M, { category = "venue", keep, profile, doc }) {
  const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=${category}&limit=50`, profile, budgetDoc: doc, overlay: M.hideExcept(category, keep), countFetch: { n: 0 } });
  const list = r.body?.vendors || [];
  return { r, vs: new Map(list.map((v) => [v.id, v])), order: list.map((v) => v.id) };
}
export async function detail(M, { id, category = "venue", profile, doc }) {
  const r = await tab(M, { url: `/api/vendors/${id}?coupleId=${CID}`, profile, budgetDoc: doc, overlay: M.hideExcept(category, [id]), countFetch: { n: 0 } });
  return { r, m: r.body?.match };
}
export const labels = (v) => (v?.match?.reasons || []).map((x) => (typeof x === "string" ? x : x.label));
/** Chip theo bàn: nhãn bắt đầu bằng "≈" và chứa "/bàn". */
export const chipOf = (v) => labels(v).filter((l) => /^≈ .*\/bàn/.test(l));
/** Làm tròn 1 chữ số, dấu chấm, bỏ ".0" — khuôn chip hiện tại (fmtTr). Viết lại độc lập với code. */
export const r1 = (x) => String(Math.round(x * 10) / 10);
export const near = (x, y) => typeof x === "number" && Math.abs(x - y) < 1e-9;
export const expectScore = (total, cat) => (total <= cat ? 1 : (total - cat) / cat > 0.2 ? 0 : null);
