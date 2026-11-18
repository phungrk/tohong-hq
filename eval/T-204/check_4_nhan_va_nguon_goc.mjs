// T-204 tiêu chí 4: nhãn người duyệt + nguồn gốc "cờ mở admin" trong export. Cờ "1", kho gồm: bản ghi cũ của danh tính cố định, bản ghi mới ghi lúc bật, Capu thật.
//  - reviewer_label của mục từ danh tính cố định = "admin:" + 8 hex đầu SHA-256("admin-khong-dang-nhap") (= admin:2ddfc6ef; dạng khớp LABEL_RE của apply_admin_reviews.py), KHÁC nhãn của Capu thật;
//  - mục đó có thêm trường `via: "admin_open"` (không ký); mục của Capu thật KHÔNG có `via`; không mục nào có reviewed_by hay Clerk id thô; mọi chữ ký kiểm được theo định nghĩa chuẩn.
import { reporter, mkEnv, MemoryBucket, REVIEWS_KEY, seedReviews, stored, pickIds, review, exportOf, sigOk, labelOf, FIXED, FIXED_LABEL, CAPU, VIA } from "./lib/common.mjs";
const R = reporter();
const [fo, fn, rc] = pickIds(3);
const bucket = new MemoryBucket();
seedReviews(bucket, { [fo]: stored(fo, FIXED, false), [rc]: stored(rc, CAPU, true) });
const env = mkEnv(bucket, "1");
const w = await review(env, fn, { decision: "approve" });
const ex = await exportOf(env);
const by = Object.fromEntries((ex.json?.entries || []).map((e) => [e.vendor_id, e]));
R.check("ghi mới 200 và export có đủ 3 mục", w.status === 200 && Object.keys(by).length === 3, [w.status, Object.keys(by).length]);
R.check("nhãn cố định tính độc lập = admin:2ddfc6ef", FIXED_LABEL === "admin:2ddfc6ef", FIXED_LABEL);
for (const id of [fo, fn]) {
  const e = by[id] || {};
  R.check(`mục của danh tính cố định (${id === fo ? "cũ" : "mới"}): reviewer_label = ${FIXED_LABEL} và via = "${VIA}"`, e.reviewer_label === FIXED_LABEL && e.via === VIA, [e.reviewer_label, e.via]);
}
R.check("mục của Capu thật: nhãn riêng, KHÔNG có via", by[rc]?.reviewer_label === labelOf(CAPU) && by[rc]?.reviewer_label !== FIXED_LABEL && !("via" in by[rc]), [by[rc]?.reviewer_label, by[rc]?.via]);
R.check("mọi nhãn khớp /^admin:[0-9a-f]{8}$/; không reviewed_by; không Clerk id thô; không chuỗi danh tính cố định", Object.values(by).every((e) => /^admin:[0-9a-f]{8}$/.test(e.reviewer_label) && !("reviewed_by" in e)) && !/user_[A-Za-z0-9]{10,}/.test(ex.text) && !ex.text.includes(FIXED), ex.text.slice(0, 120));
R.check("mọi chữ ký kiểm được bằng định nghĩa chuẩn (nhãn nằm trong phần ký)", Object.values(by).length === 3 && Object.values(by).every(sigOk), Object.values(by).map((e) => [e.vendor_id, sigOk(e)]));
const t = { ...by[fn], reviewer_label: labelOf(CAPU) };
R.check("đối chứng: đổi nhãn sang của Capu thật thì chữ ký hỏng (nguồn gốc không thể giả)", !sigOk(t));
R.done();
