// TC7: chỉ dùng kênh đã có, không dịch vụ mới: máy chủ gọi ra chỉ gồm Gemini, webhook Slack admin đã cấu hình, PostHog (chỉ khi có khoá); không thêm dịch vụ/binding mới.
import fs from "node:fs";
import path from "node:path";
import { chat, newKv, check, done, BACK, T0, WEBHOOK_ENV, HOOK, PH_KEY } from "./lib.mjs";
const fails = [];
const hosts = (o) => [...new Set(o.fetches.map((f) => new URL(f.url).hostname))].sort();
const GEM = "generativelanguage.googleapis.com", SL = new URL(HOOK).hostname;
const burst = (extra) => { const kv = newKv(); let last, all = new Set(); for (let i = 0; i < 6; i++) { last = chat({ kvFile: kv, now: T0 + i * 1000, gemini: 402, ...extra }); hosts(last).forEach((h) => all.add(h)); } return { all: [...all].sort(), last }; };
check(fails, JSON.stringify(burst({ env: {} }).all) === JSON.stringify([GEM]), "không cấu hình kênh nào: chỉ gọi tới Gemini");
const w = burst({ env: WEBHOOK_ENV });
check(fails, JSON.stringify(w.all) === JSON.stringify([GEM, SL].sort()), `có webhook: chỉ Gemini + host webhook (nhận ${w.all})`);
check(fails, w.last.slackPosts.length + 0 >= 0, "");
const p = burst({ env: { ...WEBHOOK_ENV, POSTHOG_KEY: PH_KEY } });
check(fails, p.all.every((h) => h === GEM || h === SL || h.endsWith("posthog.com")), `có webhook + PostHog: chỉ Gemini, webhook, *.posthog.com (nhận ${p.all})`);
const nh = burst({ env: { POSTHOG_KEY: PH_KEY } });
check(fails, nh.all.every((h) => h === GEM || h.endsWith("posthog.com")) && !nh.all.some((h) => h.includes("slack")), "đủ ngưỡng nhưng không có webhook: không gọi tới Slack hay máy chủ lạ");
// Webhook đúng URL đã cấu hình, đúng định dạng của kênh báo admin hiện có: POST JSON {"text": "..."}.
{
  const kv = newKv(); let posts = [];
  for (let i = 0; i < 6; i++) posts.push(...chat({ kvFile: kv, now: T0 + i * 1000, gemini: 402, env: WEBHOOK_ENV }).slackPosts);
  let body = null; try { body = JSON.parse(posts[0]?.body); } catch {}
  check(fails, posts.length === 1 && posts[0].url === HOOK && posts[0].method === "POST" && body && typeof body.text === "string" && body.text.length > 0, "cảnh báo gửi POST tới đúng ADMIN_SLACK_WEBHOOK_URL, thân JSON có chuỗi text");
}
// Không thêm dịch vụ trả phí / binding mới (đối chiếu với bản đã duyệt tại origin/main).
const wr = fs.readFileSync(path.join(BACK, "wrangler.toml"), "utf8");
const bind = [...wr.matchAll(/^\s*\[\[?([a-z0-9_.]+)\]?\]\s*$/gim)].map((m) => m[1]).filter((n) => !["vars", "triggers"].includes(n)).sort();
check(fails, JSON.stringify(bind) === JSON.stringify(["kv_namespaces", "r2_buckets"]), `wrangler.toml: chỉ có binding r2_buckets + kv_namespaces như cũ (nhận ${bind})`);
check(fails, !/^\s*\[\[?(d1_databases|queues|durable_objects|analytics_engine_datasets|vectorize|ai|hyperdrive|services)\b/im.test(wr), "wrangler.toml: không thêm D1/Queues/Durable Objects/Analytics Engine/AI/dịch vụ khác");
const pk = JSON.parse(fs.readFileSync(path.join(BACK, "package.json"), "utf8"));
check(fails, JSON.stringify(Object.keys(pk.dependencies || {})) === JSON.stringify(["yaml"]), "package.json: dependencies vẫn chỉ có yaml (không thêm thư viện)");
done(fails);
