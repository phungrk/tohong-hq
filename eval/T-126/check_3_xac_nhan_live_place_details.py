#!/usr/bin/env python3
"""T-126 tiêu chí 3 (xác nhận LIVE cho vendor có số đánh giá đã lưu "cũ", đường rẻ nhất): `enrich.py ... --apply-review-rule --confirm-review-count`. OFFLINE (Google giả; chạy ĐÚNG lệnh CLI).
Diện cần xác nhận = vendor có place_id Google, không có mục accept_place của Capu, dòng log google_maps "đọc cũ" (timestamp < 2026-11-08) mà số đánh giá đã lưu < 2 (hoặc không có trường rating),
chưa được xác nhận trước đó. Mỗi vendor đúng MỘT Place Details (GET /v1/places/<place_id>) với field mask CHÍNH XÁC `userRatingCount` (không Text Search, không ảnh, không field nào khác).
Số đánh giá thật < 2 (Google bỏ trường = 0) -> hạ như check_2; >= 2 -> GIỮ nguyên bản ghi, ghi audit.google_review_count = số thật, KHÔNG hỏi lại lần sau. Lỗi HTTP -> không ghi gì (lần sau hỏi lại).
Vendor đọc mới <2 đánh giá được hạ offline ở cùng lệnh (0 lượt); vendor >= 2, đọc cũ nhưng >= 2, hoặc duyệt tay: 0 lượt.
Sổ chi: mỗi lượt ghi `GOOGLE_REQUEST run=<id> kind=details_count` TRƯỚC khi gửi; dòng GOOGLE_USAGE có `details_count=<n>`; không lẫn vào bộ đếm ảnh `photo_details`.
Fixture: l1 (cũ, lưu 1; thật 1) hạ · l0 (cũ, không rating; thật 0) hạ · l4 (cũ, lưu 1; thật 4) giữ + google_review_count=4 · le (cũ, không rating; HTTP 500) nguyên, lần 2 hỏi lại (thật 0) hạ ·
l7 (cũ, lưu 7) 0 lượt · lm (cũ, duyệt tay) 0 lượt · f1 (mới, lưu 1) hạ offline 0 lượt. Mong: lần 1 đúng 4 Place Details, lần 2 đúng 1, lần 3 đúng 0; 0 Text Search, 0 ảnh. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import copy, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t126 as k
h, x, t = k.h, k.x, k.t
bad = []
A = k.ADDR
spec = [("l1", "Live One Photo", "Pl1", k.OLD_TS, 1, 1), ("l0", "Live Zero Photo", "Pl0", k.OLD_TS, None, 0), ("l4", "Live Four Photo", "Pl4", k.OLD_TS, 1, 4),
        ("le", "Live Error Photo", "Ple", k.OLD_TS, None, 0), ("l7", "Live Seven Photo", "Pl7", k.OLD_TS, 7, 7), ("lm", "Live Manual Photo", "Plm", k.OLD_TS, None, 0),
        ("f1", "Fresh One Photo", "Pf1", k.NEW_TS, 1, 1)]
files = {"photography": []}
PL = {}
for i, (vid, name, pid, ts, stored, live) in enumerate(spec):
    files["photography"].append(k.matched("t126_" + vid, name, A % (40 + i), "photography", pid, ts, stored, manual=(vid == "lm")))
    PL[pid] = k.pl(name, A % (40 + i), pid, n=live, details_status=(500 if vid == "le" else None))
root = k.seed(files)
root.set_overrides([t.entry("t126_lm", "accept_place", place_id="Plm", resolved=t.resolved("Plm", PL["Plm"]), reason="Capu duyệt tay (fixture eval T-126)")])
before = {v["id"]: copy.deepcopy(v) for v in files["photography"]}
FX = x.fx(PL, [])
argv = x.enrich_all(["photography"], extra=[k.APPLY, k.CONFIRM])
rc, out, calls = root.run(argv, FX)
if rc != 0:
    t.fail("enrich %s %s thoát %d: %s" % (k.APPLY, k.CONFIRM, rc, (out.strip().splitlines() or [""])[-1][:160]))
det = [c for c in calls if c["kind"] == "details"]
if len(calls) != 4 or len(det) != 4:
    bad.append("lần 1 mong đúng 4 lượt Google, cả 4 là Place Details; thấy %d lượt: %r" % (len(calls), sorted({c["kind"] for c in calls})))
if sorted(c["url"].split("/v1/places/")[-1].split("?")[0] for c in det) != ["Pl0", "Pl1", "Pl4", "Ple"]:
    bad.append("lần 1 mong hỏi đúng Pl0, Pl1, Pl4, Ple (không hỏi Pl7, Plm, Pf1), thấy %r" % sorted(c["url"].split("/v1/places/")[-1] for c in det))
if k.mask_of(calls, "details") != ["userRatingCount"] and k.mask_of(calls, "details") != ["places.userRatingCount"]:
    bad.append("field mask của Place Details mong CHÍNH XÁC `userRatingCount` (SKU Enterprise, $20/1000), thấy %r" % k.mask_of(calls, "details"))
if x.n_requests(out, "details_count") != 4 or x.n_requests(out, "details") or x.n_requests(out, "search") or x.n_requests(out, "media"):
    bad.append("sổ GOOGLE_REQUEST mong 4 dòng kind=details_count và 0 search/media/details(ảnh); thấy details_count=%d details=%d search=%d media=%d" % (
        x.n_requests(out, "details_count"), x.n_requests(out, "details"), x.n_requests(out, "search"), x.n_requests(out, "media")))
us = [d for d in x.kv(out, "GOOGLE_USAGE")]
if not us or us[-1].get("details_count") != "4" or us[-1].get("photo_details", "0") != "0":
    bad.append("GOOGLE_USAGE mong details_count=4 và photo_details=0 (không lẫn bộ đếm ảnh), thấy %r" % (us[-1:] or None))
for vid, n in (("l1", 1), ("l0", 0), ("f1", 1)):
    bad += k.demoted_state_ok(root, "t126_" + vid, n)
bad += k.kept_state_ok(root, "t126_l4", "Pl4")
a4 = root.audit("photography").get("t126_l4") or {}
if a4.get("google_review_count") != 4 or a4.get("reject_reason"):
    bad.append("l4 (thật 4 đánh giá): mong giữ + audit.google_review_count=4, thấy %r" % {x_: a4.get(x_) for x_ in ("google_review_count", "reject_reason")})
for vid in ("le", "l7", "lm"):
    if root.vendor("t126_" + vid, "photography") != before["t126_" + vid]:
        bad.append("%s: không được đổi bản ghi ở lần 1 (lỗi HTTP / >=2 / duyệt tay)" % vid)
if "google_review_count" in (root.audit("photography").get("t126_le") or {}):
    bad.append("le (HTTP 500): không được ghi dấu đã xác nhận (lần sau phải hỏi lại)")
PL2 = copy.deepcopy(PL)
PL2["Ple"].pop("details_status")
rc2, out2, calls2 = root.run(argv, x.fx(PL2, []))
if rc2 != 0 or [c["url"].split("/v1/places/")[-1] for c in calls2] != ["Ple"] or len(calls2) != 1:
    bad.append("lần 2 mong đúng 1 Place Details (Ple, lỗi lần trước), thấy %d lượt %r" % (len(calls2), [c["url"][-12:] for c in calls2]))
bad += k.demoted_state_ok(root, "t126_le", 0)
tree = root.tree()
rc3, out3, calls3 = root.run(argv, x.fx(PL2, []))
if rc3 != 0 or calls3 or root.tree() != tree:
    bad.append("lần 3 mong 0 lượt và không đổi file (l4 đã xác nhận không hỏi lại), thấy %d lượt, file đổi=%s" % (len(calls3), root.tree() != tree))
t.done(bad, "xác nhận live: 1 Place Details/vendor đọc cũ <2 (mask userRatingCount, kind=details_count), hạ khi thật <2, giữ + ghi số thật khi >=2, lỗi thì hỏi lại, đã xác nhận không hỏi lại, duyệt tay và >=2 0 lượt")
