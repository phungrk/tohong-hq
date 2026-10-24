#!/usr/bin/env python3
"""Hook PostToolUse của Claude Code: ghi nhật ký mỗi khi agent ghi file vào sổ cái.

Claude Code gọi script này sau mỗi lần dùng Write hoặc Edit, truyền JSON qua stdin
(có tool_name và tool_input.file_path). Script ghi thêm một dòng vào ledger/events.jsonl:

  - ghi vào handoffs/, decisions/, inbox/, reports/, products/  → sự kiện "file_written"
  - sửa tay file trong board/                                  → sự kiện "board_edited_directly"
    (vi phạm hiến pháp: trạng thái phải đổi bằng scripts/task.py)

Hook không bao giờ chặn agent: lỗi gì cũng thoát êm với mã 0.
"""
import json
import os
import sys
from datetime import datetime
from pathlib import Path

WATCHED = ("handoffs/", "decisions/", "inbox/", "reports/", "products/")


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    tool = data.get("tool_name", "")
    path = (data.get("tool_input") or {}).get("file_path", "")
    if not path:
        return
    root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or ".").resolve()
    try:
        rel = Path(path).resolve().relative_to(root).as_posix()
    except ValueError:
        return

    if rel.startswith("board/"):
        event, detail = "board_edited_directly", f"{tool} sửa tay {rel}: phải dùng scripts/task.py"
    elif rel.startswith(WATCHED):
        event, detail = "file_written", f"{tool} {rel}"
    else:
        return

    task = ""
    name = Path(rel).name
    if name.startswith("T-"):
        task = name.split("-v")[0].split("-D")[0].split(".")[0]
        task = "-".join(task.split("-")[:2])

    ledger = root / "ledger" / "events.jsonl"
    ledger.parent.mkdir(parents=True, exist_ok=True)
    n = sum(1 for l in ledger.open(encoding="utf-8") if l.strip()) if ledger.exists() else 0
    try:
        from zoneinfo import ZoneInfo
        t = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh"))
    except Exception:
        t = datetime.now()
    row = {
        "id": f"E-{n + 1:04d}", "t": t.strftime("%Y-%m-%dT%H:%M"), "task": task, "title": "",
        "event": event, "from": data.get("agent_type") or "session", "to": rel.split("/")[0],
        "round": 0, "severity": "warning" if event == "board_edited_directly" else "",
        "detail": detail, "link": rel, "cost": 0,
    }
    with ledger.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
