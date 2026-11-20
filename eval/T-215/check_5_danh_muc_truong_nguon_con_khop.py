#!/usr/bin/env python3
"""T-215 tiêu chí 5 (chặn hồi quy lân cận): danh mục trường nguồn tạo pool (tools/scraper/pool-input-fields.json) vẫn KHỚP những gì các bước sinh pool thật sự đọc.
Nếu regen bắt đầu đọc một trường nguồn mới (vd enrichment_log) mà danh mục không có mục thì drawer admin nói thiếu: hai bất biến đã có đỏ.
Chạy đúng hai bất biến vùng planner/admin/vendor-enrich (không gọi cách cài đặt): inv-006 và inv-014 với TOHONG_REPO hiện hành. Xanh trên main là đúng (đây là rào hồi quy, không phải eval đỏ-trước). ~2-3 phút. Chạy: python3 -I <file>."""
import glob, os, subprocess, sys
sys.dont_write_bytecode = True
d = os.path.dirname(os.path.abspath(__file__))
while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    d = os.path.dirname(d)
base = os.path.join(d, "eval", "invariants", "planner", "admin", "vendor-enrich")
fails = []
for pat in ("inv-006-*.py", "inv-014-*.py"):
    fs = sorted(glob.glob(os.path.join(base, pat)))
    if not fs:
        print("FAIL không thấy bất biến " + pat); sys.exit(1)
    p = subprocess.run([sys.executable, "-I", fs[0]], capture_output=True, text=True, timeout=900)
    if p.returncode != 0:
        fails.append(os.path.basename(fs[0]) + ": " + (p.stdout.strip() or p.stderr.strip())[-200:])
print("PASS inv-006 và inv-014 (danh mục trường nguồn khớp)" if not fails else "FAIL " + " | ".join(fails))
sys.exit(1 if fails else 0)
