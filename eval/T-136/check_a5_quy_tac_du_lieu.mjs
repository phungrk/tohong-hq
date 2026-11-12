// T-136 tiêu chí 9: khối "## Quy tắc dữ liệu" của prompt chỉ cấm GIỚI THIỆU / ĐỀ XUẤT vendor ngoài khối [VENDOR CANDIDATES]; vẫn cho nhắc lại vendor đã giới thiệu ở lượt trước và phân tích vendor
// do cặp đôi tự nêu / có trong hồ sơ (giữ quy tắc 3 của vendor agent trong lib/prompts.js). Đây là ĐỔI PROMPT (đường LLM): eval chỉ kiểm văn bản prompt gửi đi, không kiểm LLM có tuân thủ
// (không có LLM trong eval) nên là bảo đảm "chỉ dẫn", không phải bảo đảm cứng; bảo đảm cứng chỉ có ở đường matcher (tiêu chí 1).
// Câu bắt buộc (nguyên văn, ở mọi tình huống): 
//  C1 "chỉ được giới thiệu hoặc đề xuất vendor cụ thể có trong khối [VENDOR CANDIDATES] của lượt này"
//  C2 "Được nhắc lại vendor đã giới thiệu ở lượt trước trong cuộc trò chuyện"
//  C3 "phân tích vendor do cặp đôi tự nêu hoặc có trong hồ sơ"
//  C4 "Không tự đề xuất vendor nào khác, kể cả vendor nổi tiếng theo kiến thức có sẵn"
//  C5 "Quy tắc này thắng mọi hướng dẫn khác ở trên về việc đề xuất vendor"
// Câu bị cấm: bản cũ cho phép gợi ý theo kiến thức sẵn có, và bản v2 chặn cả việc nêu tên ("không nêu tên vendor nào khác", "chỉ được nêu tên vendor cụ thể").
// Tình huống: có ứng viên / khoảng trống / matcher rỗng / matcher lỗi / không có ý định tìm vendor / HỎI TIẾP vendor vừa gợi ý / vendor do cặp đôi tự nêu.
import { chat, item, poolPhotographers, buildChatContext, MemoryBucket, done } from "./_lib.mjs";
const fails = [];
const noIntent = (msg) => () => buildChatContext({ CHAT_DATA: new MemoryBucket() }, "c1", null, msg, null, "u1");
const sc = { "có ứng viên": () => chat({ matches: [item(poolPhotographers[0].id, "x")], total_pool: 1, passed_filters: 1 }),
  "khoảng trống": () => chat({ matches: [item("marry_deadbeef0001", "ZZ")], total_pool: 1, passed_filters: 1 }),
  "matcher rỗng": () => chat({ matches: [], total_pool: 0, passed_filters: 0 }), "matcher lỗi": () => chat("500"),
  "không có ý định": noIntent("Chào em, anh chị nên chọn nhà hàng nào ở quận 1?"),
  "hỏi tiếp vendor vừa gợi ý": noIntent("Studio thứ hai giá bao nhiêu, có nhận ngày 15/11 không?"),
  "vendor do cặp đôi tự nêu": noIntent("Tụi anh đã đặt nhà hàng Hoa Sen rồi, studio ABC có ổn không em?") };
const REQ = ["chỉ được giới thiệu hoặc đề xuất vendor cụ thể có trong khối [VENDOR CANDIDATES] của lượt này", "Được nhắc lại vendor đã giới thiệu ở lượt trước trong cuộc trò chuyện", "phân tích vendor do cặp đôi tự nêu hoặc có trong hồ sơ",
  "Không tự đề xuất vendor nào khác, kể cả vendor nổi tiếng theo kiến thức có sẵn", "Quy tắc này thắng mọi hướng dẫn khác ở trên về việc đề xuất vendor"];
const BAN = [/dùng kiến thức có sẵn về thị trường để gợi ý vendor phổ biến/, /KHÔNG từ chối recommend/, /không nêu tên vendor nào khác/, /chỉ được nêu tên vendor cụ thể/];
for (const [label, f] of Object.entries(sc)) {
  const sp = (await f()).systemPrompt, i = sp.indexOf("## Quy tắc dữ liệu");
  if (i < 0) { fails.push(`${label}: thiếu mục Quy tắc dữ liệu`); continue; }
  const tail = sp.slice(i);
  REQ.forEach((c, k) => { if (!tail.includes(c)) fails.push(`${label}: thiếu câu C${k + 1}`); });
  BAN.forEach((re) => { if (re.test(tail)) fails.push(`${label}: còn câu bị cấm ${re}`); });
}
// quy tắc 3 của vendor agent (phân tích vendor cặp đôi tự nêu) vẫn còn nguyên trong prompt khi có agent block vendor
const v = (await noIntent("Studio ABC chụp ảnh cưới có ổn không em?")()).systemPrompt;
if (v.includes("Vendor Agent") && !/user tự nêu/.test(v)) fails.push("quy tắc 3 của vendor agent (vendor user tự nêu) bị mất khỏi prompt");
done(fails);
