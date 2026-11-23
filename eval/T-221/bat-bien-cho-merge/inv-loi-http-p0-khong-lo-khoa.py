#!/usr/bin/env python3
"""BẤT BIẾN (nguồn: T-221, Spec Gate 2026-11-23, spec v3; vùng đích planner/vendor/, số do Chief đặt khi đưa vào bể; ADR-028: chờ merge vì main chưa có dòng P0_HTTP_ERROR).
Mọi phản hồi HTTP khác 200 của Gemini, Text Search và Place Details trong tools/scraper/discover_p0.py sinh ĐÚNG MỘT dòng chẩn đoán `P0_HTTP_ERROR` mà KHÔNG lộ khoá:
dạng AIza + 35 ký tự (kể cả khoá lạ, không phải khoá đang chạy), `key=<giá trị>`, `Bearer` + mọi ký tự trắng + token, giá trị khoá môi trường đang chạy (đủ hay 12 ký tự đầu),
ở stdout, log tee và mọi file CLI tạo ra; kể cả khoá sát vị trí cắt 300 (che trước, cắt sau), khoá trong header Content-Type của thân không phải JSON, và thân không phải JSON
không bao giờ in nội dung. Lý do: log đi vào PR discover-p0/ công khai trên git.
Cách đo: chạy lại eval/T-221/check_2_che_khoa_ca_ba_loai.py (offline, fake Google của T-219/T-221, không mạng).
Repo: $TOHONG_REPO hoặc ../tohong cạnh tohong-hq (dò ngược tới scripts/gate.py, ADR-057). Không thấy discover_p0.py: PASS 'chưa áp dụng'. Chạy: python3 -I <file>."""
import os, subprocess, sys

d = os.path.dirname(os.path.abspath(__file__))
while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    d = os.path.dirname(d)
repo = next((c for c in (os.environ.get("TOHONG_REPO"), os.path.join(d, "..", "tohong")) if c and os.path.isfile(os.path.join(c, "tools", "scraper", "discover_p0.py"))), None)
if not repo:
    print("PASS chưa áp dụng (không thấy tools/scraper/discover_p0.py)"); sys.exit(0)
p = os.path.join(d, "eval", "T-221", "check_2_che_khoa_ca_ba_loai.py")
if not os.path.isfile(p):
    print("FAIL thiếu eval nguồn %s" % p); sys.exit(1)
r = subprocess.run([sys.executable, p], capture_output=True, text=True, timeout=1200,
                   env=dict(os.environ, TOHONG_REPO=os.path.abspath(repo), PYTHONDONTWRITEBYTECODE="1"))
print(((r.stdout or "").strip().splitlines() or ["FAIL không có đầu ra " + (r.stderr or "").strip()[-200:]])[-1])
sys.exit(r.returncode)
