// T-176 adv-01 (đối kháng, T-172 H9 "Mọi chữ khác ... giữ nguyên"): bộ lọc chữ nguồn giá lúc dựng ngữ cảnh gửi LLM chỉ được cắt
// đúng cụm nguồn giá (+ ngoặc + khoảng trắng trước ngoặc). Chữ khác của tin AI cũ, tóm tắt, ghi nhớ phải tới LLM nguyên văn,
// kể cả khoảng trắng: thụt lề danh sách markdown lồng nhau, bảng, thụt lề JSON của "## Ghi nhớ".
// Input phá: hội thoại cũ KHÔNG có chữ nguồn giá nhưng có thụt lề >= 2 dấu cách; và một tin có nhãn kèm danh sách con thụt lề.
// Mong đợi: tin không có chữ nguồn giá gửi LLM y nguyên byte; ghi nhớ trong system = JSON.stringify(memory, null, 2) nguyên văn;
// tóm tắt nguyên văn; tin có nhãn: chỉ mất " (giá marry.vn · 06/2026)", thụt lề dòng con giữ. Không mạng (LLM giả).
import { stampedBack, loadModules, imp, chatTurn, coupleProfile, CID, AUTH, leaks, reporter, setNow } from "../T-172/_lib.mjs";
const { bad, end } = reporter();
setNow("2026-11-14T08:00:00Z");
const dir = stampedBack(); const M = await loadModules(dir);
const b = new M.MemoryBucket();
b.data.set(`data/couples/${CID}/profile.yaml`, JSON.stringify(coupleProfile({ budget: 300 })));
b.data.set(`data/couples/${CID}/members.json`, JSON.stringify([{ user_id: AUTH.userId, role: "owner" }]));
const { makeConversationStore } = await imp(dir, "lib/conversationStore.js");
const cs = makeConversationStore({ CHAT_DATA: b });
const conv = await cs.create(CID, "cu");
const CLEAN_AI = "Dạ, việc cần làm tháng này:\n- Chốt ngày\n  - hỏi ý bố mẹ hai bên\n    - xem ngày tốt\n- Đặt nhà hàng\n\n| Hạng mục | Dự toán |\n| --- | --- |\n| Ảnh  |  20tr |";
const LABEL_AI = "Studio Alpha 6-8tr (giá marry.vn · 06/2026):\n  - chụp ngoại cảnh\n  - album 30x30";
const LABEL_WANT = "Studio Alpha 6-8tr:\n  - chụp ngoại cảnh\n  - album 30x30";
await cs.appendMessage(CID, conv.id, { role: "user", content: "Tháng này cần làm gì em?" });
await cs.appendMessage(CID, conv.id, { role: "assistant", content: CLEAN_AI });
await cs.appendMessage(CID, conv.id, { role: "user", content: "Studio nào ổn?" });
await cs.appendMessage(CID, conv.id, { role: "assistant", content: LABEL_AI });
const SUM = "Đã bàn:\n  - ngày cưới (chưa chốt)\n  - studio Alpha 6-8tr";
const memory = { facts: ["Cưới ở HCMC", "Thích ảnh tự nhiên"], decisions: [{ topic: "ngân sách", value: "300tr" }] };
b.data.set(`data/couples/${CID}/conversations/${conv.id}/summary.md`, SUM);
b.data.set(`data/couples/${CID}/memory.yaml`, JSON.stringify(memory));
const t = await chatTurn(M, dir, { message: "Còn gì nữa không em?", bucket: b, conversationId: conv.id, reply: () => "Dạ." });
if (t.status !== 200 || !t.calls.length) bad(`chat không chạy (HTTP ${t.status}, ${t.calls.length} lượt LLM)`);
else {
  const sent = t.calls[0]; const msgs = (sent.messages || []).map((m) => String(m.content));
  if (msgs.length < 5) bad(`eval không đo đủ: chỉ ${msgs.length} tin gửi LLM`);
  if (!msgs.includes(CLEAN_AI)) bad(`tin AI cũ không có chữ nguồn giá bị sửa khi gửi LLM (thụt lề/khoảng trắng mất): ${JSON.stringify(msgs.find((m) => m.startsWith("Dạ, việc cần làm")) ?? "(không thấy)")}`);
  if (!msgs.includes(LABEL_WANT)) bad(`tin AI có nhãn: phải chỉ mất cụm nguồn giá, giữ thụt lề dòng con; thấy ${JSON.stringify(msgs.find((m) => m.startsWith("Studio Alpha")) ?? "(không thấy)")}`);
  const memWant = `## Ghi nhớ\n${JSON.stringify(memory, null, 2)}`;
  if (!sent.system.includes(memWant)) bad("mục \"## Ghi nhớ\" không có chữ nguồn giá nhưng tới LLM bị đổi (thụt lề JSON bị gộp)");
  if (!sent.system.includes(`## Tóm tắt cuộc trò chuyện\n${SUM}`)) bad("mục tóm tắt không có chữ nguồn giá nhưng tới LLM bị đổi (thụt lề bị gộp)");
  const l = leaks(msgs.join("\n")); if (l.length) bad(`lịch sử còn chữ nguồn giá: ${l.join(" | ")}`);
}
end();
