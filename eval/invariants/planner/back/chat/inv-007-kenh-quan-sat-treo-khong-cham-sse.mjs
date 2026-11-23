// Nguồn: T-224 (spec products/T-224-tin-hieu-suc-khoe-chat-llm.md, hành vi 6; defect handoffs/T-224-D1.md; rút bởi spec-critic khi spec qua Spec Gate v2, từ check_10).
// Vùng: planner/back/chat. Chờ merge PR T-224; Chief of Staff đưa thư mục này (cả lib/) vào eval/invariants/planner/back/chat/ sau merge.
// Bất biến: Slack, PostHog hay KV ngoài khoá rl:* treo/chậm 30 giây thì sự kiện cuối của SSE (done/error) và việc đóng luồng vẫn tới trong < 3 giây,
// cả tin lỗi lẫn tin tốt, kể cả ở tin chạm ngưỡng gửi Slack.
// Offline. Repo back: TOHONG_BACK_REPO, rồi ../tohong-back cạnh gốc HQ. Thoát 0 = đạt.
import { chat, newKv, check, done, T0, WEBHOOK_ENV, PH_KEY } from "./lib/t224_harness.mjs";
const fails = [];
const LIM = 3000;
const fast = (o, ev) => o.eventMs != null && o.eventMs < LIM && o.closeMs != null && o.closeMs < LIM && o.sse.some((e) => e.event === ev);
const ms = (o) => `${Math.round(o.eventMs ?? -1)}ms / đóng ${Math.round(o.closeMs ?? -1)}ms`;
{
  const kv = newKv(); let worst = null;
  for (let i = 0; i < 8; i++) { const o = chat({ kvFile: kv, now: T0 + i * 1000, gemini: 500, env: WEBHOOK_ENV, slack: "hang" }); if (!fast(o, "error")) worst = worst || o; }
  check(fails, !worst, `Slack treo 30s qua chuỗi 8 tin lỗi: mọi tin kết thúc < ${LIM}ms ${worst ? ms(worst) : ""}`);
}
for (const [g, ev] of [[500, "error"], ["ok", "done"]]) {
  const p = chat({ gemini: g, env: { POSTHOG_KEY: PH_KEY }, posthog: "hang" });
  check(fails, fast(p, ev), `PostHog treo 30s, LLM=${g}: ${ms(p)}`);
  const k = chat({ kvFile: newKv(), kv: "slow", gemini: g, env: WEBHOOK_ENV });
  check(fails, fast(k, ev), `KV ngoài rl:* chậm 30s, LLM=${g}: ${ms(k)}`);
}
done(fails);
