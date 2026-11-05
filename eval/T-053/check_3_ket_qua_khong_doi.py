#!/usr/bin/env python3
"""T-053 tiêu chí 3: PASS/FAIL trên code T-052 không đổi. (a) Trên front hiện tại (đã gồm T-052) check 9 và 10 vẫn PASS (baseline đo 2026-11-05: cả hai PASS, xem baseline.txt).
(b) Không nới ngưỡng: trên bản sao front bị phá có chủ đích (mọi ảnh coi là tốt, nên ảnh hỏng không còn ra ảnh mặc định) check 9 và 10 vẫn FAIL.
Bản sao nằm trong $EVAL_TMPDIR (nên đặt vào scratchpad), tự dọn. Chạy: python3 check_3_ket_qua_khong_doi.py [--front DIR]. In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import sys, os, shutil, re
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import h
front = sys.argv[sys.argv.index("--front") + 1] if "--front" in sys.argv else h.FRONT
base = set(h.vite_pids(front)); errs = []

def mutate(dst):
    f = os.path.join(dst, "src/vendorImages.js"); s = open(f, encoding="utf-8").read()
    n = re.sub(r"return \{ isGood: \(url\) => results\.get\(url\) === true, isBad: \(url\) => results\.get\(url\) === false \};", "return { isGood: () => true, isBad: () => false };", s)
    if n == s: raise RuntimeError("không phá được bản sao: vendorImages.js đã đổi dạng, cập nhật mutate()")
    open(f, "w", encoding="utf-8").write(n)

tmp = h.scratch()
try:
    for name, s in (("C9", h.C9), ("C10", h.C10)):
        line, _ = h.run_check(s, front)
        if not line.startswith("PASS"): errs.append(f"{name} trên code hiện tại đáng ra PASS, thấy: {line[:100]}")
    dst = os.path.join(tmp, "front-hong"); h.front_copy(dst, mutate)
    for name, s in (("C9", h.C9), ("C10", h.C10)):
        line, _ = h.run_check(s, dst)
        if not line.startswith("FAIL"): errs.append(f"{name} trên bản front bị phá đáng ra FAIL, thấy: {line[:100]}")
finally:
    h.kill_pids(set(h.vite_pids(front)) - base); h.kill_pids({p for p, c in h.vite_pids(os.path.join(tmp, "front-hong")).items()}) if os.path.isdir(os.path.join(tmp, "front-hong")) else None
    h.rm_probe_files(front); shutil.rmtree(tmp, ignore_errors=True)
if errs: print("FAIL " + " | ".join(errs)); sys.exit(1)
print("PASS C9, C10: PASS trên code hiện tại, FAIL trên bản front bị phá")
