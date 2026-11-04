#!/usr/bin/env python3
"""Tầng 3 T-063 · input: việc chỉ có spec (owner product), bậc C, spec-critic accept → done.
Mong đợi (tiêu chí 3 "done bậc C → issue gán Capu"; ADR-012 §2): issue được gán Capu, không bị đóng.
Chạy khô với GitHub giả, không mạng."""
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); from _advlib import Ledger, posted, patched
L = Ledger()
try:
    L.task("new", "--title", "x", "--to", "product", "--tier", "C", "--area", "hq/ledger", "--issue", "7",
           "--criteria", "c", "--by", "chief-of-staff")
    L.task("start", "T-001", "--by", "product")
    L.task("handoff", "T-001", "--by", "product", "--eval", "true")
    L.task("accept", "T-001", "--by", "spec-critic", "--note", "qua")
    rc, out, calls = L.mirror()
    assert rc == 0, out
    p = patched(calls, "7")
    assert not any(x.get("state") == "closed" for x in p), "done bậc C bị đóng issue"
    assert any(x.get("assignees") == ["capu-login"] for x in p), "done bậc C (sau Spec Gate) không gán Capu: " + str(p)
    print("PASS done bậc C sau Spec Gate → gán Capu, không đóng")
finally:
    L.close()
