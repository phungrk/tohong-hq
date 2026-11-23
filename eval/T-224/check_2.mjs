// TC2: mỗi tin nhắn chat (đã tới bước gọi LLM) kết thúc bằng đúng một dòng log JSON event "chat_llm_result", làm mẫu số cho tỉ lệ lỗi.
import { chat, sig, check, done } from "./lib.mjs";
const fails = [];
const f = chat({ gemini: 402 });
const r = sig(f, "chat_llm_result");
const last = sig(f, "llm_provider_error").at(-1);
check(fails, r.length === 1, `tin nhắn lỗi: đúng 1 chat_llm_result (nhận ${r.length})`);
check(fails, r[0]?.ok === false && r[0]?.error_category === last?.category && r[0]?.http_status === 402, "ok=false, error_category = nhãn lỗi cuối, http_status=402");
check(fails, r[0]?.attempts === f.geminiCalls, `attempts = số lần gọi provider (${f.geminiCalls})`);
const g = chat({ gemini: "ok" });
const rg = sig(g, "chat_llm_result");
check(fails, rg.length === 1 && rg[0].ok === true && rg[0].provider === "gemini" && rg[0].attempts === 1, "tin nhắn thành công: 1 chat_llm_result ok=true, provider gemini, attempts=1");
check(fails, rg[0]?.error_category == null && rg[0]?.http_status == null, "thành công: error_category và http_status là null/vắng");
const m = chat({ gemini: "ok", message: "x", kv: "none" });
check(fails, sig(m, "chat_llm_result").length === 1, "không KV: vẫn đúng 1 chat_llm_result");
done(fails);
