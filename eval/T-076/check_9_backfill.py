#!/usr/bin/env python3
"""T-076 tiêu chí 9: backfill một lần sự kiện `merged` cho các việc engineering bậc B/C đã done mà Capu xác nhận PR đã merge (2026-11-06): T-052 (3 PR), T-055, T-057, T-067, T-068, T-070.
Với T-044 (2 PR) và T-046 (1 PR) Engineering/Chief of Staff kiểm bằng REST rồi ghi `merged` cho PR đã merge, PR còn mở thì để nguyên (không ép ở eval này).
Danh sách PR lấy đúng như spec D3 (link sự kiện handoff của engineering + handoffs/<task>-v*.md); eval không đổi theo thời gian vì danh sách việc cố định.
Chạy: cd /home/user/tohong-hq && python3 eval/T-076/check_9_backfill.py
"""
import json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
MUST = ["T-052", "T-055", "T-057", "T-067", "T-068", "T-070"]
PR = re.compile(r"https://github\.com/phungrk/[\w.-]+/pull/\d+")
ev = [json.loads(l) for l in (ROOT / "ledger" / "events.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
merged = {e["link"] for e in ev if e["event"] == "merged" and re.match(r"merged\b", e.get("detail", ""))}
bad = []
for t in MUST:
    urls = []
    for e in ev:
        if e["task"] == t and e["event"] == "handoff" and e["from"] == "engineering":
            urls += PR.findall(e.get("link", "") + " " + e.get("detail", ""))
    for h in sorted((ROOT / "handoffs").glob(f"{t}-v*.md")):
        urls += PR.findall(h.read_text(encoding="utf-8"))
    urls = list(dict.fromkeys(urls))
    if not urls: bad.append(f"{t}: không tìm thấy PR nào (danh sách backfill sai?)"); continue
    miss = [u for u in urls if u not in merged]
    if miss: bad.append(f"{t}: thiếu sự kiện merged cho " + ", ".join(miss))
if bad:
    for b in bad: print("FAIL " + b)
    sys.exit(1)
print("PASS")
