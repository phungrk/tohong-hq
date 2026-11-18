import { reporter, mkEnv, MemoryBucket, REVIEWS_KEY, seedReviews, stored, pickIds, review, listAll, exportOf, FIXED, ADM, CAPU, VIA } from "./open_admin_common.mjs";
const R = reporter();
const [f1, f2, f3, rc, ra] = pickIds(5);
const seedAll = (bk) => seedReviews(bk, { [f1]: stored(f1, FIXED, false), [f2]: stored(f2, FIXED, undefined), [f3]: stored(f3, FIXED, true, { via: VIA }), [rc]: stored(rc, CAPU, true), [ra]: stored(ra, ADM, false) });
const idsOf = async (env) => ((await exportOf(env)).json?.entries || []).map((e) => e.vendor_id).sort();
{ // cờ bật: bản ghi cũ lẫn mới
  const bk = new MemoryBucket(); seedAll(bk); const snap = JSON.stringify(bk.readJson(REVIEWS_KEY));
  const env = mkEnv(bk, "1");
  const w = await review(env, pickIds(1, undefined, 10)[0], { decision: "approve" });
  R.check("cờ bật: ghi mới by_capu=true", w.status === 200 && w.json?.review?.by_capu === true, [w.status]);
  const ids = await idsOf(env);
  R.check("cờ bật: export có cả 3 bản ghi cũ + bản mới + Capu thật, không có admin thường", [f1, f2, f3, rc, w.json?.review && pickIds(1, undefined, 10)[0]].every((x) => ids.includes(x)) && !ids.includes(ra), ids);
  const pa = await listAll(env, "pending_apply");
  R.check("cờ bật: bản ghi của danh tính cố định ở 'Chờ áp dụng'", [f1, f2, f3].every((id) => pa.rows.some((x) => x.id === id)), pa.rows.map((x) => x.id));
}
for (const flag of [undefined, "", "0", "true", "yes", "on", " 1", "1 ", "01", "TRUE"]) for (const listed of [false, true]) { // cờ tắt
  const bk = new MemoryBucket(); seedAll(bk);
  const env = mkEnv(bk, flag, listed ? { ADMIN_USER_IDS: `${ADM},${CAPU},${FIXED}`, CAPU_USER_IDS: `${CAPU},${FIXED}` } : {});
  const ex = await exportOf(env);
  R.check(`ADMIN_OPEN=${flag === undefined ? "thiếu" : JSON.stringify(flag)}${listed ? " + liệt kê" : ""}: export chỉ có Capu thật, không chuỗi danh tính cố định`, JSON.stringify((ex.json?.entries || []).map((e) => e.vendor_id)) === JSON.stringify([rc]) && !ex.text.includes(FIXED), [ex.status, (ex.json?.entries || []).length]);
}
{ // Capu thật ký khi cờ tắt; đảo cờ trên cùng kho không ghi R2
  const bk = new MemoryBucket(); const on = mkEnv(bk, "1"), off = mkEnv(bk, undefined);
  const k = await review(off, rc, { decision: "approve" }, "dev:" + CAPU);
  R.check("cờ tắt: Capu thật ký được", k.status === 200 && k.json?.review?.by_capu === true && (await idsOf(off)).includes(rc), [k.status]);
  seedReviews(bk, { ...bk.readJson(REVIEWS_KEY).vendors, [f1]: stored(f1, FIXED, false) });
  const snap = JSON.stringify(bk.readJson(REVIEWS_KEY)), n = bk.putLog.length;
  const a = await idsOf(on), b = await idsOf(off), c = await idsOf(on);
  R.check("đảo cờ bật/tắt/bật: tính lại đúng, không ghi R2", a.includes(f1) && !b.includes(f1) && c.includes(f1) && JSON.stringify(bk.readJson(REVIEWS_KEY)) === snap && bk.putLog.length === n, [a, b, c]);
}
R.done();
