#!/usr/bin/env python3
"""T-106 eval đối kháng 03 (adversary, Code Gate T-108): nhà hàng CLOSED_PERMANENTLY nằm ở NHIỀU category file.
Nguồn: ADR-044 (decisions/2026-11-08-adr-044-nha-hang-dong-cua-tren-google.md) mục 1: CLOSED_PERMANENTLY xử lý "giống place_id 404 của spec 005":
gỡ vendor khỏi vendors.json, không vào pool. Ca 404 (refresh_photos.run) gom theo place_id và gỡ MỌI bản ghi cùng business ở mọi file được chạy;
business đóng cửa vĩnh viễn thì không còn tồn tại ở category nào. Dữ liệu thật: 7/99 vendor venue HCMC nằm thêm ở category khác
(vd marry_40917c8745e0 ở photography + wedding_attire + venue). check_5 đọc vendors.json của MỌI category (_common.load_records): bản ghi còn sót
ở category khác + audit status=closed_permanently (luật nhận) -> check_5 đỏ "luật chấp nhận nhưng audit status='closed_permanently'".
Input: vendor "adv03" có ở output/HCMC/venue và output/HCMC/photography; chạy enrich.py như workflow (--state HCMC --category venue);
Text Search trả place cùng tên + địa chỉ, businessStatus CLOSED_PERMANENTLY.
Mong đợi: adv03 không còn trong vendors.json của bất kỳ category HCMC nào, có trong removed_vendors.json (cùng thư mục với từng file bị gỡ).
HTTP giả, KHÔNG gọi Google. Cần TOHONG_REPO."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
import _adv_harness as h

mk = lambda cat: h.vendor("adv03", "Nha hang Sen Vang", "56 Nguyễn Huệ, Quận 1", cats=("venue", "photography"))
other = h.vendor("adv03x", "Studio Khac", "1 Hai Bà Trưng, Quận 1", cats=("photography",))
root = h.make_root({"venue": [mk("venue")], "photography": [mk("photography"), other]})
places = {"Nha hang Sen Vang": [h.place("pid_adv03", "Nha hang Sen Vang", "56 Nguyễn Huệ, Phường Bến Nghé, Hồ Chí Minh", "CLOSED_PERMANENTLY")]}
rc, out, calls = h.run_enrich(root, places)
ids = h.all_ids(root)
rem = h.removed(root)
bad = []
if "adv03" in ids:
    bad.append("vendor đóng cửa vĩnh viễn còn trong vendors.json của %s" % ids["adv03"])
for cat in ("venue", "photography"):
    if (cat, "adv03") not in rem and cat not in ids.get("adv03", []):
        bad.append("%s: đã gỡ nhưng không lưu removed_vendors.json (không khôi phục được)" % cat)
if "adv03x" not in ids:
    bad.append("vendor khác ở photography bị gỡ nhầm")
if bad:
    c.fail("ADR-044 (giống 404) chỉ gỡ một nửa: " + "; ".join(bad) + " | removed=%s" % rem)
c.ok("CLOSED_PERMANENTLY gỡ ở mọi category file, lưu removed_vendors.json")
