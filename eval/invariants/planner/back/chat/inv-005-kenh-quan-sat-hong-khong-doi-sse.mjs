// Nguồn: T-224 (spec products/T-224-tin-hieu-suc-khoe-chat-llm.md, hành vi 6; rút bởi spec-critic khi spec qua Spec Gate v2, từ check_6).
// Vùng: planner/back/chat. Chờ merge PR T-224; Chief of Staff đưa thư mục này (cả lib/) vào eval/invariants/planner/back/chat/ sau merge.
// Bất biến: thiếu hay hỏng kênh quan sát (không KV, KV ném lỗi ngoài khoá rl:*, Slack/PostHog 500 hoặc lỗi mạng, biến rỗng) thì tin chat lỗi
// và tin chat tốt vẫn trả HTTP 200, không ném lỗi, và đúng dãy sự kiện SSE như khi không cấu hình kênh nào.
// Offline. Repo back: TOHONG_BACK_REPO, rồi ../tohong-back cạnh gốc HQ. Thoát 0 = đạt.
import { chat, newKv, check, done, WEBHOOK_ENV, PH_KEY, T0, names } from "./lib/t224_harness.mjs";
const fails = [];
const base = { fail: chat({ gemini: 500 }), ok: chat({ gemini: "ok" }) };
check(fails, base.fail.status === 200 && /(^|,)error$/.test(names(base.fail)), `không cấu hình gì, lỗi LLM: 200 và kết bằng error (${names(base.fail)})`);
check(fails, base.ok.status === 200 && /done$/.test(names(base.ok)), `không cấu hình gì, LLM tốt: kết bằng done (${names(base.ok)})`);
const scenarios = {
  "chỉ webhook, không KV": { env: WEBHOOK_ENV, kv: "none" },
  "KV hỏng": { env: { ...WEBHOOK_ENV, POSTHOG_KEY: PH_KEY }, kv: "throw", kvFile: true },
  "Slack 500": { env: WEBHOOK_ENV, kvFile: true, slack: 500 },
  "Slack lỗi mạng": { env: WEBHOOK_ENV, kvFile: true, slack: "throw" },
  "PostHog 500": { env: { POSTHOG_KEY: PH_KEY }, posthog: 500 },
  "PostHog lỗi mạng": { env: { POSTHOG_KEY: PH_KEY }, posthog: "throw" },
  "biến rỗng": { env: { ADMIN_SLACK_WEBHOOK_URL: "", POSTHOG_KEY: "" } },
};
for (const [name, s] of Object.entries(scenarios)) {
  const kvFile = s.kvFile ? newKv() : undefined;
  let why = "";
  for (let i = 0; i < 6 && !why; i++) {
    const o = chat({ ...s, kvFile, now: T0 + i * 1000, gemini: 500 });
    if (o.status !== 200 || o.thrown || names(o) !== names(base.fail)) why = `lỗi: status=${o.status} thrown=${o.thrown} seq=${names(o)}`;
  }
  const g = chat({ ...s, kvFile, now: T0 + 7000, gemini: "ok" });
  if (!why && (g.status !== 200 || g.thrown || names(g) !== names(base.ok))) why = `tốt: status=${g.status} thrown=${g.thrown} seq=${names(g)}`;
  check(fails, !why, `${name}: giữ nguyên hành vi chat ${why}`);
}
done(fails);
