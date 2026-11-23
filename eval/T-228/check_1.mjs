// TC1: Slack không nhận (500, 429, 404, ném lỗi mạng) thì cảnh báo chưa tính là đã gửi: tin lỗi kế tiếp còn đạt ngưỡng sẽ gửi lại; sau khi một lần gửi được 2xx thì chống lặp.
import { chat, newKv, check, done, T0 } from "./lib.mjs";
const fails = [];
for (const bad of [500, 429, 404, "throw"]) {
  const kv = newKv(); let t = 0; const posts = [];
  for (let i = 0; i < 4; i++) posts.push(chat({ kvFile: kv, now: T0 + ++t * 1000 }).slackPosts.length);
  posts.push(chat({ kvFile: kv, now: T0 + ++t * 1000, slack: bad }).slackPosts.length);   // tin 5: đạt ngưỡng, Slack lỗi
  posts.push(chat({ kvFile: kv, now: T0 + ++t * 1000, slack: "ok" }).slackPosts.length);   // tin 6: gửi lại, Slack nhận
  posts.push(chat({ kvFile: kv, now: T0 + ++t * 1000, slack: "ok" }).slackPosts.length);   // tin 7: đã có cảnh báo thành công, im lặng
  posts.push(chat({ kvFile: kv, now: T0 + ++t * 1000, slack: bad }).slackPosts.length);    // tin 8: vẫn im lặng dù Slack lại hỏng
  check(fails, posts.join() === "0,0,0,0,1,1,0,0", `Slack ${bad} ở lần gửi đầu: POST theo tin = ${posts} (cần 0,0,0,0,1,1,0,0)`);
}
// Lỗi hai lần liên tiếp rồi mới nhận: mỗi tin lỗi đạt ngưỡng gửi lại, tới khi 2xx.
{
  const kv = newKv(); let t = 0; const posts = [];
  for (let i = 0; i < 4; i++) chat({ kvFile: kv, now: T0 + ++t * 1000 });
  for (const s of [500, 429, "throw", "ok", "ok"]) posts.push(chat({ kvFile: kv, now: T0 + ++t * 1000, slack: s }).slackPosts.length);
  check(fails, posts.join() === "1,1,1,1,0", `Slack hỏng 3 tin liền rồi hồi phục: POST theo tin = ${posts} (cần 1,1,1,1,0)`);
}
done(fails);
