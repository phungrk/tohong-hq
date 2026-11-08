#!/usr/bin/env python3
"""Tiêu chí 5: kết luận trong báo cáo = kết luận cơ học tính từ hồ sơ lượt chạy + thresholds.json; có khuyến nghị đi kèm."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import *
v, red, d = verdict(runs())
txt = report_text()
m = re.search(r"^KẾT LUẬN:\s*(ADOPT|DROP|INCONCLUSIVE)\b", txt, re.M)
if not m: fail("báo cáo thiếu dòng 'KẾT LUẬN: ADOPT|DROP|INCONCLUSIVE'")
if m.group(1) != v: fail(f"báo cáo ghi {m.group(1)} nhưng hồ sơ + ngưỡng cho {v} (giảm {red:.1%})")
r = re.search(r"^KHUYẾN NGHỊ:\s*(.+)$", txt, re.M)
if not r or len(r.group(1).strip()) < 20: fail("báo cáo thiếu dòng 'KHUYẾN NGHỊ: …'")
if v in ("DROP", "INCONCLUSIVE") and not re.search(r"không (cài|dùng|áp dụng|mở rộng)", r.group(1), re.I):
    fail("kết luận không ADOPT nhưng khuyến nghị không nói rõ 'không cài/dùng/áp dụng/mở rộng'")
ok(f"{v}, giảm $/việc {red:.1%}")
