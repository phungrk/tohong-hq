#!/usr/bin/env python3
"""T-053 tiêu chí 3: PASS/FAIL trên code T-052 không đổi. (a) Trên front hiện tại (đã gồm T-052) check 9 và 10 vẫn PASS (baseline đo 2026-11-05: cả hai PASS, xem baseline.txt).
(b) Không nới ngưỡng, mỗi nhóm kiểm một đột biến trên bản sao front: M1 mọi ảnh coi là tốt (ảnh hỏng không ra ảnh mặc định) -> C9 và C10 FAIL; M2 front gọi www.marry.vn -> C10 FAIL; M3 front ghi đè localStorage vendor đã lưu -> C10 FAIL.
Giao adversary đọc diff (không dựng đột biến): "mỗi id tra ảnh tối đa một lần" và "tra ảnh không mang coupleId" của C10, các kiểm gallery riêng của C9.
Bản sao nằm trong $EVAL_TMPDIR (nên đặt vào scratchpad), tự dọn. Chạy: python3 check_3_ket_qua_khong_doi.py [--front DIR]. In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import sys, os, shutil, re, signal
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import h
front = sys.argv[sys.argv.index("--front") + 1] if "--front" in sys.argv else h.FRONT
errs = []
M1 = r"return \{ isGood: \(url\) => results\.get\(url\) === true, isBad: \(url\) => results\.get\(url\) === false \};"
def sub_(dst, f, fn):
    p = os.path.join(dst, f); s = open(p, encoding="utf-8").read(); n = fn(s)
    if n == s: raise RuntimeError(f"không phá được bản sao: {f} đã đổi dạng, cập nhật đột biến")
    open(p, "w", encoding="utf-8").write(n)
def m1(dst): sub_(dst, "src/vendorImages.js", lambda s: re.sub(M1, "return { isGood: () => true, isBad: () => false };", s))
def m2(dst): sub_(dst, "src/vendorImages.js", lambda s: s + "\nif (typeof Image !== 'undefined') { const __m = new Image(); __m.src = 'https://www.marry.vn/images/detailed/1/zz.jpg'; }\n")
def m3(dst): sub_(dst, "src/vendorImages.js", lambda s: s + "\nif (typeof setInterval !== 'undefined') setInterval(() => { try { const k = 'th_vendors_t051'; const v = localStorage.getItem(k); if (v) localStorage.setItem(k, v + ' '); } catch (e) {} }, 400);\n")  # app ghi lại chuỗi chuẩn lúc mount, nên ghi đè lặp lại để chắc chắn lệch lúc eval so sánh
MUT = (("M1 ảnh hỏng không ra mặc định", m1, ("C9", "C10"), ""), ("M2 gọi www.marry.vn", m2, ("C10",), "marry"), ("M3 ghi đè localStorage", m3, ("C10",), "localStorage"))
SC = {"C9": h.C9, "C10": h.C10}

tmp = h.scratch()
try:
    for name, s in (("C9", h.C9), ("C10", h.C10)):
        line, _ = h.run_check(s, front)
        if not line.startswith("PASS"): errs.append(f"{name} trên code hiện tại đáng ra PASS, thấy: {line[:100]}")
    for label, fn, who, why in MUT:
        dst = os.path.join(tmp, "front-hong"); shutil.rmtree(dst, ignore_errors=True); h.front_copy(dst, fn)
        for name in who:
            line, _ = h.run_check(SC[name], dst)
            if not line.startswith("FAIL"): errs.append(f"{name} trên bản front đột biến {label} đáng ra FAIL, thấy: {line[:100]}")
            elif why and why not in h.LAST_OUT: errs.append(f"{name} đột biến {label} FAIL nhưng không vì '{why}' (sai lý do): {line[:100]}")
        h.kill_pids(h.marked())
finally:
    h.kill_pids(h.marked()); h.rm_probe_files(front); shutil.rmtree(tmp, ignore_errors=True)
if errs: print("FAIL " + " | ".join(errs)); sys.exit(1)
print("PASS C9, C10: PASS trên code hiện tại, FAIL trên cả ba đột biến (ảnh hỏng, marry.vn, localStorage)")
