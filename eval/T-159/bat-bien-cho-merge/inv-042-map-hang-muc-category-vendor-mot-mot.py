#!/usr/bin/env python3
"""Nguồn: T-159 (spec products/T-159-ghep-vendor-theo-bang-du-toan.md v2, H6, "Bất biến đề xuất" INV-G; handoffs/T-159-v2.md),
qua Spec Gate 2026-11-14 (spec-critic). Nằm ở eval/T-159/bat-bien-cho-merge/ cho tới khi PR code T-159 merge, sau đó chuyển vào
eval/invariants/planner/vendor/images/ (đỏ trước khi có code là đúng).
INV-G · Map hạng mục bảng dự toán <-> category vendor luôn đủ và một-một, đo bằng hành vi:
 hạng mục = GET /api/couples/:id/budget khi chưa có bảng; category = GET /api/vendors/categories; phân bổ riêng từng hạng mục 50tr thì
 đúng một category đổi điểm ngân sách (trừ reserve: không category nào); mỗi category đúng một hạng mục; hạng mục người dùng tự thêm không ảnh hưởng.
 Thêm hạng mục mới mà quên map -> FAIL. Thêm id vào NO_VENDOR_OK (trong eval/T-159/check_5) là quyết định sản phẩm, phải qua spec.
Thân bất biến: eval/T-159/check_5_map_hang_muc_vendor.mjs (pool đông cứng eval/T-140/fixtures/pool-frozen.json, R2 giả trong bộ nhớ, không mạng).
Repo back: $TOHONG_BACK_REPO, rồi cwd nếu có lib/contextBuilder.js, rồi <gốc HQ>/../tohong-back. Chỉ đọc repo. Chạy không tham số (python3 -I), từ cwd nào cũng được."""
import os, subprocess, sys

HQ = os.path.dirname(os.path.abspath(__file__))
while HQ != "/" and not os.path.isfile(os.path.join(HQ, "scripts", "gate.py")):  # tìm gốc tohong-hq ở mọi độ sâu
    HQ = os.path.dirname(HQ)
if HQ == "/":
    print("FAIL không tìm thấy gốc tohong-hq (scripts/gate.py)"); sys.exit(1)
B = next((os.path.abspath(c) for c in (os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(HQ, "..", "tohong-back"))
          if c and os.path.isfile(os.path.join(c, "lib", "contextBuilder.js"))), None)
if not B:
    print("PASS chưa áp dụng (thiếu tohong-back)"); sys.exit(0)
body = os.path.join(HQ, "eval", "T-159", "check_5_map_hang_muc_vendor.mjs")
if not os.path.isfile(body):
    print("FAIL thiếu thân bất biến " + body); sys.exit(1)
env = dict(os.environ, TOHONG_BACK_REPO=B)
try:
    p = subprocess.run(["node", body], cwd=HQ, env=env, capture_output=True, text=True, timeout=600)
except Exception as e:  # node thiếu / quá giờ
    print(f"FAIL không chạy được node: {e}"); sys.exit(1)
lines = (p.stdout or "").strip().splitlines()
last = lines[-1] if lines else (p.stderr or "").strip()[-300:]
if p.returncode == 0 and last.startswith("PASS"):
    print("PASS INV-G " + last); sys.exit(0)
print("FAIL INV-G " + last[:600]); sys.exit(1)
