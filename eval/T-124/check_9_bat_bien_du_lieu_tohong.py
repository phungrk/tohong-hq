#!/usr/bin/env python3
"""T-124 tiêu chí 9: PR tohong của việc này (thêm build_enrich_report.py, apply_admin_reviews.py, commit enrich-report.json) không làm đỏ các bất biến dữ liệu vendor.
Vùng planner/admin/vendor-enrich không chạy bể planner/vendor/images ở tầng 2, nên eval này chạy NGUYÊN VĂN (không sao chép, không sửa) INV-020, INV-021, INV-022 từ
eval/invariants/planner/vendor/images/ trên repo tohong (TOHONG_REPO hoặc ../tohong) và tohong-back (TOHONG_BACK_REPO hoặc ../tohong-back), như gate.py chạy: python3 -I, không tham số.
Xanh khi cả ba in PASS và thoát 0. Thiếu repo: các bất biến tự in "PASS chưa áp dụng". Không gọi Google. In PASS hoặc FAIL <bất biến nào, lý do>; thoát 0/1."""
import os, subprocess, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
D = os.path.join(HQ, "eval", "invariants", "planner", "vendor", "images")
names = ["inv-020-duyet-tay-co-quyet-dinh-cua-capu.py", "inv-021-du-lieu-khop-file-duyet-tay.py", "inv-022-pool-khong-vendor-da-go.py"]
bad = []
for n in names:
    p = subprocess.run([sys.executable, "-I", os.path.join(D, n)], capture_output=True, text=True, timeout=300, env=os.environ.copy())
    out = (p.stdout or p.stderr).strip().splitlines()
    if p.returncode != 0 or not (out and out[-1].startswith("PASS")):
        bad.append("%s: %s" % (n[:7].upper(), out[-1][:160] if out else "không có đầu ra"))
print("FAIL " + bad[0] + (" (+%d lỗi nữa)" % (len(bad) - 1) if len(bad) > 1 else "") if bad else "PASS")
sys.exit(1 if bad else 0)
