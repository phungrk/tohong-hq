// T-205 adv-01 (adversary): (a) cờ "1" với ADMIN_USER_IDS/CAPU_USER_IDS thiếu / rỗng / chỉ dấu phẩy-cách / chỉ admin thường:
// spec T-204 "danh sách không ảnh hưởng" -> bản cũ + mới của danh tính cố định vẫn "Chờ áp dụng" và vào export, nhãn admin:2ddfc6ef, via.
// (b) giá trị cờ lạ ngoài bộ 10 của check_3: "1\n", "\r1", "1​", " 1", "１" (toàn khổ), số 1, true -> tắt, danh tính cố định không vào export.
import { reporter, mkEnv, MemoryBucket, seedReviews, stored, pickIds, listAll, exportOf, review, FIXED, FIXED_LABEL, VIA, ADM, CAPU, sigOk } from "./lib/t204_common.mjs";
const R = reporter();
const [o1, o2, n1, rc] = pickIds(4);
const LISTS = [["thiếu cả hai", { ADMIN_USER_IDS: undefined, CAPU_USER_IDS: undefined }], ["rỗng cả hai", { ADMIN_USER_IDS: "", CAPU_USER_IDS: "" }],
  ["chỉ dấu phẩy-cách", { ADMIN_USER_IDS: " , ,", CAPU_USER_IDS: " ," }], ["chỉ admin thường, CAPU rỗng", { ADMIN_USER_IDS: ADM, CAPU_USER_IDS: "" }]];
for (const [tag, lists] of LISTS) {
  const bk = new MemoryBucket();
  seedReviews(bk, { [o1]: stored(o1, FIXED, false), [o2]: stored(o2, FIXED, undefined) });
  const env = mkEnv(bk, "1", lists);
  for (const k of Object.keys(lists)) if (lists[k] === undefined) delete env[k];
  const w = await review(env, n1, { decision: "approve" });
  R.check(`cờ "1", ${tag}: review mới 200 by_capu=true`, w.status === 200 && w.json?.review?.by_capu === true, [w.status, w.text.slice(0, 100)]);
  const pa = await listAll(env, "pending_apply");
  R.check(`cờ "1", ${tag}: 3 bản ở Chờ áp dụng`, pa.status === 200 && [o1, o2, n1].every((id) => pa.rows.some((x) => x.id === id && x.review?.by_capu === true)), [pa.status, pa.rows.length]);
  const ex = await exportOf(env);
  const es = ex.json?.entries || [];
  R.check(`cờ "1", ${tag}: export có đúng 3 mục, nhãn ${FIXED_LABEL}, via, chữ ký đúng, không id thô`,
    ex.status === 200 && JSON.stringify(es.map((e) => e.vendor_id).sort()) === JSON.stringify([o1, o2, n1].sort()) && es.every((e) => e.reviewer_label === FIXED_LABEL && e.via === VIA && sigOk(e) && !("reviewed_by" in e)) && !ex.text.includes(FIXED), [ex.status, es.length]);
}
const ODD = ["1\n", "\r1", "1​", " 1", "１", 1, true];
for (const flag of ODD) {
  const tag = `ADMIN_OPEN=${JSON.stringify(flag)}`;
  const bk = new MemoryBucket();
  seedReviews(bk, { [o1]: stored(o1, FIXED, false), [o2]: stored(o2, FIXED, true, { via: VIA }), [rc]: stored(rc, CAPU, true) });
  const env = mkEnv(bk, flag, { ADMIN_USER_IDS: `${ADM},${CAPU},${FIXED}`, CAPU_USER_IDS: `${CAPU},${FIXED}` });
  const ex = await exportOf(env);
  R.check(`${tag}: tắt -> export chỉ có Capu thật`, ex.status === 200 && JSON.stringify((ex.json?.entries || []).map((e) => e.vendor_id)) === JSON.stringify([rc]) && ex.json?.waiting_capu === 2, [ex.status, ex.text.slice(0, 120)]);
  const anon = await review(env, n1, { decision: "approve" });
  R.check(`${tag}: tắt -> không token bị 403`, anon.status === 403, anon.status);
  const fx = await review(env, n1, { decision: "approve" }, "dev:" + FIXED);
  R.check(`${tag}: tắt -> token mang đúng chuỗi danh tính cố định (có trong cả hai danh sách) không ra by_capu=true, không via`, fx.status === 200 && fx.json?.review?.by_capu === false && !("via" in (fx.json?.review || {})), [fx.status, fx.text.slice(0, 120)]);
}
R.done();
