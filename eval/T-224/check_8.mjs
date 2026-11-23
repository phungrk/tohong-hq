// TC8: không rò nội dung chat, dữ liệu cá nhân, id cặp đôi/người dùng, hay khoá API ra mọi kênh tín hiệu (log, PostHog, Slack) — kể cả khi thông điệp lỗi của provider/fetch lặp lại chúng.
import { chat, newKv, check, done, T0, WEBHOOK_ENV, PH_KEY, leaks, SENT } from "./lib.mjs";
const fails = [];
const env = { ...WEBHOOK_ENV, POSTHOG_KEY: PH_KEY };
let nSig = 0, nSlack = 0, nPh = 0;
const kv = newKv();
const cases = [];
for (let i = 0; i < 6; i++) cases.push({ gemini: 402 });       // thân lỗi lặp lại nội dung chat
cases.push({ gemini: "throw" });                                  // lỗi fetch có chứa URL kèm khoá API
cases.push({ gemini: 500 }, { gemini: "ok" });
cases.push({ gemini: 402, message: "Tên con gái là Nguyễn Thị Lan, SĐT 0912345678, email lan.nguyen.sentinel@example.com, SENTINEL-NOIDUNG" });
let i = 0;
for (const c of cases) {
  const o = chat({ ...c, kvFile: kv, now: T0 + ++i * 1000, env, userId: SENT.userId, coupleId: SENT.coupleId.replace(/n1$/, "n" + (i % 10)) + "" });
  const l = leaks(o);
  nSig += o.signals.length; nSlack += o.slackPosts.length; nPh += o.phPosts.length;
  check(fails, l.length === 0, `tin #${i} (Gemini=${c.gemini}): không rò [${l.join(", ")}]`);
}
check(fails, nSig > 0 && nPh > 0, `có tín hiệu để kiểm (log=${nSig}, PostHog=${nPh}); không có thì phép kiểm vô nghĩa`);
check(fails, nSlack >= 1, `có ít nhất một cảnh báo Slack được kiểm (${nSlack})`);
done(fails);
