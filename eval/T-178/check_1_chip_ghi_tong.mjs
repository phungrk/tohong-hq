// T-178 tiêu chí 1. Chip lý do theo bàn của nhà hàng ghi tổng tiền: "≈ {giá}tr/bàn × {N} bàn = {tổng}tr", với {tổng} = match.budgetBasis.totalTr làm tròn 1 chữ số (cùng khuôn số của {giá}).
// Đo ở GET /api/vendors/match VÀ GET /api/vendors/:id (hai nơi cho cùng chip). Chạy từ gốc tohong-hq: node eval/T-178/check_1_chip_ghi_tong.mjs
import { setup, match, detail, budgetDoc, coupleProfile, restoreNow, done, ids, chipOf, r1, near } from "./_lib.mjs";
const fails = []; const bad = (m) => { if (fails.length < 25) fails.push(m); };
const M = await setup();
const P = (g, extra = {}) => coupleProfile({ budget: 3000, guest_count: g, ...extra });
// [nhãn, venue, hồ sơ, bảng, chip mong chính xác]
const cases = [
  ["ví dụ Capu: 3tr x 20 bàn (200 khách, tiệc cưới 90tr)", "A", P(200), budgetDoc(90, { guests: 200 }), "≈ 3tr/bàn × 20 bàn = 60tr"],
  ["giá thập phân: 3,9 x 20 bàn", "B", P(200), budgetDoc(90, { guests: 200 }), "≈ 3.9tr/bàn × 20 bàn = 78tr"],
  ["tổng thập phân và sai số float (3,9 x 33 = 128,70000000000002): ghi 128.7", "B", P(330), budgetDoc(200, { guests: 330 }), "≈ 3.9tr/bàn × 33 bàn = 128.7tr"],
  ["giá bị làm tròn ở chip (4,25 -> 4.3) nhưng tổng lấy từ số đầy đủ 4,25 x 20 = 85, KHÔNG phải 4.3 x 20 = 86", "C", P(200), budgetDoc(90, { guests: 200 }), "≈ 4.3tr/bàn × 20 bàn = 85tr"],
  ["số khách lẻ: 201 khách = 21 bàn: 3 x 21 = 63", "A", P(201), budgetDoc(90, { guests: 201 }), "≈ 3tr/bàn × 21 bàn = 63tr"],
  ["bảng 300 khách thắng hồ sơ 200: 3 x 30 = 90", "A", P(200), budgetDoc(120, { guests: 300 }), "≈ 3tr/bàn × 30 bàn = 90tr"],
  ["không có bảng, hồ sơ 200 khách, ngân sách tổng 200 (venue ước 96tr)", "A", P(200, { budget: 200 }), undefined, "≈ 3tr/bàn × 20 bàn = 60tr"],
  ["số lớn không phân cách hàng nghìn: 3,9 x 360 bàn = 1404", "B", P(3600, { budget: 6000 }), budgetDoc(2000, { total_tr: 6000, guests: 3600 }), "≈ 3.9tr/bàn × 360 bàn = 1404tr"],
];
for (const [label, key, profile, doc, want] of cases) {
  const id = ids[key];
  const m = await match(M, { keep: [id], profile, doc });
  if (m.r.err || m.r.status !== 200 || !m.vs.get(id)) { bad(`${label}: match lỗi ${m.r.err?.message || m.r.status}`); continue; }
  const v = m.vs.get(id); const chips = chipOf(v);
  if (chips.length !== 1) { bad(`${label}: mong đúng 1 chip theo bàn, thấy ${JSON.stringify(chips)} (reasons ${JSON.stringify((v.match?.reasons || []).map((x) => x.label))})`); continue; }
  if (chips[0] !== want) bad(`${label}: chip mong "${want}", thấy "${chips[0]}"`);
  // Một nguồn số: tổng trong chip = budgetBasis.totalTr làm tròn cùng khuôn (r1), và = priceMax x số bàn
  const bb = v.match?.budgetBasis;
  const mm = /^≈ (\S+)tr\/bàn × (\d+) bàn = (\S+)tr$/.exec(chips[0]);
  if (!mm) bad(`${label}: chip không đúng khuôn "≈ {giá}tr/bàn × {N} bàn = {tổng}tr": "${chips[0]}"`);
  else if (!bb || bb.kind !== "per_table") bad(`${label}: thiếu budgetBasis per_table để đối chiếu`);
  else {
    if (mm[3] !== r1(bb.totalTr)) bad(`${label}: tổng trong chip "${mm[3]}" khác budgetBasis.totalTr ${bb.totalTr} (làm tròn "${r1(bb.totalTr)}")`);
    if (Number(mm[2]) !== bb.tables) bad(`${label}: số bàn trong chip ${mm[2]} khác budgetBasis.tables ${bb.tables}`);
    if (!near(bb.totalTr, bb.pricePerTableTr * bb.tables)) bad(`${label}: budgetBasis.totalTr ${bb.totalTr} khác pricePerTableTr x tables`);
    if (/[,\s]\d{3}tr|\d,\d/.test(chips[0].replace(/ /g, " ")) || /\d,\d/.test(chips[0])) bad(`${label}: chip có dấu phẩy/phân cách nghìn: "${chips[0]}"`);
    if (!bb.text.includes(`= ${r1(bb.totalTr).replace(".", ",")}tr so với`)) bad(`${label}: dòng Ngân sách (budgetBasis.text) và chip phải cùng một tổng, text="${bb.text}"`);
  }
  const d = await detail(M, { id, profile, doc });
  if (d.r.err || d.r.status !== 200 || !d.m) { bad(`${label}: chi tiết lỗi ${d.r.err?.message || d.r.status}`); continue; }
  const dc = (d.m.reasons || []).map((x) => x.label ?? x).filter((l) => /^≈ .*\/bàn/.test(l));
  if (JSON.stringify(dc) !== JSON.stringify(chips)) bad(`${label}: chi tiết và danh sách khác chip: ${JSON.stringify(dc)} vs ${JSON.stringify(chips)}`);
}
restoreNow(); done(fails);
