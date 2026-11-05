#!/usr/bin/env python3
"""T-058 tiêu chí 8: README công cụ mô tả dòng PROGRESS, stopped=early và mã thoát 4 (mục 12 của spec).
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-058/check_8_readme.py --back /home/user/tohong-back"""
import os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t058 import fail, ok, parse_args
back = parse_args().get("back") or fail("cần --back <tohong-back>")
t = open(os.path.join(back, "scripts", "vendor-images", "README.md"), encoding="utf-8").read()
secs = re.split(r"(?m)^(?=## )", t)
sec = next((s for s in secs if s.startswith("## ") and "tiến độ" in s.splitlines()[0].lower()), None)
if not sec: fail("README thiếu mục '## … tiến độ …'")
need = [(r"(?m)^PROGRESS done=\S+ total=\S+ ok=\S+ failed=\S+ \(.*\)\s*$", "ví dụ dòng PROGRESS đúng khuôn"), (r"100", "nhịp 100 ảnh"), (r"\b50\b", "ngưỡng 50 ảnh"),
        (r"stopped=early", "stopped=early"), (r"mã (thoát )?4|exit 4|mã 4", "mã thoát 4"), (r"không (ghi|đổi) manifest", "không ghi manifest"), (r"không deploy", "không deploy"),
        (r"Đường dự phòng", "trỏ tới mục Đường dự phòng")]
for rx, what in need:
    if not re.search(rx, sec): fail("mục tiến độ thiếu: " + what)
if not re.search(r"(?m)^## Đường dự phòng", t): fail("mục 'Đường dự phòng' bị mất")
rules = t[t.index("## Quy tắc công cụ"):]
if not re.search(r"mã 4", rules): fail("'Quy tắc công cụ' chưa nhắc mã 4")
ok("README có mục tiến độ và mã 4")
