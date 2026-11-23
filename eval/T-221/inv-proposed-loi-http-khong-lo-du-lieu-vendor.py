#!/usr/bin/env python3
"""Bất biến đề xuất (planner/vendor): đường lỗi HTTP của discover_p0.py không bao giờ in place_id, tên, địa chỉ, website hay truy vấn đã gửi (kể cả khi Google nhắc lại),
và không rơi về thân thô khi JSON có đối tượng `error`. Chạy lại check_6 của T-221 (offline)."""
import os, subprocess, sys
p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "check_6_khong_lo_du_lieu_vendor_khi_google_nhac_lai.py")
r = subprocess.run([sys.executable, p], capture_output=True, text=True, env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"))
print(((r.stdout or "").strip().splitlines() or ["FAIL không có đầu ra"])[-1])
sys.exit(r.returncode)
