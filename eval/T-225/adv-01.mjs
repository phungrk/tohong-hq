// T-225 đối kháng (adversary): biên mà c1..c11 chưa chạm. Offline, dùng khung eval/T-223/_harness.mjs.
// 1) subscription.json chưa tồn tại + 402 -> lượt về 0, đúng thông điệp.
// 2) Hoàn lượt gặp 412 mãi (quá số lần thử) -> vẫn đúng 1 error, đúng thông điệp, không treo, không lộ.
// 3) 402 có thân lạ (không phải JSON, chứa tên provider/khoá/URL) -> không lộ, billing, 1 lần gọi.
// 4) Provider khác (claude/gpt/grok) qua relay trả 402 -> billing: 1 lần gọi, thông điệp billing, recoverable:false, hoàn lượt.
// 5) Action ném lỗi (không gửi sự kiện action) rồi luồng đứt -> chưa có nội dung -> hoàn lượt.
// 6) Lỗi 400 trước nội dung -> hoàn lượt, 1 lần gọi, không lộ.
// 7) Hai tab cùng lúc ở 2/3, cả hai 402 -> sau cùng 2/3.
import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
const HQ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const h = await import(pathToFileURL(path.join(HQ, "eval/T-223/_harness.mjs")).href);
const r = h.reporter();
const leak = (raw) => h.MSG_INVARIANT_BAD.filter((w) => raw.toLowerCase().includes(w.toLowerCase()));

{ const { bucket, env } = h.makeWorld(null); h.setLlm(() => h.httpErr(402));
  const res = await h.chat(env); const e = h.errEvent(res);
  r.check(h.used(bucket) === 0, "1 chưa có subscription.json, 402: lượt = 0", `nhận ${h.used(bucket)}`);
  r.check(e?.message === h.MSG_BILLING && e?.recoverable === false, "1 thông điệp billing", JSON.stringify(e)); }

{ const { bucket, env } = h.makeWorld(h.trialDoc(1)); let w = 0;
  bucket.beforePut = async (k) => { if (k === h.subKey && ++w >= 2) throw Object.assign(new Error("kho lỗi giả 412"), { status: 412 }); };
  h.setLlm(() => h.httpErr(402)); const res = await h.chat(env); const errs = res.events.filter((x) => x.event === "error");
  r.check(errs.length === 1 && errs[0].data?.message === h.MSG_BILLING, "2 412 mãi: đúng 1 error billing", JSON.stringify(errs));
  r.check(leak(res.raw).length === 0, "2 412 mãi: không lộ", leak(res.raw).join(",")); }

{ const { bucket, env } = h.makeWorld(h.trialDoc(1));
  h.setLlm(() => ({ status: 402, body: `<html>gemini billing ${h.FAKE_KEY} https://generativelanguage.googleapis.com ${h.BODY_MARK}</html>` }));
  const res = await h.chat(env); const e = h.errEvent(res);
  r.check(h.llmCalls.length === 1 && e?.message === h.MSG_BILLING && h.used(bucket) === 1, "3 402 thân HTML: 1 gọi, billing, hoàn", `${h.llmCalls.length} ${JSON.stringify(e)} ${h.used(bucket)}`);
  r.check(leak(res.raw).length === 0 && !res.raw.includes("googleapis"), "3 không lộ thân", leak(res.raw).join(",")); }

for (const [p, key] of [["claude", "CLAUDE_API_KEY"], ["gpt", "OPENAI_API_KEY"], ["grok", "GROK_API_KEY"]]) {
  const { bucket, env } = h.makeWorld(h.trialDoc(1), { PROVIDER_ORDER: p, [key]: h.FAKE_KEY, LLM_RELAY_URL: h.RELAY_URL, RELAY_SECRET: h.RELAY_SECRET });
  h.setLlm(() => h.httpErr(402)); const res = await h.chat(env); const e = h.errEvent(res);
  r.check(h.llmCalls.length === 1, `4 ${p} 402: 1 lần gọi`, `nhận ${h.llmCalls.length}`);
  r.check(e?.message === h.MSG_BILLING && e?.recoverable === false, `4 ${p} 402: thông điệp billing`, JSON.stringify(e));
  r.check(h.used(bucket) === 1, `4 ${p} 402: hoàn lượt`, `nhận ${h.used(bucket)}`);
  r.check(!res.raw.toLowerCase().includes(p) || p === "gpt" && !/\bgpt\b/i.test(res.raw), `4 ${p}: không lộ tên`, "lộ"); }

{ const { bucket, env } = h.makeWorld(h.trialDoc(1));
  bucket.beforePut = async (k) => { if (!k.endsWith("subscription.json") && /checklist|timeline|task/i.test(k)) throw new Error("kho lỗi giả action"); };
  h.setLlm(() => h.brokenStream('<<<ACTION_START>>>\n{"type":"add_checklist_task","text":"Đặt thợ chụp ảnh"}\n<<<ACTION_END>>>'));
  const res = await h.chat(env);
  if (res.events.some((x) => x.event === "action")) console.log("  -- 5 bỏ qua: action không ném lỗi được trong khung này");
  else r.check(h.used(bucket) === 1, "5 action ném lỗi rồi đứt: hoàn lượt", `nhận ${h.used(bucket)}`); }

{ const { bucket, env } = h.makeWorld(h.trialDoc(1)); h.setLlm(() => h.httpErr(400));
  const res = await h.chat(env); const e = h.errEvent(res);
  r.check(h.llmCalls.length === 1 && h.used(bucket) === 1 && leak(res.raw).length === 0, "6 400: 1 gọi, hoàn, không lộ", `${h.llmCalls.length} ${h.used(bucket)} ${JSON.stringify(e)}`); }

{ const { bucket, env } = h.makeWorld(h.trialDoc(2));
  bucket.beforePut = async (k) => { if (k === h.subKey) await new Promise((ok) => setTimeout(ok, 20)); };
  h.setLlm(() => h.httpErr(402)); const [a, b] = await Promise.all([h.chat(env), h.chat(env)]);
  r.check(h.used(bucket) === 2, "7 hai tab 2/3 cùng 402: sau cùng 2", `nhận ${h.used(bucket)} (${a.status},${b.status})`); }
r.done();
