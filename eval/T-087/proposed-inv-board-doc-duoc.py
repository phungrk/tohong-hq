#!/usr/bin/env python3
"""BẤT BIẾN ĐỀ XUẤT hq/ledger (T-087; chỉ spec-critic được rút vào eval/invariants/hq/ledger/).
(a) Sổ cái thật: `task.py summary --json` thoát 0 và board_hong rỗng (mọi board/T-*.md thật đọc được, không hỏng nhẹ/nặng).
(b) Sổ cái tạm có board hỏng nhẹ và hỏng nặng: list/summary/export không Traceback, thoát 0.
Chạy: python3 eval/T-087/proposed-inv-board-doc-duoc.py"""
import json, subprocess, sys, tempfile
import _lib as L
r = subprocess.run([sys.executable, str(L.ROOT / "scripts/task.py"), "summary", "--json"], capture_output=True, text=True, cwd=str(L.ROOT))
try: j = json.loads(r.stdout)
except Exception: j = {}
L.chk(r.returncode == 0 and j.get("board_hong") == [], "sổ cái thật: board hỏng hoặc summary sập: %s %s" % (j.get("board_hong"), r.stderr[-150:]))
with tempfile.TemporaryDirectory() as tmp:
    fake = L.mk(tmp, {"T-901": L.CORRUPT, "T-911": {"state": '""xyz""'}, "T-915": {}})
    for argv in (["task.py", "list"], ["task.py", "summary"], ["export_dashboard.py", "--out", tmp + "/p"]):
        r = L.run(fake, L.ROOT / "scripts" / argv[0], *argv[1:])
        L.chk(r.returncode == 0 and "Traceback" not in r.stderr, f"{argv}: sập")
L.done()
