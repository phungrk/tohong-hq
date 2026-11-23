// T-223 tiêu chí 6: hoàn lượt không đụng người dùng trả phí hay cổng hết lượt. Gói đang hiệu lực: lỗi hay thành công đều không đổi bộ đếm (kể cả bộ đếm cũ còn >0) và không đổi gói. Hết lượt dùng thử: HTTP 402 subscription_required, 0 lần gọi LLM, bộ đếm giữ nguyên.
import * as h from "./_harness.mjs";
const r = h.reporter();
for (const [name, mk] of [["402", () => h.httpErr(402)], ["lỗi mạng", () => h.netErr()], ["thành công", () => h.okText("Chào bạn")]]) {
  const { bucket, env } = h.makeWorld(h.paidDoc(2));
  const before = bucket.readJson(h.subKey);
  h.setLlm(mk);
  await h.chat(env);
  const after = bucket.readJson(h.subKey);
  r.check(after.trial_messages_used === 2, `gói trả phí, ${name}: bộ đếm vẫn 2`, `nhận ${after.trial_messages_used}`);
  r.check(["plan", "status", "expires_at", "activated_via", "trial_messages_total"].every((k) => after[k] === before[k]), `gói trả phí, ${name}: gói không đổi`, JSON.stringify(after));
}
for (const [name, doc, expectUsed] of [["hết 3/3", h.trialDoc(3), 3], ["hết 6/6 sau gia hạn", h.trialDoc(6, { trial_extended: true }), 6]]) {
  const { bucket, env } = h.makeWorld(doc);
  h.setLlm(() => h.okText("không được gọi"));
  const res = await h.chat(env);
  r.check(res.status === 402 && /subscription_required/.test(res.raw), `${name}: HTTP 402 subscription_required`, `status=${res.status} ${res.raw.slice(0, 80)}`);
  r.check(h.llmCalls.length === 0, `${name}: không gọi LLM`, `nhận ${h.llmCalls.length}`);
  r.check(h.used(bucket) === expectUsed, `${name}: bộ đếm giữ nguyên ${expectUsed}`, `nhận ${h.used(bucket)}`);
}
r.done();
