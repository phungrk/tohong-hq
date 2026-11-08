#!/usr/bin/env python3
"""T-101 tiêu chí 4: không đếm trùng. Cùng payload gửi hai lần; SubagentStop rồi Stop quét lại cùng subagent;
4 tiến trình hook chạy đồng thời: mỗi (phiên, agent) có đúng một sự kiện, tổng tiền = tiền thật của transcript."""
import sys, pathlib, subprocess, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import lib
b = lib.Box(); sid = "sess-4"; fails = []
main, subs = b.session(sid)            # main 3 tin, sa1 2 tin, sa2 4 tin; không tin dở
p = b.payload("SubagentStop", sid, main, "sa1", "engineering", subs["sa1"])
b.hook(p); b.hook(p)
if len(b.events()) != 1: fails.append(f"cùng payload hai lần → {len(b.events())} sự kiện, cần 1")
procs = [subprocess.Popen([sys.executable, str(lib.COST), "hook"], stdin=subprocess.PIPE, text=True,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=str(b.launch), env=b.env())
         for _ in range(4)]
for pr in procs:
    pr.stdin.write(json.dumps(b.payload("Stop", sid, main))); pr.stdin.close()
for pr in procs: pr.wait(timeout=60)
ev = b.events()
keys = [(e["src"]["session"], e["src"]["agent"]) for e in ev]
if len(keys) != len(set(keys)): fails.append(f"có (phiên, agent) bị ghi hơn một lần: {sorted(keys)}")
if sorted(k[1] for k in keys) != ["main", "sa1", "sa2"]: fails.append(f"cần main/sa1/sa2 mỗi cái một lần, có {sorted(k[1] for k in keys)}")
exp = lib.usd(3) + lib.usd(2) + lib.usd(4)
if abs(sum(e["cost"] for e in ev) - exp) > 1e-3: fails.append(f"tổng {sum(e['cost'] for e in ev):.4f}, cần {exp:.4f}")
bt = b.root / "board" / "T-101.md"
lib.finish(fails)
