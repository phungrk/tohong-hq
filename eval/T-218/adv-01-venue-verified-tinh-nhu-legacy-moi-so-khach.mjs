// T-218 adversary 01 (tầng 3): vi phân. Spec T-217 Hành vi 5: venue source_verified tính theo bàn "như legacy_marry" (điểm, chip, lọc chat ×1,2, "Theo số bàn", không khách = 0,5).
// Hai venue sinh đôi y hệt, cùng giá 3,4tr/bàn: VA priceSource "verified" (không priceAsOf), LA legacy_marry 2026-10 (còn mới). Với nhiều số khách biên
// (thiếu, 0, 1, 9, 10, 11, 301, chuỗi "300", âm, rất lớn) và ngân sách biên quanh ngưỡng ×1,2 (84/85/86 với 30 bàn), mọi điểm ngân sách, chip, có mặt ở chat và dòng "Theo số bàn" phải giống nhau.
// Mong đợi: không có khác biệt nào ngoài nhãn giá. Chạy: node eval/T-218/<file> · Biến: TOHONG_BACK_REPO.
import * as H from "./_adv218.mjs";
const { M, ids: [VA, LA] } = await H.loadTwins([
  { priceMin: 3.4, priceMax: 3.4, priceSource: "verified" },
  { priceMin: 3.4, priceMax: 3.4, priceSource: "legacy_marry", priceAsOf: "2026-10" },
]);
const fails = []; const bad = (m) => { if (fails.length < 30) fails.push(m); };
const ov = H.hide(M, [VA, LA]);
const nameOf = (id) => M.POOL.find((v) => v.id === id).name;
const G = [undefined, 0, 1, 9, 10, 11, 299, 301, "300", -5, 4999];
const BUD = [undefined, 30, 84, 85, 86, 102, 150];
const strip = (s, id) => String(s).split(nameOf(id)).join("<X>");
for (const g of G) for (const bc of BUD) {
  const prof = H.coupleProfile({ budget: 300, ...(g !== undefined ? { guest_count: g } : {}), ...(bc !== undefined ? { budget_by_category: { venue: bc } } : {}) });
  const r = await H.match(M, "venue", { overlay: ov, profile: prof });
  if (r.status !== 200) { bad(`match g=${g} bc=${bc}: HTTP ${r.status} ${r.err?.message || ""}`); continue; }
  const a = r.body.vendors.find((v) => v.id === VA), l = r.body.vendors.find((v) => v.id === LA);
  if (!a || !l) { bad(`match g=${g} bc=${bc}: thiếu ${!a ? "VA" : "LA"}`); continue; }
  if (a.match?.scoreBreakdown?.budget !== l.match?.scoreBreakdown?.budget) bad(`g=${g} bc=${bc}: điểm ngân sách verified ${a.match?.scoreBreakdown?.budget} ≠ legacy ${l.match?.scoreBreakdown?.budget}`);
  const ra = JSON.stringify((a.match?.reasons || []).map((x) => x.label)), rl = JSON.stringify((l.match?.reasons || []).map((x) => x.label));
  if (ra !== rl) bad(`g=${g} bc=${bc}: chip verified ${ra} ≠ legacy ${rl}`);
  if (a.price_basis !== "source_verified" || a.price_label !== "Giá đã xác minh" || a.price_source !== "verified") bad(`g=${g}: VA basis/label/source ${a.price_basis}/${a.price_label}/${a.price_source}`);
  if (bc === undefined) continue;
  const c = await H.chat(M, { message: `Tìm nhà hàng tiệc cưới giúp anh chị ${bc}tr`, profile: H.coupleProfile({ budget: 300, ...(g !== undefined ? { guest_count: g } : {}) }), overlay: ov });
  if (c.err) { bad(`chat g=${g} bc=${bc} lỗi ${c.err.message}`); continue; }
  if (c.ids.includes(VA) !== c.ids.includes(LA)) bad(`chat g=${g} ${bc}tr: verified ${c.ids.includes(VA) ? "qua" : "bị lọc"}, legacy ${c.ids.includes(LA) ? "qua" : "bị lọc"}`);
  const lines = (c.sp || "").split("\n");
  const block = (id) => { const at = lines.findIndex((x) => x.includes(nameOf(id)) && /^\d+\./.test(x.trim())); return at < 0 ? null : lines.slice(at + 1, at + 6).filter((x) => !/^\s*\d+\./.test(x)).join("\n"); };
  const ba = block(VA), bl = block(LA);
  if ((ba === null) !== (bl === null)) bad(`chat g=${g} ${bc}tr: khối prompt có VA=${ba !== null} LA=${bl !== null}`);
  else if (ba !== null) {
    const ta = /Theo số bàn[^\n]*/.exec(ba)?.[0] || null, tl = /Theo số bàn[^\n]*/.exec(bl)?.[0] || null;
    if (ta !== tl) bad(`chat g=${g} ${bc}tr: dòng "Theo số bàn" verified ${JSON.stringify(ta)} ≠ legacy ${JSON.stringify(tl)}`);
    const ea = /ước tính/i.test(ba), el = /ước tính/i.test(bl);
    if (ea !== el) bad(`chat g=${g} ${bc}tr: verified ${ea ? "bị" : "không"} gắn ước tính, legacy ${el ? "bị" : "không"}`);
  }
}
H.done(fails);
