// T-223 tiêu chí 10 (điểm nối T-224): MỌI sự kiện error của orchestrator có `category` ở mức ngoài, theo bảng: billing, auth, rate_limit, timeout, network (không nhận được phản hồi HTTP), server (5xx), invalid_input (400/422), unknown (mã khác), mid_stream (đứt sau khi AI đã bắt đầu trả). `errors[]` giữ nguyên nhãn cũ. Luồng SSE gửi cặp đôi KHÔNG mang các trường này (chỉ message và recoverable).
import * as h from "./_harness.mjs";
const r = h.reporter();
const CASES = [
  ["402", () => h.httpErr(402), "billing", 1], ["401", () => h.httpErr(401), "auth", 1], ["403", () => h.httpErr(403), "auth", 1],
  ["429", () => h.httpErr(429), "rate_limit", 2], ["500", () => h.httpErr(500), "server", 2], ["400", () => h.httpErr(400), "invalid_input", 1],
  ["418", () => h.httpErr(418), "unknown", 2], ["lỗi mạng", () => h.netErr(), "network", 2], ["timeout", () => h.timeoutErr(), "timeout", 2],
  ["đứt giữa chừng", () => h.brokenStream("Xin chào"), "mid_stream", 1],
];
for (const [name, mk, cat, calls] of CASES) {
  h.setLlm(mk);
  const { orchestrator } = h.createOrchestrator({ GEMINI_API_KEY: h.FAKE_KEY, PROVIDER_ORDER: "gemini", PROVIDER_RETRIES: "1", NODE_ENV: "production" });
  const events = [];
  try { for await (const e of orchestrator.stream({ messages: [{ role: "user", content: "xin chào" }], systemPrompt: "x", maxTokens: 16 })) events.push(e); } catch { /* sau sự kiện lỗi */ }
  const err = events.find((e) => e.type === "error");
  r.check(err?.category === cat, `${name}: event.category = ${cat}`, `nhận ${err?.category}`);
  r.check(h.llmCalls.length === calls, `${name}: ${calls} lần gọi`, `nhận ${h.llmCalls.length}`);
  if (name === "lỗi mạng") r.check(err?.errors?.every((e) => e.category === "unknown"), "lỗi mạng: errors[] giữ nhãn cũ unknown", JSON.stringify(err?.errors?.map((e) => e.category)));
  if (name === "500") r.check(err?.errors?.every((e) => e.category === "server_error"), "500: errors[] giữ nhãn cũ server_error", JSON.stringify(err?.errors?.map((e) => e.category)));
  const { env } = h.makeWorld(h.trialDoc(0));
  h.setLlm(mk);
  const res = await h.chat(env);
  const d = h.errEvent(res);
  r.check(!!d && Object.keys(d).sort().join() === "message,recoverable" && !/"category"|"errors"|"mid_stream"/.test(res.raw), `${name}: SSE tới cặp đôi chỉ có message và recoverable`, JSON.stringify(d));
}
r.done();
