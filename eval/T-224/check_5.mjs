// TC5: chống lặp: tối đa 1 cảnh báo mỗi 60 phút; sau 60 phút vẫn đạt ngưỡng thì cảnh báo lại. Mỗi tin một tiến trình (khác instance), trạng thái chỉ qua KV chung.
import { chat, newKv, check, done, T0, MIN, WEBHOOK_ENV } from "./lib.mjs";
const fails = [];
const kv = newKv(); let total = 0, t = 0;
const run = (now, code = 500) => { const o = chat({ kvFile: kv, now, gemini: code, env: WEBHOOK_ENV }); total += o.slackPosts.length; };
for (let i = 0; i < 5; i++) run(T0 + ++t * 1000);
check(fails, total === 1, `5 tin lỗi đầu: 1 cảnh báo (nhận ${total})`);
for (let i = 0; i < 20; i++) run(T0 + ++t * 1000);
check(fails, total === 1, `20 tin lỗi tiếp trong cùng khung: vẫn 1 cảnh báo (nhận ${total})`);
for (let i = 0; i < 6; i++) run(T0 + 20 * MIN + i * 1000);
check(fails, total === 1, `+20 phút vẫn lỗi (đạt ngưỡng) nhưng còn trong 60 phút chờ: vẫn 1 cảnh báo (nhận ${total})`);
for (let i = 0; i < 6; i++) run(T0 + 75 * MIN + i * 1000);
check(fails, total === 2, `+75 phút vẫn lỗi: nhắc lại đúng 1 lần, tổng 2 (nhận ${total})`);
done(fails);
