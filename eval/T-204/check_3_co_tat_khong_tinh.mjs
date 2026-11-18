// T-204 tiêu chí 3: cờ tắt (thiếu / "" / "0" / "true" / "yes" / "on" / " 1" / "1 " / "01" / "TRUE"): danh tính cố định không bao giờ là Capu: mọi bản ghi của nó
// (cũ by_capu=false, vắng, hoặc by_capu=true+via lưu lúc cờ bật) ở 'Chờ Capu', không vào export, dù ADMIN_USER_IDS/CAPU_USER_IDS liệt kê chính chuỗi đó. Capu thật vẫn ký.
// Cộng: đảo cờ trên CÙNG kho: bật -> tắt -> bật; bản ghi tạo lúc bật ngừng tính khi tắt và tính lại khi bật (kho không đổi).
import { reporter, mkEnv, MemoryBucket, REVIEWS_KEY, seedReviews, stored, pickIds, listAll, exportOf, review, FIXED, ADM, CAPU, VIA } from "./lib/common.mjs";
const R = reporter();
const OFF = [undefined, "", "0", "true", "yes", "on", " 1", "1 ", "01", "TRUE"];
const [f1, f2, f3, rc, ra] = pickIds(5);
for (const flag of OFF) for (const listed of [false, true]) {
  const tag = `ADMIN_OPEN=${flag === undefined ? "thiếu" : JSON.stringify(flag)}${listed ? " + danh tính cố định nằm trong ADMIN_USER_IDS/CAPU_USER_IDS" : ""}`;
  const bucket = new MemoryBucket();
  seedReviews(bucket, { [f1]: stored(f1, FIXED, false), [f2]: stored(f2, FIXED, undefined), [f3]: stored(f3, FIXED, true, { via: VIA }), [rc]: stored(rc, CAPU, true), [ra]: stored(ra, ADM, false) });
  const env = mkEnv(bucket, flag, listed ? { ADMIN_USER_IDS: `${ADM},${CAPU},${FIXED}`, CAPU_USER_IDS: `${CAPU},${FIXED}` } : {});
  const ex = await exportOf(env);
  const ids = (ex.json?.entries || []).map((e) => e.vendor_id);
  R.check(`${tag}: export chỉ có Capu thật`, ex.status === 200 && JSON.stringify(ids) === JSON.stringify([rc]) && !ex.text.includes(FIXED), [ex.status, ids]);
  R.check(`${tag}: waiting_capu=4`, ex.json?.waiting_capu === 4, ex.json?.waiting_capu);
  const pc = await listAll(env, "pending_capu", "dev:" + ADM);
  R.check(`${tag}: 3 bản ghi của danh tính cố định ở 'Chờ Capu' với review.by_capu=false`, [f1, f2, f3].every((id) => pc.rows.find((x) => x.id === id)?.review?.by_capu === false), pc.rows.map((x) => [x.id, x.review?.by_capu]));
}
// Capu thật ký khi cờ tắt
{
  const env = mkEnv(new MemoryBucket(), undefined);
  const r = await review(env, rc, { decision: "approve" }, "dev:" + CAPU);
  const ex = await exportOf(env);
  R.check("cờ tắt: Capu thật duyệt -> by_capu=true và có trong export", r.status === 200 && r.json?.review?.by_capu === true && (ex.json?.entries || []).some((e) => e.vendor_id === rc), [r.status, r.text.slice(0, 80)]);
}
// Đảo cờ trên cùng kho
{
  const bucket = new MemoryBucket();
  const on = mkEnv(bucket, "1"), off = mkEnv(bucket, undefined);
  const w = await review(on, f1, { decision: "approve" });
  seedReviews(bucket, { ...bucket.readJson(REVIEWS_KEY).vendors, [f2]: stored(f2, FIXED, false) });
  const ids = async (e) => ((await exportOf(e)).json?.entries || []).map((x) => x.vendor_id).sort();
  const want = [f1, f2].sort();
  R.check("bật: bản ghi mới + bản ghi cũ đều trong export", w.status === 200 && JSON.stringify(await ids(on)) === JSON.stringify(want), [w.status, await ids(on)]);
  const snap = JSON.stringify(bucket.readJson(REVIEWS_KEY)); const puts = bucket.putLog.length;
  R.check("tắt: cả hai ngừng tính (export rỗng)", (await ids(off)).length === 0, await ids(off));
  R.check("tắt: cả hai về 'Chờ Capu'", (await listAll(off, "pending_capu", "dev:" + ADM)).rows.length === 2);
  R.check("bật lại: cả hai tính lại; đảo cờ không ghi R2", JSON.stringify(await ids(on)) === JSON.stringify(want) && JSON.stringify(bucket.readJson(REVIEWS_KEY)) === snap && bucket.putLog.length === puts, [await ids(on)]);
}
R.done();
