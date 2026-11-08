#!/usr/bin/env python3
"""T-103 adv-03 (tầng 3). Spec T-101 mục 1: "mọi hook không phải cost.py trong ba sự kiện đó giữ nguyên về giá trị JSON".
Input: settings có (a) hook khác mà lệnh chứa chuỗi con "cost.py hook" (vd /opt/budget/podcost.py hook) và
(b) một nhóm hook rỗng có matcher. Mong: cả hai giữ nguyên; mỗi sự kiện vẫn có đúng một hook cost.py của repo."""
import sys, json, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "T-101"))
from lib import Box, finish, COST

fails = []
b = Box()
st = b.home / ".claude" / "settings.json"
other = {"type": "command", "command": "python3 /opt/budget/podcost.py hook"}
empty = {"matcher": "x", "hooks": []}
st.write_text(json.dumps({"hooks": {"Stop": [{"hooks": [dict(other)]}], "SessionEnd": [dict(empty)]}}))
r = b.run(["install-hook"])
h = json.loads(st.read_text())["hooks"]
flat = lambda ev: [x for g in h.get(ev, []) for x in g.get("hooks", [])]
if other not in flat("Stop"):
    fails.append("hook podcost.py bị thay/xoá: " + json.dumps(flat("Stop")))
if empty not in h.get("SessionEnd", []):
    fails.append("nhóm hook rỗng có matcher bị xoá")
for ev in ("SubagentStop", "Stop", "SessionEnd"):
    n = sum(1 for x in flat(ev) if str(COST) in x.get("command", ""))
    if n != 1:
        fails.append(f"{ev}: {n} hook cost.py của repo")
finish(fails)
