#!/usr/bin/env python3
"""T-053 tiêu chí 1: khi một "vite lạ" chiếm cả dải cổng cũ (5100-8999, gồm 7000-8999, trả 200 cho mọi đường dẫn), chạy check 9 và check 10 của T-051 năm lần liên tiếp -> 0 lần FAIL giả.
FAIL giả = check in FAIL trong khi mã front đúng (baseline: cả hai PASS trên front hiện tại, xem check_3). Chạy: python3 check_1_khong_fail_gia.py [--front DIR]  (~5-10 phút)
In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import h
front = sys.argv[sys.argv.index("--front") + 1] if "--front" in sys.argv else h.FRONT
bad = []
try:
    with h.Decoy() as d:
        if d.n < 3000: print(f"FAIL decoy chỉ chiếm được {d.n} cổng (máy bận cổng?), không đủ để thử"); sys.exit(1)
        for i in range(1, 6):
            for name, s in (("C9", h.C9), ("C10", h.C10)):
                line, rc = h.run_check(s, front)
                if not line.startswith("PASS"): bad.append(f"lần {i} {name}: {line[:110]}")
finally:
    h.kill_pids(h.marked()); h.rm_probe_files(front)
if bad: print(f"FAIL {len(bad)}/10 lần chạy ra FAIL giả; đầu tiên: {bad[0]}"); sys.exit(1)
print("PASS 10/10 lần chạy (5 x C9, C10) PASS khi vite lạ chiếm dải cổng")
