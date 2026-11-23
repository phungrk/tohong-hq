// TC10: Slack, PostHog, hay KV-sức-khoẻ treo/chậm 30 giây không làm chậm cặp đôi: sự kiện cuối (done hoặc error) tới sau < 3 giây và luồng SSE đóng sau < 3 giây.
import { chat, newKv, check, done, T0, WEBHOOK_ENV, PH_KEY } from "./lib.mjs";
const fails = [];
const LIM = 3000;
const ok = (o) => o.eventMs != null && o.eventMs < LIM && o.closeMs != null && o.closeMs < LIM;
// Đưa trạng thái tới ngưỡng cảnh báo trước (4 lỗi), rồi tin thứ 5 kích Slack treo.
{
  const kv = newKv();
  for (let i = 0; i < 4; i++) chat({ kvFile: kv, now: T0 + i * 1000, gemini: 500, env: WEBHOOK_ENV });
  const o = chat({ kvFile: kv, now: T0 + 5000, gemini: 500, env: WEBHOOK_ENV, slack: "hang" });
  check(fails, ok(o) && o.sse.some((e) => e.event === "error"), `Slack treo 30s ở tin kích cảnh báo: error ${Math.round(o.eventMs)}ms, đóng luồng ${Math.round(o.closeMs)}ms (< ${LIM})`);
}
{
  const o = chat({ gemini: 500, env: { POSTHOG_KEY: PH_KEY }, posthog: "hang" });
  check(fails, ok(o), `PostHog treo 30s, tin lỗi: ${Math.round(o.eventMs)}ms / đóng ${Math.round(o.closeMs)}ms`);
  const g = chat({ gemini: "ok", env: { POSTHOG_KEY: PH_KEY }, posthog: "hang" });
  check(fails, ok(g) && g.sse.some((e) => e.event === "done"), `PostHog treo 30s, tin tốt: done ${Math.round(g.eventMs)}ms / đóng ${Math.round(g.closeMs)}ms`);
}
{
  const kv = newKv();
  const o = chat({ kvFile: kv, kv: "slow", gemini: 500, env: WEBHOOK_ENV });
  check(fails, ok(o), `KV sức khoẻ chậm 30s, tin lỗi: ${Math.round(o.eventMs)}ms / đóng ${Math.round(o.closeMs)}ms`);
  const g = chat({ kvFile: kv, kv: "slow", gemini: "ok", env: WEBHOOK_ENV });
  check(fails, ok(g) && g.sse.some((e) => e.event === "done"), `KV sức khoẻ chậm 30s, tin tốt: done ${Math.round(g.eventMs)}ms / đóng ${Math.round(g.closeMs)}ms`);
}
done(fails);
