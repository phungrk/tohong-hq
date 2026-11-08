#!/usr/bin/env python3
"""T-112 adv-06 (adversary, tầng 3). Spec T-111 v2 (products/T-111-enrich-toan-bo-vendor.md, B5, dòng "Yêu cầu có eval"): MỌI workflow trong `tohong` có dùng
GOOGLE_MAPS_API_KEY, kể cả "workflow `resolve-overrides` của T-110/T-112", dùng `concurrency.group: google-places` (cấp workflow, so khoá YAML) và
`cancel-in-progress: false` (handoffs/T-111-D2.md M3). T-111 chỉ chạm enrich-venue.yml, refresh-vendor-photos.yml, scrape-vendors.yml, nên resolve-overrides.yml
phải được T-112 đặt đúng ngay khi tạo. Input phá: resolve-overrides.yml hiện dùng group `resolve-overrides` -> có thể chạy song song với enrich-venue.yml,
hai lần chạy cùng ghi output/HCMC/venue/* và cùng tiêu vào trần $30 (ADR-049).
Cần TOHONG_REPO. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-106"))
import _common as c
try:
    import yaml
except ImportError:
    print("FAIL thiếu PyYAML để đọc workflow"); sys.exit(1)
p = os.path.join(c.tohong(), ".github", "workflows", "resolve-overrides.yml")
if not os.path.isfile(p):
    print("FAIL không có .github/workflows/resolve-overrides.yml"); sys.exit(1)
y = yaml.safe_load(open(p, encoding="utf-8"))
cc = y.get("concurrency")
grp = cc.get("group") if isinstance(cc, dict) else cc
bad = []
if grp != "google-places":
    bad.append("concurrency.group phải là 'google-places' (cấp workflow), thấy %r" % grp)
if isinstance(cc, dict) and cc.get("cancel-in-progress") not in (False, None):
    bad.append("cancel-in-progress phải là false")
if bad:
    print("FAIL " + " | ".join(bad)); sys.exit(1)
print("PASS resolve-overrides.yml dùng chung concurrency google-places, không huỷ lần đang chạy")
