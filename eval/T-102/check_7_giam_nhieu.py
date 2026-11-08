#!/usr/bin/env python3
"""Tiêu chí 7: giảm nhiễu. Cùng một model ở mọi lượt (= model_pin); mỗi ô (việc x arm) có >= reps_min lượt; thứ tự xen kẽ (không chạy hết A rồi hết B);
ô có độ rộng (max-min)/median > ngưỡng thì đã có thêm lượt; lượt vi phạm quy tắc 'không nhìn lịch sử git' đã bị loại và chạy lại."""
import os, statistics, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _lib import *
rs = runs()
bad = {r["model"] for r in rs} - {TH["model_pin"]}
if bad: fail(f"model khác {TH['model_pin']}: {bad}")
if any(r.get("git_history_peek") is not False for r in rs): fail("có lượt git_history_peek != false (agent nhìn lịch sử git, phải loại và chạy lại)")
if len({r["seq"] for r in rs}) != len(rs): fail("seq trùng nhau")
for t in sorted({r["task"] for r in rs}):
    a = [r for r in rs if r["task"] == t and r["arm"] == "A"]
    b = [r for r in rs if r["task"] == t and r["arm"] == "B"]
    if len(a) < TH["reps_min_per_cell"] or len(b) < TH["reps_min_per_cell"]: fail(f"{t}: mỗi arm cần >= {TH['reps_min_per_cell']} lượt (A={len(a)}, B={len(b)})")
    if max(x["seq"] for x in a) < min(x["seq"] for x in b) or max(x["seq"] for x in b) < min(x["seq"] for x in a): fail(f"{t}: chạy hết một arm rồi mới tới arm kia, không xen kẽ")
    for name, c in (("A", a), ("B", b)):
        med = statistics.median(x["usd"] for x in c)
        spread = (max(x["usd"] for x in c) - min(x["usd"] for x in c)) / med if med else 0
        if spread > TH["extra_rep_if_cell_spread_over"] and len(c) < TH["reps_min_per_cell"] + 1: fail(f"{t}-{name}: độ rộng {spread:.0%} > {TH['extra_rep_if_cell_spread_over']:.0%} mà chưa có lượt thêm")
ok("cùng model, đủ lặp, xen kẽ, không nhìn lịch sử git")
