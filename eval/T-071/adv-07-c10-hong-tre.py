#!/usr/bin/env python3
"""T-071 adv-07 (adversary, tầng 3): adv-05 chỉ đòi cửa sổ vi phạm cho phép đo TRA ẢNH của C10; v2 thêm watchLookups nhưng các phép đo
NỘI DUNG khác của C10 (nền ảnh từng hàng/tiêu đề, request tới marry.vn) vẫn chụp NGAY khi trạng thái tốt xuất hiện. Bản cũ (e6202ff) chụp
sau chờ cố định 3s (danh sách) / 1.5s + nhấn + 2.5s (Ngân sách). Spec T-053 Hành vi 3 + "Không làm": không nới, không đổi phép đo nội dung.
Đột biến trên bản sao front (src/vendorImages.js), vi phạm trễ nằm gọn trong cửa sổ của bản cũ:
  M7 = M2 của check_3 trễ: front gửi request tới www.marry.vn 2s sau khi nạp module         -> C10 phải FAIL vì 'marry'
  M8 = M1 của check_3 trễ: 1.2s sau khi mỗi bề mặt mount, mọi ảnh bị coi là tốt (ảnh hỏng hiện) -> C10 phải FAIL
Bản sao trong $EVAL_TMPDIR, tự dọn. Chạy: python3 eval/T-071/adv-07-c10-hong-tre.py [--c10 <đường dẫn C10>]. In PASS/FAIL; mã thoát 0/1."""
import os, sys, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "T-053", "lib"))
import h
C10 = sys.argv[sys.argv.index("--c10") + 1] if "--c10" in sys.argv else h.C10
OLD = "  return { isGood: (url) => results.get(url) === true, isBad: (url) => results.get(url) === false };\n"
NEW = ("  const [t0] = useState(() => performance.now());\n"
       "  useEffect(() => { const t = setTimeout(() => bump((n) => n + 1), 1500); return () => clearTimeout(t); }, []);\n"
       "  const late = performance.now() - t0 > 1200;\n"
       "  return { isGood: (url) => late || results.get(url) === true, isBad: (url) => !late && results.get(url) === false };\n")
def m7(dst):
    p = os.path.join(dst, "src/vendorImages.js"); s = open(p, encoding="utf-8").read()
    open(p, "w", encoding="utf-8").write(s + "\nif (typeof Image !== 'undefined') setTimeout(() => { const __m = new Image(); __m.src = 'https://www.marry.vn/images/detailed/1/zz.jpg'; }, 2000);\n")
def m8(dst):
    p = os.path.join(dst, "src/vendorImages.js"); s = open(p, encoding="utf-8").read()
    if OLD not in s: raise RuntimeError("không phá được bản sao: useImageStatus đã đổi dạng, cập nhật đột biến")
    open(p, "w", encoding="utf-8").write(s.replace(OLD, NEW, 1))
M = (("M7 marry.vn trễ 2s", m7, "marry"), ("M8 ảnh hỏng hiện sau 1.2s", m8, ""))
only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
tmp = h.scratch(); errs = []
try:
    for label, fn, why in M:
        if only and not label.startswith(only): continue
        dst = os.path.join(tmp, "front-tre"); shutil.rmtree(dst, ignore_errors=True); h.front_copy(dst, fn)
        line, _ = h.run_check(C10, dst)
        if not line.startswith("FAIL"): errs.append(f"C10 trên đột biến {label} đáng ra FAIL, thấy: {line[:90]}")
        elif why and why not in h.LAST_OUT: errs.append(f"C10 đột biến {label} FAIL nhưng không vì '{why}': {line[:110]}")
        h.kill_pids(h.marked())
finally:
    h.kill_pids(h.marked()); shutil.rmtree(tmp, ignore_errors=True)
if errs: print("FAIL " + " | ".join(errs)); sys.exit(1)
print("PASS C10 bắt được marry.vn gọi trễ 2s (M7) và ảnh hỏng hiện ra 1.2s sau khi bề mặt mount (M8)")
