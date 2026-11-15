// T-176 adv-03 (đối kháng, T-172 H6): các ca cache câu "vì sao hợp" mà check_5 không chạm.
// (a) câu cache SẠCH (không chữ nguồn giá, đúng hash hồ sơ) => trả nguyên văn, 0 lượt LLM (không gọi thừa).
// (b) câu cache VIẾT HOA "(GIÁ MARRY.VN · 06/2026)" => trượt cache, sinh lại đúng 1 lượt.
// (c) LLM chạy được nhưng câu MỚI còn chữ nguồn giá => câu mẫu của matcher (không chữ nguồn), đúng 1 lượt; mở lại => 0 lượt (không vòng lặp gọi LLM),
//     file cache không chứa câu bẩn.
// (d) LLM lỗi với cache bẩn, mở 3 lần với LLM lỗi => không ném, không bao giờ trả câu bẩn, lần mở sau không gọi nhiều hơn lần đầu.
// Không mạng (LLM giả).
import { twinBack, openDetail, coupleProfile, doc, CID, EST, REAL, leaks, whyEcho, reporter, setNow } from "../T-172/_lib.mjs";
const { bad, end } = reporter();
setNow("2026-11-14T08:00:00Z");
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h).toString(36); }
const HASH = hashStr(["", 300, 20, 3, "HCMC", ""].join("|"));
const { M, ids, ov } = await twinBack([{ cat: "photography", price: EST(6, 8) }, { cat: "photography", price: REAL(6, 8) }]);
const profile = coupleProfile({ budget: 300 }); const budgetDoc = doc({ photography: 20 });
const KEY = `data/couples/${CID}/vendor_why_cache.json`;
const seed = (sentences) => {
  const b = new M.MemoryBucket();
  b.data.set(`data/couples/${CID}/profile.yaml`, JSON.stringify(profile));
  b.data.set(`data/couples/${CID}/members.json`, JSON.stringify([{ user_id: "u1", role: "owner" }]));
  b.data.set(`data/couples/${CID}/budget.json`, JSON.stringify(budgetDoc));
  b.data.set("data/admin/vendor_overrides.json", JSON.stringify({ seq: 1, vendors: ov }));
  const entries = {}; ids.forEach((id, i) => { if (sentences[i] != null) entries[id] = { hash: HASH, sentence: sentences[i] }; });
  b.data.set(KEY, JSON.stringify({ entries, updated_at: "2026-11-14T00:00:00.000Z" }));
  return b;
};
const CLEAN = ["Studio này hợp gu nhẹ nhàng của bạn, mức 6–8tr dễ cân đối.", "Ảnh tự nhiên, 6–8tr, đội ngũ được đánh giá tốt."];
{ // (a)
  const b = seed(CLEAN);
  for (const [i, id] of ids.entries()) {
    const r = await openDetail(M, id, { bucket: b, reply: whyEcho });
    if (r.calls.length !== 0) bad(`(a) vendor #${i + 1}: câu cache sạch mà vẫn gọi LLM ${r.calls.length} lượt (gọi thừa)`);
    if (r.body?.match?.whyThisVendor !== CLEAN[i]) bad(`(a) vendor #${i + 1}: không trả nguyên câu cache sạch: "${r.body?.match?.whyThisVendor}"`);
  }
}
{ // (b)
  const b = seed(["Mức 6–8tr (GIÁ MARRY.VN · 06/2026) hợp bạn.", "Mức 6–8tr (ƯỚC TÍNH THEO HẠNG MỤC) hợp bạn."]);
  for (const [i, id] of ids.entries()) {
    const r = await openDetail(M, id, { bucket: b, reply: whyEcho });
    const s = r.body?.match?.whyThisVendor || "";
    if (leaks(s).length) bad(`(b) vendor #${i + 1}: trả câu cache viết hoa còn chữ nguồn giá: "${s}"`);
    if (r.calls.length !== 1) bad(`(b) vendor #${i + 1}: mong sinh lại 1 lượt, thấy ${r.calls.length}`);
  }
}
{ // (c)
  const b = seed([null, null]);
  const dirty = () => "Mức 6–8tr (giá marry.vn · 06/2026) rất hợp với bạn.";
  for (const [i, id] of ids.entries()) {
    const r = await openDetail(M, id, { bucket: b, reply: dirty });
    const s = r.body?.match?.whyThisVendor || "";
    if (r.calls.length !== 1) bad(`(c) vendor #${i + 1}: lần đầu mong đúng 1 lượt LLM, thấy ${r.calls.length}`);
    if (!s) bad(`(c) vendor #${i + 1}: không có câu (mong câu mẫu)`); else if (leaks(s).length) bad(`(c) vendor #${i + 1}: trả câu LLM còn chữ nguồn giá: "${s}"`);
    const r2 = await openDetail(M, id, { bucket: b, reply: dirty });
    if (r2.calls.length !== 0) bad(`(c) vendor #${i + 1}: mở lại vẫn gọi LLM ${r2.calls.length} lượt (vòng gọi lại mỗi lần mở)`);
    if ((r2.body?.match?.whyThisVendor || "") !== s) bad(`(c) vendor #${i + 1}: mở lại ra câu khác`);
  }
  const saved = JSON.parse(b.data.get(KEY) || "{}").entries || {};
  for (const id of ids) if (saved[id] && leaks(saved[id].sentence).length) bad(`(c) file cache lưu câu bẩn cho ${id}`);
}
{ // (d)
  const b = seed(["Mức 6–8tr (Ước tính theo hạng mục) hợp bạn.", "Mức 6–8tr (Giá marry.vn · 06/2026) hợp bạn."]);
  for (const [i, id] of ids.entries()) { let first = null; for (let k = 0; k < 3; k++) {
    const r = await openDetail(M, id, { bucket: b, reply: whyEcho, fail: true });
    if (r.status !== 200) { bad(`(d) vendor #${i + 1} lần ${k + 1}: HTTP ${r.status}`); continue; }
    // Một lần mở = một lượt sinh; chuỗi dự phòng có sẵn của orchestrator (đổi nhà cung cấp khi lỗi) được phép, nhưng không lần mở sau nào gọi nhiều hơn lần đầu.
    if (first === null) { first = r.calls.length; if (first < 1) bad(`(d) vendor #${i + 1}: cache bẩn mà không thử sinh lại`); }
    else if (r.calls.length > first) bad(`(d) vendor #${i + 1} lần ${k + 1}: ${r.calls.length} lượt LLM > lần đầu ${first} (gọi lại tăng dần)`);
    const s = r.body?.match?.whyThisVendor || "";
    if (!s || leaks(s).length) bad(`(d) vendor #${i + 1} lần ${k + 1}: câu "${s}" (mong câu mẫu sạch)`);
  } }
}
end();
