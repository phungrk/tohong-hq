// T-205 adv-03 (adversary): vòng đời ghi xen kẽ cờ trên CÙNG kho + đua.
// (a) bật: danh tính cố định ghi (via) -> tắt: admin thường ghi đè (200, by_capu=false, không via) -> bật lại: bản giờ là của admin thường, KHÔNG được vào export (via cũ không được sống lại);
//     tắt: Capu thật ghi -> bật lại: vẫn trong export, nhãn của Capu thật, không via.
// (b) đua, cờ tắt: Capu thật PUT song song với admin thường PUT/DELETE trên bản by_capu=true lưu lúc cờ bật: mọi phản hồi 200/409, bản cuối luôn là của Capu thật.
// (c) đua, cờ "1": 20 PUT song song của danh tính cố định trên 20 dòng khác nhau: mỗi phản hồi 200 hoặc 409 version_conflict (hành vi sẵn có của main),
//     không mất bản nào đã trả 200; gửi lại tuần tự các bản 409 thì cả 20 vào export.
import { reporter, mkEnv, MemoryBucket, REVIEWS_KEY, seedReviews, stored, pickIds, exportOf, review, withdraw, FIXED, FIXED_LABEL, VIA, ADM, CAPU, labelOf } from "../T-204/lib/common.mjs";
const R = reporter();
const [a, b] = pickIds(2);
{
  const bk = new MemoryBucket();
  const on = mkEnv(bk, "1"), off = mkEnv(bk, undefined);
  const w1 = await review(on, a, { decision: "approve" });
  R.check("bật: danh tính cố định ghi -> via", w1.status === 200 && w1.json?.review?.via === VIA, [w1.status, w1.text.slice(0, 100)]);
  const w2 = await review(off, a, { decision: "manual", action: "remove", note: "x" }, "dev:" + ADM);
  R.check("tắt: admin thường ghi đè -> 200, by_capu=false, không via", w2.status === 200 && w2.json?.review?.by_capu === false && !("via" in w2.json.review), [w2.status, w2.text.slice(0, 100)]);
  const st = bk.readJson(REVIEWS_KEY).vendors[a];
  R.check("kho: bản giờ là của admin thường, không via", st.reviewed_by === ADM && !("via" in st), st);
  const e1 = await exportOf(on);
  R.check("bật lại: bản của admin thường không vào export", e1.status === 200 && !(e1.json?.entries || []).some((e) => e.vendor_id === a), e1.text.slice(0, 160));
  const w3 = await review(off, b, { decision: "approve" }, "dev:" + CAPU);
  const e2 = await exportOf(on);
  const eb = (e2.json?.entries || []).find((e) => e.vendor_id === b);
  R.check("Capu thật ghi lúc tắt -> bật lại vẫn trong export, nhãn Capu thật, không via", w3.status === 200 && eb && eb.reviewer_label === labelOf(CAPU) && eb.reviewer_label !== FIXED_LABEL && !("via" in eb), eb);
}
for (let t = 0; t < 15; t++) {
  const bk = new MemoryBucket();
  seedReviews(bk, { [a]: stored(a, FIXED, true, { via: VIA }) });
  const off = mkEnv(bk, undefined);
  const ops = t % 2 ? [review(off, a, { decision: "approve" }, "dev:" + ADM), review(off, a, { decision: "approve" }, "dev:" + CAPU)]
                    : [withdraw(off, a, "dev:" + ADM), review(off, a, { decision: "approve" }, "dev:" + CAPU)];
  if (t % 3 === 0) ops.reverse();
  const rs = await Promise.all(ops);
  const fin = bk.readJson(REVIEWS_KEY).vendors[a];
  R.check(`đua #${t}: phản hồi 200/409, bản cuối là của Capu thật`, rs.every((x) => x.status === 200 || x.status === 409) && fin?.reviewed_by === CAPU && fin?.by_capu === true, [rs.map((x) => x.status), fin?.reviewed_by]);
}
{
  const ids = pickIds(20, undefined, 10);
  const bk = new MemoryBucket();
  const on = mkEnv(bk, "1");
  const rs = await Promise.all(ids.map((id) => review(on, id, { decision: "approve" })));
  const ok = ids.filter((_, i) => rs[i].status === 200).sort();
  const ex = await exportOf(on);
  const got = (ex.json?.entries || []).map((e) => e.vendor_id).sort();
  R.check("cờ bật, 20 PUT song song: chỉ 200 hoặc 409 version_conflict; mọi bản 200 đều trong export", rs.every((x) => x.status === 200 || (x.status === 409 && x.json?.error === "version_conflict")) && JSON.stringify(got) === JSON.stringify(ok), [rs.map((x) => x.status).join(","), got.length, ok.length]);
  for (const [i, id] of ids.entries()) if (rs[i].status !== 200) await review(on, id, { decision: "approve" });
  const ex2 = await exportOf(on);
  R.check("cờ bật: gửi lại tuần tự -> cả 20 vào export, nhãn danh tính cố định", JSON.stringify((ex2.json?.entries || []).map((e) => e.vendor_id).sort()) === JSON.stringify([...ids].sort()) && ex2.json.entries.every((e) => e.reviewer_label === FIXED_LABEL), ex2.json?.count);
}
R.done();
