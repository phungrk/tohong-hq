#!/usr/bin/env python3
"""T-112 adv-01 (adversary, tầng 3). Spec T-110 Hành vi 5: "GOOGLE_USAGE ... (dòng cuối stdout của MỖI CLI chạy thật)"; Hành vi 9: workflow tee
`resolve_overrides.py --probe` vào run-logs/T-110/<ngày>-probe.log; check_7 đòi MỌI log trong run-logs/T-110 có dòng GOOGLE_USAGE.
Input phá: chạy `resolve_overrides.py --state HCMC --probe` (đúng bước workflow) với 1 mục accept_place có link. Mong đợi: thoát 0, dòng cuối stdout
là `GOOGLE_USAGE text_search=0 photo_details=0 photo_media=0` (probe không gọi Places). Hiện tại probe không in dòng này nên check_7 sẽ ĐỎ cả sau lần chạy thật.
OFFLINE (Google giả eval/T-110/_fake). In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-110"))
import _t110 as t

M = "https://www.google.com/maps/place/Nh%C3%A0+h%C3%A0ng+Probe/@10.78,106.70,17z"
LINK = "https://share.google/advprobe01"
r = t.Root({"venue": [t.vendor("t112_p", "Nhà hàng Probe", "1 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh")], "honeymoon": []})
r.set_overrides([t.entry("t112_p", "accept_place", maps_link=LINK)])
rc, out, calls = r.run(t.RESOLVE + ["--probe"], t.fixture({}, [], {LINK: {"status": 200, "to": M}}))
bad = []
lines = [l for l in out.splitlines() if l.strip()]
if rc != 0:
    bad.append("--probe thoát %r" % rc)
if t.n_kind(calls, "search", "details", "media"):
    bad.append("--probe gọi Places")
if not lines or not lines[-1].startswith("GOOGLE_USAGE"):
    bad.append("dòng cuối stdout của --probe không phải GOOGLE_USAGE (check_7 đòi mọi log run-logs/T-110 có dòng này); thấy %r" % (lines[-1][:100] if lines else ""))
else:
    u = t.usage(out)
    if u != {"text_search": 0, "photo_details": 0, "photo_media": 0}:
        bad.append("GOOGLE_USAGE của --probe phải bằng 0 lượt Places; thấy %r" % u)
t.done(bad, "--probe kết thúc bằng GOOGLE_USAGE 0/0/0, log probe đạt check_7")
