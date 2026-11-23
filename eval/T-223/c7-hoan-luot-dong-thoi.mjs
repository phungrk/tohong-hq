// T-223 tiêu chí 7: hoàn lượt là "trừ đúng 1 khỏi giá trị hiện tại", không ghi lại số tuyệt đối, không chờ bộ đếm đứng yên, không phụ thuộc gói, không xuống dưới 0.
// Hai tin chạy đồng thời (mỗi lần gọi LLM giả bị trễ 60 ms): một lỗi 402, một thành công, bắt đầu từ 1/3 -> phải còn 2 (chỉ tin thành công bị tính).
import * as h from "./_harness.mjs";
const r = h.reporter();
const real = globalThis.fetch;
const slow = (extra) => { globalThis.fetch = async (...a) => { await new Promise((ok) => setTimeout(ok, 60)); if (extra) await extra(); return real(...a); }; };
const reset = () => { globalThis.fetch = real; };

for (const failing of [1, 2]) { // tin nào tới LLM trước cũng được: kết quả không đổi
  const { bucket, env } = h.makeWorld(h.trialDoc(1));
  h.setLlm((n) => (n === failing ? h.httpErr(402) : h.okText("Chào bạn")));
  slow();
  const [a, b] = await Promise.all([h.chat(env, "tin A"), h.chat(env, "tin B")]);
  reset();
  const errs = [a, b].filter((x) => h.errEvent(x)).length, oks = [a, b].filter((x) => x.events.some((e) => e.event === "done")).length;
  r.check(errs === 1 && oks === 1, `đồng thời (lỗi là lần gọi ${failing}): 1 tin lỗi, 1 tin thành công`, `lỗi=${errs}, thành công=${oks}`);
  r.check(h.used(bucket) === 2, `đồng thời (lỗi là lần gọi ${failing}): 1/3 -> 2 (chỉ tin thành công bị tính)`, `nhận ${h.used(bucket)}`);
}
{ // hai tin cùng lỗi: cả hai được hoàn
  const { bucket, env } = h.makeWorld(h.trialDoc(1));
  h.setLlm(() => h.httpErr(402));
  slow();
  await Promise.all([h.chat(env, "tin A"), h.chat(env, "tin B")]);
  reset();
  r.check(h.used(bucket) === 1, "đồng thời, cả hai lỗi: về 1", `nhận ${h.used(bucket)}`);
}
{ // gói được kích hoạt giữa lúc cổng trừ và lúc hoàn: vẫn trừ 1 khỏi bộ đếm thử, gói giữ nguyên
  const { bucket, env } = h.makeWorld(h.trialDoc(1));
  h.setLlm(() => h.httpErr(402));
  slow(async () => { await h.makeSubscriptionStore(env).activate(h.COUPLE, "m1", { by: "user_admin" }); });
  await h.chat(env);
  reset();
  const d = bucket.readJson(h.subKey);
  r.check(d.plan === "m1" && d.status === "active", "kích hoạt gói chen giữa: gói không bị ghi đè", JSON.stringify(d));
  r.check(d.trial_messages_used === 1, "kích hoạt gói chen giữa: bộ đếm thử vẫn trừ 1 (2 -> 1)", `nhận ${d.trial_messages_used}`);
}
{ // bộ đếm bị đặt về 0 giữa chừng: không âm
  const { bucket, env } = h.makeWorld(h.trialDoc(1));
  h.setLlm(() => h.httpErr(402));
  slow(async () => { bucket.seedJson(h.subKey, h.trialDoc(0)); });
  await h.chat(env);
  reset();
  r.check(h.used(bucket) === 0, "bộ đếm đã về 0 giữa chừng: không xuống dưới 0", `nhận ${h.used(bucket)}`);
}
r.done();
