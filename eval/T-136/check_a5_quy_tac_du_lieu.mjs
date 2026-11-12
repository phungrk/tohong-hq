// T-136 tiêu chí 9: khối "## Quy tắc dữ liệu" của prompt không còn cho phép nêu tên vendor theo kiến thức sẵn có. Đây là ĐỔI PROMPT (đường LLM): eval chỉ kiểm được văn bản prompt
// gửi đi, không kiểm được LLM có tuân thủ (không có LLM trong eval) nên là bảo đảm "chỉ dẫn", không phải bảo đảm cứng; bảo đảm cứng chỉ có ở đường matcher (tiêu chí 1).
// Mong ở MỌI tình huống (có ứng viên / khoảng trống / matcher rỗng / matcher lỗi / không có ý định tìm vendor):
//  - có câu: "chỉ được nêu tên vendor cụ thể có trong khối [VENDOR CANDIDATES]"
//  - có câu: "Quy tắc này thắng mọi hướng dẫn khác ở trên về việc nêu tên vendor" (agent block venue/vendor còn ví dụ tên riêng)
//  - KHÔNG còn "dùng kiến thức có sẵn về thị trường để gợi ý vendor phổ biến" và "KHÔNG từ chối recommend"
import { chat, item, poolPhotographers, buildChatContext, MemoryBucket, done } from "./_lib.mjs";
const fails = [];
const sc = { "có ứng viên": () => chat({ matches: [item(poolPhotographers[0].id, "x")], total_pool: 1, passed_filters: 1 }),
  "khoảng trống": () => chat({ matches: [item("marry_deadbeef0001", "ZZ")], total_pool: 1, passed_filters: 1 }),
  "matcher rỗng": () => chat({ matches: [], total_pool: 0, passed_filters: 0 }), "matcher lỗi": () => chat("500"),
  "không có ý định": () => buildChatContext({ CHAT_DATA: new MemoryBucket() }, "c1", null, "Chào em, anh chị nên chọn nhà hàng nào ở quận 1?", null, "u1") };
for (const [label, f] of Object.entries(sc)) {
  const sp = (await f()).systemPrompt, i = sp.indexOf("## Quy tắc dữ liệu");
  if (i < 0) { fails.push(`${label}: thiếu mục Quy tắc dữ liệu`); continue; }
  const tail = sp.slice(i);
  if (!tail.includes("chỉ được nêu tên vendor cụ thể có trong khối [VENDOR CANDIDATES]")) fails.push(`${label}: thiếu câu cấm nêu tên vendor ngoài khối`);
  if (!tail.includes("Quy tắc này thắng mọi hướng dẫn khác ở trên về việc nêu tên vendor")) fails.push(`${label}: thiếu câu quy tắc thắng`);
  if (/dùng kiến thức có sẵn về thị trường để gợi ý vendor phổ biến|KHÔNG từ chối recommend/.test(sp.slice(i))) fails.push(`${label}: còn câu cho phép gợi ý vendor theo kiến thức sẵn có`);
}
done(fails);
