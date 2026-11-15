// T-172 tiêu chí 10 (H9): hội thoại có từ TRƯỚC T-172 mang chữ nguồn giá (tin AI cũ, summary.md, memory.yaml) thì ngữ cảnh gửi LLM (system + messages) vẫn không còn chữ nguồn giá nhưng còn số giá;
// lời LLM giả (nhắc lại cả tin cũ) không có chữ nguồn giá; dữ liệu đã lưu (tin nhắn, summary.md, memory.yaml) không đổi byte nào. Bong bóng cũ trên màn không thuộc việc này. Không mạng.
import { stampedBack, loadModules, imp, chatTurn, coupleProfile, CID, AUTH, leaks, promptWithoutProfile, reporter, setNow } from "./_lib.mjs";
const { bad, end } = reporter();
setNow("2026-11-14T08:00:00Z");
const dir = stampedBack(); const M = await loadModules(dir);
const b = new M.MemoryBucket();
b.data.set(`data/couples/${CID}/profile.yaml`, JSON.stringify(coupleProfile({ budget: 300 })));
b.data.set(`data/couples/${CID}/members.json`, JSON.stringify([{ user_id: AUTH.userId, role: "owner" }]));
const { makeConversationStore } = await imp(dir, "lib/conversationStore.js");
const cs = makeConversationStore({ CHAT_DATA: b });
const conv = await cs.create(CID, "cu");
const OLD_AI = ["Dạ em gợi ý Studio Alpha giá 6-8tr (giá marry.vn · 06/2026) và Studio Beta 7-9tr (ước tính theo hạng mục) ạ.", "Nếu anh chị muốn chắc thì Studio Gamma 5-6tr (giá đã xác minh), Studio Delta 4-5tr (giá do Tơ Hồng cập nhật), hoặc Studio Eps 9-10tr (giá ước tính) ạ."];
await cs.appendMessage(CID, conv.id, { role: "user", content: "Tìm giúp anh chị studio chụp ảnh" });
await cs.appendMessage(CID, conv.id, { role: "assistant", content: OLD_AI[0] });
await cs.appendMessage(CID, conv.id, { role: "user", content: "Còn chỗ nào nữa không em" });
await cs.appendMessage(CID, conv.id, { role: "assistant", content: OLD_AI[1] });
const SUM = "Đã giới thiệu Alpha: Giá marry.vn · 06/2026, 6-8tr; Beta giá ước tính 7-9tr (ước tính theo hạng mục). Câu hỏi còn mở: chọn studio nào.";
const MEM = JSON.stringify({ facts: ["Thích Alpha 6-8tr (giá do Tơ Hồng cập nhật)"], decisions: [] });
b.data.set(`data/couples/${CID}/conversations/${conv.id}/summary.md`, SUM);
b.data.set(`data/couples/${CID}/memory.yaml`, MEM);
const keys = [...b.data.keys()].filter((k) => k.includes(`/conversations/${conv.id}/`) && (k.endsWith(".json") && !/meta|index/.test(k) || k.endsWith("summary.md"))).concat([`data/couples/${CID}/memory.yaml`]);
const before = Object.fromEntries(keys.map((k) => [k, b.data.get(k)]));
if (Object.keys(before).length < 6) bad(`eval không dựng đủ dữ liệu cũ (${Object.keys(before).length} khoá)`);
const t = await chatTurn(M, dir, { message: "Studio số 2 giá sao em?", bucket: b, conversationId: conv.id, reply: (sys, user) => user });
if (t.status !== 200 || !t.calls.length) bad(`chat không chạy (HTTP ${t.status}, ${t.calls.length} lượt LLM)`);
else {
  const sent = t.calls[0]; const msgsText = (sent.messages || []).map((m) => String(m.content)).join("\n");
  if ((sent.messages || []).length < 5) bad(`eval không đo đủ: chỉ ${(sent.messages || []).length} tin gửi LLM`);
  const l1 = leaks(promptWithoutProfile(sent.system)); if (l1.length) bad(`system gửi LLM (tóm tắt/ghi nhớ) còn chữ nguồn giá: ${[...new Set(l1)].join(" | ")}`);
  const l2 = leaks(msgsText); if (l2.length) bad(`lịch sử tin gửi LLM còn chữ nguồn giá: ${[...new Set(l2)].join(" | ")}`);
  const l3 = leaks(t.text); if (l3.length) bad(`lời AI (nhắc lại tin cũ) còn chữ nguồn giá: ${[...new Set(l3)].join(" | ")}`);
  for (const p of ["6-8tr", "7-9tr", "5-6tr", "4-5tr", "9-10tr"]) if (!msgsText.includes(p)) bad(`lịch sử gửi LLM mất số giá ${p}`);
  for (const p of ["6-8tr", "7-9tr"]) if (!sent.system.includes(p)) bad(`system gửi LLM mất số giá ${p} (tóm tắt hoặc ghi nhớ)`);
  if (!sent.system.includes("Câu hỏi còn mở: chọn studio nào")) bad("tóm tắt gửi LLM mất phần không liên quan nhãn");
}
for (const k of keys) if (b.data.get(k) !== before[k]) bad(`dữ liệu đã lưu bị đổi: ${k}`);
end();
