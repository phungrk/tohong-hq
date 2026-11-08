#!/usr/bin/env python3
"""Bằng chứng nguyên nhân T-101 (không phải eval; chỉ đọc). Dùng: python3 eval/T-101/tim_nguyen_nhan.py [transcript.jsonl]
Đếm các dòng stop_hook_summary trong transcript phiên chính: nếu hook cost.py của dự án được nạp thì Stop phải chạy >= 2 hook
(git-check của người dùng + cost.py). Thấy hookCount luôn là 1 dù cwd đã chuyển vào tohong-hq → hook dự án không được nạp."""
import collections, glob, json, os, sys
p = sys.argv[1] if len(sys.argv) > 1 else (glob.glob(os.path.expanduser("~/.claude/projects/*/" + os.environ.get("CLAUDE_CODE_SESSION_ID", "*") + ".jsonl")) or [""])[0]
if not os.path.exists(p): print("không thấy transcript"); sys.exit(0)
c, first = collections.Counter(), None
for l in open(p, encoding="utf-8"):
    try: r = json.loads(l)
    except ValueError: continue
    first = first or r.get("cwd")
    if r.get("subtype") == "stop_hook_summary":
        c[(r["hookCount"], os.path.basename(r.get("cwd", "")) or "?")] += 1
print("cwd dòng đầu:", first)
for (n, d), v in sorted(c.items()): print(f"  Stop chạy {n} hook · cwd={d}: {v} lần")
