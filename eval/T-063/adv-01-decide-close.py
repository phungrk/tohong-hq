#!/usr/bin/env python3
"""Tầng 3 T-063 · input: việc có issue bị leo thang rồi Capu `decide --close` (escalated → done, sự kiện 'decided').
Mong đợi (ADR-012 §2 "đóng issue khi sổ cái ghi done"; tiêu chí 2 "done → comment ④ và issue đóng"):
issue nhận ④ và bị đóng. Chạy khô với GitHub giả, không mạng."""
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); from _advlib import Ledger, posted, patched
L = Ledger()
try:
    L.task("new", "--title", "x", "--to", "engineering", "--tier", "B", "--area", "hq/ledger", "--issue", "7",
           "--criteria", "c", "--eval", "true", "--by", "chief-of-staff")
    L.task("start", "T-001", "--by", "engineering")
    L.task("escalate", "T-001", "--by", "chief-of-staff", "--note", "hỏi Capu")
    L.task("decide", "T-001", "--close", "--note", "bỏ việc này")
    rc, out, calls = L.mirror()
    assert rc == 0, out
    bodies = posted(calls, "7")
    assert any("④" in b for b in bodies), "done qua decide --close không có comment ④:\n" + "\n".join(bodies)
    assert any(p.get("state") == "closed" for p in patched(calls, "7")), "done qua decide --close không đóng issue"
    print("PASS done qua decide --close → ④ và đóng issue")
finally:
    L.close()
