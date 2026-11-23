// Nguồn: T-224 (spec products/T-224-tin-hieu-suc-khoe-chat-llm.md, hành vi 4b; defect handoffs/T-224-D1.md; rút bởi spec-critic khi spec qua Spec Gate v2, từ check_9).
// Vùng: planner/back/chat. Chờ merge PR T-224; Chief of Staff đưa thư mục này (cả lib/) vào eval/invariants/planner/back/chat/ sau merge.
// Lý do: KV RATE_LIMIT (gói Workers Free, ~1.000 ghi/ngày toàn tài khoản) dùng chung với giới hạn tốc độ chat; checkRateLimit không bắt lỗi put,
// nên hết hạn mức ghi là mọi tin chat trả 500. Bất biến: ngoài khoá rl:*, tin chat thành công không put/delete/list; tin chat lỗi tối đa 1 put,
// cộng 1 nếu chính tin đó gửi tin Slack; không list/delete; mọi put có TTL. Đúng cả khi có/không webhook và PostHog.
// Offline. Repo back: TOHONG_BACK_REPO, rồi ../tohong-back cạnh gốc HQ. Thoát 0 = đạt.
import { chat, newKv, check, done, T0, WEBHOOK_ENV, PH_KEY } from "./lib/t224_harness.mjs";
const fails = [];
for (const [label, env] of [["webhook+PostHog", { ...WEBHOOK_ENV, POSTHOG_KEY: PH_KEY }], ["không webhook", {}]]) {
  const kv = newKv(); let t = 0; const bad = [];
  const audit = (o, tag, okMsg) => {
    const k = o.kvOps, allow = okMsg ? 0 : 1 + (o.slackPosts.length > 0 ? 1 : 0);
    if (k.lists || k.deletes) bad.push(`${tag}: list=${k.lists} delete=${k.deletes}`);
    if (k.puts.length > allow) bad.push(`${tag}: ${k.puts.length} put (cho phép ${allow})`);
    if (k.puts.some((p) => !p.ttl)) bad.push(`${tag}: put không TTL`);
  };
  for (let i = 0; i < 10; i++) audit(chat({ kvFile: kv, now: T0 + ++t * 1000, gemini: "ok", env }), `ok#${i}`, true);
  for (let i = 0; i < 12; i++) audit(chat({ kvFile: kv, now: T0 + ++t * 1000, gemini: [402, 500, 429, "throw"][i % 4], env }), `lỗi#${i}`, false);
  for (let i = 0; i < 10; i++) audit(chat({ kvFile: kv, now: T0 + ++t * 1000, gemini: "ok", env }), `ok-sau-lỗi#${i}`, true);
  check(fails, bad.length === 0, `${label}: hạn mức ghi KV ngoài rl:* ${bad.join("; ")}`);
}
done(fails);
