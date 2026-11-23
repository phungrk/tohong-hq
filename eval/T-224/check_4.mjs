// TC4: cảnh báo Slack khi, trong 15 phút gần nhất, có >= 5 tin nhắn chat có kết quả LLM và >= 50% trong đó lỗi.
import { chat, newKv, check, done, T0, MIN, WEBHOOK_ENV } from "./lib.mjs";
const fails = [];
const run = (kvFile, now, gemini) => chat({ kvFile, now, gemini, env: WEBHOOK_ENV });

// A: 4 lỗi liên tiếp -> chưa đủ khối lượng; lỗi thứ 5 -> đúng 1 cảnh báo.
{
  const kv = newKv(); let posts = [];
  for (let i = 1; i <= 5; i++) { const o = run(kv, T0 + i * 1000, 402); posts.push(o.slackPosts.length); }
  check(fails, posts.slice(0, 4).every((n) => n === 0), "A: 4 tin lỗi đầu: 0 cảnh báo (dưới 5 tin)");
  check(fails, posts[4] === 1, `A: tin lỗi thứ 5 (5/5 lỗi): đúng 1 cảnh báo (nhận ${posts[4]})`);
  // nội dung cảnh báo
  const kv2 = newKv(); let last;
  for (let i = 1; i <= 5; i++) last = run(kv2, T0 + i * 1000, 402);
  const p = last.slackPosts[0];
  let text = ""; try { text = JSON.parse(p.body).text; } catch {}
  check(fails, p?.method === "POST" && typeof text === "string" && /gemini/i.test(text) && /\b5\s*\/\s*5\b/.test(text) && /402/.test(text), `A: cảnh báo là POST JSON {text} có provider, "5/5", mã 402 (text="${String(text).slice(0, 120)}")`);
}
// B: 6 tin thành công rồi lỗi nối tiếp -> chỉ cảnh báo khi tỉ lệ lỗi chạm 50% (6/12), không phải 5/11.
{
  const kv = newKv(); let t = 0;
  for (let i = 0; i < 6; i++) run(kv, T0 + ++t * 1000, "ok");
  const res = [];
  for (let i = 0; i < 6; i++) res.push(run(kv, T0 + ++t * 1000, 402).slackPosts.length);
  check(fails, res.slice(0, 5).every((n) => n === 0), `B: 5/11 lỗi (45%) chưa cảnh báo (nhận ${res.slice(0, 5)})`);
  check(fails, res[5] === 1, `B: 6/12 lỗi (50%) cảnh báo (nhận ${res[5]})`);
}
// C: toàn tin thành công, không bao giờ cảnh báo; D: 5 lỗi nhưng rải 6 phút một tin -> không khung 15 phút nào đủ 5 tin.
{
  const kv = newKv(); let n = 0;
  for (let i = 0; i < 8; i++) n += run(kv, T0 + i * 1000, "ok").slackPosts.length;
  check(fails, n === 0, "C: 8 tin thành công: 0 cảnh báo");
  const kv2 = newKv(); let m = 0;
  for (let i = 0; i < 5; i++) m += run(kv2, T0 + i * 6 * MIN, 402).slackPosts.length;
  check(fails, m === 0, `D: 5 lỗi cách nhau 6 phút (tối đa 3 tin trong 15 phút): 0 cảnh báo (nhận ${m})`);
}
done(fails);
