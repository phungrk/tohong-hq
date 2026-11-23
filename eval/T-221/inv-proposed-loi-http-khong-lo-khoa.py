#!/usr/bin/env python3
"""Bất biến đề xuất (planner/vendor): mọi đường lỗi HTTP của discover_p0.py (Gemini, Text Search, Details) ghi chẩn đoán mà KHÔNG lộ khoá API
(dạng AIza…, key=…, Bearer …, giá trị khoá đang chạy) ở stdout, log tee hay file CLI tạo ra. Chạy lại check_2 của T-221 (offline)."""
import os, subprocess, sys
p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "check_2_che_khoa_ca_ba_loai.py")
r = subprocess.run([sys.executable, p], capture_output=True, text=True, env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"))
print(((r.stdout or "").strip().splitlines() or ["FAIL không có đầu ra"])[-1])
sys.exit(r.returncode)
