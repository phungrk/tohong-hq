#!/usr/bin/env python3
"""T-083 tiêu chí 3: inbox/capu/da-quyet/ không có nghĩa gì với bước xuất; trạng thái "đã trả lời" chỉ đến từ sổ cái; thư mục này không còn trong sổ cái thật.
Chạy: cd /home/user/tohong-hq && python3 eval/T-083/check_3_da_quyet_khong_quet.py"""
import tempfile
from pathlib import Path
from lib import *
c = Checker()
with tempfile.TemporaryDirectory() as tmp:
    tasks = {"T-931": dict(state="escalated", owner="engineering", tier="B", updated="2026-11-06T10:00"),
             "T-932": dict(state="done", owner="engineering", tier="A", updated="2026-11-06T10:00")}
    evs = [ev(1, "T-931", "escalated", "q", frm="product"), ev(2, "T-932", "merged", "merged", PR_A)]
    fake = build(tmp, tasks, evs)
    sub = fake / "inbox" / "capu" / "da-quyet"; sub.mkdir()
    for n in ("T-931-x.md", "T-932-y.md"):
        (sub / n).write_text("---\ntype: decision-request\ndecide-by: 2026-11-01\n---\nx\n", encoding="utf-8")
    q, err = export(fake, Path(tmp) / "out")
    c.chk(q is not None, f"export lỗi: {err}")
    b = by_task(q["capu_queue"]) if q else {}
    c.chk("T-932" not in b, "file chỉ nằm trong da-quyet/ của việc không cần quyết: không tạo dòng 'decision'")
    t = b.get("T-931", {})
    c.chk(t.get("kind") == "escalated" and t.get("decide_by") == "" and [l["url"] for l in t.get("links", [])] == ["https://github.com/phungrk/tohong-hq/tree/main/inbox/capu"],
          f"T-931 escalated mà file DR chỉ có trong da-quyet/: coi như chưa có file (link thư mục inbox/capu, không có hạn, không link vào da-quyet); thấy {t}")
    c.chk("da-quyet" not in str(q["capu_queue"]), "không dấu vết da-quyet trong capu_queue")
    # file DR nằm ở inbox/capu/ đã có decided -> không cần chuyển file đi đâu
    (fake / "inbox" / "capu" / "T-932-z.md").write_text("---\ndecide-by: 2026-11-10\n---\nx\n", encoding="utf-8")
    with open(fake / "ledger" / "events.jsonl", "a", encoding="utf-8") as f:
        import json; f.write(json.dumps(ev(3, "T-932", "decided", "ok", frm="capu")) + "\n")
    q, _ = export(fake, Path(tmp) / "out")
    c.chk(q is not None and "T-932" not in by_task(q["capu_queue"]), "DR còn nguyên ở inbox/capu/ nhưng đã decided: không vào capu_queue (không cần chuyển file)")
# sổ cái thật
c.chk(not (ROOT / "inbox" / "capu" / "da-quyet").exists(), "inbox/capu/da-quyet/ không còn trong sổ cái thật (file đã trả về inbox/capu/)")
c.chk(any(ROOT.joinpath("inbox", "capu").glob("T-070-*.md")), "DR của T-070 nằm ở inbox/capu/T-070-*.md")
import subprocess
g = subprocess.run(["grep", "-rIl", "da-quyet", "scripts", "templates", "handbook", ".claude", "CLAUDE.md"], cwd=ROOT, capture_output=True, text=True).stdout.split()
c.chk(not g, f"không còn tham chiếu da-quyet trong scripts/templates/handbook/.claude/CLAUDE.md: {g}")
c.done()
