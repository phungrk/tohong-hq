#!/usr/bin/env python3
"""T-065 tiêu chí 6: `npm test` của tohong-back xanh, và có ít nhất 3 ca kiểm thử nêu Wayback trong tên (Engineering phải thêm test cho tính năng).
Chạy: cd /home/user/tohong-hq && python3 -I eval/T-065/check_7_npm_test.py --back /home/user/tohong-back"""
import os, re, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t065 import fail, ok, need_back
back = need_back()
r = subprocess.run(["npm", "test"], cwd=back, capture_output=True, text=True, timeout=900)
if r.returncode != 0: fail("npm test đỏ (mã %s): %s" % (r.returncode, (r.stdout + r.stderr)[-300:]))
names = re.findall(r"(?m)^ok \d+ - (.*)$", r.stdout)
w = [n for n in names if "wayback" in n.lower()]
if len(w) < 3: fail("npm test xanh nhưng chỉ có %d ca kiểm thử nêu 'wayback' trong tên (cần >= 3, dùng server HTTP cục bộ, không gọi archive.org)" % len(w))
ok("npm test xanh, %d ca Wayback" % len(w))
