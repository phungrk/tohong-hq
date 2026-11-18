#!/usr/bin/env python3
"""T-201 tiêu chí 1a: wrangler.toml có keep_vars = true (boolean true) ở cấp gốc, không nằm trong [section] nào.
Chạy: python3 -I eval/T-201/check_1_keep_vars_cap_goc.py (thêm TOHONG_BACK_REPO nếu repo ở chỗ khác). Thoát 0 = PASS, 1 = FAIL."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import load

cfg = load()
v = cfg.get("keep_vars")
if v is not True:
    print("FAIL keep_vars ở cấp gốc là %r, cần true" % (v,)); sys.exit(1)
# không được đặt nhầm trong bảng con (khi đó wrangler bỏ qua)
for k, sub in cfg.items():
    if isinstance(sub, dict) and "keep_vars" in sub:
        print("FAIL keep_vars còn nằm trong [%s]" % k); sys.exit(1)
print("PASS")
