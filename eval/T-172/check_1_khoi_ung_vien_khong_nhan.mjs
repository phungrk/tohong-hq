// T-172 tiêu chí 1: khối ứng viên chat ("## Vendor matching candidates") và phần còn lại của prompt gửi AI (trừ hồ sơ cặp đôi) không chứa chữ nguồn giá nào,
// ở mọi loại nguồn: giá riêng marry, ước tính theo hạng mục, admin đã xác minh, admin tự nhập, pool cũ không nguồn. Dòng "Giá:" của mỗi ứng viên chỉ còn số và đơn vị
// (venue có nguồn giá vẫn "/bàn"; không giá thì vẫn "Liên hệ để hỏi báo giá"). Đo prompt chat thật (buildChatContext), không mạng.
import { twinBack, chat, profileFor, MSG_BY_CAT, EST, REAL, NOSRC, candBlock, promptWithoutProfile, entries, leaks, reporter, setNow } from "./_lib.mjs";
const { bad, end } = reporter();
setNow("2026-11-14T08:00:00Z");
const PRICE_LINE = /^   Giá: (?:(?:\d+-)?\d+tr(?:\/bàn)?|Liên hệ để hỏi báo giá)$/;
async function run(tag, specs, cat, { venue = false } = {}) {
  const { M, ids, ov, nameOf } = await twinBack(specs);
  const r = await chat(M, { message: MSG_BY_CAT[cat], profile: profileFor(cat), overlay: ov });
  if (r.err) return bad(`${tag}: chat lỗi ${r.err.message}`);
  const block = candBlock(r.sp);
  const ents = entries(block, Object.fromEntries(ids.map((id) => [id, nameOf(id)])));
  const missing = ids.filter((id) => !ents[id]);
  if (missing.length) return bad(`${tag}: ${missing.length}/${ids.length} ứng viên không vào khối (eval không đo đủ)`);
  ids.forEach((id, i) => {
    const gia = (ents[id].find((l) => /^\s+Giá:/.test(l)) || "");
    if (!PRICE_LINE.test(gia)) bad(`${tag} ứng viên ${i + 1}: dòng giá phải chỉ có số + đơn vị, thấy "${gia.trim()}"`);
    if (/Liên hệ/.test(gia) && specs[i].price.priceMax > 0) bad(`${tag} ứng viên ${i + 1}: có giá mà ghi "Liên hệ"`);
    if (venue && specs[i].price.priceSource && !/\/bàn$/.test(gia)) bad(`${tag} ứng viên ${i + 1}: venue có nguồn giá phải giữ "/bàn", thấy "${gia.trim()}"`);
  });
  const l = leaks(block); if (l.length) bad(`${tag}: khối ứng viên còn chữ nguồn giá: ${[...new Set(l)].join(" | ")}`);
  const l2 = leaks(promptWithoutProfile(r.sp)); if (l2.length) bad(`${tag}: prompt gửi AI (trừ hồ sơ) còn chữ nguồn giá: ${[...new Set(l2)].join(" | ")}`);
}
// 5 loại nguồn trong một khối: ước tính / giá riêng marry / ước tính + admin đã xác minh / ước tính + admin tự nhập giá / pool cũ không nguồn
await run("ảnh, đủ 5 loại nguồn", [
  { cat: "photography", price: EST(6, 8) },
  { cat: "photography", price: REAL(6, 8) },
  { cat: "photography", price: EST(6, 8), ov: { priceMin: 7, priceMax: 9, price_verified: true } },
  { cat: "photography", price: EST(6, 8), ov: { priceMin: 5, priceMax: 6 } },
  { cat: "photography", price: NOSRC(6, 8) },
], "photography");
await run("venue có nguồn giá (giá theo bàn)", [
  { cat: "venue", price: EST(4, 4.6) },
  { cat: "venue", price: REAL(4, 4.6) },
  { cat: "venue", price: EST(4, 4.6), ov: { priceMin: 5, priceMax: 6, price_verified: true } },
], "venue", { venue: true });
await run("pool cũ hoàn toàn không nguồn (trước đây ghi '(giá ước tính)')", [
  { cat: "photography", price: NOSRC(6, 8) },
  { cat: "photography", price: NOSRC(7, 9) },
  { cat: "photography", price: NOSRC(5, 6), ov: { priceMin: 5, priceMax: 6, price_verified: true } },
], "photography");
end();
