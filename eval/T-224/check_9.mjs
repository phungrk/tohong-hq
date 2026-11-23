// TC9: hạn mức ghi KV (gói Free ~1.000 lần ghi/ngày, dùng chung với giới hạn tốc độ chat). Chỉ đếm thao tác ngoài khoá "rl:".
// Tin thành công: 0 put, 0 delete, 0 list. Tin lỗi: tối đa 1 put, cộng 1 nếu chính tin đó kích cảnh báo. Không list, không delete. Mọi put có TTL.
import { chat, newKv, check, done, T0, WEBHOOK_ENV } from "./lib.mjs";
const fails = [];
const kv = newKv(); let t = 0;
const bad = [];
const audit = (o, label, allowAlert) => {
  const k = o.kvOps, extra = allowAlert && o.slackPosts.length > 0 ? 1 : 0;
  if (k.lists || k.deletes) bad.push(`${label}: list=${k.lists} delete=${k.deletes}`);
  if (k.puts.length > (label.startsWith("ok") ? 0 : 1 + extra)) bad.push(`${label}: ${k.puts.length} put (cho phép ${label.startsWith("ok") ? 0 : 1 + extra})`);
  if (k.puts.some((p) => !p.ttl)) bad.push(`${label}: có put không TTL`);
};
for (let i = 0; i < 20; i++) audit(chat({ kvFile: kv, now: T0 + ++t * 1000, gemini: "ok", env: WEBHOOK_ENV }), `ok#${i}`, false);
check(fails, bad.length === 0, `20 tin thành công (KV trống): 0 put/list/delete ngoài rl:* ${bad.join("; ")}`);
let b0 = bad.length;
for (let i = 0; i < 12; i++) audit(chat({ kvFile: kv, now: T0 + ++t * 1000, gemini: i % 2 ? 402 : 500, env: WEBHOOK_ENV }), `fail#${i}`, true);
check(fails, bad.length === b0, `12 tin lỗi (có kích cảnh báo): mỗi tin tối đa 1 put (+1 khi gửi cảnh báo), 0 list/delete, put có TTL ${bad.slice(b0).join("; ")}`);
b0 = bad.length;
for (let i = 0; i < 10; i++) audit(chat({ kvFile: kv, now: T0 + ++t * 1000, gemini: "ok", env: WEBHOOK_ENV }), `ok-after#${i}`, false);
check(fails, bad.length === b0, `10 tin thành công khi đang có lỗi và đã cảnh báo: vẫn 0 put/list/delete ${bad.slice(b0).join("; ")}`);
b0 = bad.length;
const kv2 = newKv();
for (let i = 0; i < 8; i++) audit(chat({ kvFile: kv2, now: T0 + 2 * 3600e3 + i * 1000, gemini: 500 }), `fail-nohook#${i}`, true);
check(fails, bad.length === b0, `không có webhook: tin lỗi vẫn tối đa 1 put, không ghi khoá chống lặp ${bad.slice(b0).join("; ")}`);
done(fails);
