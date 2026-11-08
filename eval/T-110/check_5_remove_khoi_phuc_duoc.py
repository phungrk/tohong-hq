#!/usr/bin/env python3
"""T-110 tiêu chí 5: `remove` lưu vào removed_vendors.json kèm lý do và KHÔI PHỤC được. OFFLINE (Google giả).
Spec: products/T-110-duyet-tay-venue.md, "Bốn hành động" (remove) và "Khôi phục".
Vendor X1 nằm ở HAI category file (venue và honeymoon), X2 chỉ ở venue, X3 vendor khác (đối chứng). Có dòng audit no_match cho X1 (đã từng thử).
Bước 1: enrich venue với mục remove cho X1. X1 biến mất khỏi vendors.json của CẢ HAI category; mỗi category file có removed_vendors.json chứa đúng một bản ghi của X1:
  manual=true, reason bắt đầu 'manual_override: remove' và chứa lý do của Capu, removed_at, vendor = bản ghi nguyên vẹn trước khi gỡ (bằng nhau từng trường).
  X2, X3 không đổi. Không có lượt Text Search nào cho X1. Chạy lại: không gỡ thêm, removed_vendors.json không thêm bản ghi.
Bước 2: khôi phục khi mục remove còn trong file: `enrich.py --state HCMC --restore t110_X1` thoát khác 0, in 'RESTORE_ERROR t110_X1 still_overridden', không file nào đổi.
  `--restore` id không có trong removed_vendors.json: 'RESTORE_ERROR <id> not_removed'.
Bước 3: Capu xoá mục remove khỏi file, chạy --restore: thoát 0, in 'RESTORED t110_X1', X1 trở lại vendors.json của cả hai category với bản ghi bằng bản ghi gốc, bản ghi
  rời khỏi removed_vendors.json (cả hai), chạy lại --restore: not_removed. Sau đó enrich không gỡ lại và không tìm lại X1 (có dòng audit).
Bước 4: accept_place cho vendor đang nằm trong removed_vendors.json (gỡ bởi luật tự động): khôi phục rồi nhận khớp, không báo unknown_vendor.
Không gọi Google ở bất kỳ bước nào của restore. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import copy, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t110 as t

bad = []
x1v = t.vendor("t110_X1", "Nhà hàng Tự Do Test", "275A Phạm Ngũ Lão, Quận 1, Thành phố Hồ Chí Minh", ("venue", "honeymoon"))
x1v["flags"] = ["insufficient_reviews"]
x2 = t.vendor("t110_X2", "Nhà hàng Hai", "2 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh")
x3 = t.vendor("t110_X3", "Nhà hàng Ba", "3 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh")
orig = copy.deepcopy(x1v)
r = t.Root({"venue": [x1v, x2, x3], "honeymoon": [copy.deepcopy(x1v)]})
AU = [{"vendor_id": v["id"], "status": "no_match", "matched_name": "", "confidence": 0.0, "place_id": None, "formatted_address": "", "address_match": None} for v in (x1v, x2, x3)]
r.write("venue/enrichment-audit.json", AU)
LY = "Capu: không có trên Google Maps nên loại khỏi danh sách"
r.set_overrides([t.entry("t110_X1", "remove", reason=LY)])
FX = t.fixture({}, [])
rc, out, calls = r.run(t.ENRICH, FX)
if any("t110_X1" == v["id"] for cat in ("venue", "honeymoon") for v in r.vendors(cat)):
    bad.append("bước 1: X1 còn trong vendors.json")
for cat in ("venue", "honeymoon"):
    rec = [x for x in r.removed(cat) if (x.get("vendor") or {}).get("id") == "t110_X1"]
    if len(rec) != 1:
        bad.append("bước 1: %s/removed_vendors.json có %d bản ghi X1 (mong 1)" % (cat, len(rec))); continue
    x = rec[0]
    if x.get("manual") is not True or not str(x.get("reason", "")).startswith("manual_override: remove") or LY not in str(x.get("reason")) or not x.get("removed_at"):
        bad.append("bước 1: %s bản ghi remove thiếu manual=true / reason 'manual_override: remove … <lý do Capu>' / removed_at: %r" % (cat, {k: x.get(k) for k in ("manual", "reason", "removed_at")}))
    if x.get("vendor") != orig:
        bad.append("bước 1: %s bản ghi lưu khác bản ghi gốc (khôi phục không nguyên vẹn)" % cat)
if [v["id"] for v in r.vendors("venue")] != ["t110_X2", "t110_X3"]:
    bad.append("bước 1: venue còn %r (mong X2, X3 không đổi)" % [v["id"] for v in r.vendors("venue")])
if any("Tự Do" in x["q"] for x in calls):
    bad.append("bước 1: Text Search cho vendor bị Capu loại")
snap = r.tree()
rc, out, calls = r.run(t.ENRICH, FX)
if r.tree() != snap:
    bad.append("chạy lại sau remove đổi file (thêm bản ghi removed hay audit)")

# ---- Bước 2 -----------------------------------------------------------------------------------------------------------------------------------------
rc, out, calls = r.run(t.ENRICH[:3] + ["--restore", "t110_X1"], FX)
if rc == 0 or not any(l.startswith("RESTORE_ERROR t110_X1 still_overridden") for l in out.splitlines()) or r.tree() != snap or calls:
    bad.append("bước 2: restore khi mục remove còn: mong rc≠0 + 'RESTORE_ERROR t110_X1 still_overridden', không file đổi, không gọi Google; thấy rc=%r" % rc)
rc, out, calls = r.run(t.ENRICH[:3] + ["--restore", "t110_khong_co"], FX)
if rc == 0 or not any(l.startswith("RESTORE_ERROR t110_khong_co not_removed") for l in out.splitlines()):
    bad.append("bước 2: restore id lạ: mong rc≠0 + 'RESTORE_ERROR t110_khong_co not_removed'")

# ---- Bước 3 -----------------------------------------------------------------------------------------------------------------------------------------
r.set_overrides([])
rc, out, calls = r.run(t.ENRICH[:3] + ["--restore", "t110_X1"], FX)
if rc != 0 or not any(l.startswith("RESTORED t110_X1") for l in out.splitlines()) or calls:
    bad.append("bước 3: restore: mong rc=0 + 'RESTORED t110_X1', 0 lượt Google; thấy rc=%r calls=%d" % (rc, len(calls)))
for cat in ("venue", "honeymoon"):
    got = r.vendor("t110_X1", cat)
    if got != orig:
        bad.append("bước 3: %s X1 sau khôi phục khác bản ghi gốc" % cat)
    if any((x.get("vendor") or {}).get("id") == "t110_X1" for x in r.removed(cat)):
        bad.append("bước 3: %s bản ghi X1 còn trong removed_vendors.json sau khôi phục" % cat)
rc, out, calls = r.run(t.ENRICH[:3] + ["--restore", "t110_X1"], FX)
if rc == 0 or "not_removed" not in out:
    bad.append("bước 3: restore lần hai mong rc≠0 + not_removed")
snap = r.tree()
rc, out, calls = r.run(t.ENRICH, FX)
if r.vendor("t110_X1") is None or any(x["kind"] == "search" for x in calls) or r.tree() != snap:
    bad.append("bước 3: sau khôi phục enrich gỡ lại hoặc tìm lại X1 (có dòng audit) hoặc đổi file")
# ---- Bước 4: accept_place cho vendor đang nằm trong removed_vendors.json (bị luật tự động gỡ, kiểu T-111): khôi phục rồi nhận --------------------------
x4 = t.vendor("t110_X4", "Nhà hàng Bốn", "4 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh")
p4 = {"PX4": t.place("Nhà hàng Bốn", "4 Lê Lợi, Bến Thành, Hồ Chí Minh")}
r4 = t.Root({"venue": [t.vendor("t110_X5", "Nhà hàng Năm", "5 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh")], "honeymoon": []})
r4.write("venue/removed_vendors.json", [{"removed_at": "2026-11-08T04:04:01Z", "reason": "T-111: no_match sau hai lần thử", "vendor": x4}])
r4.set_overrides([t.accept_with_snapshot("t110_X4", "PX4", p4["PX4"])])
rc, out, calls = r4.run(t.ENRICH, t.fixture(p4, []))
if "unknown_vendor" in out or not t.has_pid(r4.vendor("t110_X4")) or any((x.get("vendor") or {}).get("id") == "t110_X4" for x in r4.removed()):
    bad.append("bước 4: accept_place cho vendor đang trong removed_vendors.json phải khôi phục rồi nhận (có place_id, rời removed); thấy pid=%r" % t.pid_of(r4.vendor("t110_X4")))
t.done(bad, "remove gỡ ở mọi category, lưu nguyên bản ghi + lý do + manual, chạy lại không đổi; --restore bị chặn khi mục còn, khôi phục nguyên vẹn khi Capu đã xoá mục")
