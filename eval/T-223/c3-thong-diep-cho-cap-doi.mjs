// T-223 tiêu chí 3: qua endpoint chat thật, khi provider trả 402/401/403 cặp đôi nhận đúng một sự kiện error với thông điệp cố định (không kỹ thuật, không hứa "thử lại ngay"), recoverable=false, không có chunk/done, và không lộ chi tiết kỹ thuật nào ở bất kỳ chỗ nào của luồng. Lỗi tạm thời giữ thông điệp cũ.
import * as h from "./_harness.mjs";
const r = h.reporter();
for (const st of [402, 401, 403]) {
  const { env } = h.makeWorld(h.trialDoc(0));
  h.setLlm(() => h.httpErr(st));
  const res = await h.chat(env);
  const errs = res.events.filter((e) => e.event === "error");
  r.check(res.status === 200 && errs.length === 1, `HTTP ${st}: đúng 1 sự kiện error trong luồng 200`, `status=${res.status}, số error=${errs.length}`);
  r.check(errs[0]?.data?.message === h.MSG_BILLING, `HTTP ${st}: thông điệp đúng nguyên văn`, JSON.stringify(errs[0]?.data?.message));
  r.check(errs[0]?.data?.recoverable === false, `HTTP ${st}: recoverable = false`, `nhận ${errs[0]?.data?.recoverable}`);
  r.check(!res.events.some((e) => e.event === "chunk" || e.event === "done" || e.event === "meta"), `HTTP ${st}: không có chunk/meta/done`, res.events.map((e) => e.event).join(","));
  const low = res.raw.toLowerCase();
  const leaked = h.MSG_INVARIANT_BAD.filter((w) => low.includes(w.toLowerCase()));
  r.check(leaked.length === 0, `HTTP ${st}: không lộ chi tiết kỹ thuật trong luồng`, `lộ: ${leaked.join(", ")}`);
  r.check(Object.keys(errs[0]?.data || {}).sort().join() === "message,recoverable", `HTTP ${st}: sự kiện error chỉ có message và recoverable`, Object.keys(errs[0]?.data || {}).join());
}
for (const [name, mk] of [["429", () => h.httpErr(429)], ["500", () => h.httpErr(500)], ["lỗi mạng", () => h.netErr()], ["timeout", () => h.timeoutErr()]]) {
  const { env } = h.makeWorld(h.trialDoc(0));
  h.setLlm(mk);
  const res = await h.chat(env);
  const e = h.errEvent(res);
  r.check(e?.message === h.MSG_TRANSIENT && e?.recoverable === true, `${name}: giữ thông điệp tạm thời cũ, recoverable = true`, JSON.stringify(e));
}
r.done();
