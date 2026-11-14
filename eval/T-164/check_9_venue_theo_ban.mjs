// T-164 tiêu chí 9 (venue tính theo bàn; spec H7): với vendor venue có nguồn giá (pool gắn priceSource), giá là tr/BÀN và điểm ngân sách / lọc cứng chat so TỔNG = giá/bàn x số bàn với ngân sách hạng mục (vẫn là tổng).
// Số bàn = ceil(số khách / 10) (journey.js GUESTS_PER_TABLE, venueCost của tab Ngân sách; không có trường "số bàn" nào được lưu). Số khách = `guests` trong data/couples/<id>/budget.json nếu số nguyên > 0, ngược lại guest_count của hồ sơ.
// Không có số khách: điểm ngân sách venue = 0,5, không lọc cứng venue theo giá, câu danh sách bỏ "Với khoảng Xtr". Có số bàn: điểm dùng priceMax x bàn (như budgetScore dùng priceMax), lọc chat dùng priceMin x bàn, nới x1,2 áp lên tổng.
// Chip (chỉ vendor có giá riêng, điểm ngân sách = 1): "≈ {priceMax}tr/bàn × {T} bàn"; vendor ước tính không chip. Câu danh sách: "Với khoảng {X}tr cho tiệc & nhà hàng (≈ {X/T làm tròn 0,1}tr/bàn × {T} bàn)".
// Khối chat: dòng giá "Giá: a-btr/bàn (nhãn)" (số làm tròn như cũ); vendor giá riêng có thêm dòng "Theo số bàn: ≈ {priceMax}tr/bàn × {T} bàn"; vendor ước tính không có dòng đó. Pool KHÔNG có priceSource: venue y như cũ (so giá bàn với tổng).
import { stampedBack, loadModules, setNow, restoreNow } from "./_lib.mjs";
import { tab, chat, tabMatch, coupleProfile, CID, doc } from "../T-159/_lib.mjs";
const fails = []; const bad = (m) => { if (fails.length < 30) fails.push(m); };
const near = (x, y) => typeof x === "number" && Math.abs(x - y) < 0.011;
const R = (a, b) => ({ priceMin: a, priceMax: b, priceSource: "legacy_marry", priceAsOf: "2026-06" }); const E = (a, b) => ({ priceMin: a, priceMax: b, priceSource: "estimate_category", priceAsOf: "2026-06" });
const ids = {}; const OLD = {};
const dir = stampedBack({ mut: (arr) => {
  const tw = arr.filter((v) => v.category === "venue" && v.isVerified && v.rating === 0 && v.styles.length === 0 && v.availability.length === 12 && v.city === "HCMC").slice(0, 4);
  [["R1", R(4, 4.6)], ["E1", E(4, 4.6)], ["R2", R(8, 9)]].forEach(([k, p], i) => { Object.assign(tw[i], p); ids[k] = tw[i].id; });
  Object.assign(tw[3], { priceMin: 5, priceMax: 15 }); delete tw[3].priceSource; delete tw[3].priceAsOf; ids.OLD = tw[3].id;   // pool cũ: không nguồn giá
} });
const M = await loadModules(dir);
const hide = (keep) => Object.fromEntries(M.POOL.filter((v) => v.category === "venue" && !keep.includes(v.id)).map((v) => [v.id, { hidden: true, hidden_reason: "eval T-164" }]));
const KEEP3 = [ids.R1, ids.E1, ids.R2]; const ov3 = hide(KEEP3); const ovOld = hide([ids.OLD]);
const tabV = (o) => tabMatch(M, "venue", { overlay: ov3, ...o });
const bs = (r, id) => r.body?.vendors?.find((v) => v.id === id)?.match?.scoreBreakdown?.budget;
const reasons = (r, id) => (r.body?.vendors?.find((v) => v.id === id)?.match?.reasons || []).map((x) => x.label);
setNow("2026-11-14T08:00:00Z");
const P = (g, bc) => coupleProfile({ budget: 300, ...(g ? { guest_count: g } : {}), budget_by_category: { venue: bc } });
/* a. 300 khách = 30 bàn, ngân sách venue 120tr (4tr/bàn) */
{ const r = await tabV({ profile: P(300, 120) });
  if (r.err || r.status !== 200) bad("tab venue lỗi " + (r.err?.message || r.status));
  else { if (!near(bs(r, ids.R1), 0.25)) bad(`30 bàn x 4,6tr = 138tr so 120tr: điểm R1 mong 0,25, thấy ${bs(r, ids.R1)} (so giá bàn với tổng ngân sách thì ra 1)`); if (!near(bs(r, ids.E1), 0.25)) bad(`vendor ước tính cùng giá phải cùng điểm 0,25, thấy ${bs(r, ids.E1)}`); if (!near(bs(r, ids.R2), 0)) bad(`30 bàn x 9tr = 270tr: điểm R2 mong 0, thấy ${bs(r, ids.R2)}`); } }
{ const r = await tabV({ profile: P(300, 150) });
  if (!near(bs(r, ids.R1), 1) || !near(bs(r, ids.R2), 0)) bad(`ngân sách 150tr, 30 bàn: điểm R1/R2 mong 1/0, thấy ${bs(r, ids.R1)}/${bs(r, ids.R2)}`);
  if (!reasons(r, ids.R1).includes("≈ 4.6tr/bàn × 30 bàn")) bad(`chip venue giá riêng mong "≈ 4.6tr/bàn × 30 bàn", thấy ${JSON.stringify(reasons(r, ids.R1))}`);
  if (reasons(r, ids.R1).some((l) => /^Rẻ hơn|^Trong ngân sách/.test(l))) bad("venue có số bàn không còn chip 'Rẻ hơn'/'Trong ngân sách'");
  if (reasons(r, ids.E1).some((l) => /ngân sách|^Rẻ hơn|bàn/.test(l))) bad(`vendor ước tính không được có chip ngân sách/bàn, thấy ${JSON.stringify(reasons(r, ids.E1))}`);
  const w = r.body?.whyThoseVendors || "";
  if (!w.includes("Với khoảng 150tr cho tiệc & nhà hàng (≈ 5tr/bàn × 30 bàn)")) bad(`câu danh sách venue thiếu "(≈ 5tr/bàn × 30 bàn)": "${w}"`);
  if (!/giá dao động 4–9tr\/bàn/.test(w)) bad(`"giá dao động" của venue phải theo bàn (4–9tr/bàn; ước tính E1 không tính): "${w}"`); }
/* b. ceil: 301 khách = 31 bàn: 31 x 4,6 = 142,6tr so 120tr */
{ const r = await tabV({ profile: P(301, 120) }); const want = 1 - ((142.6 - 120) / 120) / 0.2; if (!near(bs(r, ids.R1), want)) bad(`301 khách => 31 bàn: điểm R1 mong ${want.toFixed(3)}, thấy ${bs(r, ids.R1)}`); }
/* c. không có số khách: trung tính 0,5, không chip, không "Với khoảng" */
{ const r = await tabV({ profile: P(0, 120) });
  for (const k of ["R1", "E1", "R2"]) if (bs(r, ids[k]) !== 0.5) bad(`không có số khách: điểm ngân sách ${k} mong đúng 0,5, thấy ${bs(r, ids[k])}`);
  if (reasons(r, ids.R1).some((l) => /bàn|ngân sách|^Rẻ hơn/.test(l))) bad("không có số khách: không được có chip ngân sách/bàn");
  if (/Với khoảng|Dựa trên gu .* khoảng/.test(r.body?.whyThoseVendors || "")) bad(`không có số khách: câu danh sách không được nêu "khoảng Xtr": "${r.body?.whyThoseVendors}"`); }
/* d. số khách trong bảng dự toán (budget.json) thắng hồ sơ */
{ const r = await tabV({ profile: P(100, 120), budgetDoc: { ...doc({ venue: 0 }), guests: 300 } }); if (!near(bs(r, ids.R1), 0.25)) bad(`hồ sơ 100 khách nhưng bảng dự toán 300 khách: điểm R1 mong 0,25 (30 bàn), thấy ${bs(r, ids.R1)}`);
  const r2 = await tabV({ profile: P(300, 120), budgetDoc: { ...doc({ venue: 0 }), guests: 0 } }); if (!near(bs(r2, ids.R1), 0.25)) bad(`bảng dự toán guests = 0 thì dùng hồ sơ 300 khách: điểm R1 mong 0,25, thấy ${bs(r2, ids.R1)}`); }
/* e. chi tiết vendor venue cùng số bàn */
{ const r = await tab(M, { url: `/api/vendors/${ids.R1}?coupleId=${CID}`, profile: P(300, 120) }); const s = r.body?.match?.scoreBreakdown?.budget; if (!near(s, 0.25)) bad(`chi tiết venue: điểm ngân sách mong 0,25, thấy ${s}`); }
/* f. pool cũ (không priceSource): như cũ, so giá bàn với tổng */
{ const r = await tabMatch(M, "venue", { overlay: ovOld, profile: P(300, 120) }); if (!near(bs(r, ids.OLD), 1)) bad(`venue chưa có nguồn giá: phải như cũ (so 15tr/bàn với 120tr => 1), thấy ${bs(r, ids.OLD)}`); }
/* g. chat: lọc cứng theo tổng, nới x1,2 lên tổng, dòng giá/bàn */
const msg = "Tìm nhà hàng tiệc cưới giúp anh chị";
{ const p = coupleProfile({ budget: 300, guest_count: 300, budget_breakdown: { venue: 150_000_000 } });
  const r = await chat(M, { message: msg + " 150tr", profile: p, overlay: ov3 });
  if (r.err || !r.md) bad("chat venue lỗi " + r.err?.message);
  else {
    if (!r.ids.includes(ids.R1) || !r.ids.includes(ids.E1)) bad(`chat venue 150tr, 30 bàn: R1 (4x30=120tr) và E1 phải qua lọc, thấy ${r.ids.length} ứng viên`);
    if (r.ids.includes(ids.R2)) bad("chat venue 150tr, 30 bàn: R2 (8x30=240tr) phải bị lọc (kể cả khi nới x1,2 = 180tr)");
    const lines = (r.sp || "").split("\n"); const nameOf = (id) => M.POOL.find((v) => v.id === id).name;
    const at = (id) => lines.findIndex((l) => l.includes(nameOf(id)) && /^\d+\./.test(l.trim())); const i1 = at(ids.R1), i2 = at(ids.E1);
    if (i1 < 0 || !/Giá: \d+-\d+tr\/bàn \(giá marry\.vn · 06\/2026\)/.test(lines[i1 + 1] || "")) bad(`dòng giá venue giá riêng mong "Giá: a-btr/bàn (giá marry.vn · 06/2026)", thấy "${(lines[i1 + 1] || "").trim()}"`);
    else if (!/Theo số bàn: ≈ 4\.6tr\/bàn × 30 bàn/.test(lines.slice(i1, i1 + 6).join("\n"))) bad("vendor giá riêng thiếu dòng 'Theo số bàn: ≈ 4.6tr/bàn × 30 bàn'");
    if (i2 < 0 || !/Giá: \d+-\d+tr\/bàn \(ước tính theo hạng mục\)/.test(lines[i2 + 1] || "")) bad(`dòng giá venue ước tính mong "Giá: a-btr/bàn (ước tính theo hạng mục)", thấy "${(lines[i2 + 1] || "").trim()}"`);
    else if (/Theo số bàn/.test(lines.slice(i2, i2 + 4).join("\n").split(/\n\d+\./)[0])) bad("vendor ước tính không được có dòng 'Theo số bàn'");
  } }
{ // 120tr: R1 (120tr) vừa đủ; E1 cùng; R2 bị loại
  const r = await chat(M, { message: msg + " 100tr", profile: coupleProfile({ budget: 300, guest_count: 300 }), overlay: ov3 });
  if (r.ids.includes(ids.R1) && !r.md?.relaxations_applied?.length) bad("chat venue 100tr, 30 bàn: R1 (120tr) vượt, chỉ được qua khi đã nới x1,2 (120tr)");
  if (r.md?.relaxations_applied?.length && !(r.ids.includes(ids.R1) && !r.ids.includes(ids.R2))) bad(`nới x1,2 lên tổng (120tr): R1 phải qua, R2 không; thấy ${r.ids.length} ứng viên`);
  if (!r.md?.relaxations_applied?.length && r.ids.length) bad("chat venue 100tr: R1 (120tr) phải bị lọc; nới x1,2 phải xảy ra khi còn dưới 5 ứng viên"); }
{ // số khách trong bảng dự toán thắng hồ sơ: hồ sơ 100 khách (10 bàn: R2 = 80tr qua), bảng 300 khách (30 bàn: R2 = 240tr loại)
  const p = coupleProfile({ budget: 300, guest_count: 100 });
  const a = await chat(M, { message: msg + " 150tr", profile: p, overlay: ov3 }); const b = await chat(M, { message: msg + " 150tr", profile: p, overlay: ov3, budgetDoc: { ...doc({ venue: 0 }), guests: 300 } });
  if (!a.ids.includes(ids.R2)) bad("hồ sơ 100 khách (10 bàn), 150tr: R2 (80tr) phải qua lọc");
  if (b.ids.includes(ids.R2)) bad("bảng dự toán 300 khách thắng hồ sơ 100: R2 (240tr) phải bị lọc"); }
{ // chat chưa có số khách: giữ hành vi hiện có (hỏi số khách, không ứng viên), không ném
  const r = await chat(M, { message: msg + " 150tr", profile: coupleProfile({ budget: 300 }), overlay: ov3 }); if (r.err) bad("chat venue chưa có số khách: không được ném"); if (r.ids.length) bad("chat venue chưa có số khách: không ứng viên (hỏi số khách trước như hôm nay)"); }
restoreNow();
if (fails.length && process.env.T164_ALL) console.log(fails.map((f) => "  - " + f).join("\n"));
if (fails.length) { console.log("FAIL " + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : "")); process.exit(1); }
console.log("PASS");
