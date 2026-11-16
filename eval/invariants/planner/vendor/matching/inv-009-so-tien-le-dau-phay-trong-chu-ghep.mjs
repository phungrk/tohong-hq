// Nguồn: T-183 (spec products/T-183-don-no-nho-dau-phay-score-epoch-spec-t179.md v1, H1 và "Bất biến đề xuất" matching/inv-009), rút bởi spec-critic khi spec qua Spec Gate 2026-11-16.
// Nằm ở eval/T-183/bat-bien-cho-merge/ tới khi PR back T-183 merge (ADR-028: ĐỎ trên back main 2d1a76c vì chip và câu tư vấn còn "3.9tr");
// Chief of Staff chuyển vào eval/invariants/planner/vendor/matching/ sau merge, nếu PASS trên main mới.
// INV (planner/vendor/matching) · Mọi chữ do back sinh cho cặp đôi trong kết quả ghép (chip match.reasons, match.whyThisVendor, match.budgetBasis.text, whyThoseVendors),
//   ở danh sách và chi tiết, viết MỌI số tiền (số đứng trước "tr", kể cả đầu dưới của khoảng "a–btr") đúng một khuôn: số nguyên, hoặc đúng MỘT chữ số thập phân
//   sau dấu PHẨY, không ",0", không dấu chấm, không phân cách hàng nghìn. Chữ không phải tiền ("Còn lịch 20.3", "Đánh giá cao (4.9★)") không thuộc bất biến.
// Rộng hơn eval tầng 1 của T-183: chạy trên pool THẬT (thêm venue giá 4,25 và 3,9, ảnh cưới 10,5 và 15,5 để thử số lẻ) qua mọi hạng mục, nhiều ca số khách/ngân sách lẻ,
//   có và không có ngày cưới; đo qua hành vi công khai GET /api/vendors/match và GET /api/vendors/:id, R2 giả, không mạng. Không nói cách cài đặt.
// Chạy: node <file>. Repo: TOHONG_BACK_REPO hoặc ../tohong-back.
import { existsSync as ex } from "fs"; import { fileURLToPath as f, pathToFileURL as u } from "url"; import p from "path";
let hq = p.dirname(f(import.meta.url)); while (!ex(p.join(hq, "scripts", "gate.py")) && p.dirname(hq) !== hq) hq = p.dirname(hq);   // ADR-070
const L = (t) => import(u(p.join(hq, "eval", t, "_lib.mjs")).href);
const { stampedBack, loadModules, setNow, restoreNow } = await L("T-164");
const { tab, coupleProfile, CID, done } = await L("T-159");
const fails = []; const bad = (m) => { if (fails.length < 12) fails.push(m); };
const M = await loadModules(stampedBack({ stamp: () => {}, mut: (arr) => {
  const set = (cat, prices) => arr.filter((v) => v.category === cat && v.city === "HCMC").slice(0, prices.length).forEach((v, i) =>
    Object.assign(v, { priceMin: prices[i], priceMax: prices[i], priceSource: "legacy_marry", priceAsOf: "2026-06", capacity: { min: 1, max: 2e9 }, availability: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }));
  set("venue", [4.25, 3.9]); set("photography", [10.5, 15.5]);
} }));
setNow("2026-11-14T08:00:00Z");
// Số tiền: dãy số đứng ngay trước "tr" (không phải đầu một từ như "trang"), hoặc đầu dưới của "a–btr".
const TR = "\\s?tr(?![a-zà-ỹ])";
const MONEY = new RegExp(`(\\d[\\d.,]*)(?=${TR}|\\s?[–-]\\s?\\d[\\d.,]*${TR})`, "gi");
const OK = /^\d+(,[1-9])?$/;
let seen = 0, lẻ = 0;
const check = (tag, s) => { if (typeof s !== "string") return; for (const m of s.matchAll(MONEY)) { seen++; if (/,/.test(m[1])) lẻ++; if (!OK.test(m[1])) bad(`${tag}: số tiền "${m[1]}" sai khuôn trong "${s.slice(0, 160)}"`); } };
const doc = (alloc, guests, total_tr = 600) => ({ categories: Object.entries(alloc).map(([id, a]) => ({ id, name: id, allocated_tr: a, items: [] })), total_tr, guests, mung_tr: 0, updated_at: "2026-11-14T00:00:00.000Z" });
const noDate = { couple: { city: "HCMC" } };
const CASES = [
  ["300 khách, venue 139,5, ảnh 39,5, decor 20,25 (không ngày)", coupleProfile({ ...noDate, budget: 600, guest_count: 300 }), doc({ venue: 139.5, photography: 39.5, decor: 20.25 }, 300)],
  ["330 khách, venue 300 (có ngày)", coupleProfile({ budget: 600, guest_count: 330 }), doc({ venue: 300, photography: 40 }, 330)],
  ["201 khách, venue 120,04 (không ngày)", coupleProfile({ ...noDate, budget: 300, guest_count: 201 }), doc({ venue: 120.04, photography: 12.75 }, 201, 300)],
  ["3600 khách, venue 5000 (không ngày)", coupleProfile({ ...noDate, budget: 6000, guest_count: 3600 }), doc({ venue: 5000 }, 3600, 6000)],
  ["không bảng, hồ sơ 157 khách, tổng 400", coupleProfile({ budget: 400, guest_count: 157 }), undefined],
  ["không số khách", coupleProfile({ ...noDate, budget: 250 }), undefined],
];
for (const [label, profile, budgetDoc] of CASES) for (const cat of ["venue", "photography", "decor", "makeup", "ceremony"]) {
  const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=${cat}&limit=50`, profile, budgetDoc, countFetch: { n: 0 } });
  if (r.err || r.status !== 200) { bad(`${label}/${cat}: match lỗi ${r.err?.message || r.status}`); continue; }
  check(`${label}/${cat}/whyThoseVendors`, r.body?.whyThoseVendors);
  let detailed = 0;
  for (const v of r.body?.vendors || []) {
    const t = `${label}/${cat}/${v.id}`;
    for (const x of v.match?.reasons || []) check(`${t}/chip`, typeof x === "string" ? x : x.label);
    check(`${t}/whyThisVendor`, v.match?.whyThisVendor); check(`${t}/budgetBasis.text`, v.match?.budgetBasis?.text);
    if (detailed < 2) {
      detailed++;
      const d = await tab(M, { url: `/api/vendors/${v.id}?coupleId=${CID}`, profile, budgetDoc, countFetch: { n: 0 } });
      if (d.err || d.status !== 200) { bad(`${t}: chi tiết lỗi ${d.err?.message || d.status}`); continue; }
      for (const x of d.body?.match?.reasons || []) check(`${t}/chi tiết/chip`, typeof x === "string" ? x : x.label);
      check(`${t}/chi tiết/whyThisVendor`, d.body?.match?.whyThisVendor); check(`${t}/chi tiết/budgetBasis.text`, d.body?.match?.budgetBasis?.text);
    }
  }
}
restoreNow();
if (seen < 50 || lẻ < 5) bad(`khung hỏng: chỉ thấy ${seen} số tiền, ${lẻ} số lẻ`);
done(fails);
