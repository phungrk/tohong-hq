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
# T-066, T-068 và hai bất biến vendor-images (ADR-024): dựng vite qua helper dùng chung, không còn spawn npx vite hay cổng Math.random
for f in ("eval/T-066/check_ui.cjs", "eval/T-068/_advlib.cjs", "eval/invariants/planner/front/vendor-images/lib/vendor_img_inv.cjs", "eval/invariants/planner/front/vendor-images/lib/small_tile_tooltip.cjs"):
    s = open(os.path.join(h.HQ, f), encoding="utf-8").read()
    if "vite_dev" not in s: bad.append(f"{f} chưa dùng eval/_lib/vite_dev.cjs")
    if re.search(r"spawn\(\s*'npx'", s): bad.append(f"{f} còn spawn npx")
    if re.search(r"port\s*=\s*\d+\s*\+\s*Math\.floor\(Math\.random", s): bad.append(f"{f} còn bốc cổng ngẫu nhiên")
if bad: print("FAIL " + "; ".join(bad)); sys.exit(1)
print("PASS không còn waitForTimeout; có thăm dò nonce; T-066, T-068 và hai bất biến dùng helper")
