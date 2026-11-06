#!/usr/bin/env python3
"""T-071 adv-05 (adversary, tầng 3): nhóm kiểm spec T-053 GIAO adversary đọc diff (không có đột biến trong check_3): "mỗi id tra ảnh tối đa
một lần" và "tra ảnh không mang coupleId" của C10. Bản cũ (trước T-071) đo sau chờ cố định 3s (danh sách) / 1.5s+2.5s (Ngân sách); bản mới
gọi checkLookups ngay khi đủ 6 id + ảnh ổn định, nên cửa sổ bắt vi phạm co lại. Spec T-053 Hành vi 3 + "Không làm": không nới, không đổi phép đo nội dung.
Đột biến trên bản sao front (src/vendorImages.js, hàm lookupPool), vi phạm xảy ra 1 giây sau lần tra đầu (nằm gọn trong cửa sổ của bản cũ):
  M4 tra lại cùng id lần hai sau 1s           -> C10 phải FAIL vì 'bị tra' (id tra quá 1 lần)
  M5 tra thêm một lần KÈM coupleId sau 1s     -> C10 phải FAIL vì 'coupleId'
Bản sao trong $EVAL_TMPDIR, tự dọn. Chạy: python3 eval/T-071/adv-05-c10-tra-tre.py [--c10 <đường dẫn C10>]. In PASS/FAIL; mã thoát 0/1."""
import os, sys, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "T-053", "lib"))
import h
C10 = sys.argv[sys.argv.index("--c10") + 1] if "--c10" in sys.argv else h.C10
ANCHOR = "  lookups.set(id, e);\n"
def mut(extra):
    def f(dst):
        p = os.path.join(dst, "src/vendorImages.js"); s = open(p, encoding="utf-8").read()
        if ANCHOR not in s: raise RuntimeError("không phá được bản sao: lookupPool đã đổi dạng, cập nhật đột biến")
        open(p, "w", encoding="utf-8").write(s.replace(ANCHOR, ANCHOR + extra, 1))
    return f
M = (("M4 tra lại cùng id sau 1s", mut("  setTimeout(() => { api.getVendorPhotos(id).catch(() => {}); }, 1000);\n"), "bị tra"),
     ("M5 tra kèm coupleId sau 1s", mut("  setTimeout(() => { api.getVendorDetail(id, 'c_t071').catch(() => {}); }, 1000);\n"), "coupleId"))
tmp = h.scratch(); errs = []
try:
    for label, fn, why in M:
        dst = os.path.join(tmp, "front-tra"); shutil.rmtree(dst, ignore_errors=True); h.front_copy(dst, fn)
        line, _ = h.run_check(C10, dst)
        if not line.startswith("FAIL"): errs.append(f"C10 trên đột biến {label} đáng ra FAIL, thấy: {line[:90]}")
        elif why not in h.LAST_OUT: errs.append(f"C10 đột biến {label} FAIL nhưng không vì '{why}': {line[:110]}")
        h.kill_pids(h.marked())
finally:
    h.kill_pids(h.marked()); shutil.rmtree(tmp, ignore_errors=True)
if errs: print("FAIL " + " | ".join(errs)); sys.exit(1)
print("PASS C10 bắt được tra trùng id và tra kèm coupleId xảy ra 1s sau lần tra đầu (M4, M5)")
