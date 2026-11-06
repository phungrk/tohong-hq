#!/usr/bin/env python3
"""DỰ THẢO bất biến hq/dashboard (T-081): mọi link issue trong `capu_queue` của bản --public (xuất từ sổ cái thật) là https://github.com/phungrk/tohong-hq/issues/<n>
với <n> đúng bằng trường `issue` trên board của việc đó (số nguyên dương, không số 0 đứng đầu), nhãn "Issue #<n>", pr_state rỗng, tối đa một link issue mỗi việc;
việc không có `issue` hợp lệ thì không có link issue; `tasks[]` công khai không có khoá `issue`. Spec Critic rút vào eval/invariants/hq/dashboard/ khi T-081 qua Spec Gate.
Chạy: cd /home/user/tohong-hq && python3 eval/T-081/inv-draft-013-link-issue-dung-so-viec.py
"""
import json, os, re, subprocess, sys, tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
env = {k: v for k, v in os.environ.items() if k not in ("PR_READ_TOKEN", "TOHONG_ROOT")}
with tempfile.TemporaryDirectory() as tmp:
    r = subprocess.run([sys.executable, str(ROOT / "scripts/export_dashboard.py"), "--public", "--out", tmp], capture_output=True, text=True, env=env)
    if r.returncode: print("FAIL exporter --public không chạy: " + (r.stderr.strip().splitlines() or ["?"])[-1]); sys.exit(1)
    d = json.loads((Path(tmp) / "dashboard.json").read_text(encoding="utf-8"))
if "capu_queue" not in d: print("PASS chưa áp dụng: chưa có capu_queue"); sys.exit(0)
bad = []
board = {}
for f in (ROOT / "board").glob("T-*.md"):
    m = re.search(r'(?m)^issue:\s*"?([^"\n]*)"?\s*$', f.read_text(encoding="utf-8")); board[f.stem] = m.group(1).strip() if m else ""
for e in d["capu_queue"]:
    iss = [l for l in e["links"] if "/issues/" in l["url"]]; b = board.get(e["task"], ""); ok = bool(re.fullmatch(r"[1-9][0-9]*", b))
    if len(iss) > 1: bad.append(f"{e['task']}: {len(iss)} link issue")
    for l in iss:
        if not ok or l["url"] != f"https://github.com/phungrk/tohong-hq/issues/{b}" or l["label"] != f"Issue #{b}" or l["pr_state"] != "": bad.append(f"{e['task']}: link issue {l} không khớp board issue={b!r}")
    if ok and not iss: bad.append(f"{e['task']}: board có issue {b} mà thiếu link issue")
if any("issue" in t for t in d["tasks"]): bad.append("tasks[] công khai có khoá issue")
for b in bad: print("FAIL " + b)
print("FAIL" if bad else "PASS", f"{len(d['capu_queue'])} phần tử capu_queue")
sys.exit(1 if bad else 0)
