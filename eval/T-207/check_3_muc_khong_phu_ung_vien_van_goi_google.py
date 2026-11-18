#!/usr/bin/env python3
"""T-207 tiêu chí 3 (offline): lô HỖN HỢP. Mục dán link, mục place_id mà báo cáo không biết, và mục place_id KHÁC ứng viên của vendor đó trong báo cáo
giữ nguyên hành vi hiện tại (gọi Google); mục khớp ứng viên thì không. Tổng request Google = đúng số mục không được phủ.
  C  place_id PC = ứng viên tươi trong báo cáo            -> 0 request, resolved_from=enrich_report
  L  chỉ maps_link (dạng /maps/place/<tên>/@lat,lng)     -> mở link + 1 Text Search, resolved_from=link
  D  place_id PD, báo cáo không có dòng cho vendor D      -> 1 Place Details, resolved_from=place_id
  M  place_id PM, báo cáo có ứng viên PX (khác PM)       -> 1 Place Details cho PM, resolved_from=place_id
Tổng: details=2, search=1 (kind details/search của Google giả), không request nào nhắc PC; GOOGLE_USAGE text_search=1 photo_details=2."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t207 as k

r = k.mk_root(["C", "L", "D", "M"])
LINK = "https://share.google/t207"
DEST = "https://www.google.com/maps/place/Nh%C3%A0+h%C3%A0ng+Lima+Garden/@10.7800,106.7000,17z/data=!3m1!4b1"
PL = {"PD": k.op_place("Nhà hàng Delta", pid="PD"), "PM": k.op_place("Nhà hàng Mu", pid="PM"),
      "PL": k.t.place("Nhà hàng Lima Garden", k.ADDR, lat=10.78, lng=106.70, pid="PL")}
FX = k.t.fixture(PL, [("Lima Garden", ["PL"])], {LINK: {"status": 200, "to": DEST}})
k.write_report(r, [k.row("C", "PC"), k.row("M", "PX")])
r.set_overrides([k.acc("C", "PC"), k.acc("L", link=LINK), k.acc("D", "PD"), k.acc("M", "PM")])
rc, out, calls = r.run(k.t.RESOLVE, FX)
bad = []
det, srch = k.t.n_kind(calls, "details"), k.t.n_kind(calls, "search")
if (det, srch) != (2, 1):
    bad.append("request Google details=%d search=%d, kỳ vọng details=2 search=1 (chỉ mục không được phủ)" % (det, srch))
if any("PC" in c["url"] for c in calls):
    bad.append("có request nhắc place_id PC của mục đã được phủ")
u = k.t.usage(out) or {}
if (u.get("text_search"), u.get("photo_details")) != (1, 2):
    bad.append("GOOGLE_USAGE %r, kỳ vọng text_search=1 photo_details=2" % u)
for vid, pid, frm in (("C", "PC", "enrich_report"), ("L", "PL", "link"), ("D", "PD", "place_id"), ("M", "PM", "place_id")):
    e = k.by_vid(r).get(vid, {})
    rs = e.get("resolved") or {}
    if rs.get("place_id") != pid or rs.get("resolved_from") != frm or e.get("place_id") != pid:
        bad.append("%s: place_id=%r resolved=%r, kỳ vọng %s/%s" % (vid, e.get("place_id"), rs, pid, frm))
k.done(bad, "lô hỗn hợp: chỉ mục không khớp ứng viên gọi Google (2 Place Details + 1 Text Search), mục khớp 0 request")
