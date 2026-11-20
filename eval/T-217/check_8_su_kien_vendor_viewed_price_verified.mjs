// T-217 tiêu chí 8 (ADR-139, phân xử D1 mục 1): sự kiện analytics vendor_viewed ghi price_verified = true khi giá cặp đôi thấy mang nhãn "Giá đã xác minh" từ MỘT trong hai nguồn (admin duyệt tay: basis admin_verified; pool verified: basis source_verified).
// Front ghi price_verified từ giá trị price_source mà back trả cho cặp đôi (tohong-front src/screens/Budget.jsx:125, src/screens/chat/VendorChatCards.jsx:588; chỉ nhận "verified" hay "estimated"); eval này đo đúng hợp đồng đó trên MỌI bề mặt back cặp đôi dùng:
// POST /api/vendors/status, GET /api/vendors/:id, GET /api/vendors/match, và siêu dữ liệu ghép của chat (matchMetadata.matches).
// Quy tắc: price_source = "verified" khi price_basis ∈ {admin_verified, source_verified}; mọi basis khác ("admin" giá chưa xác minh, legacy_marry, estimate_*) = "estimated". Cặp đôi KHÔNG thấy giá trị "source_verified" (giá trị đó chỉ có ở admin, tiêu chí 7).
// Hạn chế đã biết: eval không chạy giao diện; nếu front đổi cách suy ra price_verified (không đọc price_source nữa) thì eval này không bắt được (xem spec, mục Câu hỏi mở).
// Pool nền như tiêu chí 5 (pool thật + 4 venue sinh đôi). Chạy: node eval/T-217/<file> · Biến: TOHONG_BACK_REPO.
import * as H from "./_back217.mjs";
const M = await H.loadBack(); const { VA, VB, LC, EC } = H.ids; const BQ2 = "marry_b92e8a86175d";
const fails = []; const bad = (m) => { if (fails.length < 30) fails.push(m); };
const SRC = [VA, VB, BQ2]; const keep = [VA, VB, LC, EC, BQ2]; const hideOthers = H.hide(M, keep);
const ovFor = (p) => Object.fromEntries(SRC.map((i) => [i, p]));
const variants = {
  "không overlay": { ov: {}, want: { verified: SRC, estimated: [LC, EC] } },
  "giá chưa xác minh": { ov: ovFor({ priceMin: 7, priceMax: 9 }), want: { verified: [], estimated: SRC } },
  "giá đã xác minh": { ov: ovFor({ priceMin: 7, priceMax: 9, price_verified: true }), want: { verified: SRC, estimated: [] } },
  "chỉ xác minh": { ov: ovFor({ price_verified: true }), want: { verified: SRC, estimated: [] } },
};
const prof = H.coupleProfile({ budget: 300, guest_count: 300 });
const expect = (where, v, id, word) => { if (v?.price_source !== word) bad(`${where} ${id}: price_source mong ${JSON.stringify(word)}, thấy ${JSON.stringify(v?.price_source)}`); };
for (const [name, { ov, want }] of Object.entries(variants)) {
  const overlay = { ...hideOthers, ...ov };
  const st = await H.api(M, { method: "POST", url: "/api/vendors/status", body: { ids: keep }, overlay, profile: prof });
  if (st.status !== 200) bad(`status[${name}]: HTTP ${st.status}`);
  const m = await H.match(M, "venue", { overlay, profile: prof });
  for (const [word, list] of Object.entries(want)) for (const id of list) {
    expect(`status[${name}]`, st.body?.vendors?.[id], id, word);
    const d = await H.api(M, { url: `/api/vendors/${id}?coupleId=${H.CID}`, overlay, profile: prof });
    if (d.status !== 200) bad(`chi tiết[${name}] ${id}: HTTP ${d.status}`); else expect(`chi tiết[${name}]`, d.body?.vendor, id, word);
    const v = m.body?.vendors?.find((x) => x.id === id); if (!v) bad(`match[${name}]: thiếu ${id}`); else expect(`match[${name}]`, v, id, word);
  }
}
{ // chat: siêu dữ liệu ghép mang price_source cho thẻ chat (VA qua lọc ở 150tr, 30 bàn)
  const msg = "Tìm nhà hàng tiệc cưới giúp anh chị 150tr";
  const r = await H.chat(M, { message: msg, profile: prof, overlay: hideOthers });
  if (r.err) bad("chat lỗi " + r.err.message);
  else { const it = (r.md?.matches || []).find((x) => x.vendor_id === VA); if (!it) bad("chat 150tr: thiếu VA trong matchMetadata"); else expect("chat[không overlay]", it, VA, "verified"); }
}
H.done(fails);
