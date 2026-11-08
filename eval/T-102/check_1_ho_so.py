#!/usr/bin/env python3
"""Tiêu chí 1: hồ sơ thí nghiệm đủ phần. Báo cáo có các mục bắt buộc; mỗi lượt chạy có đủ trường; usd khớp token x bảng giá."""
import re, sys
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from _lib import *
txt = report_text()
need = ["Khuyến nghị", "Thiết kế", "Kết quả", "Ngưỡng", "Cách cài", "Gỡ", "Đồ thị cũ", "Dữ liệu gửi đi", "Nguồn số đo", "Rủi ro"]
heads = [h.strip().lower() for h in re.findall(r"^#{1,3}\s+(.+)$", txt, re.M)]
miss = [n for n in need if not any(n.lower() in h for h in heads)]
if miss: fail("báo cáo thiếu mục: " + ", ".join(miss))
rs = runs()
keys = ["task", "arm", "rep", "seq", "base_sha", "start_tree_sha", "started_at", "model", "source", "tokens", "usd", "gate_green_first", "returns", "wall_s"]
for r in rs:
    m = [k for k in keys if k not in r]
    if m: fail(f"{r.get('task')}-{r.get('arm')}-r{r.get('rep')} thiếu trường {m}")
    if r["arm"] not in ("A", "B"): fail("arm phải là A hoặc B")
    if r["source"] not in ("cost_event", "transcript"): fail("source phải là cost_event hoặc transcript")
    t = r["tokens"]
    if any(k not in t for k in ("input", "cache_read", "cache_write", "output")): fail("tokens thiếu input/cache_read/cache_write/output")
    exp = usd_of(r["model"], t)
    if abs(exp - r["usd"]) > max(0.01 * exp, 0.005): fail(f"usd {r['usd']} lệch token x bảng giá ({exp:.4f}) ở {r['task']}-{r['arm']}-r{r['rep']}")
tasks = sorted({r["task"] for r in rs})
if not (TH["tasks_min"] <= len(tasks) <= 4): fail(f"cần 3-4 việc, có {len(tasks)}")
for t in tasks:
    for arm in "AB":
        if sum(1 for r in rs if r["task"] == t and r["arm"] == arm) < 1: fail(f"{t} thiếu arm {arm}")
ok(f"{len(rs)} lượt, {len(tasks)} việc, báo cáo đủ {len(need)} mục")
