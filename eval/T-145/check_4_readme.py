#!/usr/bin/env python3
"""Eval T-145 tiêu chí 4: README của repo trang nói nguồn dữ liệu là repo tohong-hq-dashboard.
Repo trang: ${TOHONG_DASHBOARD_REPO:-/home/user/tohong-hq-dashboard}. In PASS hoặc FAIL <lý do>."""
import os, pathlib, re, sys
repo = pathlib.Path(os.environ.get("TOHONG_DASHBOARD_REPO") or "/home/user/tohong-hq-dashboard")
f = repo / "README.md"
if not f.is_file(): print("FAIL không thấy README.md trong " + str(repo)); sys.exit(1)
t = f.read_text(encoding="utf-8")
line = next((l for l in t.splitlines() if "dashboard.json" in l and "dashboard-data" in l), None)
why = []
if line is None: why.append("README không có dòng nào nói dashboard.json ở nhánh dashboard-data")
else:
    if not re.search(r"github\.com/phungrk/tohong-hq-dashboard(?![-\w/])", line) and "tohong-hq-dashboard" not in line: why.append("dòng nguồn dữ liệu không nhắc repo tohong-hq-dashboard")
    if re.search(r"github\.com/phungrk/tohong-hq(?![-\w])", line): why.append("dòng nguồn dữ liệu còn trỏ repo phungrk/tohong-hq")
if re.search(r"raw\.githubusercontent\.com/phungrk/tohong-hq(?![-\w])", t): why.append("README còn nhắc raw của phungrk/tohong-hq")
print("PASS" if not why else "FAIL " + " | ".join(why)); sys.exit(1 if why else 0)
