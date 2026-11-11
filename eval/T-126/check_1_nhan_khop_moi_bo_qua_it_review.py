#!/usr/bin/env python3
"""T-126 tiêu chí 1 (luật mới cho lần enrich từ nay: ứng viên Google có số đánh giá < 2 thì KHÔNG nhận khớp). OFFLINE (Google giả có userRatingCount; chạy ĐÚNG lệnh CLI).
Kịch bản (bước 0 = luật hiện hành chạy `enrich.py` thường, rồi `enrich.py ... --recheck-name-match` cho đường tên; m cũng được hỏi lại ở đây và qua đường tên nhưng 0 đánh giá -> few_reviews):
  a makeup 5 đánh giá -> NHẬN (đối chứng) · b makeup 2 -> NHẬN (đúng ngưỡng) · g venue 2 -> NHẬN
  c makeup 1 · d flower Google KHÔNG có trường rating/userRatingCount (= 0) · e venue 0 · f venue 1 -> KHÔNG nhận: vendor ở lại (không remove), không place_id/ảnh Google, địa chỉ = địa chỉ gốc,
     audit low_confidence + reject_reason=few_reviews + candidate_place_id + google_review_count; KHÔNG tốn lượt ảnh nào cho vendor này (ảnh chỉ lấy sau khi nhận)
  k flower CLOSED_PERMANENTLY với 0 đánh giá -> few_reviews thắng: KHÔNG gỡ, ở lại · l flower CLOSED_TEMPORARILY với 0 đánh giá -> few_reviews, không ở trạng thái tạm đóng cửa (không retry)
  m makeup địa chỉ mâu thuẫn + 0 đánh giá -> mã từ chối cũ (address_conflict) GIỮ NGUYÊN: few_reviews chỉ xét ứng viên đã qua luật nhận khớp
  n makeup 0 đánh giá nhưng Capu duyệt tay accept_place -> NHẬN (duyệt tay thắng), 0 Text Search cho n
  đường tên (--recheck-name-match): o invitation 0 đánh giá và q wedding_gift 1 đánh giá -> few_reviews (1 Text Search mỗi vendor, 0 ảnh); p invitation 4 đánh giá -> nhận theo tên (2 ảnh)
Đếm: baseline đúng 13 Text Search (n được duyệt tay thì không); recheck đúng 4 (m, o, p, q). Không có lượt Details, không có lượt ảnh cho vendor few_reviews. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t126 as k
h, x, t = k.h, k.x, k.t
bad = []
S = k.ADDR
G = "55 Hai Bà Trưng, Bến Nghé, Hồ Chí Minh"   # địa chỉ Google khác đường với địa chỉ gốc (mâu thuẫn)
V = [  # id, tên, category file, địa chỉ gốc, địa chỉ Google, số đánh giá, trạng thái Google
    ("a", "Lumen Alpha Makeup", "makeup", S % 11, S % 11, 5, "OPERATIONAL"),
    ("b", "Beryl Boundary Makeup", "makeup", S % 12, S % 12, 2, "OPERATIONAL"),
    ("g", "Nhà Hàng Garnet Court", "venue", S % 13, S % 13, 2, "OPERATIONAL"),
    ("c", "Cobalt Single Makeup", "makeup", S % 14, S % 14, 1, "OPERATIONAL"),
    ("d", "Hoa Dahlia Absent", "flower", S % 15, S % 15, None, "OPERATIONAL"),
    ("e", "Nhà Hàng Emerald Zero", "venue", S % 16, S % 16, 0, "OPERATIONAL"),
    ("f", "Nhà Hàng Fluorite One", "venue", S % 17, S % 17, 1, "OPERATIONAL"),
    ("k", "Hoa Kyanite Closed", "flower", S % 18, S % 18, 0, "CLOSED_PERMANENTLY"),
    ("l", "Hoa Lazurite Temp", "flower", S % 19, S % 19, 0, "CLOSED_TEMPORARILY"),
    ("m", "Mikado Conflict Makeup", "makeup", S % 20, G, 0, "OPERATIONAL"),
    ("n", "November Manual Makeup", "makeup", S % 21, S % 21, 0, "OPERATIONAL"),
    ("o", "Opal Name Invitation", "invitation", S % 22, G, 0, "OPERATIONAL"),
    ("p", "Pearl Name Invitation", "invitation", S % 23, G, 4, "OPERATIONAL"),
    ("q", "Quartz Name Gift", "wedding_gift", S % 24, G, 1, "OPERATIONAL"),
]
files, PL, rules = {}, {}, []
for vid, name, cat, src, gaddr, n, st in V:
    files.setdefault(cat, []).append(t.vendor("t126_" + vid, name, src, (h.DIR_CATEGORY[cat],)))
    PL["P" + vid] = k.pl(name, gaddr, "P" + vid, n=n, status=st)
    rules.append((h.fold(name), ["P" + vid]))
rules.sort(key=lambda r: -len(r[0]))
root = t.Root(files)
x.usage_logs(root, ts=0, details=0, media=0)
root.set_overrides([t.accept_with_snapshot("t126_n", "Pn", PL["Pn"])])
FX = x.fx(PL, rules)
cats = [c for c in h.ORDER if c in files]
rc, out, calls = root.run(x.enrich_all(cats), FX)
if rc != 0:
    t.fail("enrich thường thoát %d: %s" % (rc, (out.strip().splitlines() or [""])[-1][:160]))


def recs(vid):
    return {c: root.vendor("t126_" + vid, c) for c in files if root.vendor("t126_" + vid, c)}


for cat, v in recs("n").items():   # duyệt tay accept_place: có place_id (ảnh do bước ảnh của T-110 lo, không đo ở đây)
    if t.pid_of(v) != "Pn":
        bad.append("n (%s): Capu duyệt tay accept_place, mong có place_id Pn dù Google chỉ có 0 đánh giá, thấy %r" % (cat, t.pid_of(v)))
for vid in ("a", "b", "g"):
    for cat, v in recs(vid).items():
        if t.pid_of(v) != "P" + vid or len(v.get("google_photos") or []) != 2:
            bad.append("%s (%s): mong NHẬN (place_id P%s, 2 ảnh), thấy pid=%r ảnh=%d" % (vid, cat, vid, t.pid_of(v), len(v.get("google_photos") or [])))
for vid, want in (("a", 5), ("b", 2), ("g", 2)):
    a = root.audit(next(iter(recs(vid)))).get("t126_" + vid) or {}
    if a.get("status") != "enriched" or a.get("google_review_count") != want:
        bad.append("%s: audit mong enriched + google_review_count=%d, thấy %r" % (vid, want, {x_: a.get(x_) for x_ in ("status", "google_review_count")}))
for vid, want in (("c", 1), ("d", 0), ("e", 0), ("f", 1), ("k", 0), ("l", 0)):
    bad += k.demoted_state_ok(root, "t126_" + vid, want)
la = root.audit("flower").get("t126_l") or {}
if x.is_temp_closed(la) or la.get("retry") or la.get("closed_state"):
    bad.append("l (CLOSED_TEMPORARILY, 0 đánh giá): few_reviews thắng, không được vào trạng thái tạm đóng cửa/retry; thấy %r" % {x_: la.get(x_) for x_ in ("retry", "closed_state")})
ma = root.audit("makeup").get("t126_m") or {}
if ma.get("reject_reason") != "address_conflict" or ma.get("status") != "low_confidence" or t.has_pid(root.vendor("t126_m", "makeup")):
    bad.append("m (địa chỉ mâu thuẫn + 0 đánh giá): mong mã từ chối cũ address_conflict giữ nguyên, thấy %r" % {x_: ma.get(x_) for x_ in ("status", "reject_reason")})
qs = x.queries(calls)
if len(qs) != 13 or x.count_for(calls, "november manual") != 0:
    bad.append("baseline mong đúng 13 Text Search (n được duyệt tay thì không), thấy %d (n: %d)" % (len(qs), x.count_for(calls, "november manual")))
if t.n_kind(calls, "details", "share", "geocode", "maps"):
    bad.append("baseline có lượt Details/share/geocode/maps (mong 0)")
for vid in ("c", "d", "e", "f", "k", "l", "m"):
    if [c_ for c_ in calls if c_["kind"] == "media" and "/places/P%s/" % vid in c_["url"]]:
        bad.append("%s: không được nhận mà vẫn tốn lượt ảnh (ảnh chỉ lấy sau khi nhận)" % vid)
for vid in ("k", "l"):   # few_reviews thắng đóng cửa: không remove ở bất kỳ category
    if [e for e in root.removed("flower") if (e.get("vendor") or {}).get("id") == "t126_" + vid]:
        bad.append("%s: bị gỡ vì Google báo đóng cửa trong khi chỉ có <2 đánh giá (few_reviews thắng, vendor ở lại)" % vid)
# ---- đường tên ----------------------------------------------------------------------------------------------------------------------------------
before = {v: root.audit(c).get("t126_" + v) for v, c in (("o", "invitation"), ("q", "wedding_gift"), ("p", "invitation"))}
for v_, a_ in before.items():
    if not a_ or a_.get("reject_reason") not in h.ELIGIBLE_REASONS:
        t.fail("fixture hỏng (đối chứng): %s mong bị address_conflict/unconfirmed ở bước 0, thấy %r" % (v_, (a_ or {}).get("reject_reason")))
rc2, out2, calls2 = root.run(h.recheck_argv([{"cat": c} for c in files]), FX)
if rc2 != 0:
    t.fail("enrich %s thoát %d: %s" % (h.RECHECK_FLAG, rc2, (out2.strip().splitlines() or [""])[-1][:160]))
for vid, want in (("o", 0), ("q", 1)):
    bad += k.demoted_state_ok(root, "t126_" + vid, want)
for cat, v in recs("p").items():
    if t.pid_of(v) != "Pp" or len(v.get("google_photos") or []) != 2:
        bad.append("p (đường tên, 4 đánh giá): mong NHẬN theo tên với 2 ảnh, thấy pid=%r" % t.pid_of(v))
bad += k.demoted_state_ok(root, "t126_m", 0)   # m (mâu thuẫn địa chỉ ở bước 0) cũng đủ điều kiện hỏi lại; qua đường tên nhưng 0 đánh giá -> few_reviews
if len(x.queries(calls2)) != 4 or t.n_kind(calls2, "media") != 2 or t.n_kind(calls2, "details", "share", "geocode", "maps"):
    bad.append("recheck mong đúng 4 Text Search (m, o, p, q), 2 media (chỉ p), 0 Details; thấy %d, %d, %d" % (len(x.queries(calls2)), t.n_kind(calls2, "media"), t.n_kind(calls2, "details")))
# few_reviews là kết cục cuối của lần hỏi: lần recheck thứ hai KHÔNG hỏi lại o và q
rc3, out3, calls3 = root.run(h.recheck_argv([{"cat": c} for c in files]), FX)
if x.queries(calls3):
    bad.append("recheck lần 2 hỏi lại %d vendor (mong 0: o, q đã có kết cục few_reviews; p đã nhận)" % len(x.queries(calls3)))
t.done(bad, "ứng viên < 2 đánh giá không được nhận ở mọi category và cả hai đường (sáu cổng, tên); đúng ngưỡng 2 nhận; few_reviews không gỡ, không tốn ảnh, không che mã từ chối cũ; duyệt tay thắng; hỏi lại không lặp")
