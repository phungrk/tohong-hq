// Khung dùng chung cho bất biến T-224 (planner/back/chat). Không phải bất biến; gate chỉ chạy file inv-* ở thư mục cha.
// Tự chứa: chỉ dùng t224_chat_once.mjs cạnh file này. Mỗi tin nhắn một tiến trình con (một "instance Worker"), fetch giả, KV giả (tệp), khoá giả.
// Cổng vào duy nhất là route chat của cặp đôi có sẵn (api/coupleChat.js, handleCoupleChat). Gốc HQ dò ngược tới scripts/gate.py (không đếm cấp).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let HQ = HERE;
while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
export const BACK = [process.env.TOHONG_BACK_REPO, path.join(HQ, "..", "tohong-back")].filter(Boolean).map((p) => path.resolve(p)).find((p) => fs.existsSync(path.join(p, "api", "coupleChat.js")));
if (!BACK) { console.log("FAIL không thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); process.exit(1); }

export const T0 = Date.parse("2026-12-01T03:05:00Z");
export const MIN = 60_000;
export const SENT = { text: "SENTINEL-NOIDUNG-gap-chi-Lan-0912345678", email: "lan.nguyen.sentinel@example.com", userId: "user_sentinel_ab12", coupleId: "couple_20261201_sentn1", key: "khoa-gia-gemini-0001", relaySecret: "bi-mat-relay-gia-sentinel" };
export const HOOK = "https://hooks.slack.test/services/T000/B000/XXXXFAKE";
export const PH_KEY = "phc_khoa_gia_bat_bien";
export const RELAY_URL = "https://relay.test/api/proxy";
export const WEBHOOK_ENV = { ADMIN_SLACK_WEBHOOK_URL: HOOK, ADMIN_APP_URL: "https://admin.test/?admin" };
export const RELAY_ENV = { LLM_RELAY_URL: RELAY_URL, RELAY_SECRET: SENT.relaySecret };
const LLM_HOSTS = ["generativelanguage.googleapis.com", new URL(RELAY_URL).hostname];

let seq = 0;
export function newKv() { return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "t224-inv-kv-")), "kv.json"); }

export function chat(o = {}) {
  seq++;
  const id = String(seq).padStart(4, "0");
  const sc = {
    back: BACK, now: o.now ?? T0, gemini: o.gemini ?? 402, slack: o.slack, posthog: o.posthog, env: o.env || {},
    kv: o.kv || (o.kvFile ? "file" : "none"), kvFile: o.kvFile,
    message: o.message ?? SENT.text + " " + SENT.email,
    coupleId: o.coupleId ?? `couple_20261201_c${id}`, userId: o.userId ?? `user_u${id}`,
  };
  const r = spawnSync(process.execPath, [path.join(HERE, "t224_chat_once.mjs")], { input: JSON.stringify(sc), encoding: "utf8", timeout: 60_000, maxBuffer: 32 << 20 });
  if (r.status !== 0) { console.log("FAIL tiến trình chat lỗi: " + (r.stderr || "").split("\n").slice(-4).join(" | ")); process.exit(1); }
  const out = JSON.parse(r.stdout);
  out.signals = [];
  for (const l of out.logs) {
    if (l.args.length !== 1) continue;
    let x = l.args[0];
    if (typeof x === "string") { try { x = JSON.parse(x); } catch { x = null; } }
    if (x && typeof x === "object" && !Array.isArray(x) && typeof x.event === "string") out.signals.push(x);
  }
  out.slackPosts = out.fetches.filter((f) => new URL(f.url).hostname.includes("slack"));
  out.phPosts = out.fetches.filter((f) => new URL(f.url).hostname.includes("posthog"));
  return out;
}

// Mọi thứ đi ra khỏi đường gọi LLM: log + mọi request không tới Gemini/relay (Slack, PostHog, máy chủ lạ).
export function leaks(out) {
  const hay = JSON.stringify({ logs: out.logs, nonLlm: out.fetches.filter((f) => !LLM_HOSTS.includes(new URL(f.url).hostname)) });
  return ["SENTINEL-NOIDUNG", "0912345678", "lan.nguyen.sentinel", "chi-Lan", "Nguyễn Thị Lan", SENT.userId, SENT.coupleId, SENT.key, SENT.relaySecret].filter((s) => hay.includes(s));
}

export const names = (o) => o.sse.map((e) => e.event).join(",");
export function check(fails, ok, msg) { console.log(`${ok ? "  ok " : "  XX "}${msg}`); if (!ok) fails.push(msg); }
export function done(fails) {
  if (fails.length) { console.log("FAIL " + fails.join("; ")); process.exit(1); }
  console.log("PASS");
}
