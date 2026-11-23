// Khung dùng chung cho bất biến T-228 (planner/back/chat). Không phải bất biến; gate chỉ chạy file inv-* ở thư mục cha.
// Tự chứa: chỉ dùng t228_chat_once.mjs cạnh file này. Mỗi tin nhắn một tiến trình con (một "instance Worker"), fetch giả, KV giả (tệp), khoá giả.
// Gốc HQ dò ngược tới scripts/gate.py (không đếm cấp).
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
export const WEBHOOK_ENV = { ADMIN_SLACK_WEBHOOK_URL: "https://hooks.slack.test/services/T000/B000/XXXXFAKE", ADMIN_APP_URL: "https://admin.test/?admin" };
export function newKv() { return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "t228-inv-kv-")), "kv.json"); }

let seq = 0;
export function chat(o = {}) {
  seq++; const id = String(seq).padStart(4, "0");
  const sc = { back: BACK, now: o.now ?? T0, gemini: o.gemini ?? 500, slack: o.slack, env: o.env ?? WEBHOOK_ENV,
    kv: o.kvFile ? "file" : "none", kvFile: o.kvFile, waitMs: o.waitMs,
    message: "xin chao", coupleId: `couple_20261201_c${id}`, userId: `user_u${id}` };
  const r = spawnSync(process.execPath, [path.join(HERE, "t228_chat_once.mjs")], { input: JSON.stringify(sc), encoding: "utf8", timeout: 90_000, maxBuffer: 32 << 20 });
  if (r.status !== 0) { console.log("FAIL tiến trình chat lỗi: " + (r.stderr || "").split("\n").slice(-4).join(" | ")); process.exit(1); }
  const out = JSON.parse(r.stdout);
  out.slackPosts = out.fetches.filter((f) => new URL(f.url).hostname.includes("slack"));
  return out;
}
export function check(fails, ok, msg) { console.log(`${ok ? "  ok " : "  XX "}${msg}`); if (!ok) fails.push(msg); }
export function done(fails) {
  if (fails.length) { console.log("FAIL " + fails.join("; ")); process.exit(1); }
  console.log("PASS");
}
