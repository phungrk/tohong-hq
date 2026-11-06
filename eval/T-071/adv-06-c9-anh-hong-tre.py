#!/usr/bin/env python3
"""T-071 adv-06 (adversary, tầng 3): nhóm "các kiểm gallery riêng của C9" spec T-053 GIAO adversary đọc diff (không có đột biến trong check_3).
Bản cũ chụp nền sau chờ cố định (2.5s thẻ danh sách, 0.5s+2s gallery chi tiết, 2.5s thẻ chọn/bảng so sánh); bản mới chờ tới khi trạng thái
TỐT xuất hiện rồi đo ngay, nên front hiện ảnh tốt trước rồi mới đổi sang ảnh hỏng sẽ lọt. Spec T-053 Hành vi 3: không nới, không đổi phép đo nội dung.
Đột biến M6 (M1 trễ) trên bản sao front, src/vendorImages.js useImageStatus: 1.2s sau khi mỗi bề mặt mount, mọi ảnh bị coi là tốt (ảnh hỏng hiện ra,
đúng hỏng hóc M1 của check_3, chỉ trễ 1.2s — nằm gọn trong cửa sổ của bản cũ) -> C9 phải FAIL.
Bản sao trong $EVAL_TMPDIR, tự dọn. Chạy: python3 eval/T-071/adv-06-c9-anh-hong-tre.py [--c9 <đường dẫn C9>]. In PASS/FAIL; mã thoát 0/1."""
import os, sys, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "T-053", "lib"))
import h
C9 = sys.argv[sys.argv.index("--c9") + 1] if "--c9" in sys.argv else h.C9
OLD = "  return { isGood: (url) => results.get(url) === true, isBad: (url) => results.get(url) === false };\n"
NEW = ("  const [t0] = useState(() => performance.now());\n"
       "  useEffect(() => { const t = setTimeout(() => bump((n) => n + 1), 1500); return () => clearTimeout(t); }, []);\n"
       "  const late = performance.now() - t0 > 1200;\n"
       "  return { isGood: (url) => late || results.get(url) === true, isBad: (url) => !late && results.get(url) === false };\n")
def m6(dst):
    p = os.path.join(dst, "src/vendorImages.js"); s = open(p, encoding="utf-8").read()
    if OLD not in s: raise RuntimeError("không phá được bản sao: useImageStatus đã đổi dạng, cập nhật đột biến")
    open(p, "w", encoding="utf-8").write(s.replace(OLD, NEW, 1))
tmp = h.scratch(); errs = []
try:
    dst = os.path.join(tmp, "front-m6"); h.front_copy(dst, m6)
    line, _ = h.run_check(C9, dst)
    if not line.startswith("FAIL"): errs.append(f"C9 trên đột biến M6 (ảnh hỏng hiện ra sau 1.2s) đáng ra FAIL, thấy: {line[:90]}")
    h.kill_pids(h.marked())
finally:
    h.kill_pids(h.marked()); shutil.rmtree(tmp, ignore_errors=True)
if errs: print("FAIL " + " | ".join(errs)); sys.exit(1)
print("PASS C9 bắt được ảnh hỏng hiện ra 1.2s sau khi bề mặt mount (M6)")
