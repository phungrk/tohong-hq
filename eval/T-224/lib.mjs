// Thư viện dùng chung cho eval T-224. Chỉ hành vi quan sát được; không nhắc tới tên hàm/tệp cài đặt ngoài cổng vào chat có sẵn.
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

// Mốc thời gian giả; đặt giữa một khung 15 phút để các cụm tin cách nhau vài giây luôn nằm chung khung.
export const T0 = Date.parse("2026-12-01T03:05:00Z");
export const MIN = 60_000;
export const SENT = { text: "SENTINEL-NOIDUNG-gap-chi-Lan-0912345678", email: "lan.nguyen.sentinel@example.com", userId: "user_sentinel_ab12", coupleId: "couple_20261201_sentn1", key: "khoa-gia-gemini-0001" };
export const HOOK = "https://hooks.slack.test/services/T000/B000/XXXXFAKE";
export const PH_KEY = "phc_khoa_gia_eval";

let seq = 0;
export function newKv() { return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "t224-kv-")), "kv.json"); }

// Chạy một tin nhắn. o: {now, gemini:'ok'|<http>|'throw', slack, posthog, env, kv:'file'|'throw'|'none', kvFile, message}
export function chat(o = {}) {
  seq++;
  const id = String(seq).padStart(4, "0");
  const sc = {
    back: BACK, now: o.now ?? T0, gemini: o.gemini ?? 402, slack: o.slack, posthog: o.posthog, env: o.env || {},
    kv: o.kv || (o.kvFile ? "file" : "none"), kvFile: o.kvFile,
    message: o.message ?? SENT.text + " " + SENT.email,
    coupleId: o.coupleId ?? `couple_20261201_c${id}`, userId: o.userId ?? `user_u${id}`,
  };
  const r = spawnSync(process.execPath, [path.join(HERE, "chat_once.mjs")], { input: JSON.stringify(sc), encoding: "utf8", timeout: 60_000, maxBuffer: 32 << 20 });
  if (r.status !== 0) { console.log("FAIL tiến trình chat lỗi: " + (r.stderr || "").split("\n").slice(-4).join(" | ")); process.exit(1); }
  const out = JSON.parse(r.stdout);
  out.signals = signalsOf(out.logs);
  out.geminiCalls = out.fetches.filter((f) => new URL(f.url).hostname === "generativelanguage.googleapis.com").length;
  out.slackPosts = out.fetches.filter((f) => new URL(f.url).hostname.includes("slack"));
  out.phPosts = out.fetches.filter((f) => new URL(f.url).hostname.includes("posthog"));
  return out;
}

// Tín hiệu trong log: một lần console là một chuỗi JSON, hoặc một object thuần, có trường `event`.
export function signalsOf(logs) {
  const res = [];
  for (const l of logs) {
    const cands = l.args.length === 1 ? [l.args[0]] : [];
    for (const c of cands) {
      let o = c;
      if (typeof c === "string") { try { o = JSON.parse(c); } catch { o = null; } }
      if (o && typeof o === "object" && !Array.isArray(o) && typeof o.event === "string") res.push(o);
    }
  }
  return res;
}
export const sig = (out, name) => out.signals.filter((s) => s.event === name);

// Tin nhắn PostHog gửi đi: thân JSON có api_key và event (dạng capture hoặc batch).
export function phEvents(out) {
  const evs = [];
  for (const p of out.phPosts) {
    let b; try { b = JSON.parse(p.body); } catch { continue; }
    const list = Array.isArray(b.batch) ? b.batch.map((e) => ({ ...e, api_key: e.api_key ?? b.api_key })) : [b];
    for (const e of list) if (e && typeof e.event === "string") evs.push(e);
  }
  return evs;
}

export function leaks(out) {
  const hay = JSON.stringify({ logs: out.logs, nonGemini: out.fetches.filter((f) => new URL(f.url).hostname !== "generativelanguage.googleapis.com") });
  return ["SENTINEL-NOIDUNG", "0912345678", "lan.nguyen.sentinel", "chi-Lan", SENT.userId, SENT.coupleId, SENT.key].filter((s) => hay.includes(s));
}

export function check(fails, ok, msg) { console.log(`${ok ? "  ok " : "  XX "}${msg}`); if (!ok) fails.push(msg); }
export function done(fails) {
  if (fails.length) { console.log("FAIL " + fails.join("; ")); process.exit(1); }
  console.log("PASS");
}
export const WEBHOOK_ENV = { ADMIN_SLACK_WEBHOOK_URL: HOOK, ADMIN_APP_URL: "https://admin.test/?admin" };
