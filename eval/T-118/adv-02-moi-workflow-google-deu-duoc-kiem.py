#!/usr/bin/env python3
"""T-118 adv-02 (tầng 3): không workflow gọi Google nào lọt khỏi tầm kiểm của check.py / adv-01.
Quét workflow của các repo sản phẩm (tohong, tohong-back, tohong-front cạnh tohong-hq; tohong lấy từ $TOHONG_REPO nếu có).
Workflow nào có dấu hiệu Google trả phí (GOOGLE_MAPS_API_KEY, maps.googleapis.com, places.googleapis.com, google-places,
GOOGLE_PLACES, GOOGLE_API_KEY) thì phải: (a) nằm trong repo tohong (nơi check.py/adv-01 quét), (b) được check.py tự phát hiện
(chứa GOOGLE_MAPS_API_KEY hoặc google-places), (c) có bước 1 'Cổng: không Re-run workflow Google' ở mọi job.
Không mạng, không Google."""
import os, re, sys, yaml
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
repos = {"tohong": os.environ.get("TOHONG_REPO") or os.path.join(HQ, "..", "tohong"),
         "tohong-back": os.path.join(HQ, "..", "tohong-back"), "tohong-front": os.path.join(HQ, "..", "tohong-front")}
MARK = re.compile(r"GOOGLE_MAPS_API_KEY|maps\.googleapis\.com|places\.googleapis\.com|google-places|GOOGLE_PLACES|GOOGLE_API_KEY")
GATE = "Cổng: không Re-run workflow Google"
bad, found = [], []
for rn, r in repos.items():
    d = os.path.join(r, ".github", "workflows")
    if not os.path.isdir(d):
        continue
    for fn in sorted(os.listdir(d)):
        if not fn.endswith((".yml", ".yaml")):
            continue
        t = open(os.path.join(d, fn), encoding="utf-8").read()
        if not MARK.search(t):
            continue
        found.append(f"{rn}/{fn}")
        if rn != "tohong":
            bad.append(f"{rn}/{fn}: workflow Google ngoài repo tohong, check.py và adv-01 không quét"); continue
        if "GOOGLE_MAPS_API_KEY" not in t and "google-places" not in t:
            bad.append(f"{rn}/{fn}: check.py không tự phát hiện (thiếu GOOGLE_MAPS_API_KEY/google-places)")
        for jn, job in (yaml.safe_load(t).get("jobs") or {}).items():
            st = job.get("steps") or []
            if not st or st[0].get("name") != GATE:
                bad.append(f"{rn}/{fn}:{jn}: bước 1 không phải cổng Re-run")
if not found:
    bad.append("không thấy workflow Google nào: eval không còn kiểm gì")
print("workflow Google: " + ", ".join(found))
for b in bad:
    print("FAIL " + b)
print("PASS mọi workflow Google đều ở tohong, check.py tự phát hiện, mỗi job mở đầu bằng cổng Re-run" if not bad else "FAIL")
sys.exit(1 if bad else 0)
