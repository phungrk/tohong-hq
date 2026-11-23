// Nguồn: T-223 (spec products/T-223-loi-llm-co-nhan-khong-tru-luot.md, hành vi 6; rút bởi spec-critic khi spec qua Spec Gate v2).
// Vùng: planner/back/chat. Chờ merge PR T-223 (ADR-028); Chief of Staff đưa vào eval/invariants/planner/back/chat/ sau merge.
// Bất biến: cặp đôi dùng thử gửi một tin nhắn chat mà tin đó kết thúc bằng lỗi trước khi có nội dung nào của AI (402, 401, 5xx, lỗi mạng, 200 rồi đứt)
// thì trial_messages_used không tăng, và đã về đúng số cũ ngay lúc cặp đôi nhận sự kiện `error` (gửi lại ngay không bị cổng chặn).
// Offline: fetch giả, khoá giả, kho R2 giả. Repo back: TOHONG_BACK_REPO, rồi ../tohong-back cạnh gốc HQ. Thoát 0 = đạt, 1 = vi phạm.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let HQ = path.dirname(fileURLToPath(import.meta.url));
while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
const BACK = [process.env.TOHONG_BACK_REPO, path.join(HQ, "..", "tohong-back")].filter(Boolean).map((p) => path.resolve(p)).find((p) => fs.existsSync(path.join(p, "lib", "factory.js")));
if (!BACK) { console.log("FAIL không thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); process.exit(1); }
const imp = (rel) => import(pathToFileURL(path.join(BACK, rel)).href);

const enc = new TextEncoder();
let behaviour = () => ({ status: 500 });
globalThis.fetch = async (input) => {
  const url = typeof input === "string" ? input : input?.url || String(input);
  if (!url.startsWith("https://generativelanguage.googleapis.com/")) throw new Error(`offline: fetch ngoài dự kiến ${url}`);
  const r = behaviour();
  if (r.throws) throw r.throws;
  if (r.broken) return new Response(new ReadableStream({ pull: (c) => c.error(new Error("connection reset")) }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
  return new Response(JSON.stringify({ error: { code: r.status, message: "loi gia" } }), { status: r.status, headers: { "Content-Type": "application/json" } });
};
const { MemoryBucket } = await imp("test/helpers/memoryBucket.js");
const worker = (await imp("worker.js")).default;

const COUPLE = "couple_20261001_bbbbbb", OWNER = "user_owner";
const subKey = `data/couples/${COUPLE}/subscription.json`;
const CASES = [
  ["402", () => ({ status: 402 })], ["401", () => ({ status: 401 })], ["500", () => ({ status: 500 })],
  ["lỗi mạng", () => ({ throws: Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } }) })],
  ["200 rồi đứt trước chữ đầu", () => ({ broken: true })],
];
const fails = [];
for (const [name, mk] of CASES) {
  const bucket = new MemoryBucket();
  bucket.seedJson(`data/couples/${COUPLE}/members.json`, [{ user_id: OWNER, role: "owner" }]);
  bucket.seedText(`data/couples/${COUPLE}/profile.yaml`, "couple:\n  bride_name: Lan\n  groom_name: Minh\nfamilies: {}\npreferences: {}\n");
  bucket.seedJson(subKey, { plan: null, status: "trial", trial_messages_used: 1, trial_messages_total: 3, trial_extended: false, started_at: null, expires_at: null });
  const env = { CHAT_DATA: bucket, DEV_AUTH_BYPASS: "1", GEMINI_API_KEY: "khoa-gia", PROVIDER_ORDER: "gemini", PROVIDER_RETRIES: "1", NODE_ENV: "production" };
  behaviour = mk;
  const pending = [];
  const res = await worker.fetch(new Request(`http://localhost/api/couples/${COUPLE}/chat`, { method: "POST", headers: { Authorization: `Bearer dev:${OWNER}`, "Content-Type": "application/json" }, body: JSON.stringify({ message: "xin chào" }) }), env, { waitUntil: (p) => pending.push(p) });
  let raw = "", atError = null;
  const reader = res.body.getReader(); const dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += dec.decode(value, { stream: true });
    if (atError === null && /(^|\n)event: error\n/.test(raw)) atError = bucket.readJson(subKey)?.trial_messages_used;
  }
  await Promise.allSettled(pending);
  const after = bucket.readJson(subKey)?.trial_messages_used;
  const ok = atError === 1 && after === 1;
  console.log(`${ok ? "  ok " : "  XX "} ${name}: lượt lúc nhận error = ${atError}, sau cùng = ${after} (trước tin = 1)`);
  if (!ok) fails.push(`${name}: lúc error=${atError}, sau=${after}`);
}
if (fails.length) { console.log("FAIL " + fails.join("; ")); process.exit(1); }
console.log("PASS");
