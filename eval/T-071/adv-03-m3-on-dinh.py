#!/usr/bin/env python3
"""T-071 adv-03 (adversary, tầng 3): độ ổn định của đột biến M3 (front ghi đè localStorage vendor đã lưu) qua nhiều lần chạy, có và không có tải CPU.
Spec T-053 Hành vi 3 / tiêu chí 3: C10 phải FAIL đúng lý do 'localStorage' trên M3 — mỗi lần, không chỉ đa số lần (check_3 từng báo M3 PASS một lần ở gate trước).
Mong đợi: 4 lần không tải + 4 lần khi mọi lõi CPU bận, C10 trên bản sao M3 đều FAIL và output có 'localStorage'.
Đột biến M3 lấy nguyên từ eval/T-053/check_3 (không tự chế). Bản sao trong $EVAL_TMPDIR, tự dọn. In PASS/FAIL; mã thoát 0/1."""
import os, sys, shutil, subprocess, importlib.util
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "T-053", "lib"))
import h
N = int(os.environ.get("ADV03_N", "4"))
src = open(os.path.join(HERE, "..", "T-053", "check_3_ket_qua_khong_doi.py"), encoding="utf-8").read()
L = src.splitlines(); i = next(n for n, l in enumerate(L) if l.startswith("def sub_("))
ns = {"re": __import__("re"), "os": os}
exec("\n".join(L[i:i + 4] + [next(l for l in L if l.startswith("def m3("))]), ns)   # sub_ + m3 nguyên văn từ check_3
tmp = h.scratch(); errs = []; burn = []
try:
    dst = os.path.join(tmp, "front-m3"); h.front_copy(dst, ns["m3"])
    for phase in ("không tải", "tải CPU"):
        if phase == "tải CPU":
            burn = [subprocess.Popen([sys.executable, "-c", "while True: pass"], env=h.env()) for _ in range(os.cpu_count() or 2)]
        for i in range(N):
            line, _ = h.run_check(h.C10, dst)
            if not line.startswith("FAIL"): errs.append(f"{phase} lần {i+1}: C10 trên M3 đáng ra FAIL, thấy {line[:90]}")
            elif "localStorage" not in h.LAST_OUT: errs.append(f"{phase} lần {i+1}: FAIL sai lý do {line[:90]}")
        for b in burn: b.kill(); b.wait()
        burn = []
finally:
    for b in burn: b.kill()
    h.kill_pids(h.marked()); shutil.rmtree(tmp, ignore_errors=True)
if errs: print("FAIL " + " | ".join(errs)); sys.exit(1)
print(f"PASS M3: C10 FAIL đúng lý do localStorage {2*N}/{2*N} lần ({N} không tải, {N} tải CPU)")
