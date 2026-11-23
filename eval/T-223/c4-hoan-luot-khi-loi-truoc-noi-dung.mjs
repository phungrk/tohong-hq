// T-223 tiêu chí 4: cặp đôi dùng thử nhận lỗi mà chưa có chữ nào của AI -> lượt dùng thử về đúng số trước tin nhắn, kịp trước khi cặp đôi nhận sự kiện error (bấm gửi lại ngay không bị chặn). Áp cho mọi loại lỗi.
import * as h from "./_harness.mjs";
const r = h.reporter();
const CASES = [
  ["402", () => h.httpErr(402)], ["401", () => h.httpErr(401)], ["403", () => h.httpErr(403)],
  ["429 hết lần thử", () => h.httpErr(429)], ["500", () => h.httpErr(500)], ["400", () => h.httpErr(400)],
  ["lỗi mạng", () => h.netErr()], ["timeout", () => h.timeoutErr()],
  ["200 rồi đứt trước chữ đầu tiên", () => h.brokenStream("")],
];
async function once(name, mk, extra = {}, start = 1) {
  const { bucket, env } = h.makeWorld(h.trialDoc(start), extra);
  bucket.beforePut = async (k) => { if (k === h.subKey) await new Promise((ok) => setTimeout(ok, 30)); }; // ghi chậm: hoàn lượt sau khi gửi error sẽ bị lộ
  h.setLlm(mk);
  let atError = null;
  const res = await h.chat(env, undefined, (ev) => { if (ev.event === "error" && atError === null) atError = h.used(bucket); });
  r.check(!!h.errEvent(res), `${name}: có sự kiện error`, "không có");
  r.check(atError === start, `${name}: lúc cặp đôi nhận error, lượt dùng = ${start}`, `nhận ${atError}`);
  r.check(h.used(bucket) === start, `${name}: sau cùng lượt dùng = ${start}`, `nhận ${h.used(bucket)}`);
}
for (const [name, mk] of CASES) await once(name, mk);
await once("402 khi DEBUG_MATCHING=true", () => h.httpErr(402), { DEBUG_MATCHING: "true" });
await once("402 ở tin nhắn cuối của dùng thử", () => h.httpErr(402), {}, 2);
// Gửi lại sau lỗi phải qua được cổng, rồi tin nhắn thành công mới trừ lượt.
{
  const { bucket, env } = h.makeWorld(h.trialDoc(2));
  h.setLlm(() => h.httpErr(402));
  await h.chat(env);
  h.setLlm(() => h.okText("Chào bạn"));
  const res = await h.chat(env);
  r.check(res.status === 200 && res.events.some((e) => e.event === "done"), "gửi lại ngay sau lỗi: được trả lời (không bị cổng chặn)", `status=${res.status}, ${res.events.map((e) => e.event).join(",")}`);
  r.check(h.used(bucket) === 3, "tin nhắn thành công mới trừ lượt: 2 -> 3", `nhận ${h.used(bucket)}`);
}
r.done();
