// TC4: hạn mức ghi KV (ngoài khoá rl:*): tin thành công 0 put/list/delete; tin lỗi tối đa 1 put; put thứ hai (khoá chống lặp) chỉ xảy ra ở tin mà Slack trả 2xx; không list/delete; mọi put có TTL.
import { chat, newKv, check, done, T0 } from "./lib.mjs";
const fails = [];
const bad = []; const kv = newKv(); let t = 0;
const audit = (o, tag, maxPuts) => { const k = o.kvOps; if (k.lists || k.deletes) bad.push(`${tag}: list/delete`); if (k.puts.length > maxPuts) bad.push(`${tag}: ${k.puts.length} put (tối đa ${maxPuts})`); if (k.puts.some((p) => !p.ttl)) bad.push(`${tag}: put không TTL`); };
for (let i = 0; i < 10; i++) audit(chat({ kvFile: kv, now: T0 + ++t * 1000, gemini: "ok" }), `ok#${i}`, 0);
check(fails, bad.length === 0, `10 tin thành công: 0 put/list/delete ${bad.join("; ")}`);
let b0 = bad.length;
for (let i = 0; i < 4; i++) audit(chat({ kvFile: kv, now: T0 + ++t * 1000 }), `fail#${i}`, 1);
for (const s of [500, 429, "throw", 404]) { const o = chat({ kvFile: kv, now: T0 + ++t * 1000, slack: s }); audit(o, `slack-${s}`, 1); if (o.slackPosts.length !== 1) bad.push(`slack-${s}: không POST`); }
check(fails, bad.length === b0, `tin kích cảnh báo mà Slack lỗi (500/429/404/ném lỗi): đúng 1 put (chỉ bộ đếm), không ghi khoá ${bad.slice(b0).join("; ")}`);
b0 = bad.length;
const ok = chat({ kvFile: kv, now: T0 + ++t * 1000, slack: "ok" });
audit(ok, "slack-ok", 2);
check(fails, bad.length === b0 && ok.slackPosts.length === 1 && ok.kvOps.puts.length === 2, `tin kích cảnh báo mà Slack 2xx: đúng 2 put (đếm + khoá) (nhận ${ok.kvOps.puts.length}) ${bad.slice(b0).join("; ")}`);
b0 = bad.length;
for (let i = 0; i < 3; i++) audit(chat({ kvFile: kv, now: T0 + ++t * 1000, slack: "ok" }), `locked#${i}`, 1);
for (let i = 0; i < 5; i++) audit(chat({ kvFile: kv, now: T0 + ++t * 1000, gemini: "ok" }), `ok-after#${i}`, 0);
check(fails, bad.length === b0, `sau cảnh báo: tin lỗi tối đa 1 put, tin tốt 0 put ${bad.slice(b0).join("; ")}`);
done(fails);
