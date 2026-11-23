// T-223 tiêu chí 8: việc hoàn lượt tự lỗi (kho ghi thất bại) không làm mất thông báo: cặp đôi vẫn nhận đúng MỘT sự kiện error với thông điệp đúng như khi không có lỗi kho; chi tiết lỗi kho không lộ ra luồng.
import * as h from "./_harness.mjs";
const r = h.reporter();
for (const [name, mk, msg, rec] of [["402", () => h.httpErr(402), h.MSG_BILLING, false], ["500", () => h.httpErr(500), h.MSG_TRANSIENT, true]]) {
  const { bucket, env } = h.makeWorld(h.trialDoc(1));
  let writes = 0;
  bucket.beforePut = async (k) => { if (k === h.subKey && ++writes >= 2) throw new Error("kho lỗi giả"); }; // lần ghi 1 = cổng trừ lượt; từ lần 2 = hoàn lượt
  h.setLlm(mk);
  const res = await h.chat(env);
  const errs = res.events.filter((e) => e.event === "error");
  r.check(errs.length === 1, `${name}, kho lỗi lúc hoàn: đúng 1 sự kiện error`, `nhận ${errs.length}`);
  r.check(errs[0]?.data?.message === msg && errs[0]?.data?.recoverable === rec, `${name}, kho lỗi lúc hoàn: thông điệp và recoverable như bình thường`, JSON.stringify(errs[0]?.data));
  r.check(!res.events.some((e) => e.event === "done" || e.event === "chunk"), `${name}, kho lỗi lúc hoàn: không có done/chunk`, res.events.map((e) => e.event).join(","));
  r.check(!res.raw.includes("kho lỗi giả"), `${name}, kho lỗi lúc hoàn: không lộ lỗi kho ra luồng`, "lộ");
}
r.done();
