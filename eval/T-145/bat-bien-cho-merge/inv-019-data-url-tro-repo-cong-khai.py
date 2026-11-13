#!/usr/bin/env python3
"""Nguồn: T-145 (spec products/T-145-dashboard-doc-repo-cong-khai.md v3, câu 6-7, mục "Bất biến đề xuất"; ADR-080), spec-critic rút ở Spec Gate 2026-11-13.
INV-019 (hq/dashboard) · Trang công khai đọc dữ liệu từ nhánh dashboard-data của repo CÔNG KHAI tohong-hq-dashboard, không từ repo sổ cái (private):
  `const DATA_URL` của index.html đúng bằng https://raw.githubusercontent.com/phungrk/tohong-hq-dashboard/dashboard-data/dashboard.json;
  index.html không còn chuỗi raw.githubusercontent.com/phungrk/tohong-hq/… ; trang không đọc tham số ?data= (không nạp dữ liệu từ URL tùy ý).
Tĩnh, không cần Playwright/D3. Repo trang: $TOHONG_DASHBOARD_REPO, mặc định /home/user/tohong-hq-dashboard (như các bất biến hq/dashboard khác).
Gốc HQ: dò ngược tới scripts/gate.py (chỉ để kiểm vị trí; chạy được từ cwd bất kỳ). Chạy: python3 -I <file này>"""
import os, pathlib, re, sys
here = pathlib.Path(__file__).resolve().parent
if not any((p / "scripts" / "gate.py").is_file() for p in [here, *here.parents]):
    print("ERROR không dò được gốc HQ (scripts/gate.py)"); sys.exit(2)
repo = pathlib.Path(os.environ.get("TOHONG_DASHBOARD_REPO") or "/home/user/tohong-hq-dashboard")
f = repo / "index.html"
if not f.is_file(): print(f"ERROR không thấy index.html trong {repo}"); sys.exit(2)
html = f.read_text(encoding="utf-8")
EXPECT = "https://raw.githubusercontent.com/phungrk/tohong-hq-dashboard/dashboard-data/dashboard.json"
why = []
m = re.findall(r"const\s+DATA_URL\s*=\s*(['\"`])([^'\"`]+)\1", html)
if len(m) != 1: why.append(f"cần đúng 1 khai báo const DATA_URL, thấy {len(m)}")
elif m[0][1] != EXPECT: why.append(f"DATA_URL={m[0][1]} (phải là {EXPECT})")
if re.search(r"raw\.githubusercontent\.com/phungrk/tohong-hq(?![-\w])", html): why.append("còn đọc raw của repo sổ cái phungrk/tohong-hq")
if re.search(r"\.get\(\s*['\"]data['\"]\s*\)", html): why.append("trang đọc tham số ?data=")
print("PASS DATA_URL trỏ nhánh dashboard-data của repo công khai" if not why else "FAIL " + " | ".join(why)); sys.exit(1 if why else 0)
