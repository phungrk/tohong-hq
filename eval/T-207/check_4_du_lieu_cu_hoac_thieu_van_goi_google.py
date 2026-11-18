#!/usr/bin/env python3
"""T-207 tiêu chí 4 (offline): ngưỡng cũ = 30 ngày. Dữ liệu của ứng viên trong báo cáo chỉ được dùng thay Google khi ĐỦ MỌI điều kiện:
place_id khớp; business_status là chuỗi không rỗng; google.name và google.address không rỗng; checked_at đúng dạng YYYY-MM-DDTHH:MM:SSZ và cách hiện tại <= 30 ngày.
Thiếu/cũ bất kỳ điều kiện nào thì mục đó gọi Google như hiện tại (1 Place Details, resolved_from=place_id, resolved_at là lúc resolve chứ không phải checked_at cũ).
  F29  checked_at 29 ngày trước                      -> 0 request, enrich_report
  S31  checked_at 31 ngày trước                      -> 1 Place Details
  NBS  không có business_status (dữ liệu enrich cũ)  -> 1 Place Details
  NTS  không có checked_at                           -> 1 Place Details
  BTS  checked_at "hôm qua" (sai dạng)               -> 1 Place Details
  NAD  address rỗng                                  -> 1 Place Details
  NNM  name rỗng                                     -> 1 Place Details
Tổng request = 6 Place Details, 0 Text Search."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t207 as k

V = ["F29", "S31", "NBS", "NTS", "BTS", "NAD", "NNM"]
r = k.mk_root(V)
rows = [k.row("F29", "P_F29", checked_at=k.ago(29)), k.row("S31", "P_S31", checked_at=k.ago(31)),
        k.row("NBS", "P_NBS", business_status="__DROP__"), k.row("NTS", "P_NTS", checked_at="__DROP__"),
        k.row("BTS", "P_BTS", checked_at="hôm qua"), k.row("NAD", "P_NAD", address=""), k.row("NNM", "P_NNM", name="")]
for x in rows:  # row() đặt checked_at mặc định khi None; "__DROP__" được dọn trong row()
    pass
k.write_report(r, rows)
r.set_overrides([k.acc(v, "P_" + v) for v in V])
FX = k.t.fixture({"P_" + v: k.op_place("Nhà hàng " + v, pid="P_" + v) for v in V})
rc, out, calls = r.run(k.t.RESOLVE, FX)
bad = []
dets = [c["url"] for c in calls if c["kind"] == "details"]
want = {"P_" + v for v in V if v != "F29"}
got = {u.split("/v1/places/")[1].split("?")[0] for u in dets}
if got != want or len(dets) != 6 or k.t.n_kind(calls, "search") or len(calls) != 6:
    bad.append("request Google %r (tổng %d), kỳ vọng đúng 6 Place Details cho %s" % (sorted(got), len(calls), sorted(want)))
for v in V:
    rs = k.by_vid(r).get(v, {}).get("resolved") or {}
    frm = "enrich_report" if v == "F29" else "place_id"
    if rs.get("resolved_from") != frm:
        bad.append("%s: resolved_from=%r, kỳ vọng %s" % (v, rs.get("resolved_from"), frm))
    if v != "F29" and rs.get("resolved_at", "")[:10] != k.ago(0)[:10]:
        bad.append("%s: resolved_at=%r không phải thời điểm resolve" % (v, rs.get("resolved_at")))
k.done(bad, "ngưỡng 30 ngày và thiếu trường: 29 ngày dùng báo cáo, 31 ngày/thiếu/sai dạng gọi Google")
