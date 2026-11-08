#!/usr/bin/env python3
"""Tiêu chí 4: ngưỡng + trần viết trước khi chạy. thresholds.json khớp băm ghi trong spec; mọi lượt (kể cả lượt bị loại) bắt đầu SAU locked_at,
so bằng giờ CÓ MÚI (started_at phải có Z hoặc ±hh:mm; locked_at ghi +07:00) và started_at tăng theo seq; báo cáo nhắc đúng các con số ngưỡng."""
import hashlib, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import *
spec = open(os.path.join(HQ, "products", "T-102-graphify-thu-nghiem.md"), encoding="utf-8").read()
h = hashlib.sha256(open(os.path.join(HERE, "thresholds.json"), "rb").read()).hexdigest()
if h not in spec: fail("băm sha256 của thresholds.json không khớp băm ghi trong spec (ngưỡng/trần bị sửa sau khi khoá)")
lock = parse_ts(TH["locked_at"], "locked_at")
prev = None
for r in runs():
    t = parse_ts(r["started_at"], f"started_at của {tag(r)}")
    if t <= lock: fail(f"lượt {tag(r)} bắt đầu trước hoặc đúng lúc khoá ngưỡng ({t.isoformat()} <= {lock.isoformat()})")
    if prev and t <= prev: fail(f"started_at không tăng theo seq tại {tag(r)}")
    prev = t
txt = report_text()
sec = re.search(r"^#{1,3}\s+Ngưỡng.*?(?=^#{1,3}\s|\Z)", txt, re.M | re.S)
if not sec: fail("báo cáo thiếu mục Ngưỡng")
for needle in ("20%", "5%", "30%"):
    if needle not in sec.group(0): fail(f"mục Ngưỡng của báo cáo không nhắc {needle}")
ok("ngưỡng khoá trước mọi lượt chạy (giờ có múi), báo cáo trích đúng")
