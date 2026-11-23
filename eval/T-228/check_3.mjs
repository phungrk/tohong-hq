// TC3: Slack nhận (200, 204): chống lặp 60 phút như cũ (ADR-147), nhắc lại sau 60 phút nếu vẫn đạt ngưỡng; nội dung cảnh báo không đổi.
import { chat, newKv, check, done, T0, MIN } from "./lib.mjs";
const fails = [];
const kv = newKv(); let total = 0, t = 0, first;
const run = (now, s) => { const o = chat({ kvFile: kv, now, slack: s }); total += o.slackPosts.length; return o; };
for (let i = 0; i < 4; i++) run(T0 + ++t * 1000, 200);
first = run(T0 + ++t * 1000, 200);
check(fails, total === 1, `5 tin lỗi, Slack 200: 1 cảnh báo (nhận ${total})`);
let text = ""; try { text = JSON.parse(first.slackPosts[0].body).text; } catch {}
check(fails, first.slackPosts[0]?.method === "POST" && /\b5\b/.test(text) && /500/.test(text), `nội dung: POST JSON {text} có số tin lỗi 5 và mã 500 (text="${String(text).slice(0, 100)}")`);
for (let i = 0; i < 15; i++) run(T0 + ++t * 1000, 204);
check(fails, total === 1, `15 tin lỗi tiếp: vẫn 1 (nhận ${total})`);
for (let i = 0; i < 6; i++) run(T0 + 20 * MIN + i * 1000, 200);
check(fails, total === 1, `+20 phút: vẫn 1 (nhận ${total})`);
for (let i = 0; i < 6; i++) run(T0 + 75 * MIN + i * 1000, 204);
check(fails, total === 2, `+75 phút vẫn lỗi: nhắc lại đúng 1 lần, tổng 2 (nhận ${total})`);
done(fails);
