// Khung chung cho eval đối kháng T-227 (không phải eval). Dùng lại lib T-224 (BACK, khoá giả, HOOK), chạy adv_chat_once.mjs bất đồng bộ để có thể xen kẽ tin.
import path from "node:path"; import { spawn } from "node:child_process"; import { fileURLToPath } from "node:url";
import { BACK, T0, MIN, SENT, HOOK, PH_KEY, WEBHOOK_ENV, newKv, signalsOf, check, done } from "../T-224/lib.mjs";
export { BACK, T0, MIN, SENT, HOOK, PH_KEY, WEBHOOK_ENV, newKv, check, done };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const RELAY = { LLM_RELAY_URL: "https://relay.test/api/proxy", RELAY_SECRET: "bi-mat-relay-gia-t227" };
let seq = 0;
export function chat(o = {}) {
  seq++; const id = String(seq).padStart(4, "0");
  const sc = { back: BACK, now: o.now ?? T0, gemini: o.gemini ?? 402, relay: o.relay, slack: o.slack, posthog: o.posthog, env: o.env || {},
    kv: o.kv || (o.kvFile ? "file" : "none"), kvFile: o.kvFile, kvDelayMs: o.kvDelayMs, waitMs: o.waitMs,
    message: o.message ?? SENT.text + " " + SENT.email, coupleId: o.coupleId ?? `couple_20261201_c${id}`, userId: o.userId ?? `user_u${id}` };
  return new Promise((ok, bad) => {
    const p = spawn(process.execPath, [path.join(HERE, "adv_chat_once.mjs")]); let so = "", se = "";
    p.stdout.on("data", (d) => (so += d)); p.stderr.on("data", (d) => (se += d));
    p.on("close", (c) => { if (c !== 0) return bad(new Error("tiến trình chat lỗi: " + se.split("\n").slice(-4).join(" | ")));
      const out = JSON.parse(so); out.signals = signalsOf(out.logs);
      const host = (f) => new URL(f.url).hostname;
      out.llmCalls = out.fetches.filter((f) => ["generativelanguage.googleapis.com", "relay.test"].includes(host(f))).length;
      out.slackPosts = out.fetches.filter((f) => host(f).includes("slack")); out.phPosts = out.fetches.filter((f) => host(f).includes("posthog"));
      ok(out); });
    p.stdin.end(JSON.stringify(sc));
  });
}
export const sig = (o, n) => o.signals.filter((s) => s.event === n);
export function leaks(out) {
  const hay = JSON.stringify({ logs: out.logs, out: out.fetches.filter((f) => !["generativelanguage.googleapis.com", "relay.test"].includes(new URL(f.url).hostname)) });
  return ["SENTINEL-NOIDUNG", "0912345678", "lan.nguyen.sentinel", "chi-Lan", SENT.key, RELAY.RELAY_SECRET, "relay.test", out.coupleId || "§"].filter((s) => hay.includes(s));
}
