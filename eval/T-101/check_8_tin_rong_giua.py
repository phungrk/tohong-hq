#!/usr/bin/env python3
"""T-101 tiêu chí 8 (mục 7 spec): tin có stop_reason rỗng NẰM GIỮA transcript (sau nó còn tin khác) vẫn được tính và con trỏ đi qua nó;
chỉ tin rỗng CUỐI CÙNG của file bị hoãn (trừ --final). `backfill --dry-run` đếm đúng theo quy tắc đó.
Ca thật: msg_011CggouQsjh5b1tfwzVKm49 vị trí 1196/2177 của phiên 86243faa (tính đủ ~$385, dừng ở tin rỗng chỉ ~$198)."""
import sys, pathlib, re
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import lib
b = lib.Box(); fails = []
ok = lambda mids, empty=(): [(m, None if i in empty else "end_turn") for i, m in enumerate(mids)]
def pend(sid):
    r = b.run(["backfill", sid, "--dry-run"]); m = re.search(r"PENDING msgs=(\d+) usd=([\d.]+)", r.stdout)
    return r.returncode, (int(m.group(1)) if m else None)

# A. tin rỗng ở giữa, đuôi xong: phiên chính 5 tin (m2 rỗng), subagent 3 tin (m1 rỗng) → tính đủ 8
sid = "sess-8a"
b.write_stops(b.proj / f"{sid}.jsonl", "Việc T-101", ok([f"{sid}-m{i}" for i in range(5)], {2}))
b.write_stops(b.proj / sid / "subagents" / "agent-sa1.jsonl", "Giao việc T-101: x", ok([f"{sid}-sa1-m{i}" for i in range(3)], {1}), attr="engineering")
rc, n = pend(sid)
if (rc, n) != (1, 8): fails.append(f"A dry-run: thoát {rc}, msgs={n}; cần thoát 1, msgs=8 (tin rỗng giữa vẫn tính)")
r = b.run(["backfill", sid]); ev = b.events()
by = {e["src"]["agent"]: e["src"] for e in ev}
if abs(sum(e["cost"] for e in ev) - lib.usd(8)) > 1e-3: fails.append(f"A backfill tổng ${sum(e['cost'] for e in ev):.4f}, cần ${lib.usd(8):.4f}")
if by.get("main", {}).get("msgs") != 5 or by.get("main", {}).get("last") != f"{sid}-m4": fails.append(f"A con trỏ main phải qua tin rỗng tới m4, có {by.get('main')}")
if by.get("sa1", {}).get("msgs") != 3: fails.append(f"A sa1 phải tính 3 tin, có {by.get('sa1')}")
rc, n = pend(sid)
if (rc, n) != (0, 0): fails.append(f"A sau backfill dry-run: thoát {rc}, msgs={n}; cần 0/0")

# B. tin rỗng giữa VÀ tin rỗng cuối: hoãn đúng tin cuối, không mất tin giữa
sid = "sess-8b"; mp = b.proj / f"{sid}.jsonl"; mids = [f"{sid}-m{i}" for i in range(5)]
b.write_stops(mp, "Việc T-101", ok(mids, {2, 4}))
before = len(b.events())
rc, n = pend(sid)
if (rc, n) != (1, 4): fails.append(f"B dry-run: thoát {rc}, msgs={n}; cần 1/4 (m0..m3, hoãn m4)")
b.run(["backfill", sid]); m = [e["src"] for e in b.events()[before:]]
if [(s["msgs"], s["last"]) for s in m] != [(4, mids[3])]: fails.append(f"B lần 1 cần đúng 1 sự kiện (4, {mids[3]}), có {m}")
b.write_stops(mp, "Việc T-101", ok(mids, {2}))          # tin cuối đã xong, tin giữa vẫn rỗng
b.run(["backfill", sid]); m = [e["src"] for e in b.events()[before:]]
if [s["msgs"] for s in m] != [4, 5]: fails.append(f"B lần 2 phải thêm đúng phần tăng (msgs 4→5), có {[s['msgs'] for s in m]}")
tot = sum(e["cost"] for e in b.events()[before:])
if abs(tot - lib.usd(5)) > 1e-3: fails.append(f"B tổng ${tot:.4f}, cần ${lib.usd(5):.4f} (không mất, không trùng)")

# C. --final tính cả tin rỗng cuối
sid = "sess-8c"; mp = b.proj / f"{sid}.jsonl"
b.write_stops(mp, "Việc T-101", ok([f"{sid}-m{i}" for i in range(3)], {2})); b.age(mp)
before = len(b.events()); b.run(["backfill", sid, "--final"])
m = [e["src"]["msgs"] for e in b.events()[before:]]
if m != [3]: fails.append(f"C --final phải tính cả tin cuối rỗng (msgs 3), có {m}")

# D. hook Stop quét subagent sót: tin rỗng giữa vẫn tính
sid = "sess-8d"; mp = b.write_stops(b.proj / f"{sid}.jsonl", "Việc T-101", ok([f"{sid}-m0"]))
b.write_stops(b.proj / sid / "subagents" / "agent-sa1.jsonl", "Giao việc T-101: x", ok([f"{sid}-sa1-m{i}" for i in range(3)], {1}), attr="engineering")
before = len(b.events()); b.hook(b.payload("Stop", sid, mp))
sa = [e["src"]["msgs"] for e in b.events()[before:] if e["src"]["agent"] == "sa1"]
if sa != [3]: fails.append(f"D Stop: subagent sa1 tin rỗng giữa phải tính đủ 3, có {sa}")
lib.finish(fails)
