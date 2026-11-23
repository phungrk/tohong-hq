// Nguồn: T-223 (spec products/T-223-loi-llm-co-nhan-khong-tru-luot.md, hành vi 3-4; rút bởi spec-critic khi spec qua Spec Gate v2).
// Vùng: planner/back/chat. Chờ merge PR T-223 (ADR-028; thăng vào bể planner/back/chat sau merge phungrk/tohong-back#77, ADR-146); Chief of Staff đưa vào eval/invariants/planner/back/chat/ sau merge.
// Bất biến: khi LLM lỗi (402/401/403/429/500/lỗi mạng, gọi thẳng hoặc qua relay), luồng SSE chat tới cặp đôi không chứa mã HTTP, tên/miền nhà cung cấp,
// khoá, URL hay bí mật relay, thân phản hồi lỗi của provider, và sự kiện `error` chỉ có `message` + `recoverable`.
// Phạm vi: chỉ luồng lỗi; sự kiện `conversation`/`intent` (lặp lại chữ của cặp đôi) không soi. `meta` của tin thành công nằm ngoài bất biến này.
// Offline: fetch giả, khoá giả, kho R2 giả. Repo back: TOHONG_BACK_REPO, rồi ../tohong-back cạnh gốc HQ. Thoát 0 = đạt, 1 = vi phạm.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let HQ = path.dirname(fileURLToPath(import.meta.url));
while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
const BACK = [process.env.TOHONG_BACK_REPO, path.join(HQ, "..", "tohong-back")].filter(Boolean).map((p) => path.resolve(p)).find((p) => fs.existsSync(path.join(p, "lib", "factory.js")));
if (!BACK) { console.log("FAIL không thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); process.exit(1); }
const imp = (rel) => import(pathToFileURL(path.join(BACK, rel)).href);

const KEY = "khoa-gia-inv003", BODY = "than-loi-gia-inv003", RELAY = "https://relay.invtest/api/proxy", SECRET = "bi-mat-relay-inv003";
let status = 500, net = false;
globalThis.fetch = async (input) => {
  const url = typeof input === "string" ? input : input?.url || String(input);
  if (!url.startsWith("https://generativelanguage.googleapis.com/") && url !== RELAY) throw new Error(`offline: fetch ngoài dự kiến ${url}`);
  if (net) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } });
  return new Response(JSON.stringify({ error: { code: status, message: BODY, status: "PAYMENT_REQUIRED" } }), { status, headers: { "Content-Type": "application/json" } });
};
const { MemoryBucket } = await imp("test/helpers/memoryBucket.js");
const worker = (await imp("worker.js")).default;

const COUPLE = "couple_20261001_cccccc", OWNER = "user_owner";
const BAD = [KEY, BODY, SECRET, "relay", "gemini", "google", "generativelanguage", "billing", "payment", "quota", "api key", "provider", "token", "http"];
const fails = [];
for (const viaRelay of [false, true]) {
  for (const c of [402, 401, 403, 429, 500, "mạng"]) {
    status = typeof c === "number" ? c : 500; net = c === "mạng";
    const bucket = new MemoryBucket();
    bucket.seedJson(`data/couples/${COUPLE}/members.json`, [{ user_id: OWNER, role: "owner" }]);
    bucket.seedText(`data/couples/${COUPLE}/profile.yaml`, "couple:\n  bride_name: Lan\n  groom_name: Minh\nfamilies: {}\npreferences: {}\n");
    const env = { CHAT_DATA: bucket, DEV_AUTH_BYPASS: "1", GEMINI_API_KEY: KEY, PROVIDER_ORDER: "gemini", PROVIDER_RETRIES: "0", NODE_ENV: "production", ...(viaRelay ? { LLM_RELAY_URL: RELAY, RELAY_SECRET: SECRET } : {}) };
    const res = await worker.fetch(new Request(`http://localhost/api/couples/${COUPLE}/chat`, { method: "POST", headers: { Authorization: `Bearer dev:${OWNER}`, "Content-Type": "application/json" }, body: JSON.stringify({ message: "xin chào" }) }), env, { waitUntil: () => {} });
    const raw = await res.text();
    const blocks = raw.split(/\n\n/).filter((b) => b.trim() && !/^event: (conversation|intent)$/m.test(b));
    const text = blocks.join("\n").toLowerCase();
    const leaked = BAD.filter((w) => text.includes(w.toLowerCase()));
    if (/(^|[^0-9a-z_])(4\d\d|5\d\d)([^0-9a-z_]|$)/.test(text)) leaked.push("mã HTTP");
    const errs = blocks.filter((b) => /^event: error$/m.test(b)).map((b) => { try { return JSON.parse(/^data: (.*)$/m.exec(b)[1]); } catch { return null; } });
    const shapeOk = errs.length === 1 && errs[0] && Object.keys(errs[0]).sort().join() === "message,recoverable";
    const name = `${viaRelay ? "qua relay" : "gọi thẳng"} ${c}`;
    const ok = leaked.length === 0 && shapeOk;
    console.log(`${ok ? "  ok " : "  XX "} ${name}: ${leaked.length ? "lộ " + leaked.join(", ") : "không lộ"}; error = ${JSON.stringify(errs.map((e) => e && Object.keys(e)))}`);
    if (!ok) fails.push(name);
  }
}
if (fails.length) { console.log("FAIL " + fails.join("; ")); process.exit(1); }
console.log("PASS");
