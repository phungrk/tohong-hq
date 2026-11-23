// Bản tự chứa cho bất biến T-228 (chép từ eval/T-228/chat_once.mjs).
// Tiến trình con của eval T-228 (bản sửa của eval/T-224/chat_once.mjs: hang tôn trọng AbortSignal và ghi thời điểm abort; sc.waitMs chờ việc nền lâu hơn)
// Tiến trình con của eval T-224: chạy ĐÚNG MỘT tin nhắn chat qua handleCoupleChat của tohong-back, offline.
// Đọc kịch bản JSON từ stdin, in kết quả JSON ra stdout. Mỗi tin nhắn một tiến trình = một "instance Worker" riêng
// (không chia sẻ bộ nhớ); trạng thái chung chỉ có thể đi qua KV giả (tệp) mà kịch bản cấp.
// Mọi fetch là giả: không mạng, không gọi Gemini/Slack/PostHog thật. Khoá, URL webhook đều là giá trị giả.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sc = JSON.parse(fs.readFileSync(0, "utf8"));
const realNow = Date.now.bind(Date);
Date.now = () => sc.now;

const logs = [];
for (const lv of ["log", "info", "warn", "error", "debug"]) {
  console[lv] = (...args) => logs.push({ level: lv, args: args.map((a) => { try { return typeof a === "string" ? a : JSON.parse(JSON.stringify(a)); } catch { return String(a); } }) });
}

const fetches = [];
const sseOk = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "Chào anh chị." }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 } })}\n\n`;
const aborts = [];
const hang = (signal) => new Promise((res, rej) => {
  const t0h = performance.now();
  const timer = setTimeout(() => res(new Response("{}", { status: 200 })), 30_000);
  const onAbort = () => { clearTimeout(timer); aborts.push(Math.round(performance.now() - t0h)); rej(Object.assign(new Error("aborted"), { name: "AbortError" })); };
  if (signal?.aborted) return onAbort();
  signal?.addEventListener?.("abort", onAbort, { once: true });
});
async function respond(spec, okBody, signal) {
  if (spec === "hang") return hang(signal);
  if (spec === "throw") throw new TypeError("network down (giả lập)");
  if (typeof spec === "number") return new Response(spec === 204 || spec === 205 || spec === 304 ? null : (okBody?.err ?? "{}"), { status: spec });
  return new Response(okBody?.ok ?? "{}", { status: 200 });
}
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input?.url || String(input);
  let body = init?.body;
  if (body && typeof body !== "string") body = String(body);
  fetches.push({ url, method: init?.method || "GET", body: body || null });
  const u = new URL(url);
  if (u.hostname === "generativelanguage.googleapis.com") {
    const g = sc.gemini;
    if (g === "throw") throw new TypeError(`fetch failed: ${url}`); // cố ý chứa URL có khoá, để bắt rò khoá
    // Thân lỗi cố ý lặp lại nội dung người dùng, để bắt rò nội dung qua thông điệp lỗi của provider.
    return await respond(g, { ok: sseOk, err: JSON.stringify({ error: { message: `payment required; echo: ${sc.message}` } }) });
  }
  if (u.hostname.includes("slack")) return await respond(sc.slack ?? "ok", undefined, init?.signal);
  if (u.hostname.includes("posthog")) return await respond(sc.posthog ?? "ok", undefined, init?.signal);
  return await respond("ok");
};

// mode "throw": mọi thao tác ngoài khoá giới hạn tốc độ có sẵn ("rl:...") đều ném lỗi, để cô lập trạng thái sức khoẻ mới khỏi luồng cũ.
const kvOps = { gets: 0, puts: [], deletes: 0, lists: 0 }; // chỉ đếm thao tác NGOÀI khoá giới hạn tốc độ có sẵn "rl:"
const slow = () => new Promise((r) => setTimeout(r, 30_000));
function makeKv(file, mode) {
  const load = () => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {});
  const save = (d) => fs.writeFileSync(file, JSON.stringify(d));
  const live = (d, k) => { const e = d[k]; if (!e) return null; if (e.exp != null && e.exp <= sc.now / 1000) { delete d[k]; return null; } return e; };
  const isRl = (k) => String(k).startsWith("rl:");
  const guard = async (k) => { if (mode === "slow" && !isRl(k)) await slow();
    if (mode === "throw" && !String(k).startsWith("rl:")) throw new Error("KV hỏng (giả lập)"); };
  return {
    async get(k, opt) { await guard(k); if (!isRl(k)) kvOps.gets++; const d = load(); const e = live(d, k); if (!e) return null; const t = typeof opt === "string" ? opt : opt?.type; return t === "json" ? JSON.parse(e.v) : e.v; },
    async put(k, v, opt = {}) { await guard(k); if (!isRl(k)) kvOps.puts.push({ key: k, ttl: opt.expirationTtl ?? (opt.expiration ? 1 : null) }); const d = load(); d[k] = { v: String(v), exp: opt.expirationTtl ? sc.now / 1000 + opt.expirationTtl : opt.expiration ?? null }; save(d); },
    async delete(k) { await guard(k); if (!isRl(k)) kvOps.deletes++; const d = load(); delete d[k]; save(d); },
    async list({ prefix = "" } = {}) { if (!isRl(prefix)) kvOps.lists++; if (mode === "throw") throw new Error("KV hỏng (giả lập)"); if (mode === "slow" && !isRl(prefix)) await slow(); const d = load(); return { keys: Object.keys(d).filter((k) => k.startsWith(prefix) && live(d, k)).map((name) => ({ name })), list_complete: true }; },
  };
}

class Bucket { // R2 giả tối thiểu: get/put/head/list/delete
  constructor() { this.data = new Map(); }
  async get(k) { if (!this.data.has(k)) return null; const v = this.data.get(k); return { text: async () => v, json: async () => JSON.parse(v), etag: "e" + v.length, httpEtag: '"e"' }; }
  async head(k) { return this.data.has(k) ? { etag: "e" + this.data.get(k).length } : null; }
  async put(k, v, o) { if (o?.onlyIf?.uploadedBefore && this.data.has(k)) return null; this.data.set(k, typeof v === "string" ? v : JSON.stringify(v)); return { etag: "e" }; }
  async delete(k) { this.data.delete(k); }
  async list({ prefix = "" } = {}) { return { objects: [...this.data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; }
}

const BACK = sc.back;
const { MemoryBucket } = await import(pathToFileURL(path.join(BACK, "test", "helpers", "memoryBucket.js")).href).catch(() => ({ MemoryBucket: Bucket }));
const bucket = new MemoryBucket();
bucket.data.set(`data/couples/${sc.coupleId}/members.json`, JSON.stringify([{ user_id: sc.userId, role: "owner" }]));
const env = {
  CHAT_DATA: bucket,
  GEMINI_API_KEY: "khoa-gia-gemini-0001",
  PROVIDER_ORDER: "gemini",
  PROVIDER_RETRIES: "1",
  NODE_ENV: "production",
  ...sc.env,
};
if (sc.kv !== "none") env.RATE_LIMIT = makeKv(sc.kvFile, sc.kv);

const pending = [];
const ctx = { waitUntil: (p) => { pending.push(Promise.resolve(p).catch(() => {})); } };
const { handleCoupleChat } = await import(pathToFileURL(path.join(BACK, "api", "coupleChat.js")).href);

let status = null, text = "", thrown = null, eventMs = null, closeMs = null;
const t0 = performance.now();
try {
  const req = new Request(`http://localhost/api/couples/${sc.coupleId}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: sc.message }) });
  const res = await handleCoupleChat(req, env, { userId: sc.userId }, sc.coupleId, ctx);
  status = res.status;
  const rd = res.body.getReader(), dec = new TextDecoder();
  for (;;) { const { done, value } = await rd.read(); if (done) break; const c = dec.decode(value, { stream: true }); text += c; if (/event: (done|error)/.test(c)) eventMs = performance.now() - t0; }
  closeMs = performance.now() - t0;
} catch (e) { thrown = String(e?.message || e); }
await Promise.race([Promise.all(pending), new Promise((r) => setTimeout(r, sc.waitMs ?? 2500))]);
await new Promise((r) => setTimeout(r, 60));

const sse = [];
for (const block of text.split(/\n\n/)) {
  const ev = /^event: (.*)$/m.exec(block)?.[1]; const data = /^data: (.*)$/m.exec(block)?.[1];
  if (ev) sse.push({ event: ev, data });
}
process.stdout.write(JSON.stringify({ status, thrown, sse, logs, fetches, kvOps, eventMs, closeMs, aborts }));
void realNow;
process.exit(0);
