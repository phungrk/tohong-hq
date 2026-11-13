// T-143 adv-02 (adversary, tầng 3): hồ sơ thiếu/lạ trên đường chat (spec T-140 mục 1, 2, 3, 6 "lỗi bộ ghép").
// Ca: không ngân sách/ngày/guest/style, hồ sơ rỗng, ngân sách 0/âm/rất nhỏ/rất lớn trong tin nhắn, ngân sách tổng âm/chuỗi, ngày dạng chuỗi lạ/số,
// city: alias HCMC (TP.HCM, Thành phố Hồ Chí Minh, Sài Gòn, Quận 7 TP.HCM, tp hcm), ngoài pool (Cần Thơ, Hà Nội, Bình Dương), dạng số/object/khoảng trắng,
// style/dealbreaker rác, dealbreaker chuỗi, guest chữ/âm, venue thiếu guest; 6 hạng mục; MATCHER_URL/KEY có mặt, DEBUG_MATCHING bật.
// Mong đợi mỗi ca: không ném, 0 lần fetch; ứng viên ∈ pool, đúng hạng mục, không ẩn, đủ tư cách; priceMin×1e6 ≤ ngân sách (≤ trunc(×1,2) khi nới) với
// ngân sách hữu hạn do buildMatchProfile của back dựng; khối ứng viên không có "NaN"/"undefined"/"null"; alias HCMC có ≥1 ứng viên; ngoài pool 0 ứng viên.
import { frozenRoot, load, candidates } from "../../T-140/_lib.mjs";
const M = await load(frozenRoot());
const byId = new Map(M.POOL.map((v) => [v.id, v]));
const P = "Tìm photographer chụp ảnh cưới giúp anh chị";
const base = { couple: { city: "HCMC", wedding_date: "2029-03-20" } };
const C = [
  ["hồ sơ rỗng", {}, P, "any"], ["không ngân sách", { couple: {} }, P, "any"], ["ngân sách 0tr", base, P + " 0tr", "any"], ["ngân sách -5tr", base, P + " -5tr", "any"],
  ["ngân sách 0,5tr", base, P + " 0,5tr", "any"], ["ngân sách cực lớn", base, P + " 99999999tr", "some"], ["ngân sách tổng âm", { ...base, budget: -500 }, P, "any"],
  ["ngân sách tổng chuỗi", { ...base, budget: "abc" }, P, "any"], ["ngày chuỗi lạ", { couple: { city: "HCMC", wedding_date: "tháng 3 năm sau" } }, P + " 30tr", "some"],
  ["ngày số", { couple: { city: "HCMC", wedding_date: 20290320 } }, P + " 30tr", "some"], ["ngày quá khứ", { couple: { city: "HCMC", wedding_date: "2001-01-01" } }, P + " 30tr", "some"],
  ["TP.HCM", { couple: { city: "TP.HCM" } }, P + " 30tr", "some"], ["Thành phố Hồ Chí Minh", { couple: { city: "Thành phố Hồ Chí Minh" } }, P + " 30tr", "some"],
  ["Sài Gòn", { couple: { city: "Sài Gòn" } }, P + " 30tr", "some"], ["Quận 7, TP.HCM", { couple: { city: "Quận 7, TP.HCM" } }, P + " 30tr", "some"], ["tp hcm", { couple: { city: "tp hcm" } }, P + " 30tr", "some"],
  ["Cần Thơ", { couple: { city: "Cần Thơ" } }, P + " 30tr", "none"], ["Hà Nội", { couple: { city: "Hà Nội" } }, P + " 30tr", "none"], ["Bình Dương", { couple: { city: "Bình Dương" } }, P + " 30tr", "none"],
  ["city số", { couple: { city: 700000 } }, P + " 30tr", "any"], ["city object", { couple: { city: { name: "HCM" } } }, P + " 30tr", "any"], ["city khoảng trắng", { couple: { city: "   " } }, P + " 30tr", "any"],
  ["style/dealbreaker rác", { ...base, preferences: { style_tags: [null, 5, { a: 1 }, "KOREAN "], dealbreakers: [null, 3, "VINTAGE"] } }, P + " 30tr", "some"],
  ["dealbreaker chuỗi", { ...base, preferences: { dealbreakers: "vintage" } }, P + " 30tr", "some"],
  ["venue guest chữ", { ...base, guest_count: "hai trăm" }, "Tìm nhà hàng tiệc cưới 300tr", "any"], ["venue thiếu guest", base, "Tìm nhà hàng tiệc cưới 300tr", "none"],
  ["venue guest âm", { ...base, guest_count: -10 }, "Tìm nhà hàng tiệc cưới 300tr", "any"],
  ["attire 10tr", base, "Tìm áo cưới đẹp 10tr", "some"], ["makeup 3tr", base, "Gợi ý makeup cô dâu 3tr", "some"], ["decor 5tr", base, "Kiếm hoa cưới cầm tay 5tr", "some"], ["transport 2tr", base, "Tìm xe hoa 2tr", "any"],
];
const fails = []; let withCands = 0;
for (const [label, cs, msg, expect] of C) {
  const bucket = new M.MemoryBucket(); bucket.data.set("data/couples/c1/profile.yaml", JSON.stringify(cs)); M.resetOverlayCache();
  const of = globalThis.fetch, ow = console.warn; let net = 0; globalThis.fetch = async (u) => { net++; throw new Error("không mạng " + u); }; console.warn = () => {};
  let r;
  try { r = await M.buildChatContext({ CHAT_DATA: bucket, MATCHER_URL: "https://matcher.test", MATCHER_API_KEY: "k", DEBUG_MATCHING: "true" }, "c1", null, msg, null, "u1"); }
  catch (e) { fails.push(`${label}: ném ${e.message}`); continue; } finally { globalThis.fetch = of; console.warn = ow; }
  if (net) fails.push(`${label}: gọi mạng ${net} lần`);
  const intent = M.detectMatchIntent(msg, ["vendor", "venue"]); const mp = M.buildMatchProfile({ coupleState: cs, userMessage: msg, intent });
  const ms = r.matchMetadata?.matches || []; if (ms.length) withCands++;
  if (expect === "some" && !ms.length) fails.push(`${label}: không có ứng viên`);
  if (expect === "none" && ms.length) fails.push(`${label}: có ${ms.length} ứng viên (mong 0)`);
  if (ms.length > 5) fails.push(`${label}: ${ms.length} > 5 ứng viên`);
  const relaxed = (r.matchMetadata?.relaxations_applied || []).length > 0;
  const B = mp.error ? null : mp.budget_for_category; const cap = B == null ? null : relaxed ? Math.trunc(B * 1.2) : B;
  for (const m of ms) {
    const v = byId.get(m.vendor_id);
    if (!v) { fails.push(`${label}: ${m.vendor_id} ngoài pool`); continue; }
    if (m.name !== v.name) fails.push(`${label}: tên ${m.name} != pool`);
    if (v.category !== mp.category) fails.push(`${label}: ${v.id} sai hạng mục ${v.category}`);
    if (!v.isVerified || (v.rating > 0 && v.rating < 3.5)) fails.push(`${label}: ${v.id} không đủ tư cách`);
    if (cap != null && Number.isFinite(cap) && v.priceMin > 0 && v.priceMin * 1e6 > cap) fails.push(`${label}: ${v.id} priceMin ${v.priceMin}tr > ngân sách ${cap / 1e6}tr`);
    if ("phone" in m || "contact" in m) fails.push(`${label}: lộ liên hệ`);
  }
  const cands = candidates(r.systemPrompt);
  if (cands.length !== ms.length) fails.push(`${label}: khối prompt ${cands.length} != matchMetadata ${ms.length}`);
  const blk = (r.systemPrompt.split("## Vendor matching candidates")[1] || "").split("\n## ")[0];
  if (/\bNaN\b|\bundefined\b|\bnull\b/.test(blk)) fails.push(`${label}: khối ứng viên có NaN/undefined/null`);
}
if (fails.length) { console.log("FAIL " + fails.join("; ")); process.exit(1); }
console.log(`PASS ${C.length} hồ sơ biên, ${withCands} có ứng viên, 0 fetch, không ném`);
