#!/usr/bin/env python3
"""T-079 tiêu chí 4: việc không có issue vẫn quyết qua chat (`task.py decide` giữ nguyên), và đường /ok cho cùng kết quả sổ cái
như đường chat (cùng khoá sự kiện, cùng trạng thái). /ok không bao giờ chạm việc không có trường issue."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _lib import Box, payload
fails = []
B = Box()
try:
    t_no = B.new(issue=None)                       # T-001 không issue
    t_is = B.new(issue=7)                          # T-002 có issue
    t_is2 = B.new(issue=8)                         # T-003 có issue, quyết bằng chat
    r = B.task("decide", t_no, "--note", "chọn A qua chat")
    if B.state(t_no) != "doing": fails.append("decide qua chat trên việc không issue: việc không về doing")
    chat = B.events()[-1]
    B.task("decide", t_is2, "--note", "chọn A qua chat"); chat2 = B.events()[-1]
    if chat["event"] != "decided" or chat["from"] != "capu": fails.append("decide qua chat không còn ghi decided/from capu")
    # /ok không đụng việc không issue: issue 0, và issue rỗng không khớp "việc không có issue"
    for n in (0, 1, 99):
        B2 = Box()
        try:
            B2.new(issue=None); before = B2.snapshot()
            r = B2.ok(payload("/ok chọn A", issue=n))
            if B2.snapshot() != before or r["verdict"] == "decided":
                fails.append(f"/ok trên issue #{n} đụng việc không có issue")
        finally: B2.close()
    # parity: /ok cho cùng khoá sự kiện như chat
    r = B.ok(payload("/ok chọn A qua chat", issue=7))
    via = B.events()[-1]
    if r["verdict"] != "decided": fails.append(f"/ok trên T-002: {r['verdict']}/{r['reason']}")
    else:
        for k in ("event", "from", "to", "state", "holder", "round", "severity", "cost"):
            if via.get(k) != chat2.get(k): fails.append(f"sự kiện /ok khác chat ở khoá {k}: {via.get(k)!r} vs {chat2.get(k)!r}")
        if set(via) != set(chat2): fails.append(f"tập khoá sự kiện khác chat: {sorted(set(via)^set(chat2))}")
        if B.state(t_is) != B.state(t_is2): fails.append("trạng thái sau /ok khác sau chat")
    # sau /ok, quyết lần nữa qua chat bị task.py từ chối như cũ (không còn escalated)
    r2 = B.task("decide", t_is, "--note", "lần hai", ok=False)
    if r2.returncode == 0: fails.append("task.py decide lần hai trên việc đã quyết không bị từ chối")
finally:
    B.close()
assert not fails, "\n".join(fails)
print("PASS việc không issue quyết qua chat như cũ; /ok không chạm chúng; sự kiện /ok cùng hình với sự kiện chat")
