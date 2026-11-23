// Khung chung cho eval T-228. Chỉ hành vi quan sát được. Mỗi tin nhắn một tiến trình con (một "instance"), chung KV tệp giả; fetch giả, không mạng.
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { BACK, T0, MIN, SENT, HOOK, PH_KEY, WEBHOOK_ENV, newKv, signalsOf, check, done } from "../T-224/lib.mjs";
export { BACK, T0, MIN, SENT, HOOK, PH_KEY, WEBHOOK_ENV, newKv, check, done };
const HERE = path.dirname(fileURLToPath(import.meta.url));
let seq = 0;
export function chat(o = {}) {
  seq++; const id = String(seq).padStart(4, "0");
  const sc = { back: BACK, now: o.now ?? T0, gemini: o.gemini ?? 500, slack: o.slack, posthog: o.posthog, env: o.env ?? WEBHOOK_ENV,
    kv: o.kv || (o.kvFile ? "file" : "none"), kvFile: o.kvFile, waitMs: o.waitMs,
    message: o.message ?? SENT.text, coupleId: `couple_20261201_c${id}`, userId: `user_u${id}` };
  const r = spawnSync(process.execPath, [path.join(HERE, "chat_once.mjs")], { input: JSON.stringify(sc), encoding: "utf8", timeout: 90_000, maxBuffer: 32 << 20 });
  if (r.status !== 0) { console.log("FAIL tiến trình chat lỗi: " + (r.stderr || "").split("\n").slice(-4).join(" | ")); process.exit(1); }
  const out = JSON.parse(r.stdout); out.signals = signalsOf(out.logs);
  out.slackPosts = out.fetches.filter((f) => new URL(f.url).hostname.includes("slack"));
  out.puts = out.kvOps.puts.length;
  return out;
}
export const names = (o) => o.sse.map((e) => e.event).join(",");
