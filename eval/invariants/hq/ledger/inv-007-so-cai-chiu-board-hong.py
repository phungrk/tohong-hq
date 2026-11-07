#!/usr/bin/env python3
"""Bất biến hq/ledger (chờ merge, ADR-028) · nguồn: T-087 (Spec Gate v3 2026-11-07, spec-critic rút từ eval/T-087/proposed-inv-board-doc-duoc.py).
Đích: eval/invariants/hq/ledger/inv-007-so-cai-chiu-board-hong.py sau khi PR T-087 merge và file này xanh trên main.
(a) Sổ cái thật: `task.py summary --json` thoát 0, không Traceback, và không có board hỏng NẶNG (board_hong là danh sách, không phần tử nào severity = nang).
(b) Sổ cái tạm có board hỏng nhẹ và hỏng nặng: list/summary/export không Traceback, thoát 0.
Chạy: python3 eval/T-087/bat-bien-cho-merge/inv-007-so-cai-chiu-board-hong.py"""
import json, subprocess, sys, tempfile
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "T-087"))  # _lib.py của eval/T-087 (vào bể theo ADR-028 sau merge tohong-hq#29)
import _lib as L
r = subprocess.run([sys.executable, str(L.ROOT / "scripts/task.py"), "summary", "--json"], capture_output=True, text=True, cwd=str(L.ROOT))
try: j = json.loads(r.stdout)
except Exception: j = {}
bh = j.get("board_hong")
L.chk(r.returncode == 0 and "Traceback" not in r.stderr and isinstance(bh, list) and not [b for b in bh if b.get("severity") == "nang"],
      "sổ cái thật: summary sập hoặc có board hỏng nặng: %s %s" % (bh, r.stderr[-150:]))
with tempfile.TemporaryDirectory() as tmp:
    fake = L.mk(tmp, {"T-901": L.CORRUPT, "T-911": {"state": '""xyz""'}, "T-915": {}})
    for argv in (["task.py", "list"], ["task.py", "summary"], ["export_dashboard.py", "--out", tmp + "/p"]):
        r = L.run(fake, L.ROOT / "scripts" / argv[0], *argv[1:])
        L.chk(r.returncode == 0 and "Traceback" not in r.stderr, f"{argv}: sập")
L.done()
