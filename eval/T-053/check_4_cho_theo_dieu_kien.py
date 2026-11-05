#!/usr/bin/env python3
"""T-053 tiêu chí 4: check 9 và check 10 của T-051 không còn chờ cố định (waitForTimeout), vòng thăm dò vite không còn nghỉ cố định 500ms/lần mà không kiểm nonce.
Vì sao kiểm tĩnh: chờ cố định chỉ đỏ khi máy chậm, không dựng được ổn định trong một lần chạy; tập lệnh này chỉ cấm đúng mẫu đã gây flake. In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import sys, os, re
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import h
bad = []
for name, f in (("C9", h.C9), ("C10", h.C10)):
    s = open(f, encoding="utf-8").read()
    n = len(re.findall(r"waitForTimeout\(", s))
    if n: bad.append(f"{name} còn {n} chỗ waitForTimeout")
    if "nonce" not in s.lower() and "vite_dev" not in s: bad.append(f"{name} chưa dùng thăm dò nonce/helper dùng chung")
if bad: print("FAIL " + "; ".join(bad)); sys.exit(1)
print("PASS không còn waitForTimeout; có thăm dò nonce")
