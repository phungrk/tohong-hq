// Nguồn: sự cố nghi ngờ 2026-11-23 (insights/2026-11-23-su-co-gemini-402.md): Gemini trả 402 PaymentRequired nhiều ngày từ 03/11 đến 22/11 mà không có tín hiệu nào phía sản phẩm.
// Bất biến (planner/back/chat): khi nhà cung cấp LLM trả 402/401/403 (lỗi thanh toán hoặc khoá), lớp provider phải gán nhãn riêng (khác 'unknown'/'server_error'/'timeout'), nhãn đó có trong sự kiện 'error' của orchestrator, và KHÔNG thử lại cùng provider (thử lại khoản đã bị từ chối chỉ nhân đôi số request).
// Hiện trạng: 402 rơi vào 'unknown' (providers/base.js _categorizeError) nên bị coi là tạm thời và thử lại -> bất biến này ĐỎ trên main cho tới khi có việc sửa.
// Offline: fetch bị thay bằng bản giả, khoá giả, không mạng, không gọi Gemini. Repo back: TOHONG_BACK_REPO, rồi ../tohong-back cạnh gốc HQ. Chạy: node <file>. Thoát 0 = đạt, 1 = vi phạm.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let HQ = path.dirname(fileURLToPath(import.meta.url));
while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
const BACK = [process.env.TOHONG_BACK_REPO, path.join(HQ, "..", "tohong-back")].filter(Boolean).map((p) => path.resolve(p)).find((p) => fs.existsSync(path.join(p, "lib", "factory.js")));
if (!BACK) { console.log("FAIL không thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); process.exit(1); }

const calls = [];
let status = 402;
globalThis.fetch = async (input) => {
  calls.push(typeof input === "string" ? input : input?.url || String(input));
  return new Response(JSON.stringify({ error: { code: status, message: "payment required (giả lập)" } }), { status, headers: { "Content-Type": "application/json" } });
};
const { createOrchestrator } = await import(pathToFileURL(path.join(BACK, "lib", "factory.js")).href);

const OK_LABELS = new Set(["billing", "payment", "quota", "auth"]);
const fails = [];
for (const st of [402, 401, 403]) {
  status = st; calls.length = 0;
  const { orchestrator } = createOrchestrator({ GEMINI_API_KEY: "khoa-gia", PROVIDER_ORDER: "gemini", PROVIDER_RETRIES: "1", NODE_ENV: "production" });
  const events = [];
  try { for await (const e of orchestrator.stream({ messages: [{ role: "user", content: "xin chào" }], systemPrompt: "x", maxTokens: 16 })) events.push(e); } catch { /* orchestrator ném sau khi phát sự kiện lỗi */ }
  const err = events.find((e) => e.type === "error");
  const cat = err?.errors?.[0]?.category ?? err?.category;
  const ok1 = !!err && OK_LABELS.has(cat);
  const ok2 = calls.length === 1;
  console.log(`${ok1 ? "  ok " : "  XX "} HTTP ${st}: sự kiện lỗi mang nhãn riêng (nhận ${cat})`);
  console.log(`${ok2 ? "  ok " : "  XX "} HTTP ${st}: gọi provider đúng 1 lần, không thử lại (nhận ${calls.length} lần)`);
  if (!ok1) fails.push(`HTTP ${st} nhãn=${cat}`);
  if (!ok2) fails.push(`HTTP ${st} số lần gọi=${calls.length}`);
}
if (fails.length) { console.log("FAIL " + fails.join("; ")); process.exit(1); }
console.log("PASS");
