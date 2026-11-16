// BẢN THAY ĐỀ NGHỊ của T-183 cho eval/invariants/planner/vendor/matching/inv-007-... (Chief quyết, ghi decisions/, không ai tự sửa file gốc). Khác bản gốc đúng một điều: số trong chip dùng dấu phẩy.
// ĐỎ trên back main 2d1a76c tới khi PR back T-183 merge (ADR-028).
// Nguồn: T-178 (spec products/T-178-chip-nha-hang-ghi-tong-tien.md v1, H1 "Khuôn chip" và "Bất biến đề xuất"), rút bởi spec-critic khi spec qua Spec Gate 2026-11-15.
// Nằm ở eval/T-178/bat-bien-cho-merge/ tới khi PR back T-178 merge (ADR-028: ĐỎ trên main c2445db vì chip chưa ghi tổng); Chief of Staff chuyển vào
// eval/invariants/planner/vendor/matching/ và đặt số (mở rộng matching/inv-005 "một nguồn số" sang chip).
// INV (planner/vendor/matching) · Chip theo bàn của nhà hàng luôn có đúng khuôn "≈ {giá}tr/bàn × {N} bàn = {tổng}tr", và ba số trong chip là đúng ba số
//   của match.budgetBasis cùng vendor: {giá} = pricePerTableTr, {N} = tables, {tổng} = totalTr (tổng tính từ giá CHƯA làm tròn), mỗi số làm tròn 1 chữ số,
//   dấu PHẨY thập phân (T-183, khuôn T-167), bỏ ",0", không phân cách hàng nghìn. Chip chỉ có ở vendor budgetBasis per_table, giá không ước tính, điểm Ngân sách >= 1;
//   không hạng mục nào khác có chip "/bàn". Chi tiết vendor (GET /api/vendors/:id) cho đúng chip như danh sách.
// Đo qua hành vi công khai GET /api/vendors/match và GET /api/vendors/:id; pool THẬT (thêm hai venue đặt giá 4,25 và 3,9 để thử làm tròn), R2 giả, không mạng.
// Chạy: node <file>. Repo: TOHONG_BACK_REPO hoặc ../tohong-back.
import { existsSync as ex } from "fs"; import { fileURLToPath as f, pathToFileURL as u } from "url"; import p from "path";
let hq = p.dirname(f(import.meta.url)); while (!ex(p.join(hq, "scripts", "gate.py")) && p.dirname(hq) !== hq) hq = p.dirname(hq);   // ADR-070
const L = (t) => import(u(p.join(hq, "eval", t, "_lib.mjs")).href);
const { stampedBack, loadModules, setNow, restoreNow } = await L("T-164");
const { tab, coupleProfile, CID, done } = await L("T-159");
const fails = []; const bad = (m) => { if (fails.length < 12) fails.push(m); };
const r1 = (x) => String(Math.round(x * 10) / 10).replace(".", ",");   // khuôn chip (T-183: dấu phẩy như budgetBasis.text), viết độc lập với mã
const odd = [];
const M = await loadModules(stampedBack({ stamp: () => {}, mut: (arr) => {
  const vs = arr.filter((v) => v.category === "venue" && v.city === "HCMC").slice(0, 2);
  [[4.25, 4.25], [3.9, 3.9]].forEach(([a, b], i) => { Object.assign(vs[i], { priceMin: a, priceMax: b, priceSource: "legacy_marry", priceAsOf: "2026-06", capacity: { min: 1, max: 2e9 }, availability: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }); odd.push(vs[i].id); });
} }));
setNow("2026-11-14T08:00:00Z");
const CATS = ["venue", "photography", "decor", "ceremony"];
const doc = (venue, guests, total_tr = 6000) => ({ categories: [{ id: "venue", name: "venue", allocated_tr: venue, items: [] }], total_tr, guests, mung_tr: 0, updated_at: "2026-11-14T00:00:00.000Z" });
const CASES = [
  ["200 khách, bảng 90tr", coupleProfile({ budget: 200, guest_count: 200 }), doc(90, 200, 200)],
  ["201 khách (21 bàn), bảng 120tr", coupleProfile({ budget: 300, guest_count: 201 }), doc(120, 201, 300)],
  ["330 khách (33 bàn), bảng 300tr", coupleProfile({ budget: 600, guest_count: 330 }), doc(300, 330, 600)],
  ["bảng 300 khách thắng hồ sơ 120", coupleProfile({ budget: 400, guest_count: 120 }), doc(200, 300, 400)],
  ["không bảng, hồ sơ 157 khách, tổng 400", coupleProfile({ budget: 400, guest_count: 157 }), undefined],
  ["3600 khách (360 bàn), venue 5000tr", coupleProfile({ budget: 6000, guest_count: 3600 }), doc(5000, 3600)],
  ["không số khách", coupleProfile({ budget: 250 }), undefined],
];
const isTableChip = (l) => /\/bàn/.test(l);
let chips = 0; const seenOdd = new Set();
for (const [label, profile, budgetDoc] of CASES) for (const cat of CATS) {
  const r = await tab(M, { url: `/api/vendors/match?coupleId=${CID}&category=${cat}&limit=50`, profile, budgetDoc, countFetch: { n: 0 } });
  if (r.err || r.status !== 200) { bad(`${label}/${cat}: match lỗi ${r.err?.message || r.status}`); continue; }
  let detailed = 0;
  for (const v of r.body?.vendors || []) {
    const ls = (v.match?.reasons || []).map((x) => (typeof x === "string" ? x : x.label)); const tc = ls.filter(isTableChip);
    if (!tc.length) continue; const tag = `${label}/${cat}/${v.id}`;
    if (tc.length > 1) { bad(`${tag}: nhiều chip theo bàn ${JSON.stringify(tc)}`); continue; }
    const c = tc[0], bb = v.match.budgetBasis; chips++; if (odd.includes(v.id)) seenOdd.add(v.id);
    if (cat !== "venue") { bad(`${tag}: hạng mục ${cat} có chip theo bàn "${c}"`); continue; }
    if (!bb || bb.kind !== "per_table" || bb.estimated !== false || !(v.match.scoreBreakdown?.budget >= 1)) { bad(`${tag}: chip "${c}" mà budgetBasis ${bb?.kind}/ước tính ${bb?.estimated}/điểm ${v.match.scoreBreakdown?.budget}`); continue; }
    const want = `≈ ${r1(bb.pricePerTableTr)}tr/bàn × ${bb.tables} bàn = ${r1(bb.totalTr)}tr`;
    if (c !== want) bad(`${tag}: chip "${c}", mong "${want}" (budgetBasis giá ${bb.pricePerTableTr}, ${bb.tables} bàn, tổng ${bb.totalTr})`);
    if (detailed < 3) {
      detailed++;
      const d = await tab(M, { url: `/api/vendors/${v.id}?coupleId=${CID}`, profile, budgetDoc, countFetch: { n: 0 } });
      const dc = (d.body?.match?.reasons || []).map((x) => (typeof x === "string" ? x : x.label)).filter(isTableChip);
      if (d.err || d.status !== 200) bad(`${tag}: chi tiết lỗi ${d.err?.message || d.status}`);
      else if (JSON.stringify(dc) !== JSON.stringify(tc)) bad(`${tag}: chi tiết ${JSON.stringify(dc)} khác danh sách ${JSON.stringify(tc)}`);
    }
  }
}
restoreNow();
if (!chips) bad("không thấy chip theo bàn nào (khung hỏng)");
if (seenOdd.size < odd.length) bad(`venue thử làm tròn (4,25 và 3,9) không ra chip ở ca nào (khung hỏng): thấy ${seenOdd.size}/${odd.length}`);
done(fails);
