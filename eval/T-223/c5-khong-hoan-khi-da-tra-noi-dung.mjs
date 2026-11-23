// T-223 tiêu chí 5: tin nhắn thành công trừ đúng 1 lượt; lỗi SAU KHI AI đã trả ít nhất một đoạn chữ không thử lại, không hoàn lượt (cặp đôi đã nhận một phần nội dung), thông điệp "gián đoạn" cũ giữ nguyên.
import * as h from "./_harness.mjs";
const r = h.reporter();
{ // thành công
  const { bucket, env } = h.makeWorld(h.trialDoc(1));
  h.setLlm(() => h.okText("Chào bạn"));
  const res = await h.chat(env);
  r.check(res.events.some((e) => e.event === "done") && !h.errEvent(res), "thành công: có done, không có error", res.events.map((e) => e.event).join(","));
  r.check(h.used(bucket) === 2 && h.llmCalls.length === 1, "thành công: lượt 1 -> 2, 1 lần gọi LLM", `used=${h.used(bucket)}, calls=${h.llmCalls.length}`);
}
{ // đứt giữa chừng
  const { bucket, env } = h.makeWorld(h.trialDoc(1));
  h.setLlm(() => h.brokenStream("Xin chào bạn, "));
  const res = await h.chat(env);
  const e = h.errEvent(res);
  r.check(res.events.some((x) => x.event === "chunk" && x.data?.text === "Xin chào bạn, "), "đứt giữa chừng: phần chữ đã gửi vẫn tới cặp đôi", res.events.map((x) => x.event).join(","));
  r.check(h.llmCalls.length === 1, "đứt giữa chừng: không thử lại (1 lần gọi)", `nhận ${h.llmCalls.length}`);
  r.check(e?.message === h.MSG_MIDSTREAM && e?.recoverable === true, "đứt giữa chừng: thông điệp gián đoạn cũ, recoverable = true", JSON.stringify(e));
  r.check(!res.events.some((x) => x.event === "done"), "đứt giữa chừng: không có done", "có done");
  r.check(h.used(bucket) === 2, "đứt giữa chừng: KHÔNG hoàn lượt (1 -> 2)", `nhận ${h.used(bucket)}`);
}
r.done();
