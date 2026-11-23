// TC1: mỗi lần provider LLM thất bại trong một tin nhắn chat ở production -> đúng một dòng log JSON event "llm_provider_error".
import { chat, sig, check, done } from "./lib.mjs";
const fails = [];
for (const [mode, expStatus] of [[402, 402], [500, 500], [429, 429], ["throw", null]]) {
  const o = chat({ gemini: mode });
  const s = sig(o, "llm_provider_error");
  check(fails, o.geminiCalls >= 1 && s.length === o.geminiCalls, `Gemini=${mode}: ${s.length} tín hiệu cho ${o.geminiCalls} lần gọi thất bại (phải bằng nhau)`);
  check(fails, s.every((x) => x.provider === "gemini" && typeof x.model === "string" && x.model && typeof x.category === "string" && x.category), `Gemini=${mode}: mỗi tín hiệu có provider "gemini", model, category là chuỗi không rỗng`);
  check(fails, s.every((x) => x.http_status === expStatus), `Gemini=${mode}: http_status = ${expStatus === null ? "null" : expStatus} (số, hoặc null khi không có phản hồi HTTP)`);
  check(fails, s.every((x, i) => x.attempt === i + 1), `Gemini=${mode}: trường attempt đếm 1..n theo thứ tự`);
}
const ok = chat({ gemini: "ok" });
check(fails, sig(ok, "llm_provider_error").length === 0, "chat thành công: 0 tín hiệu llm_provider_error");
done(fails);
