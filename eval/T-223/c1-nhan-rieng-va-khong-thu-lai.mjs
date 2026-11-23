// T-223 tiêu chí 1: provider LLM trả 402/401/403 -> sự kiện lỗi của orchestrator mang nhãn đúng (402=billing, 401/403=auth), không thể phục hồi bằng thử lại, và provider chỉ bị gọi đúng 1 lần dù PROVIDER_RETRIES=1.
// Điểm nối cho T-224: nhãn nằm ở event.category và event.errors[0].category.
import * as h from "./_harness.mjs";
const r = h.reporter();
const WANT = { 402: "billing", 401: "auth", 403: "auth" };
for (const [st, label] of Object.entries(WANT)) {
  h.setLlm(() => h.httpErr(Number(st)));
  const { orchestrator } = h.createOrchestrator({ GEMINI_API_KEY: h.FAKE_KEY, PROVIDER_ORDER: "gemini", PROVIDER_RETRIES: "1", NODE_ENV: "production" });
  const events = [];
  try { for await (const e of orchestrator.stream({ messages: [{ role: "user", content: "xin chào" }], systemPrompt: "x", maxTokens: 16 })) events.push(e); } catch { /* orchestrator ném sau khi phát sự kiện lỗi */ }
  const err = events.find((e) => e.type === "error");
  r.check(!!err, `HTTP ${st}: có sự kiện error`, "không có");
  r.check(err?.category === label, `HTTP ${st}: event.category = ${label}`, `nhận ${err?.category}`);
  r.check(err?.errors?.[0]?.category === label, `HTTP ${st}: event.errors[0].category = ${label}`, `nhận ${err?.errors?.[0]?.category}`);
  r.check(err?.recoverable === false, `HTTP ${st}: recoverable = false`, `nhận ${err?.recoverable}`);
  r.check(h.llmCalls.length === 1, `HTTP ${st}: gọi provider đúng 1 lần`, `nhận ${h.llmCalls.length} lần`);
  r.check(!events.some((e) => e.type === "chunk" || e.type === "meta"), `HTTP ${st}: không có chunk/meta`, "có");
}
r.done();
