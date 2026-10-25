#!/usr/bin/env python3
"""Hook PreToolUse: phát "nhịp hoạt động" của agent lên dashboard realtime.

Mỗi khi một agent sắp dùng công cụ, gửi một nhịp ngắn: agent nào, đang làm loại việc gì
(đọc code, sửa file, chạy lệnh, tra cứu, giao việc). Không gửi lệnh, nội dung hay đường dẫn.
Mỗi agent tối đa một nhịp mỗi 10 giây. Không bao giờ chặn agent.
"""
import json
import os
import re
import sys
import tempfile
import time
from pathlib import Path

THROTTLE_S = 10
ACTIONS = {
    "Bash": "chạy lệnh", "Edit": "sửa file", "Write": "viết file", "NotebookEdit": "sửa file",
    "Read": "đọc tài liệu", "Grep": "tìm trong code", "Glob": "tìm file",
    "WebSearch": "tra cứu web", "WebFetch": "đọc trang web",
    "Task": "giao việc cho bộ phận", "Agent": "giao việc cho bộ phận",
    "TodoWrite": "lập kế hoạch", "TaskCreate": "lập kế hoạch", "TaskUpdate": "cập nhật kế hoạch",
}


def main():
    if not os.environ.get("TOHONG_LIVE_URL") or not os.environ.get("TOHONG_LIVE_TOKEN"):
        return
    data = json.load(sys.stdin)
    agent = data.get("agent_type") or "chief-of-staff"
    if not re.fullmatch(r"[\w.-]{1,40}", agent):
        return
    tool = data.get("tool_name", "")
    action = ACTIONS.get(tool, "làm việc")

    stamp = Path(tempfile.gettempdir()) / f"tohong-activity-{agent}"
    now = time.time()
    try:
        last = json.loads(stamp.read_text())
        if now - last.get("at", 0) < THROTTLE_S and last.get("action") == action:
            return
    except Exception:
        pass
    stamp.write_text(json.dumps({"at": now, "action": action}))

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import live
    live.emit_activity(agent, action, tool)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
