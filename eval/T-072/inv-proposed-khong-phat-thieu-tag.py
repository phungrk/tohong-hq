#!/usr/bin/env python3
"""Nguồn: T-072 (spec products/T-072-hop-dong-style-chung.md), đề xuất cho eval/invariants/planner/vendor/matching/.
Bất biến: hai vendor chỉ khác tag style (lệch so với không tag) luôn cùng tổng điểm ở cả JS và Python; vendor khớp luôn cao hơn.
Chạy lại check_2 của T-072 (cần eval/T-072/lib). Mã thoát 0 = đạt."""
import os, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
p = subprocess.run(["python3", "-I", os.path.join(here, "check_2_khong_phat_thieu_tag.py")], capture_output=True, text=True)
print((p.stdout or p.stderr).strip()); sys.exit(p.returncode)
