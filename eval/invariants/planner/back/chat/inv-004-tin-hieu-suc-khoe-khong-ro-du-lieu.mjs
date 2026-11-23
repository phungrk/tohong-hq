// Nguồn: T-224 (spec products/T-224-tin-hieu-suc-khoe-chat-llm.md, hành vi 8; rút bởi spec-critic khi spec qua Spec Gate v2, từ check_8).
// Vùng: planner/back/chat. Chờ merge PR T-224; Chief of Staff đưa thư mục này (cả lib/) vào eval/invariants/planner/back/chat/ sau merge.
// Bất biến: mọi thứ đường chat của cặp đôi đưa ra ngoài đường gọi LLM (console, PostHog, Slack, máy chủ khác) không chứa nội dung tin nhắn,
// tên/SĐT/email, userId, coupleId, khoá API hay bí mật relay, kể cả khi thân lỗi provider và lỗi mạng lặp lại chúng. Kiểm cả gọi thẳng
// lẫn qua relay (cấu hình production: LLM_RELAY_URL). Không chân không: phải thấy có tín hiệu log, PostHog và ít nhất một tin Slack.
// Offline (fetch giả, KV giả, khoá giả). Repo back: TOHONG_BACK_REPO, rồi ../tohong-back cạnh gốc HQ. Thoát 0 = đạt.
import { chat, newKv, check, done, T0, WEBHOOK_ENV, PH_KEY, RELAY_ENV, leaks, SENT } from "./lib/t224_harness.mjs";
const fails = [];
let nSig = 0, nSlack = 0, nPh = 0;
for (const [mode, extra] of [["thẳng", {}], ["relay", RELAY_ENV]]) {
  const env = { ...WEBHOOK_ENV, POSTHOG_KEY: PH_KEY, ...extra };
  const kv = newKv();
  const cases = [];
  for (let i = 0; i < 6; i++) cases.push({ gemini: i % 2 ? 402 : 500 });
  cases.push({ gemini: "throw" }, { gemini: 429 }, { gemini: "ok" });
  cases.push({ gemini: 402, message: "Tên con gái là Nguyễn Thị Lan, SĐT 0912345678, email lan.nguyen.sentinel@example.com, SENTINEL-NOIDUNG" });
  let i = 0;
  for (const c of cases) {
    const o = chat({ ...c, kvFile: kv, now: T0 + ++i * 1000, env, userId: SENT.userId, coupleId: SENT.coupleId });
    const l = leaks(o);
    nSig += o.signals.length; nSlack += o.slackPosts.length; nPh += o.phPosts.length;
    check(fails, l.length === 0, `${mode} tin #${i} (LLM=${c.gemini}): không rò [${l.join(", ")}]`);
  }
}
check(fails, nSig > 0 && nPh > 0 && nSlack >= 1, `có tín hiệu để kiểm (log=${nSig}, PostHog=${nPh}, Slack=${nSlack}); thiếu thì phép kiểm vô nghĩa`);
done(fails);
