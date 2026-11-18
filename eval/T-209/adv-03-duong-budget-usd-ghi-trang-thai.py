#!/usr/bin/env python3
"""T-209 adv-03 (tầng 3, offline, Google giả): đường enrich `--budget-usd` (enrichment/batch.py) cũng ghi business_status + checked_at
(spec T-207 Hành vi 5: "Lần enrich (đường thường và --budget-usd) ghi ..."; spec ghi chú check_6 chỉ phủ đường thường, adversary thêm eval cho đường này).
Ba vendor giống check_6: m nhận (OPERATIONAL), c ứng viên bị từ chối (OPERATIONAL), t CLOSED_TEMPORARILY. Sau `build_enrich_report.py`, mỗi dòng có
google.business_status đúng trạng thái Google và google.checked_at dạng YYYY-MM-DDTHH:MM:SSZ trong 15 phút gần đây; rồi resolve mục nhận ứng viên c
dùng báo cáo đó: 0 request Google, resolved_from=enrich_report."""
import json, os, sys
from datetime import datetime, timezone
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(HQ, "eval", "T-207"))
import _t207 as k

A = "12 Nguyễn Huệ, Bến Nghé, Quận 1, Thành phố Hồ Chí Minh"
vs = [k.t.vendor("m", "Nhà hàng Hoa Sen Vàng", A), k.t.vendor("c", "Cơ sở tiệc Ánh Dương", "77 Trần Hưng Đạo, Quận 5, Thành phố Hồ Chí Minh"),
      k.t.vendor("t", "Nhà hàng Cẩm Tú Cầu", "3 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh")]
r = k.t.Root({"venue": vs})
PL = {"P_M": k.t.place("Nhà hàng Hoa Sen Vàng", "12 Nguyễn Huệ, Bến Nghé, Quận 1, Hồ Chí Minh", pid="P_M"),
      "P_C": k.t.place("Quán nhậu Bình Dân", "1 Hai Bà Trưng, Quận 3, Hồ Chí Minh", pid="P_C"),
      "P_T": k.t.place("Nhà hàng Cẩm Tú Cầu", "3 Lê Lợi, Bến Nghé, Quận 1, Hồ Chí Minh", status="CLOSED_TEMPORARILY", pid="P_T")}
FX = k.t.fixture(PL, [("Hoa Sen Vàng", ["P_M"]), ("Ánh Dương", ["P_C"]), ("Cẩm Tú Cầu", ["P_T"])])
month = datetime.now(timezone.utc).strftime("%Y-%m")
os.makedirs(os.path.join(r.path, "run-logs"), exist_ok=True)
rc, out, calls = r.run(["enrich.py", "--state", "HCMC", "--category", "venue", "--budget-usd", "5", "--max-photos", "1",
                        "--usage-root", "run-logs", "--month", month], FX)
bad = []
if not calls:
    k.fail("đường --budget-usd không chạy được trong bản sao (exit %d): %s" % (rc, out[-400:]))
rep = os.path.join(r.out, "enrich-report.json")
rc2, o2, _ = r.run(["build_enrich_report.py", "--state", "HCMC", "--output-dir", "output", "--out", rep], k.t.fixture({}, deny=True))
if rc2 != 0:
    k.fail("build_enrich_report.py exit %d: %s" % (rc2, o2[-200:]))
rows = {x["id"]: x for x in json.load(open(rep, encoding="utf-8"))["vendors"]}
now = datetime.now(timezone.utc)
for vid, st in (("m", "OPERATIONAL"), ("c", "OPERATIONAL"), ("t", "CLOSED_TEMPORARILY")):
    g = (rows.get(vid) or {}).get("google")
    if not g:
        bad.append("%s: báo cáo không có google (group=%r); enrich: %s" % (vid, (rows.get(vid) or {}).get("group"), out[-200:])); continue
    if g.get("business_status") != st:
        bad.append("%s: google.business_status=%r, kỳ vọng %r (đường --budget-usd)" % (vid, g.get("business_status"), st))
    try:
        age = (now - datetime.strptime(g.get("checked_at") or "", "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)).total_seconds()
        if not (-60 <= age <= 900):
            bad.append("%s: checked_at=%r không trong 15 phút gần đây" % (vid, g.get("checked_at")))
    except ValueError:
        bad.append("%s: checked_at=%r sai dạng" % (vid, g.get("checked_at")))
if not bad:
    r.set_overrides([k.acc("c", "P_C")])
    rc, out, calls = r.run(k.t.RESOLVE, k.t.fixture({}, deny=True))
    rs = (k.by_vid(r).get("c") or {}).get("resolved") or {}
    if calls or rs.get("resolved_from") != "enrich_report" or rs.get("business_status") != "OPERATIONAL":
        bad.append("resolve từ báo cáo của đường --budget-usd: %d request, resolved=%r" % (len(calls), rs))
k.done(bad, "đường --budget-usd ghi business_status + checked_at; báo cáo mang đủ; resolve dùng được, 0 Google")
