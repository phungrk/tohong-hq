#!/usr/bin/env python3
"""T-101 tiêu chí 2: SubagentStop gọi từ cwd ≠ tohong-hq, không có CLAUDE_PROJECT_DIR → đúng MỘT sự kiện cost
cho subagent đó (đúng agent_type, đúng mã T-xxx trong lời giao việc, đúng tiền theo bảng giá), stdout rỗng, thoát 0.
Một tin API ghi thành 2 dòng transcript chỉ tính một lần."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import lib
b = lib.Box(); sid = "sess-2"; fails = []
main, subs = b.session(sid)
r = b.hook(b.payload("SubagentStop", sid, main, "sa1", "engineering", subs["sa1"]))
ev = b.events()
if r.returncode != 0: fails.append(f"hook thoát {r.returncode}")
if r.stdout.strip(): fails.append(f"hook in stdout: {r.stdout[:60]!r}")
if len(ev) != 1: fails.append(f"cần đúng 1 sự kiện cost, có {len(ev)}")
else:
    e = ev[0]
    if e["from"] != "engineering": fails.append(f"from={e['from']!r}, cần 'engineering'")
    if e["task"] != "T-101": fails.append(f"task={e['task']!r}, cần 'T-101'")
    if abs(e["cost"] - lib.usd(2)) > 1e-4: fails.append(f"cost={e['cost']}, cần {lib.usd(2):.4f}")
    s = e.get("src") or {}
    if (s.get("session"), s.get("agent"), s.get("msgs")) != (sid, "sa1", 2): fails.append(f"src={s}")
lib.finish(fails)
