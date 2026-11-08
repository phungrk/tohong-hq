#!/usr/bin/env python3
"""Tiêu chí 5: kết luận trong báo cáo = kết luận cơ học tính từ các lượt HỢP LỆ + thresholds.json; có khuyến nghị đi kèm.
Nếu dừng vì trần ngân sách (stop.json) thì kết luận duy nhất được phép là INCOMPLETE. Thiếu dữ liệu là FAIL có lý do, không phải ngoại lệ."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import *
rs = runs()
complete, errs, info = structure(rs)
txt = report_text()
m = re.search(r"^KẾT LUẬN:\s*(ADOPT|DROP|INCONCLUSIVE|INCOMPLETE)\b", txt, re.M)
if not m: fail("báo cáo thiếu dòng 'KẾT LUẬN: ADOPT|DROP|INCONCLUSIVE|INCOMPLETE'")
r = re.search(r"^KHUYẾN NGHỊ:\s*(.+)$", txt, re.M)
if not r or len(r.group(1).strip()) < 20: fail("báo cáo thiếu dòng 'KHUYẾN NGHỊ: …'")
if stop_file():
    if m.group(1) != "INCOMPLETE": fail(f"đã dừng vì ngân sách (stop.json) nhưng báo cáo ghi {m.group(1)}, chỉ được ghi INCOMPLETE")
    if not re.search(r"không (cài|dùng|áp dụng|mở rộng)", r.group(1), re.I): fail("INCOMPLETE nhưng khuyến nghị không nói rõ 'không cài/dùng/áp dụng/mở rộng'")
    ok("INCOMPLETE do trần ngân sách, khuyến nghị không cài")
if not complete: fail("chưa đủ lượt hợp lệ mà chưa có stop.json: " + "; ".join(errs))
if m.group(1) == "INCOMPLETE": fail("INCOMPLETE nhưng không có stop.json dừng vì ngân sách và hồ sơ đã đủ")
v, red, d = verdict(rs)
if m.group(1) != v: fail(f"báo cáo ghi {m.group(1)} nhưng hồ sơ + ngưỡng cho {v} (giảm {red:.1%})")
if v in ("DROP", "INCONCLUSIVE") and not re.search(r"không (cài|dùng|áp dụng|mở rộng)", r.group(1), re.I):
    fail("kết luận không ADOPT nhưng khuyến nghị không nói rõ 'không cài/dùng/áp dụng/mở rộng'")
# độ nhạy: nếu tính cả lượt harness_fault mà kết luận khác thì báo cáo phải nói
hf = [x for x in rs if x.get("excluded_reason") == "harness_fault"]
if hf:
    v2 = verdict(valid(rs) + hf)[0]
    if v2 != v and not re.search(r"^NHẠY CẢM:\s*\S+", txt, re.M): fail(f"tính cả {len(hf)} lượt harness_fault thì kết luận là {v2} (khác {v}) mà báo cáo thiếu dòng 'NHẠY CẢM: …'")
ok(f"{v}, giảm $/việc {red:.1%}")
