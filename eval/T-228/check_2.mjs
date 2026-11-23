// TC2: Slack treo: lần POST bị huỷ sau 10 giây (chấp nhận 9 đến 10,5 giây), tính là lỗi (không ghi khoá, tin lỗi kế tiếp gửi lại); cặp đôi không phải chờ.
import { chat, newKv, check, done, T0 } from "./lib.mjs";
const fails = [];
const kv = newKv(); let t = 0;
for (let i = 0; i < 4; i++) chat({ kvFile: kv, now: T0 + ++t * 1000 });
const h = chat({ kvFile: kv, now: T0 + ++t * 1000, slack: "hang", waitMs: 12500 });
check(fails, h.slackPosts.length === 1, `tin 5 (Slack treo): đúng 1 POST (nhận ${h.slackPosts.length})`);
check(fails, h.aborts.length === 1 && h.aborts[0] >= 9000 && h.aborts[0] <= 10500, `POST treo bị huỷ sau 9 đến 10,5 giây (nhận ${JSON.stringify(h.aborts)} ms)`);
check(fails, h.eventMs != null && h.eventMs < 3000 && h.closeMs < 3000 && h.sse.some((e) => e.event === "error"), `cặp đôi nhận error và luồng đóng < 3 giây (${Math.round(h.eventMs)}/${Math.round(h.closeMs)} ms)`);
check(fails, h.puts <= 1, `tin treo: tối đa 1 put KV (nhận ${h.puts})`);
const n = chat({ kvFile: kv, now: T0 + ++t * 1000, slack: "ok" });
check(fails, n.slackPosts.length === 1, `tin lỗi kế tiếp gửi lại (nhận ${n.slackPosts.length} POST)`);
const m = chat({ kvFile: kv, now: T0 + ++t * 1000, slack: "ok" });
check(fails, m.slackPosts.length === 0, `sau 2xx: im lặng (nhận ${m.slackPosts.length} POST)`);
done(fails);
