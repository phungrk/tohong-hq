// T-204 tiêu chí 6: chặn 409 decided_by_capu theo cờ. Luật: một review "đang của Capu" (hiệu lực lúc này) chỉ bị ghi đè/rút bởi người cũng là Capu (hiệu lực lúc này).
//  cờ "1": danh tính cố định = Capu -> ghi đè/rút bản của Capu thật hoặc của chính nó: 200.
//  cờ tắt hoặc khác "1": danh tính cố định không phải Capu -> bản của Capu thật vẫn 409 với admin thường (như cũ); bản của danh tính cố định (kể cả by_capu=true lưu lúc bật) KHÔNG còn là "của Capu" -> admin thường ghi đè/rút được (200), kết quả by_capu=false.
import { reporter, mkEnv, MemoryBucket, seedReviews, stored, pickIds, review, withdraw, FIXED, ADM, CAPU, VIA } from "./lib/common.mjs";
const R = reporter();
const [a, b, c, d] = pickIds(4);
const mk = (flag, vendors) => { const bk = new MemoryBucket(); seedReviews(bk, vendors); return mkEnv(bk, flag); };
// cờ bật
for (const [name, prior] of [["bản cũ của danh tính cố định (by_capu=false)", stored(a, FIXED, false)], ["bản của Capu thật", stored(a, CAPU, true)]]) {
  const env = mk("1", { [a]: prior, [b]: { ...prior, ...stored(b, prior.reviewed_by, prior.by_capu) } });
  const p = await review(env, a, { decision: "approve" });
  R.check(`cờ bật, đè lên ${name}: 200, by_capu=true`, p.status === 200 && p.json?.review?.by_capu === true, [p.status, p.text.slice(0, 80)]);
  const w = await withdraw(env, b);
  R.check(`cờ bật, rút ${name}: 200`, w.status === 200, [w.status, w.text.slice(0, 80)]);
}
// cờ tắt / khác "1"
for (const flag of [undefined, "0", "true", " 1"]) {
  const tag = `ADMIN_OPEN=${flag === undefined ? "thiếu" : JSON.stringify(flag)}`;
  const env = mk(flag, { [a]: stored(a, CAPU, true), [b]: stored(b, CAPU, true), [c]: stored(c, FIXED, true, { via: VIA }), [d]: stored(d, FIXED, false) });
  const p = await review(env, a, { decision: "approve" }, "dev:" + ADM);
  R.check(`${tag}: admin thường đè bản của Capu thật -> 409 decided_by_capu (như cũ)`, p.status === 409 && p.json?.error === "decided_by_capu", [p.status, p.text.slice(0, 80)]);
  const w = await withdraw(env, b, "dev:" + ADM);
  R.check(`${tag}: admin thường rút bản của Capu thật -> 409 decided_by_capu (như cũ)`, w.status === 409 && w.json?.error === "decided_by_capu", [w.status, w.text.slice(0, 80)]);
  const k = await review(env, a, { decision: "approve" }, "dev:" + CAPU);
  R.check(`${tag}: Capu thật đè bản của mình -> 200, by_capu=true (như cũ)`, k.status === 200 && k.json?.review?.by_capu === true, [k.status, k.text.slice(0, 80)]);
  const o = await review(env, c, { decision: "approve" }, "dev:" + ADM);
  R.check(`${tag}: admin thường đè bản lưu lúc cờ bật (by_capu=true của danh tính cố định) -> 200, by_capu=false, không 409`, o.status === 200 && o.json?.review?.by_capu === false, [o.status, o.text.slice(0, 80)]);
  const o2 = await withdraw(env, d, "dev:" + ADM);
  R.check(`${tag}: admin thường rút bản cũ của danh tính cố định -> 200`, o2.status === 200, [o2.status, o2.text.slice(0, 80)]);
}
R.done();
