// TC6: Slack lỗi (500/429/404/ném lỗi) không đổi gì cặp đôi thấy: cùng dãy SSE, HTTP 200; chat tốt cũng vậy.
import { chat, newKv, check, done, T0, names } from "./lib.mjs";
const fails = [];
const baseFail = chat({ env: {} }), baseOk = chat({ env: {}, gemini: "ok" });
check(fails, /error$/.test(names(baseFail)) && /done$/.test(names(baseOk)), `đường chuẩn: lỗi kết thúc bằng error (${names(baseFail)}), tốt bằng done (${names(baseOk)})`);
for (const s of [500, 429, 404, "throw"]) {
  const kv = newKv(); let same = true, why = "";
  for (let i = 1; i <= 7; i++) { const o = chat({ kvFile: kv, now: T0 + i * 1000, slack: s }); if (o.status !== 200 || o.thrown || names(o) !== names(baseFail)) { same = false; why = `tin ${i}: ${o.status} ${o.thrown} ${names(o)}`; break; } }
  const g = chat({ kvFile: kv, now: T0 + 9000, gemini: "ok", slack: s });
  check(fails, same && g.status === 200 && names(g) === names(baseOk), `Slack ${s}: SSE chat lỗi và chat tốt giữ nguyên ${why}`);
}
done(fails);
