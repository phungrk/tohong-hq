// TC6: thiếu khoá/kênh hoặc kênh hỏng thì chat chạy y hệt: cùng dãy sự kiện SSE, HTTP 200, không ném lỗi.
import { chat, newKv, check, done, WEBHOOK_ENV, PH_KEY, T0 } from "./lib.mjs";
const fails = [];
const names = (o) => o.sse.map((e) => e.event).join(",");
const base = { fail: chat({ gemini: 402 }), ok: chat({ gemini: "ok" }) };
check(fails, base.fail.status === 200 && /(^|,)error$/.test(names(base.fail)), `không cấu hình gì, lỗi LLM: 200 và có sự kiện error (${names(base.fail)})`);
check(fails, base.ok.status === 200 && /chunk/.test(names(base.ok)) && /done$/.test(names(base.ok)), `không cấu hình gì, LLM tốt: có chunk và done (${names(base.ok)})`);
const scenarios = {
  "chỉ có webhook, không KV": { env: WEBHOOK_ENV, kv: "none" },
  "KV hỏng (mọi thao tác ngoài rl:* ném lỗi)": { env: { ...WEBHOOK_ENV, POSTHOG_KEY: PH_KEY }, kv: "throw", kvFile: true },
  "Slack trả 500": { env: WEBHOOK_ENV, kvFile: true, slack: 500 },
  "Slack ném lỗi mạng": { env: WEBHOOK_ENV, kvFile: true, slack: "throw" },
  "PostHog trả 500": { env: { POSTHOG_KEY: PH_KEY }, posthog: 500 },
  "PostHog ném lỗi mạng": { env: { POSTHOG_KEY: PH_KEY }, posthog: "throw" },
  "webhook rỗng, khoá rỗng": { env: { ADMIN_SLACK_WEBHOOK_URL: "", POSTHOG_KEY: "" } },
};
for (const [name, s] of Object.entries(scenarios)) {
  const kvFile = s.kvFile ? newKv() : undefined; if (s.kv === "throw") s.kv = "throw";
  // 6 tin lỗi để chắc chắn đã chạm ngưỡng cảnh báo trong các kịch bản có webhook
  let allSame = true, why = "";
  for (let i = 0; i < 6; i++) {
    const o = chat({ ...s, kvFile, now: T0 + i * 1000, gemini: 402 });
    if (o.status !== 200 || o.thrown || names(o) !== names(base.fail)) { allSame = false; why = `status=${o.status} thrown=${o.thrown} seq=${names(o)}`; break; }
  }
  const g = chat({ ...s, kvFile, gemini: "ok" });
  const okSame = g.status === 200 && !g.thrown && names(g) === names(base.ok);
  check(fails, allSame && okSame, `${name}: chat lỗi và chat tốt đều giữ nguyên hành vi${allSame && okSame ? "" : " (" + why + " | ok:" + names(g) + ")"}`);
}
done(fails);
