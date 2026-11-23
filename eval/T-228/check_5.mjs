// TC5: Slack lỗi kéo dài không gây bão: mỗi tin lỗi đạt ngưỡng POST tối đa 1 lần (không thử lại trong cùng tin), không thêm put; khi Slack hồi phục chỉ đúng 1 cảnh báo nhận được rồi im lặng.
// Giới hạn được chấp nhận (ghi trong spec): trong lúc Slack lỗi, số POST = số tin lỗi đạt ngưỡng (không trần), vì mọi trần đều tốn ghi KV hoặc làm mất cảnh báo.
import { chat, newKv, check, done, T0 } from "./lib.mjs";
const fails = [];
const kv = newKv(); let t = 0; let posts = [], maxPer = 0, maxPuts = 0;
for (let i = 1; i <= 12; i++) { const o = chat({ kvFile: kv, now: T0 + ++t * 1000, slack: i % 2 ? 500 : 429 }); posts.push(o.slackPosts.length); maxPer = Math.max(maxPer, o.slackPosts.length); maxPuts = Math.max(maxPuts, o.puts); }
check(fails, posts.join() === "0,0,0,0,1,1,1,1,1,1,1,1", `12 tin lỗi, Slack 500/429 xen kẽ: POST theo tin = ${posts}`);
check(fails, maxPer <= 1 && maxPuts <= 1, `mỗi tin tối đa 1 POST và 1 put (POST ${maxPer}, put ${maxPuts})`);
const rec = [];
for (let i = 0; i < 4; i++) rec.push(chat({ kvFile: kv, now: T0 + ++t * 1000, slack: "ok" }).slackPosts.length);
check(fails, rec.join() === "1,0,0,0", `Slack hồi phục: đúng 1 cảnh báo nhận được rồi im lặng (nhận ${rec})`);
done(fails);
