#!/usr/bin/env python3
"""T-071 adv-01 (adversary, tầng 3): hai phiên chạy CÙNG một eval front cùng lúc trên cùng repo front (hai agent chạy gate song song).
Spec T-053 Ý định: không FAIL giả vì môi trường; Hành vi 2: "vite của phiên khác chạy cùng lúc trong cùng repo" là tình huống đã tính.
Mong đợi: hai lần C9 chạy song song đều PASS; hai lần C10 chạy song song đều PASS; sau đó không còn tiến trình mang dấu, không còn file __* mới.
Chạy: python3 eval/T-071/adv-01-chay-dong-thoi.py. In PASS/FAIL; mã thoát 0/1."""
import os, sys, threading
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-053", "lib"))
import h
front = h.FRONT; snap0 = h.snapshot(front); errs = []
def pair(name, script):
    res = [None, None]
    def go(i): res[i] = h.run_check(script, front)[0]
    ts = [threading.Thread(target=go, args=(i,)) for i in range(2)]
    ts[0].start(); ts[1].start(); [t.join() for t in ts]
    for i, line in enumerate(res):
        if not (line or "").startswith("PASS"): errs.append(f"{name} phiên {i+1} chạy song song đáng ra PASS, thấy: {(line or '')[:110]}")
try:
    pair("C9", h.C9); pair("C10", h.C10)
    left = h.marked(); files = h.snapshot(front) - snap0
    if left: errs.append(f"còn {len(left)} tiến trình mang dấu")
    if files: errs.append(f"để lại {sorted(files)[:3]}")
finally:
    h.kill_pids(h.marked()); h.rm_probe_files(front)
if errs: print("FAIL " + " | ".join(errs)); sys.exit(1)
print("PASS hai phiên C9 và hai phiên C10 chạy song song đều PASS, dọn sạch")
