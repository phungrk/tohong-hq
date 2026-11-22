#!/usr/bin/env python3
"""T-219 tiêu chí 11 (offline): ngưỡng nhận. Mỗi ứng viên true/transport đúng 1 lượt Place Details, field mask CHÍNH XÁC {id,displayName,businessStatus,formattedAddress,types,rating,userRatingCount}
(Google giả trả 400 nếu mask có website/điện thoại/review/ảnh/vị trí). qualified = OPERATIONAL + địa chỉ TP.HCM + >= 10 đánh giá + >= 4,0 sao. Ca biên của thế giới chuẩn:
P001, P002 (9 đánh giá), P003 (3,9 sao), P004 (CLOSED_PERMANENTLY), P005 (địa chỉ Hà Nội) không đạt; P006 (đủ) đạt; P010 bị 404 ở Details -> details_status=error, không đạt.
Đạt = 31 (32 chuẩn trừ P010). rating/user_rating_count điền cho dòng details_status=ok; ứng viên không phải true/transport (false, unsure, hạng mục khác như photography): details_status rỗng, qualified=false."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t219 as k
bad = []
r, rc, out, calls, meta = k.full_run(fx_patch=lambda fx, m: fx.update(details_404=["P010"]))
dd = [c for c in calls if c["kind"] == "details"]
DET = {"id", "displayName", "businessStatus", "formattedAddress", "types", "rating", "userRatingCount"}
for c in dd:
    if set(c["mask"].replace(" ", "").split(",")) != DET:
        bad.append("Place Details mask %r không đúng tập tối thiểu" % c["mask"])
        break
ids = [re.search(r"/v1/places/([A-Za-z0-9]+)", c["url"]).group(1) for c in dd]
if len(ids) != 37 or len(set(ids)) != 37:
    bad.append("kỳ vọng 37 lượt Details cho 37 ứng viên yes, mỗi cái một lượt; thấy %d (%d khác nhau)" % (len(ids), len(set(ids))))
cand = {x["place_id"]: x for x in (r.rows("p0-out/t/private/candidates.csv") or [])}
q = {p for p, x in cand.items() if x.get("qualified", "").lower() == "true"}
exp = set(meta["qualified"]) - {"P010"}
if q != exp:
    bad.append("qualified sai: thừa %s, thiếu %s" % (sorted(q - exp)[:5], sorted(exp - q)[:5]))
for pid in ("P001", "P002", "P003", "P004", "P005"):
    if cand.get(pid, {}).get("qualified", "").lower() == "true":
        bad.append("%s phải không đạt ngưỡng" % pid)
if cand.get("P010", {}).get("details_status") != "error":
    bad.append("P010 (Details 404) phải details_status=error, thấy %r" % cand.get("P010", {}).get("details_status"))
if cand.get("P006", {}).get("details_status") != "ok" or cand.get("P006", {}).get("user_rating_count") != "26" or float(cand.get("P006", {}).get("rating") or 0) != 4.5:
    bad.append("P006 phải details_status=ok, rating 4.5, user_rating_count 26, thấy %r" % {x: cand.get("P006", {}).get(x) for x in ("details_status", "rating", "user_rating_count")})
for pid in ("P037", "P043"):
    x = cand.get(pid, {})
    if x.get("details_status") or x.get("rating") or x.get("user_rating_count") or x.get("qualified", "").lower() != "false":
        bad.append("%s (no/unsure) phải details_status/rating rỗng, qualified=false: %r" % (pid, x))
if ((k.read_report(r) or {}).get("candidates") or {}).get("qualified") != 31:
    bad.append("báo cáo candidates.qualified phải là 31")
k.done(bad, "Details mask tối thiểu, 1 lượt mỗi yes, qualified đúng ca biên (đánh giá, sao, trạng thái, tỉnh, lỗi 404)")
