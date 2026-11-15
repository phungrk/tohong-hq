// T-176 adv-02 (đối kháng, T-172 H9 + ADR-101): biến thể của cụm nguồn giá trong tin AI cũ / tóm tắt / ghi nhớ mà check_10 không chạm:
// VIẾT HOA toàn bộ, Hoa Đầu Từ, cụm giữa câu không ngoặc, ngoặc thiếu (mở không đóng / đóng không mở), cụm sát nhau, "giá cũ marry.vn" tháng khác,
// cụm có khoảng trắng trong ngoặc, kèm in đậm markdown. Mong đợi: không còn chữ nguồn giá trong ngữ cảnh gửi LLM, số giá giữ.
// Chữ cặp đôi gõ (tin cũ và câu hiện tại) có nhãn: tới LLM NGUYÊN VĂN (ADR-101). Dữ liệu đã lưu không đổi byte. Không mạng.
import { stampedBack, loadModules, imp, chatTurn, coupleProfile, CID, AUTH, leaks, promptWithoutProfile, reporter, setNow } from "../T-172/_lib.mjs";
const { bad, end } = reporter();
setNow("2026-11-14T08:00:00Z");
const dir = stampedBack(); const M = await loadModules(dir);
const b = new M.MemoryBucket();
b.data.set(`data/couples/${CID}/profile.yaml`, JSON.stringify(coupleProfile({ budget: 300 })));
b.data.set(`data/couples/${CID}/members.json`, JSON.stringify([{ user_id: AUTH.userId, role: "owner" }]));
const { makeConversationStore } = await imp(dir, "lib/conversationStore.js");
const cs = makeConversationStore({ CHAT_DATA: b });
const conv = await cs.create(CID, "cu");
const AI = [
  ["Alpha 6-8tr (GIÁ MARRY.VN · 06/2026), Beta 7-9tr (ƯỚC TÍNH THEO HẠNG MỤC).", ["6-8tr", "7-9tr"]],
  ["Gamma có Giá Đã Xác Minh là 5-6tr, Delta Giá Do Tơ Hồng Cập Nhật 4-5tr.", ["5-6tr", "4-5tr"]],
  ["Eps 9-10tr (giá cũ marry.vn · 12/2024 và Zeta 3-4tr giá ước tính theo hạng mục)", ["9-10tr", "3-4tr"]],
  ["**Theta 11-12tr** ( Giá ước tính )(giá marry.vn·01/2026) ạ", ["11-12tr"]],
];
const USER_OLD = "Em ơi cái (giá marry.vn · 06/2026) là gì vậy?";
const USER_NOW = "Sao lần trước em ghi (ước tính theo hạng mục) thế?";
await cs.appendMessage(CID, conv.id, { role: "user", content: USER_OLD });
for (const [a] of AI) { await cs.appendMessage(CID, conv.id, { role: "assistant", content: a }); await cs.appendMessage(CID, conv.id, { role: "user", content: "tiếp" }); }
const SUM = "ALPHA: GIÁ CŨ MARRY.VN · 03/2025 6-8tr; Beta (Ước Tính Theo Hạng Mục) 7-9tr.";
const MEM = JSON.stringify({ facts: ["Thích Gamma 5-6tr (GIÁ ĐÃ XÁC MINH)"], decisions: [] });
b.data.set(`data/couples/${CID}/conversations/${conv.id}/summary.md`, SUM);
b.data.set(`data/couples/${CID}/memory.yaml`, MEM);
const before = new Map([...b.data.entries()].filter(([k]) => (k.includes("/conversations/") && !/meta|index/.test(k)) || k.endsWith("memory.yaml")));
const t = await chatTurn(M, dir, { message: USER_NOW, bucket: b, conversationId: conv.id, reply: (sys, user) => user });
if (t.status !== 200 || !t.calls.length) bad(`chat không chạy (HTTP ${t.status}, ${t.calls.length} lượt LLM)`);
else {
  const sent = t.calls[0]; const ms = sent.messages || [];
  const ai = ms.filter((m) => m.role === "assistant").map((m) => String(m.content));
  if (ai.length < AI.length) bad(`eval không đo đủ: ${ai.length} tin AI gửi LLM`);
  for (const [i, [, prices]] of AI.entries()) {
    const key = AI[i][0].replace(/^\W+/, "").split(" ")[0]; const s = ai.find((x) => x.replace(/^\W+/, "").startsWith(key)) ?? ""; const l = leaks(s);
    if (l.length) bad(`tin AI #${i + 1} còn chữ nguồn giá (${[...new Set(l)].join(" | ")}): ${JSON.stringify(s)}`);
    for (const p of prices) if (!s.includes(p)) bad(`tin AI #${i + 1} mất số giá ${p}: ${JSON.stringify(s)}`);
  }
  const sys = promptWithoutProfile(sent.system);
  const ls = leaks(sys); if (ls.length) bad(`system (tóm tắt/ghi nhớ) còn chữ nguồn giá: ${[...new Set(ls)].join(" | ")}`);
  for (const p of ["6-8tr", "7-9tr", "5-6tr"]) if (!sent.system.includes(p)) bad(`system mất số giá ${p}`);
  const users = ms.filter((m) => m.role === "user").map((m) => String(m.content));
  if (!users.includes(USER_OLD)) bad("chữ cặp đôi gõ (tin cũ) bị sửa trước khi gửi LLM (ADR-101 cấm)");
  if (!users.includes(USER_NOW)) bad("câu cặp đôi đang hỏi bị sửa trước khi gửi LLM (ADR-101 cấm)");
}
for (const [k, v] of before) if (b.data.get(k) !== v) bad(`dữ liệu đã lưu bị đổi: ${k}`);
end();
