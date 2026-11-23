// T-223 tiêu chí 2: lỗi tạm thời giữ nguyên hành vi cũ: 429, 5xx, lỗi mạng, timeout vẫn được thử lại (1 + PROVIDER_RETRIES lần), nhãn không đổi, recoverable = true.
import * as h from "./_harness.mjs";
const r = h.reporter();
const CASES = [
  ["429", () => h.httpErr(429), "rate_limit"],
  ["500", () => h.httpErr(500), "server_error"],
  ["lỗi mạng", () => h.netErr(), "unknown"],
  ["timeout", () => h.timeoutErr(), "timeout"],
];
async function run(retries, mk) {
  h.setLlm(mk);
  const { orchestrator } = h.createOrchestrator({ GEMINI_API_KEY: h.FAKE_KEY, PROVIDER_ORDER: "gemini", PROVIDER_RETRIES: String(retries), NODE_ENV: "production" });
  const events = [];
  try { for await (const e of orchestrator.stream({ messages: [{ role: "user", content: "xin chào" }], systemPrompt: "x", maxTokens: 16 })) events.push(e); } catch { /* sau sự kiện lỗi */ }
  return events.find((e) => e.type === "error");
}
for (const [name, mk, label] of CASES) {
  const err = await run(1, mk);
  r.check(h.llmCalls.length === 2, `${name}: thử lại, tổng 2 lần gọi`, `nhận ${h.llmCalls.length}`);
  r.check(err?.errors?.every((e) => e.category === label) && err?.errors?.length === 2, `${name}: 2 lỗi, nhãn ${label}`, JSON.stringify(err?.errors?.map((e) => e.category)));
  r.check(err?.recoverable === true, `${name}: recoverable = true`, `nhận ${err?.recoverable}`);
}
await run(0, () => h.httpErr(429));
r.check(h.llmCalls.length === 1, "PROVIDER_RETRIES=0 vẫn được tôn trọng (429 -> 1 lần gọi)", `nhận ${h.llmCalls.length}`);
r.done();
