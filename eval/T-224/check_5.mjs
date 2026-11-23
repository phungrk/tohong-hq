// TC5: chống spam: sau một cảnh báo, trong 60 phút không cảnh báo tiếp dù vẫn lỗi; sau 60 phút mà vẫn lỗi thì nhắc lại. Mỗi tin là một tiến trình riêng (khác instance), trạng thái chỉ đi qua KV chung.
import { chat, newKv, check, done, T0, MIN, WEBHOOK_ENV } from "./lib.mjs";
const fails = [];
const kv = newKv(); let total = 0, t = 0;
const run = (now) => { const o = chat({ kvFile: kv, now, gemini: 402, env: WEBHOOK_ENV }); total += o.slackPosts.length; return o.slackPosts.length; };
for (let i = 0; i < 5; i++) run(T0 + ++t * 1000);
check(fails, total === 1, `5 lỗi đầu: 1 cảnh báo (nhận ${total})`);
for (let i = 0; i < 20; i++) run(T0 + ++t * 1000);
check(fails, total === 1, `20 lỗi tiếp trong cùng khung: vẫn 1 cảnh báo (nhận ${total})`);
for (let i = 0; i < 6; i++) run(T0 + 20 * MIN + i * 1000);
check(fails, total === 1, `khung mới (+20 phút) vẫn lỗi 100% nhưng còn trong 60 phút chờ: vẫn 1 cảnh báo (nhận ${total})`);
for (let i = 0; i < 6; i++) run(T0 + 75 * MIN + i * 1000);
check(fails, total === 2, `+75 phút vẫn lỗi: nhắc lại đúng 1 lần, tổng 2 (nhận ${total})`);
done(fails);
