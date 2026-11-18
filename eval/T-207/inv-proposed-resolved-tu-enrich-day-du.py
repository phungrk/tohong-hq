#!/usr/bin/env python3
"""Bất biến ĐỀ XUẤT (vùng planner/admin/vendor-enrich) · nguồn: T-207 (Hành vi 1-2). Spec-critic rút khi spec qua cổng; đặt số sau.
INV-??? · Trong repo tohong, mọi mục accept_place của output/<state>/manual_overrides.json có resolved.resolved_from == "enrich_report" thì khối `resolved` ĐỦ và hợp lệ:
  place_id == place_id của mục; name, formatted_address không rỗng; business_status thuộc {OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY} (KHÔNG null, không bịa);
  resolved_at dạng YYYY-MM-DDTHH:MM:SSZ. Và mọi dòng enrich-report.json có google thì google.business_status là null hoặc một trong ba giá trị trên, google.checked_at là null hoặc dạng trên.
Lý do: khối resolved lấy từ báo cáo là đường duy nhất thay Google; thiếu trạng thái hoạt động thì overrides.py không kiểm được đóng cửa (INV-020 + ADR-044).
Tĩnh, không mạng. Chưa có mục nào / báo cáo chưa có khoá: PASS 'chưa áp dụng'. Repo: TOHONG_REPO hoặc ../tohong. Chạy: python3 -I <file>. Thoát 0 = đạt."""
import glob, json, os, re, sys
d = os.path.dirname(os.path.abspath(__file__))
while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    d = os.path.dirname(d)
T = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_REPO"), os.path.join(d, "..", "tohong")) if p and os.path.isfile(os.path.join(p, "tools", "scraper", "enrich.py"))), None)
if not T:
    print("FAIL không thấy repo tohong (đặt TOHONG_REPO)"); sys.exit(1)
ST = {"OPERATIONAL", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"}
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
bad, n = [], 0
for p in sorted(glob.glob(os.path.join(T, "tools", "scraper", "output", "*", "manual_overrides.json"))):
    for e in json.load(open(p, encoding="utf-8")).get("overrides", []):
        rs = e.get("resolved") or {}
        if e.get("action") == "accept_place" and rs.get("resolved_from") == "enrich_report":
            n += 1
            if rs.get("place_id") != e.get("place_id") or not rs.get("name") or not rs.get("formatted_address") or rs.get("business_status") not in ST or not ISO.match(str(rs.get("resolved_at"))):
                bad.append("%s: resolved từ báo cáo thiếu/sai (%s)" % (e.get("vendor_id"), sorted(rs)))
for p in sorted(glob.glob(os.path.join(T, "tools", "scraper", "output", "*", "enrich-report.json"))):
    for r in json.load(open(p, encoding="utf-8")).get("vendors", []):
        g = r.get("google")
        if g and "business_status" in g and (g["business_status"] not in ST and g["business_status"] is not None or (g.get("checked_at") is not None and not ISO.match(str(g.get("checked_at"))))):
            bad.append("%s: google.business_status/checked_at sai (%r, %r)" % (r.get("id"), g["business_status"], g.get("checked_at")))
if bad:
    print("FAIL %s%s" % (bad[0], " (+%d)" % (len(bad) - 1) if len(bad) > 1 else "")); sys.exit(1)
print("PASS %d mục resolved_from=enrich_report đủ và hợp lệ" % n if n else "PASS chưa áp dụng (chưa có mục resolved_from=enrich_report)"); sys.exit(0)
