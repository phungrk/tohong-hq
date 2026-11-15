// T-178 tiêu chí 2. Chip theo bàn chỉ hiện đúng các trường hợp hôm nay (điểm Ngân sách = 1, venue theo bàn có giá riêng, có số bàn; không hiện khi giá ước tính, thiếu số khách, điểm < 1, hạng mục khác),
// và KHÔNG đổi điểm, thứ tự, hay các chip khác so với main c2445db (golden-main.json, chụp trên main trước T-178; chỉ khác nhau đúng phần " = {tổng}tr" của chip theo bàn).
// Chạy từ gốc tohong-hq: node eval/T-178/check_2_chip_dung_cho_cu_diem_thu_tu_khong_doi.mjs   (T178_GOLDEN=1 in lại golden từ back hiện tại; chỉ chạy trên main chưa có T-178)
import fs from "node:fs"; import { fileURLToPath } from "node:url"; import path from "node:path";
import { setup, match, budgetDoc, coupleProfile, restoreNow, done, ids, chipOf, labels, expectScore, near } from "./_lib.mjs";
const fails = []; const bad = (m) => { if (fails.length < 25) fails.push(m); };
const M = await setup();
const role = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]));
const P = (extra = {}) => coupleProfile({ budget: 300, ...extra });
const V5 = () => ["A", "B", "C", "D", "E"].map((k) => ids[k]);
const scenarios = {
  S1_vua_ngan_sach: { cat: "venue", keep: V5(), profile: P({ guest_count: 200 }), doc: budgetDoc(90, { guests: 200 }) },
  S2_vuot_mot_phan: { cat: "venue", keep: V5(), profile: P({ guest_count: 200 }), doc: budgetDoc(70, { guests: 200 }) },
  S3_khong_so_khach: { cat: "venue", keep: V5(), profile: P(), doc: undefined },
  S4_nhieu_ban: { cat: "venue", keep: V5(), profile: P({ guest_count: 300 }), doc: budgetDoc(120, { guests: 300 }) },
  S5_khong_ngan_sach_venue: { cat: "venue", keep: V5(), profile: coupleProfile({ guest_count: 200 }), doc: undefined },
  S6_photography: { cat: "photography", keep: [ids.P], profile: P({ guest_count: 200 }), doc: undefined },
};
const strip = (l) => l.replace(/^(≈ \S+tr\/bàn × \d+ bàn) = \S+tr$/, "$1");   // chip mới -> chip cũ
const snap = {};
for (const [name, s] of Object.entries(scenarios)) {
  const m = await match(M, { category: s.cat, keep: s.keep, profile: s.profile, doc: s.doc });
  if (m.r.err || m.r.status !== 200) { bad(`${name}: match lỗi ${m.r.err?.message || m.r.status}`); continue; }
  snap[name] = { order: m.order.map((id) => role[id]), vendors: Object.fromEntries(m.order.map((id) => { const v = m.vs.get(id); return [role[id], { totalScore: v.match.totalScore, scoreBreakdown: v.match.scoreBreakdown, reasons: labels(v).map(strip) }]; })) };
  // Quy tắc hiện chip (viết lại độc lập): venue theo bàn, giá riêng (không ước tính), có số bàn, điểm Ngân sách = 1
  for (const id of m.order) {
    const v = m.vs.get(id), bb = v.match.budgetBasis, chips = chipOf(v), k = role[id];
    const should = s.cat === "venue" && bb?.kind === "per_table" && bb.estimated === false && v.match.scoreBreakdown.budget >= 1 && (v.match.reasons || []).length > 0;
    const inThree = chips.length === 1;
    if (!should && chips.length) bad(`${name}/${k}: không được có chip theo bàn (kind ${bb?.kind}, estimated ${bb?.estimated}, điểm ${v.match.scoreBreakdown.budget}) nhưng thấy ${JSON.stringify(chips)}`);
    if (should && !inThree && labels(v).length < 3) bad(`${name}/${k}: phải có đúng 1 chip theo bàn, thấy ${JSON.stringify(labels(v))}`);
    if (chips.length > 1) bad(`${name}/${k}: nhiều hơn một chip theo bàn`);
    if (k === "E" && chips.length) bad(`${name}/E: vendor giá ước tính không được có chip theo bàn`);
    const es = bb?.kind === "per_table" ? expectScore(bb.totalTr, bb.categoryBudgetTr) : null;
    if (es !== null && !near(v.match.scoreBreakdown.budget, es)) bad(`${name}/${k}: điểm Ngân sách ${v.match.scoreBreakdown.budget} không khớp phép so (mong ${es})`);
  }
}
if (process.env.T178_GOLDEN) { console.log(JSON.stringify(snap, null, 1)); restoreNow(); process.exit(0); }
const golden = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "golden-main.json"), "utf8"));
for (const [name, g] of Object.entries(golden)) {
  const s = snap[name]; if (!s) continue;
  if (JSON.stringify(s.order) !== JSON.stringify(g.order)) bad(`${name}: thứ tự đổi: mong ${g.order.join(",")}, thấy ${s.order.join(",")}`);
  for (const [k, gv] of Object.entries(g.vendors)) {
    const v = s.vendors[k]; if (!v) { bad(`${name}/${k}: mất khỏi kết quả`); continue; }
    if (v.totalScore !== gv.totalScore) bad(`${name}/${k}: tổng điểm đổi ${gv.totalScore} -> ${v.totalScore}`);
    if (JSON.stringify(v.scoreBreakdown) !== JSON.stringify(gv.scoreBreakdown)) bad(`${name}/${k}: điểm thành phần đổi ${JSON.stringify(gv.scoreBreakdown)} -> ${JSON.stringify(v.scoreBreakdown)}`);
    if (JSON.stringify(v.reasons) !== JSON.stringify(gv.reasons)) bad(`${name}/${k}: chip đổi ngoài phần tổng: ${JSON.stringify(gv.reasons)} -> ${JSON.stringify(v.reasons)}`);
  }
}
restoreNow(); done(fails);
