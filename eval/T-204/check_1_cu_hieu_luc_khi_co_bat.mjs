// T-204 tiêu chí 1: cờ ADMIN_OPEN="1": review ĐÃ GHI TỪ TRƯỚC (reviewed_by = danh tính cố định, by_capu=false hoặc vắng) tính là của Capu:
// hiện "Chờ áp dụng" (status=pending_apply), không còn ở "Chờ Capu", có mặt trong export ký; việc tính toán lúc ĐỌC, không ghi lại R2.
import { reporter, mkEnv, MemoryBucket, REVIEWS_KEY, seedReviews, stored, pickIds, listAll, exportOf, FIXED, ADM, CAPU } from "./lib/common.mjs";
const R = reporter();
const [f1, f2, f3, f4, rc, ra] = pickIds(6);
const bucket = new MemoryBucket();
seedReviews(bucket, {
  [f1]: stored(f1, FIXED, false), [f2]: stored(f2, FIXED, false), [f3]: stored(f3, FIXED, false),
  [f4]: stored(f4, FIXED, undefined), // bản ghi cũ không có trường by_capu
  [rc]: stored(rc, CAPU, true),      // Capu thật đã ký từ trước
  [ra]: stored(ra, ADM, false),      // admin thật không phải Capu
});
const before = JSON.stringify(bucket.readJson(REVIEWS_KEY));
const env = mkEnv(bucket, "1"); // cờ bật, không token; ADMIN_USER_IDS không liệt kê danh tính cố định
const fixed = [f1, f2, f3, f4];
const pa = await listAll(env, "pending_apply");
const pc = await listAll(env, "pending_capu");
R.check("liệt kê pending_apply 200", pa.status === 200, pa.status);
R.check("4 review cũ của danh tính cố định nằm ở 'Chờ áp dụng' (review.by_capu=true)", fixed.every((id) => pa.rows.find((x) => x.id === id)?.review?.by_capu === true), pa.rows.map((x) => x.id));
R.check("Capu thật vẫn ở 'Chờ áp dụng'", !!pa.rows.find((x) => x.id === rc));
R.check("không review cũ nào của danh tính cố định còn ở 'Chờ Capu'", !fixed.some((id) => pc.rows.some((x) => x.id === id)), pc.rows.map((x) => x.id));
R.check("admin thật không phải Capu vẫn 'Chờ Capu' (luật cũ không đổi)", pc.rows.length === 1 && pc.rows[0].id === ra && pc.rows[0].review?.by_capu === false, pc.rows.map((x) => x.id));
const ex = await exportOf(env);
const ids = (ex.json?.entries || []).map((e) => e.vendor_id).sort();
R.check("export ký 200", ex.status === 200, [ex.status, ex.text.slice(0, 100)]);
R.check("export có đúng 5 mục: 4 cũ của danh tính cố định + Capu thật", JSON.stringify(ids) === JSON.stringify([...fixed, rc].sort()), ids);
R.check("export: mọi mục by_capu=true; waiting_capu=1 (admin thật không phải Capu)", (ex.json?.entries || []).every((e) => e.by_capu === true) && ex.json?.waiting_capu === 1, [ex.json?.waiting_capu]);
R.check("đọc/xuất không ghi lại R2 (bản ghi cũ giữ nguyên từng byte: tính lúc đọc, không lưu lúc ghi)", JSON.stringify(bucket.readJson(REVIEWS_KEY)) === before && bucket.putLog.length === 0, bucket.putLog);
R.done();
