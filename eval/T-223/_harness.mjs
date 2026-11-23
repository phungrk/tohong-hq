// Khung dùng chung cho eval tầng 1 của T-223 (không phải một eval; các c*.mjs import file này).
// Offline hoàn toàn: fetch toàn cục bị thay bằng bản giả, khoá giả, kho R2 giả trong bộ nhớ. Không mạng, không production.
// Repo back: TOHONG_BACK_REPO, rồi ../tohong-back cạnh gốc HQ. Gọi qua worker.fetch (đúng đường routing thật), không import hàm nội bộ cần sửa.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let HQ = path.dirname(fileURLToPath(import.meta.url));
while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
export const BACK = [process.env.TOHONG_BACK_REPO, path.join(HQ, "..", "tohong-back")].filter(Boolean).map((p) => path.resolve(p)).find((p) => fs.existsSync(path.join(p, "lib", "factory.js")));
if (!BACK) { console.log("FAIL không thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); process.exit(1); }
const imp = (rel) => import(pathToFileURL(path.join(BACK, rel)).href);

export const FAKE_KEY = "khoa-gia-t223";
export const BODY_MARK = "noi-dung-loi-gia-lap-t223";
export const COUPLE = "couple_20261001_aaaaaa";
export const OWNER = "user_owner";
export const MSG_BILLING = "Tơ Hồng chưa trả lời được lúc này, lỗi nằm ở phía chúng mình chứ không phải do bạn. Tin nhắn này không bị tính vào lượt dùng của bạn. Bạn vui lòng quay lại sau nhé.";
export const MSG_TRANSIENT = "Tơ Hồng đang gặp lỗi kết nối tạm thời. Vui lòng thử lại sau một chút.";
export const MSG_MIDSTREAM = "Kết nối AI bị gián đoạn. Bạn có thể thử lại để nhận phần trả lời đầy đủ.";
export const MSG_INVARIANT_BAD = ["402", "401", "403", "gemini", "google", "billing", "payment", "quota", "api key", "apikey", "provider", "http", "token", "relay", FAKE_KEY, BODY_MARK];

const ORIGINAL_FETCH = globalThis.fetch;
export const llmCalls = []; // mỗi phần tử: url đã gọi tới LLM giả
let llmBehaviour = () => ({ status: 500 });
export function setLlm(fn) { llmCalls.length = 0; llmBehaviour = fn; }

export const sse = (obj) => `data: ${JSON.stringify(obj)}\r\n\r\n`;
const enc = new TextEncoder();
export const okText = (text) => ({ status: 200, body: sse({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5 } }) });
export const httpErr = (status) => ({ status, body: JSON.stringify({ error: { code: status, message: BODY_MARK } }) });
export const netErr = () => ({ throws: Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } }) });
export const timeoutErr = () => ({ throws: Object.assign(new Error("The operation was aborted"), { name: "AbortError" }) });
// 200 rồi đứt: gửi `text` (có thể rỗng) rồi làm hỏng luồng
export const brokenStream = (text) => ({ pullStream: (() => { let n = 0; return (c) => { n++; if (n === 1 && text) { c.enqueue(enc.encode(sse({ candidates: [{ content: { parts: [{ text }] } }] }))); return; } c.error(new Error("connection reset")); }; })() });

globalThis.fetch = async (input) => {
  const url = typeof input === "string" ? input : input?.url || String(input);
  if (!url.startsWith("https://generativelanguage.googleapis.com/")) throw new Error(`eval offline: fetch ngoài dự kiến ${url}`);
  llmCalls.push(url);
  const r = llmBehaviour(llmCalls.length);
  if (r.throws) throw r.throws;
  if (r.pullStream) return new Response(new ReadableStream({ pull: r.pullStream }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
  return new Response(r.body ?? "", { status: r.status, headers: { "Content-Type": r.status === 200 ? "text/event-stream" : "application/json" } });
};

export const { MemoryBucket } = await imp("test/helpers/memoryBucket.js");
const worker = (await imp("worker.js")).default;
export const { createOrchestrator } = await imp("lib/factory.js");

export const subKey = `data/couples/${COUPLE}/subscription.json`;
export function makeWorld(sub, extra = {}) {
  const bucket = new MemoryBucket();
  bucket.seedJson(`data/couples/${COUPLE}/members.json`, [{ user_id: OWNER, role: "owner" }]);
  bucket.seedText(`data/couples/${COUPLE}/profile.yaml`, "couple:\n  bride_name: Lan Anh\n  groom_name: Minh Quan\nfamilies: {}\npreferences: {}\n");
  if (sub) bucket.seedJson(subKey, sub);
  const env = { CHAT_DATA: bucket, DEV_AUTH_BYPASS: "1", GEMINI_API_KEY: FAKE_KEY, PROVIDER_ORDER: "gemini", PROVIDER_RETRIES: "1", NODE_ENV: "production", ...extra };
  return { bucket, env };
}
export const trialDoc = (used, extra = {}) => ({ plan: null, status: "trial", trial_messages_used: used, trial_messages_total: 3, trial_extended: false, started_at: null, expires_at: null, ...extra });
export const paidDoc = (used) => ({ plan: "m1", status: "active", trial_messages_used: used, trial_messages_total: 3, trial_extended: false, started_at: new Date().toISOString(), expires_at: new Date(Date.now() + 20 * 864e5).toISOString(), activated_via: "admin" });
export const used = (bucket) => bucket.readJson(subKey)?.trial_messages_used;

function parseEvents(text) {
  const out = [];
  for (const block of text.split(/\n\n/)) {
    const ev = /^event: (.+)$/m.exec(block)?.[1];
    const data = /^data: (.*)$/m.exec(block)?.[1];
    if (!ev) continue;
    let json = null; try { json = JSON.parse(data); } catch { /* giữ null */ }
    out.push({ event: ev, data: json });
  }
  return out;
}

/** Gửi một tin nhắn chat; đọc luồng SSE từng đoạn. onEvent(ev) chạy NGAY khi sự kiện tới (để soi trạng thái kho lúc đó). */
export async function chat(env, message = "Cho mình hỏi về chụp ảnh cưới", onEvent) {
  const pending = [];
  const res = await worker.fetch(
    new Request(`http://localhost/api/couples/${COUPLE}/chat`, { method: "POST", headers: { Authorization: `Bearer dev:${OWNER}`, "Content-Type": "application/json" }, body: JSON.stringify({ message }) }),
    env, { waitUntil: (p) => pending.push(p) });
  let raw = "";
  if (res.body) {
    const reader = res.body.getReader(); const dec = new TextDecoder(); let seen = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += dec.decode(value, { stream: true });
      if (onEvent) { const evs = parseEvents(raw.slice(0, raw.lastIndexOf("\n\n") + 2)); for (; seen < evs.length; seen++) onEvent(evs[seen]); }
    }
  }
  await Promise.allSettled(pending);
  return { status: res.status, raw, events: parseEvents(raw) };
}

export function reporter() {
  const fails = [];
  return {
    check(ok, label, detail = "") { console.log(`${ok ? "  ok " : "  XX "} ${label}${ok ? "" : ` (${detail})`}`); if (!ok) fails.push(`${label}: ${detail}`); },
    done() { globalThis.fetch = ORIGINAL_FETCH; if (fails.length) { console.log(`FAIL ${fails.length} điều kiện: ${fails.join("; ")}`); process.exit(1); } console.log("PASS"); process.exit(0); },
  };
}
export const errEvent = (r) => r.events.find((e) => e.event === "error")?.data;
