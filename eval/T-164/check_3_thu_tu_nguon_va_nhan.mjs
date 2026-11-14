// T-164 tiêu chí 3: thứ tự ưu tiên nguồn giá của MỘT vendor và nhãn đi kèm, đo qua GET /api/vendors/:id (vendor.price_basis, price_as_of, price_label, priceMin/Max).
// Thứ tự: (1) admin overlay (price_verified=true => "admin_verified"; có priceMin/priceMax mà chưa xác minh => "admin") > (2) giá riêng có nguồn (CHƯA có dữ liệu; priceSource lạ = "unknown")
//   > (3) pool priceSource "legacy_marry" (nhãn kèm tháng/năm; quá 180 ngày kể từ cuối tháng priceAsOf: "Giá cũ ...") > (4) "estimate_category"/"estimate_default" ("Ước tính theo hạng mục").
// Pool không có priceSource hợp lệ (thiếu hoặc giá trị lạ), có hay không overlay: KHÔNG thêm price_basis/price_as_of/price_label (phản hồi y nguyên hôm nay; app dùng nhãn dự phòng "giá ước tính").
// Lý do: băm toàn bộ phản hồi của T-140 check 7 và T-143 adv-01 trên pool đông cứng không có priceSource phải còn xanh. price_source cũ ("verified"|"estimated") giữ nguyên nghĩa: verified chỉ khi admin xác minh.
import { stampedBack, loadModules, setNow, restoreNow, EXPECTED, LABEL, near } from "./_lib.mjs";
import { tab, coupleProfile } from "../T-159/_lib.mjs";
const fails = []; const bad = (m) => fails.push(m);
let dir;
const cats = {};
dir = stampedBack({ mut: (arr) => { for (const v of arr) cats[v.id] = v.category; } });
const pick = (src, cat) => Object.keys(EXPECTED.vendors).find((id) => EXPECTED.vendors[id].priceSource === src && cats[id] === cat);
const L = pick("legacy_marry", "photography"), E = pick("estimate_category", "photography"), D = pick("estimate_default", "honeymoon");
const X = Object.keys(EXPECTED.vendors).filter((id) => EXPECTED.vendors[id].priceSource === "legacy_marry" && cats[id] === "venue")[0];
const U = Object.keys(EXPECTED.vendors).filter((id) => cats[id] === "attire" && EXPECTED.vendors[id].priceSource === "estimate_category")[0];
const W = Object.keys(EXPECTED.vendors).filter((id) => cats[id] === "attire" && EXPECTED.vendors[id].priceSource === "estimate_category")[1];
dir = stampedBack({ mut: (arr) => {
  for (const v of arr) {
    if (v.id === X) v.priceAsOf = "2025-10";            // giá marry cũ hơn 365 ngày vẫn là legacy_marry khi đọc (rơi về N4 xảy ra lúc sinh pool), nhãn "Giá cũ"
    if (v.id === U) { delete v.priceSource; delete v.priceAsOf; }          // pool chưa gắn nguồn giá
    if (v.id === W) v.priceSource = "own_published";                       // giá trị chưa được hỗ trợ
  }
} });
const M = await loadModules(dir);
const get = async (id, overlay = null, now = "2026-11-14T08:00:00Z") => { setNow(now); try { const r = await tab(M, { url: `/api/vendors/${id}`, profile: coupleProfile(), overlay }); return r; } finally { restoreNow(); } };
const want = (name, r, basis, label, asOf, min, max) => {
  const v = r.body?.vendor;
  if (r.err || r.status !== 200 || !v) return bad(`${name}: lỗi ${r.err?.message || r.status}`);
  if (basis === null) { if ("price_basis" in v || "price_label" in v || "price_as_of" in v) bad(`${name}: pool chưa có nguồn giá thì không được thêm price_basis/price_as_of/price_label, thấy ${JSON.stringify([v.price_basis, v.price_as_of, v.price_label])}`); if (v.price_source !== "estimated") bad(`${name}: price_source cũ phải là "estimated"`); return; }
  if (v.price_basis !== basis) bad(`${name}: price_basis ${v.price_basis}, mong ${basis}`);
  if (v.price_label !== label) bad(`${name}: price_label "${v.price_label}", mong "${label}"`);
  if (asOf !== undefined && (v.price_as_of ?? null) !== asOf) bad(`${name}: price_as_of ${v.price_as_of}, mong ${asOf}`);
  if (min !== undefined && !(near(v.priceMin, min) && near(v.priceMax, max))) bad(`${name}: giá ${v.priceMin}-${v.priceMax}, mong ${min}-${max}`);
};
const e = (id) => EXPECTED.vendors[id];
if (!L || !E || !D || !X || !U || !W) { console.log("FAIL fixture thiếu vendor mẫu"); process.exit(1); }
/* 1. không overlay */
want("legacy_marry, 2026-11-14", await get(L), "legacy_marry", LABEL.legacy("06/2026", false), "2026-06", e(L).priceMin, e(L).priceMax);
want("estimate_category", await get(E), "estimate_category", LABEL.estimate, "2026-06", e(E).priceMin, e(E).priceMax);
want("estimate_default", await get(D), "estimate_default", LABEL.estimate, null, e(D).priceMin, e(D).priceMax);
want("pool không priceSource", await get(U), null);
want("priceSource chưa hỗ trợ (own_published)", await get(W), null);
want("legacy_marry cũ hơn 365 ngày vẫn legacy khi đọc, nhãn 'Giá cũ'", await get(X, null), "legacy_marry", LABEL.legacy("10/2025", true), "2025-10");
for (const id of [L, E, D]) { const r = await get(id); if (r.body?.vendor?.price_source !== "estimated") bad(`price_source cũ của ${id} phải là "estimated", thấy ${r.body?.vendor?.price_source}`); }
/* 2. tuổi giá marry: 180 ngày kể từ cuối tháng (2026-06-30): 2026-12-27 = 180 ngày chưa cũ; 2026-12-28 = 181 ngày cũ */
want("2026-12-27 (180 ngày)", await get(L, null, "2026-12-27T23:00:00Z"), "legacy_marry", LABEL.legacy("06/2026", false));
want("2026-12-28 (181 ngày)", await get(L, null, "2026-12-28T01:00:00Z"), "legacy_marry", LABEL.legacy("06/2026", true));
want("ước tính không có tuổi (2027-12-31)", await get(E, null, "2027-12-31T01:00:00Z"), "estimate_category", LABEL.estimate);
/* 3. overlay admin thắng mọi nguồn khác */
for (const [name, id] of [["legacy_marry", L], ["estimate_category", E], ["estimate_default", D]]) {
  const rv = await get(id, { [id]: { priceMin: 7, priceMax: 9, price_verified: true } });
  want(`overlay xác minh đè ${name}`, rv, "admin_verified", LABEL.verified, undefined, 7, 9);
  if (rv.body?.vendor?.price_source !== "verified") bad(`overlay xác minh đè ${name}: price_source cũ phải là "verified"`);
  const ra = await get(id, { [id]: { priceMin: 7, priceMax: 9 } });
  want(`overlay giá chưa xác minh đè ${name}`, ra, "admin", LABEL.admin, undefined, 7, 9);
  if (ra.body?.vendor?.price_source !== "estimated") bad(`overlay chưa xác minh đè ${name}: price_source cũ phải là "estimated"`);
}
want("overlay chỉ price_verified=true (xác nhận giá pool)", await get(E, { [E]: { price_verified: true } }), "admin_verified", LABEL.verified, undefined, e(E).priceMin, e(E).priceMax);
for (const id of [U, W]) { // pool chưa có nguồn giá hợp lệ: overlay giá chỉ đổi price_source/giá như hôm nay, vẫn không có trường mới (nhãn do app dựng từ price_source)
  const r = await get(id, { [id]: { priceMin: 7, priceMax: 9, price_verified: true } }); const v = r.body?.vendor;
  if (!v || "price_basis" in v || "price_label" in v || "price_as_of" in v || v.price_source !== "verified" || !(near(v.priceMin, 7) && near(v.priceMax, 9))) bad(`pool chưa có nguồn giá + overlay xác minh: phản hồi phải y như hôm nay (price_source verified, giá 7-9, không trường mới), thấy ${JSON.stringify([v?.price_source, v?.priceMin, v?.priceMax, v?.price_basis, v?.price_label])}`);
}
want("overlay rỗng không đổi nguồn", await get(L, { [L]: {} }), "legacy_marry", LABEL.legacy("06/2026", false));
want("overlay chỉ liên hệ/ẩn-lý-do không đổi nguồn giá", await get(E, { [E]: { contact: { phone: "0900000000" }, price_verified: false } }), "estimate_category", LABEL.estimate);
/* 4. vendor ẩn vẫn có nhãn khi trả giá */
{ const r = await get(L, { [L]: { hidden: true, hidden_reason: "eval" } }); const v = r.body?.vendor; if (!(v?.hidden === true) || typeof v?.price_label !== "string" || !v.price_label) bad("vendor ẩn trả giá nhưng thiếu price_label"); }
if (fails.length && process.env.T164_ALL) console.log(fails.map((f) => "  - " + f).join("\n"));
if (fails.length) { console.log("FAIL " + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : "")); process.exit(1); }
console.log("PASS");
