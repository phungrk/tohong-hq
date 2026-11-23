#!/usr/bin/env python3
"""BẤT BIẾN (nguồn: T-221, Spec Gate 2026-11-23, spec v3 sau D1/D2; vùng đích planner/vendor/, số do Chief đặt khi đưa vào bể; ADR-028: chờ merge).
Dòng `P0_HTTP_ERROR` của tools/scraper/discover_p0.py KHÔNG BAO GIỜ chứa place_id, tên, địa chỉ, website hay truy vấn đã gửi trong chính lượt gọi đó, kể cả khi Google nhắc lại
chúng, ở mọi dạng đọc lại được (hoa/thường, \\uXXXX, thực thể HTML &#NN;), cho mọi vendor của lô (đầu, giữa, cuối); thân JSON không bao giờ in thô (chỉ error.status và
error.message đã che; không có đối tượng `error` thì rỗng); thân không phải JSON chỉ in `non_json_body bytes=<n> content_type=<ct>`; giá trị đã gửi từ 2 ký tự bị che, dấu che
không bị quét lại; stdout không chứa tên/địa chỉ/place_id (ràng buộc T-219 check_16). Lý do: log vào PR discover-p0/ công khai (dữ liệu Maps không được lưu).
Cách đo: chạy lại eval/T-221/check_6_khong_lo_du_lieu_vendor_khi_google_nhac_lai.py (offline, fake Google, không mạng).
Repo: $TOHONG_REPO hoặc ../tohong cạnh tohong-hq (dò ngược tới scripts/gate.py, ADR-057). Không thấy discover_p0.py: PASS 'chưa áp dụng'. Chạy: python3 -I <file>."""
import os, subprocess, sys

d = os.path.dirname(os.path.abspath(__file__))
while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    d = os.path.dirname(d)
repo = next((c for c in (os.environ.get("TOHONG_REPO"), os.path.join(d, "..", "tohong")) if c and os.path.isfile(os.path.join(c, "tools", "scraper", "discover_p0.py"))), None)
if not repo:
    print("PASS chưa áp dụng (không thấy tools/scraper/discover_p0.py)"); sys.exit(0)
p = os.path.join(d, "eval", "T-221", "check_6_khong_lo_du_lieu_vendor_khi_google_nhac_lai.py")
if not os.path.isfile(p):
    print("FAIL thiếu eval nguồn %s" % p); sys.exit(1)
r = subprocess.run([sys.executable, p], capture_output=True, text=True, timeout=1200,
                   env=dict(os.environ, TOHONG_REPO=os.path.abspath(repo), PYTHONDONTWRITEBYTECODE="1"))
print(((r.stdout or "").strip().splitlines() or ["FAIL không có đầu ra " + (r.stderr or "").strip()[-200:]])[-1])
sys.exit(r.returncode)
