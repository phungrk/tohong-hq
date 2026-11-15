// T-172 tiêu chí 4: câu AI "vì sao hợp" ở chi tiết vendor (GET /api/vendors/:id?coupleId=…, whyThisVendor): prompt gửi LLM (system + user) và câu sinh ra không chứa chữ nguồn giá;
// giá vẫn có trong prompt (vendor có nguồn giá vẫn "6–8tr"; venue có nguồn giá vẫn "4–4.6tr/bàn"; pool cũ không nguồn "6–8tr" không "/bàn");
// giữ inv-003: vendor ước tính có đúng một dòng `Ngân sách: chưa đủ cơ sở để khẳng định vendor này hợp hoặc nằm trong ngân sách` trong prompt user và prompt (system hoặc user) có câu "không khẳng định vendor hợp hoặc nằm trong ngân sách"; vendor khác không có dòng cờ (câu cấm có thể nằm ở prompt hệ thống chung).
// Các câu mẫu không do AI (whyThisVendor/whyThoseVendors của danh sách tab) vẫn không có chữ nguồn giá. LLM giả "học trò ngoan" nhắc lại nguyên dòng "Nhà cung cấp:" của prompt. Không mạng.
import { twinBack, openDetail, coupleProfile, CID, EST, REAL, NOSRC, leaks, WHY_FLAG, whyEcho, reporter, setNow } from "./_lib.mjs";
import { tab as tabReq } from "../T-159/_lib.mjs";
const { bad, end } = reporter();
setNow("2026-11-14T08:00:00Z");
const CASES = [
  ["ảnh ước tính", { cat: "photography", price: EST(6, 8) }, "6–8tr", true],
  ["ảnh giá riêng marry", { cat: "photography", price: REAL(6, 8) }, "6–8tr", false],
  ["ảnh ước tính + admin đã xác minh", { cat: "photography", price: EST(6, 8), ov: { priceMin: 7, priceMax: 9, price_verified: true } }, "7–9tr", false],
  ["ảnh ước tính + admin tự nhập giá", { cat: "photography", price: EST(6, 8), ov: { priceMin: 5, priceMax: 6 } }, "5–6tr", false],
  ["ảnh pool cũ không nguồn", { cat: "photography", price: NOSRC(6, 8) }, "6–8tr", false],
  ["venue ước tính", { cat: "venue", price: EST(4, 4.6) }, "4–4.6tr/bàn", true],
  ["venue giá riêng", { cat: "venue", price: REAL(4, 4.6) }, "4–4.6tr/bàn", false],
];
const { M, ids, ov } = await twinBack(CASES.map((c) => c[1]));
const profile = coupleProfile({ budget: 300, guest_count: 200 });
for (const [i, [tag, , wantPrice, est]] of CASES.entries()) {
  const r = await openDetail(M, ids[i], { overlay: ov, profile, reply: whyEcho });
  if (r.status !== 200 || !r.body?.match) { bad(`${tag}: chi tiết không có match (HTTP ${r.status}); eval không đo`); continue; }
  if (r.calls.length < 1) { bad(`${tag}: không thấy lượt gọi LLM giả (eval không đo được prompt)`); continue; }
  const { system, user } = r.calls[0]; const both = system + "\n" + user;
  const l = leaks(both); if (l.length) bad(`${tag}: prompt gửi AI còn chữ nguồn giá: ${[...new Set(l)].join(" | ")}`);
  const nhaCC = user.split("\n").find((x) => x.startsWith("Nhà cung cấp:")) || "";
  if (!nhaCC.includes(`giá ${wantPrice},`)) bad(`${tag}: dòng "Nhà cung cấp" phải có "giá ${wantPrice}," (số và đơn vị giữ), thấy "${nhaCC.slice(0, 160)}"`);
  const sentence = r.body.match.whyThisVendor || "";
  const l2 = leaks(sentence); if (l2.length) bad(`${tag}: câu AI trả cho cặp đôi còn chữ nguồn giá: ${[...new Set(l2)].join(" | ")} — "${sentence.slice(0, 120)}"`);
  if (!sentence.includes(wantPrice)) bad(`${tag}: câu AI mất số giá "${wantPrice}" (eval không đo đủ hoặc giá bị bỏ), thấy "${sentence.slice(0, 120)}"`);
  const flagN = user.split("\n").filter((x) => x.trim() === WHY_FLAG).length;
  const banned = /không khẳng định vendor hợp hoặc nằm trong ngân sách/.test(both);
  if (est && (flagN !== 1 || !banned)) bad(`${tag}: vendor ước tính phải có đúng 1 dòng "${WHY_FLAG}" ở prompt user (thấy ${flagN}) và câu "không khẳng định vendor hợp hoặc nằm trong ngân sách" ở prompt (thấy ${banned})`);
  if (!est && flagN) bad(`${tag}: vendor không phải ước tính không được có dòng cờ "${WHY_FLAG}" (thấy ${flagN})`);
  if (/nằm trong ngân sách|hợp ngân sách|trong tầm ngân sách/.test(sentence) && est) bad(`${tag}: câu AI khẳng định ngân sách cho vendor ước tính`);
}
{ // câu mẫu (không AI) của tab: pool toàn ước tính + giá riêng
  const r = await tabReq(M, { url: `/api/vendors/match?coupleId=${CID}&category=photography&limit=50`, profile, overlay: ov });
  const texts = [r.body?.whyThoseVendors, ...(r.body?.vendors || []).map((v) => v.match?.whyThisVendor)].filter(Boolean);
  if (texts.length < 3) bad("tab: eval không đo đủ câu mẫu");
  for (const t of texts) { const l = leaks(t); if (l.length) bad(`tab: câu mẫu còn chữ nguồn giá: ${l.join("|")} — "${t.slice(0, 100)}"`); }
}
end();
