// T-172 tiêu chí 5: câu "vì sao hợp" đã lưu cache TRƯỚC thay đổi (có chữ nguồn giá, hash theo hồ sơ như bản cũ) không bao giờ được trả lại cho cặp đôi.
// (a) LLM chạy được: mở vendor => sinh lại đúng một lượt, câu trả về không chứa chữ nguồn giá và có giá; file cache lưu bản sạch; mở lại => 0 lượt LLM.
// (b) LLM lỗi: câu trả về không chứa chữ nguồn giá (rơi về câu mẫu), không ném lỗi.
// Cách dựng cache cũ: công thức hash của bản cũ (hồ sơ: gu, tổng ngân sách, ngân sách hạng mục, tháng cưới, thành phố, số khách) chép nguyên ở dưới; eval không đòi cách sửa (đổi hash, bỏ câu có nhãn, ... đều được).
import { twinBack, openDetail, coupleProfile, doc, CID, EST, REAL, leaks, whyEcho, reporter, setNow } from "./_lib.mjs";
const { bad, end } = reporter();
setNow("2026-11-14T08:00:00Z");
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h).toString(36); }
const OLD_HASH = hashStr(["", 300, 20, 3, "HCMC", ""].join("|"));   // gu rỗng, tổng 300tr, ảnh 20tr (bảng dự toán), cưới tháng 3, HCMC, chưa có số khách
const CASES = [["ước tính", { cat: "photography", price: EST(6, 8) }, "(Ước tính theo hạng mục)", "6–8tr"], ["giá riêng marry", { cat: "photography", price: REAL(6, 8) }, "(Giá marry.vn · 06/2026)", "6–8tr"]];
const { M, ids, ov } = await twinBack(CASES.map((c) => c[1]));
const profile = coupleProfile({ budget: 300 }); const budgetDoc = doc({ photography: 20 });
const seed = (fail) => { // bucket mới với cache cũ có nhãn cho cả hai vendor
  const b = new M.MemoryBucket();
  b.data.set(`data/couples/${CID}/profile.yaml`, JSON.stringify(profile));
  b.data.set(`data/couples/${CID}/members.json`, JSON.stringify([{ user_id: "u1", role: "owner" }]));
  b.data.set(`data/couples/${CID}/budget.json`, JSON.stringify(budgetDoc));
  b.data.set("data/admin/vendor_overrides.json", JSON.stringify({ seq: 1, vendors: ov }));
  const entries = {}; CASES.forEach((c, i) => { entries[ids[i]] = { hash: OLD_HASH, sentence: `Mức giá ${c[3]} ${c[2]} rất hợp với bạn.` }; });
  b.data.set(`data/couples/${CID}/vendor_why_cache.json`, JSON.stringify({ entries, updated_at: "2026-11-14T00:00:00.000Z" }));
  return b;
};
{ // (a)
  const b = seed();
  for (const [i, [tag, , , price]] of CASES.entries()) {
    const r = await openDetail(M, ids[i], { bucket: b, reply: whyEcho });
    const s = r.body?.match?.whyThisVendor; if (!s) { bad(`(a) ${tag}: không có câu`); continue; }
    if (leaks(s).length) bad(`(a) ${tag}: trả lại câu cache cũ/ còn chữ nguồn giá: "${s.slice(0, 100)}"`);
    if (r.calls.length !== 1) bad(`(a) ${tag}: mong sinh lại đúng 1 lượt LLM, thấy ${r.calls.length}`);
    if (!s.includes(price)) bad(`(a) ${tag}: câu sinh lại phải có giá ${price}, thấy "${s.slice(0, 100)}"`);
    const r2 = await openDetail(M, ids[i], { bucket: b, reply: whyEcho });
    if (r2.calls.length !== 0) bad(`(a) ${tag}: mở lại phải dùng cache sạch (0 lượt LLM), thấy ${r2.calls.length}`);
    if ((r2.body?.match?.whyThisVendor || "") !== s) bad(`(a) ${tag}: mở lại ra câu khác lần trước`);
  }
  const saved = JSON.parse(b.data.get(`data/couples/${CID}/vendor_why_cache.json`) || "{}").entries || {};
  for (const id of ids) if (saved[id] && leaks(saved[id].sentence).length) bad(`(a) file cache còn câu có chữ nguồn giá cho ${id}`);
}
{ // (b)
  const b = seed();
  for (const [i, [tag]] of CASES.entries()) {
    const r = await openDetail(M, ids[i], { bucket: b, reply: whyEcho, fail: true });
    if (r.status !== 200) { bad(`(b) ${tag}: HTTP ${r.status}`); continue; }
    const s = r.body?.match?.whyThisVendor;
    if (!s) bad(`(b) ${tag}: LLM lỗi mà không có câu mẫu`); else if (leaks(s).length) bad(`(b) ${tag}: LLM lỗi nhưng vẫn trả câu cache cũ có chữ nguồn giá: "${s.slice(0, 100)}"`);
  }
}
end();
