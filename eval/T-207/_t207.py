"""Helper dùng chung cho eval T-207. Offline: Google GIẢ (eval/T-207/_fake), chạy ĐÚNG lệnh CLI như workflow trong bản sao tools/scraper của repo `tohong`
(TOHONG_REPO; TOHONG_BACK_REPO chỉ check_7). Dựng trên eval/T-110/_t110.py (Root, entry, fixture). Mỗi eval in PASS hoặc FAIL <lý do>; thoát 0/1.
Hợp đồng dữ liệu mà eval giả định (spec products/T-207-*.md, mục Hành vi 1-2): dòng `vendors[]` của enrich-report.json có `google` = {place_id, name, address,
business_status, checked_at, ...}; `checked_at` dạng YYYY-MM-DDTHH:MM:SSZ (UTC)."""
import os, re, sys
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "T-110"))
import _t110 as t  # noqa: E402

t.FAKE = os.path.join(HERE, "_fake")
fail, done = t.fail, t.done
ISO_Z = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
ADDR = "12 Nguyễn Huệ, Bến Nghé, Quận 1, Hồ Chí Minh"


def ago(days=0.0, minutes=0.0):
    return (datetime.now(timezone.utc) - timedelta(days=days, minutes=minutes)).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def row(vid, pid, name="Nhà hàng Mẫu", address=ADDR, status="OPERATIONAL", checked_at=None, matched=False, **over):
    """Một dòng `vendors[]` tối thiểu của enrich-report.json (phần resolve được phép đọc: id + google)."""
    g = {"matched": matched, "place_id": pid, "name": name, "address": address, "business_status": status,
         "checked_at": checked_at if checked_at is not None else ago(3), "maps_url": "https://www.google.com/maps/place/?q=place_id:" + pid}
    g.update(over)
    for k in [k for k, v in g.items() if v == "__DROP__"]:
        del g[k]
    return {"id": vid, "name": "x", "category": "venue", "group": "addr_diff_accepted" if matched else "name_similar", "google": g,
            "approvable": not matched, "override": None}


def write_report(root, rows):
    root.write("enrich-report.json", {"schema_version": 1, "state": "HCMC", "data_as_of": ago(3), "summary": {"total": len(rows)}, "vendors": rows})


def acc(vid, pid=None, link=None):
    return t.entry(vid, "accept_place", place_id=pid, maps_link=link)


def by_vid(root):
    return {e["vendor_id"]: e for e in root.overrides().get("overrides", [])}


def places_calls(calls):
    return [c for c in calls if c["kind"] in ("details", "search")]


def op_place(name="Nhà hàng Mẫu", address=ADDR, status="OPERATIONAL", pid=None):
    return t.place(name, address, status=status, pid=pid)


def mk_root(vids, extra_cats=None):
    vs = [t.vendor(v, "Nhà hàng Mẫu " + v, "12 Nguyễn Huệ, Quận 1, Thành phố Hồ Chí Minh") for v in vids]
    files = {"venue": vs}
    files.update(extra_cats or {})
    return t.Root(files)
