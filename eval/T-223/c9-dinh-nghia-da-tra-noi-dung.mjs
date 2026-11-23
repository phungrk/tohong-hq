// T-223 tiêu chí 9: "đã trả nội dung" = có ít nhất một ký tự không phải khoảng trắng của AI tới cặp đôi, HOẶC ít nhất một hành động (action) của AI đã chạy. Chunk chỉ có khoảng trắng rồi đứt = chưa có nội dung: hoàn lượt. Chỉ có khối action rồi đứt = đã có nội dung: không hoàn. Cả hai ca không thử lại và dùng thông điệp gián đoạn mới (không hứa "phần trả lời đầy đủ").
import * as h from "./_harness.mjs";
const r = h.reporter();
const ACTION = '<<<ACTION_START>>>\n{"type":"add_checklist_task","text":"Đặt thợ chụp ảnh"}\n<<<ACTION_END>>>';
async function run(name, text, expectUsed, expectAction) {
  const { bucket, env } = h.makeWorld(h.trialDoc(1));
  bucket.beforePut = async (k) => { if (k === h.subKey) await new Promise((ok) => setTimeout(ok, 30)); };
  h.setLlm(() => h.brokenStream(text));
  let atError = null;
  const res = await h.chat(env, undefined, (ev) => { if (ev.event === "error" && atError === null) atError = h.used(bucket); });
  const e = h.errEvent(res);
  r.check(h.llmCalls.length === 1, `${name}: không thử lại (1 lần gọi)`, `nhận ${h.llmCalls.length}`);
  r.check(e?.message === h.MSG_MIDSTREAM && e?.recoverable === true, `${name}: thông điệp gián đoạn mới, recoverable = true`, JSON.stringify(e));
  r.check(!/đầy đủ/.test(e?.message || ""), `${name}: không hứa "đầy đủ"`, e?.message);
  r.check(res.events.some((x) => x.event === "action") === expectAction, `${name}: ${expectAction ? "có" : "không có"} sự kiện action`, res.events.map((x) => x.event).join(","));
  r.check(h.used(bucket) === expectUsed, `${name}: lượt dùng = ${expectUsed}`, `nhận ${h.used(bucket)}`);
  r.check(atError === expectUsed, `${name}: lúc nhận error lượt dùng đã = ${expectUsed}`, `nhận ${atError}`);
}
await run("chỉ khoảng trắng rồi đứt", "  \n", 1, false);
await run("chỉ khối action rồi đứt", ACTION, 2, true);
await run("có chữ rồi đứt", "Xin chào bạn", 2, false);
r.done();
