#!/usr/bin/env python3
"""T-101 tiêu chí 3: Stop (rồi SessionEnd) từ cwd ≠ tohong-hq ghi toàn bộ phần chưa tính của phiên chính (cho chief-of-staff)
VÀ của mọi subagent mà hook SubagentStop đã bỏ sót; ở subagent được quét sót, tin cuối chưa có stop_reason (đang ghi dở)
chưa tính; SessionEnd ngay sau Stop không thêm gì; khi tin dở đã xong, Stop kế tiếp ghi đúng phần tăng thêm."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import lib
b = lib.Box(); sid = "sess-3"; fails = []
subs_spec = (("sa1", "engineering", "T-101", 2), ("sa2", "reviewer", "T-101", 4, True))   # sa2: 3 tin xong + 1 dở
main, subs = b.session(sid, main_msgs=4, subs=subs_spec)
r = b.hook(b.payload("Stop", sid, main))
ev = b.events()
by = {(e["src"]["agent"]): e for e in ev}
if r.returncode != 0 or r.stdout.strip(): fails.append(f"Stop: thoát {r.returncode}, stdout {r.stdout[:40]!r}")
if set(by) != {"main", "sa1", "sa2"} or len(ev) != 3: fails.append(f"cần 3 sự kiện main/sa1/sa2, có {[e['src']['agent'] for e in ev]}")
else:
    if by["main"]["from"] != "chief-of-staff": fails.append(f"main from={by['main']['from']!r}")
    if by["main"]["src"]["msgs"] != 4: fails.append(f"main tính {by['main']['src']['msgs']} tin, cần 4")
    if by["sa2"]["src"]["msgs"] != 3: fails.append(f"sa2 tính {by['sa2']['src']['msgs']} tin, cần 3 (bỏ tin dở)")
    if by["sa1"]["from"] != "engineering" or by["sa2"]["from"] != "reviewer": fails.append("agent của subagent quét sót sai")
    exp = lib.usd(4) + lib.usd(2) + lib.usd(3)
    if abs(sum(e["cost"] for e in ev) - exp) > 1e-3: fails.append(f"tổng {sum(e['cost'] for e in ev):.4f}, cần {exp:.4f}")
r = b.hook(b.payload("SessionEnd", sid, main))
if len(b.events()) != 3: fails.append(f"SessionEnd ngay sau Stop thêm sự kiện ({len(b.events())} thay vì 3)")
b.write(subs["sa2"], "Giao việc T-101: làm đi", [f"{sid}-sa2-m{i}" for i in range(4)], attr="reviewer")  # tin dở đã xong
b.hook(b.payload("Stop", sid, main))
ev = b.events(); sa2 = [e for e in ev if e["src"]["agent"] == "sa2"]
if len(ev) != 4 or [e["src"]["msgs"] for e in sa2] != [3, 4]: fails.append(f"tin dở đã xong: cần thêm đúng 1 sự kiện sa2 (msgs 3→4), có {len(ev)} sự kiện, sa2={[e['src']['msgs'] for e in sa2]}")
lib.finish(fails)
