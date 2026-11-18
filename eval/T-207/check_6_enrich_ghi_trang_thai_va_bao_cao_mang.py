#!/usr/bin/env python3
"""T-207 tiêu chí 6 (offline, Google giả): dữ liệu enrich MỚI mang đủ thứ resolve cần. Chạy `enrich.py --state HCMC --category venue` (đường thường) cho ba vendor rồi
`build_enrich_report.py --state HCMC --output-dir output --out ...`:
  m  đúng tên + địa chỉ, đủ đánh giá, OPERATIONAL      -> nhận (google.matched=true)
  c  tên giống ít, địa chỉ khác (bị từ chối, ứng viên)  -> google.matched=false, place_id của ứng viên
  t  đúng, nhưng Google báo CLOSED_TEMPORARILY          -> google có place_id ứng viên, group temp_closed
Mỗi dòng báo cáo có google.business_status = trạng thái Google trả (OPERATIONAL, OPERATIONAL, CLOSED_TEMPORARILY) và google.checked_at dạng YYYY-MM-DDTHH:MM:SSZ trong vòng
15 phút trước giờ chạy. Dòng KHÔNG có place_id thì không có google. Dữ liệu cũ (không có business_status): google.business_status = null và google.checked_at vẫn hợp lệ hoặc null,
KHÔNG bịa 'OPERATIONAL'. Báo cáo không mang liên hệ/địa chỉ vendor (chỉ địa chỉ Google, như hiện nay). Sinh lại hai lần cho cùng byte."""
import json, os, sys
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t207 as k

A = "12 Nguyễn Huệ, Bến Nghé, Quận 1, Thành phố Hồ Chí Minh"
vs = [k.t.vendor("m", "Nhà hàng Hoa Sen Vàng", A), k.t.vendor("c", "Cơ sở tiệc Ánh Dương", "77 Trần Hưng Đạo, Quận 5, Thành phố Hồ Chí Minh"),
      k.t.vendor("t", "Nhà hàng Cẩm Tú Cầu", "3 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh"),
      k.t.vendor("old", "Nhà hàng Dữ Liệu Cũ", "8 Pasteur, Quận 1, Thành phố Hồ Chí Minh")]
r = k.t.Root({"venue": vs})
# dữ liệu cũ: vendor `old` đã nhận từ trước, bản ghi không có business_status
VV = r.vendors()
old = [v for v in VV if v["id"] == "old"][0]
old["enrichment_log"] = [{"source": "google_maps", "timestamp": "2026-10-01T08:00:00.123456", "matched_name": "Nhà hàng Dữ Liệu Cũ", "confidence": 1.0, "place_id": "P_OLD",
                          "formatted_address": "8 Pasteur, Bến Nghé, Hồ Chí Minh", "address_match": True, "changes": {}}]
r.write("venue/vendors.json", {"vendors": VV})
PL = {"P_M": k.t.place("Nhà hàng Hoa Sen Vàng", "12 Nguyễn Huệ, Bến Nghé, Quận 1, Hồ Chí Minh", pid="P_M"),
      "P_C": k.t.place("Quán nhậu Bình Dân", "1 Hai Bà Trưng, Quận 3, Hồ Chí Minh", pid="P_C"),
      "P_T": k.t.place("Nhà hàng Cẩm Tú Cầu", "3 Lê Lợi, Bến Nghé, Quận 1, Hồ Chí Minh", status="CLOSED_TEMPORARILY", pid="P_T")}
FX = k.t.fixture(PL, [("Hoa Sen Vàng", ["P_M"]), ("Ánh Dương", ["P_C"]), ("Cẩm Tú Cầu", ["P_T"])])
rc, out, calls = r.run(k.t.ENRICH, FX)
bad = []
rep = os.path.join(r.out, "enrich-report.json")
rc, o2, _ = r.run(["build_enrich_report.py", "--state", "HCMC", "--output-dir", "output", "--out", rep], k.t.fixture({}, deny=True))
if rc != 0 or not os.path.isfile(rep):
    k.fail("build_enrich_report.py exit %d: %s" % (rc, o2[-200:]))
doc = json.load(open(rep, encoding="utf-8"))
rows = {x["id"]: x for x in doc["vendors"]}
now = datetime.now(timezone.utc)
for vid, st, matched in (("m", "OPERATIONAL", True), ("c", "OPERATIONAL", False), ("t", "CLOSED_TEMPORARILY", False)):
    g = (rows.get(vid) or {}).get("google")
    if not g:
        bad.append("%s: báo cáo không có google (group=%r)" % (vid, (rows.get(vid) or {}).get("group"))); continue
    if g.get("matched") is not matched and vid == "m":
        bad.append("m: không được nhận (matched=%r); eval cần ứng viên nhận được: %s" % (g.get("matched"), out[-200:]))
    if g.get("business_status") != st:
        bad.append("%s: google.business_status=%r, kỳ vọng %r" % (vid, g.get("business_status"), st))
    ca = g.get("checked_at")
    try:
        age = (now - datetime.strptime(ca, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)).total_seconds()
        if not (-60 <= age <= 900):
            bad.append("%s: checked_at=%r không nằm trong 15 phút gần đây" % (vid, ca))
    except (TypeError, ValueError):
        bad.append("%s: checked_at=%r sai dạng YYYY-MM-DDTHH:MM:SSZ" % (vid, ca))
g = (rows.get("old") or {}).get("google") or {}
if "business_status" not in g or g.get("business_status") is not None:
    bad.append("old: dữ liệu cũ phải cho google.business_status=null (có khoá), thấy %r" % (g.get("business_status", "<thiếu khoá>"),))
if g.get("checked_at") not in (None,) and not k.ISO_Z.match(str(g.get("checked_at"))):
    bad.append("old: checked_at=%r sai dạng" % (g.get("checked_at"),))
for vid, x in rows.items():
    if not x.get("google") and "business_status" in json.dumps(x.get("google")):
        bad.append("%s: không có place_id mà có google" % vid)
raw = open(rep, "rb").read()
rep2 = rep + ".2"
r.run(["build_enrich_report.py", "--state", "HCMC", "--output-dir", "output", "--out", rep2], k.t.fixture({}, deny=True))
if not os.path.isfile(rep2) or open(rep2, "rb").read() != raw:
    bad.append("sinh lại báo cáo không cho cùng byte")
k.done(bad, "enrich ghi trạng thái + thời điểm; báo cáo mang google.business_status/checked_at; dữ liệu cũ là null, không bịa")
