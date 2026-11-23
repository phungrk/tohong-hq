// TC4: cảnh báo Slack khi số TIN chat lỗi trong khung 15 phút hiện tại + khung 15 phút liền trước >= 5 (khung cố định theo floor(epoch/900s)).
// Tỉ lệ lỗi không phải điều kiện cảnh báo (quyết định của Chief, ADR-145 vòng 1). Đếm theo tin nhắn, không theo lần thử.
import { chat, newKv, check, done, T0, MIN, WEBHOOK_ENV } from "./lib.mjs";
// T0 = 03:05 UTC: khung hiện tại 03:00-03:15, khung kế 03:15-03:30.
const fails = [];
const run = (kvFile, now, gemini) => chat({ kvFile, now, gemini, env: WEBHOOK_ENV });
const textOf = (o) => { try { return JSON.parse(o.slackPosts[0].body).text; } catch { return ""; } };

// A: 4 tin lỗi chưa đủ; tin lỗi thứ 5 trong cùng khung: đúng 1 cảnh báo, có provider, số 5, mã HTTP.
{
  const kv = newKv(); const posts = []; let last;
  for (let i = 1; i <= 5; i++) { last = run(kv, T0 + i * 1000, 402); posts.push(last.slackPosts.length); }
  check(fails, posts.slice(0, 4).every((n) => n === 0) && posts[4] === 1, `A: 4 lỗi: 0 cảnh báo; lỗi thứ 5: đúng 1 (nhận ${posts})`);
  const t = textOf(last), p = last.slackPosts[0];
  check(fails, p?.method === "POST" && /gemini/i.test(t) && /\b5\b/.test(t) && /402/.test(t), `A: cảnh báo POST JSON {text} có provider, số lỗi 5, mã 402 (text="${String(t).slice(0, 120)}")`);
}
// B: tin thành công không ảnh hưởng và không làm giảm đếm: 6 tin tốt rồi 5 lỗi -> cảnh báo ở lỗi thứ 5.
{
  const kv = newKv(); let t = 0; const res = [];
  for (let i = 0; i < 6; i++) run(kv, T0 + ++t * 1000, "ok");
  for (let i = 0; i < 5; i++) res.push(run(kv, T0 + ++t * 1000, 402).slackPosts.length);
  check(fails, res.slice(0, 4).every((n) => n === 0) && res[4] === 1, `B: 6 tin tốt rồi 5 lỗi: cảnh báo đúng ở lỗi thứ 5 (nhận ${res})`);
}
// C: cụm lỗi vắt ranh giới khung: 3 lỗi lúc 03:14 và 3 lỗi lúc 03:16 -> cảnh báo (khung cố định chỉ-hiện-tại sẽ bỏ sót).
{
  const kv = newKv(); const res = [];
  for (let i = 0; i < 3; i++) res.push(run(kv, T0 + 9 * MIN + i * 1000, 402).slackPosts.length);
  for (let i = 0; i < 3; i++) res.push(run(kv, T0 + 11 * MIN + i * 1000, 402).slackPosts.length);
  const total = res.reduce((a, b) => a + b, 0);
  check(fails, total === 1 && res.slice(0, 4).every((n) => n === 0) && res[4] === 1, `C: 3 lỗi 03:14 + 3 lỗi 03:16: đúng 1 cảnh báo, ở lỗi thứ 5 (nhận ${res})`);
}
// D: lỗi thưa (cách nhau 20 phút) không bao giờ chạm 5 trong hai khung: 0 cảnh báo.
{
  const kv = newKv(); let n = 0;
  for (let i = 0; i < 5; i++) n += run(kv, T0 + i * 20 * MIN, 402).slackPosts.length;
  check(fails, n === 0, `D: 5 lỗi cách nhau 20 phút: 0 cảnh báo (nhận ${n})`);
}
// E: lỗi cũ quá hai khung không được tính: 4 lỗi lúc 03:05, 1 lỗi lúc 03:40 (khung 03:30-03:45, khung trước 03:15-03:30 trống) -> không cảnh báo.
{
  const kv = newKv(); let n = 0;
  for (let i = 0; i < 4; i++) n += run(kv, T0 + i * 1000, 402).slackPosts.length;
  n += run(kv, T0 + 35 * MIN, 402).slackPosts.length;
  check(fails, n === 0, `E: 4 lỗi cũ (2 khung trước) + 1 lỗi mới: 0 cảnh báo (nhận ${n})`);
}
// F: đếm theo TIN, không theo lần thử: 500 và 429 đều bị thử lại (2 lần gọi/tin) dù T-223 merge hay chưa.
for (const code of [500, 429]) {
  const kv = newKv(); const res = []; let calls = 0;
  for (let i = 1; i <= 5; i++) { const o = run(kv, T0 + i * 1000, code); calls += o.geminiCalls; res.push(o.slackPosts.length); }
  check(fails, res.slice(0, 4).every((n) => n === 0) && res[4] === 1, `F: HTTP ${code} (${calls} lần gọi cho 5 tin): chưa cảnh báo ở 4 tin, cảnh báo ở tin thứ 5 (nhận ${res})`);
}
done(fails);
