#!/usr/bin/env python3
"""Tiêu chí 4: ngưỡng viết trước khi chạy. thresholds.json khớp băm ghi trong spec; mọi lượt chạy bắt đầu SAU locked_at;
báo cáo nhắc đúng các con số ngưỡng."""
import datetime as dt, hashlib, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import *
spec = open(os.path.join(HQ, "products", "T-102-graphify-thu-nghiem.md"), encoding="utf-8").read()
h = hashlib.sha256(open(os.path.join(HERE, "thresholds.json"), "rb").read()).hexdigest()
if h not in spec: fail("băm sha256 của thresholds.json không khớp băm ghi trong spec (ngưỡng bị sửa sau khi khoá)")
lock = dt.datetime.fromisoformat(TH["locked_at"])
for r in runs():
    if dt.datetime.fromisoformat(r["started_at"].replace("Z", "")[:19]) <= lock:
        fail(f"lượt {r['task']}-{r['arm']}-r{r['rep']} bắt đầu trước hoặc đúng lúc khoá ngưỡng")
txt = report_text()
sec = re.search(r"^#{1,3}\s+Ngưỡng.*?(?=^#{1,3}\s|\Z)", txt, re.M | re.S)
if not sec: fail("báo cáo thiếu mục Ngưỡng")
for needle in ("20%", "5%", "30%"):
    if needle not in sec.group(0): fail(f"mục Ngưỡng của báo cáo không nhắc {needle}")
ok("ngưỡng khoá trước mọi lượt chạy, báo cáo trích đúng")
