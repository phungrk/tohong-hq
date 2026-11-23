// T-223 tiêu chí 11: nhãn tính theo mã HTTP mà Worker nhận được, kể cả khi mọi cú gọi LLM đi qua LLM_RELAY_URL (như production): relay chuyển 402 -> billing, không thử lại, hoàn lượt, đúng thông điệp; relay tự trả 403 (sai bí mật) -> auth; relay tự trả 502 -> lỗi tạm thời, thử lại; thành công qua relay trừ 1 lượt. Không lộ URL/bí mật relay.
import * as h from "./_harness.mjs";
const r = h.reporter();
const X = { LLM_RELAY_URL: h.RELAY_URL, RELAY_SECRET: h.RELAY_SECRET };
for (const [name, mk, msg, rec, calls, used] of [
  ["relay chuyển 402", () => h.httpErr(402), h.MSG_BILLING, false, 1, 1],
  ["relay trả 403 sai bí mật", () => h.httpErr(403), h.MSG_BILLING, false, 1, 1],
  ["relay trả 502", () => h.httpErr(502), h.MSG_TRANSIENT, true, 2, 1],
  ["relay thành công", () => h.okText("Chào bạn"), null, null, 1, 2],
]) {
  const { bucket, env } = h.makeWorld(h.trialDoc(1), X);
  h.setLlm(mk);
  const res = await h.chat(env);
  const e = h.errEvent(res);
  r.check(h.llmCalls.length === calls && h.llmCalls.every((u) => u === h.RELAY_URL), `${name}: ${calls} lần gọi, tất cả tới URL relay`, JSON.stringify(h.llmCalls));
  if (msg) r.check(e?.message === msg && e?.recoverable === rec, `${name}: thông điệp và recoverable đúng`, JSON.stringify(e));
  else r.check(!e && res.events.some((x) => x.event === "done"), `${name}: có done, không có error`, res.events.map((x) => x.event).join(","));
  r.check(h.used(bucket) === used, `${name}: lượt dùng = ${used}`, `nhận ${h.used(bucket)}`);
  const low = res.raw.toLowerCase();
  r.check(!low.includes("relay.test") && !low.includes(h.RELAY_SECRET), `${name}: không lộ URL/bí mật relay`, "lộ");
}
r.done();
