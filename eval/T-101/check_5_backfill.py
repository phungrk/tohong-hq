#!/usr/bin/env python3
"""T-101 tiêu chí 5: `cost.py backfill <session>` tìm transcript theo mã phiên trong $HOME/.claude/projects/*/
(không cần biết thư mục dự án), ghi đúng phần chưa tính của phiên chính + mọi subagent, tính từ con trỏ nếu đã ghi một phần,
chạy lần hai không thêm gì; tin cuối chưa có stop_reason chỉ được tính khi có --final; phiên không tồn tại → thoát 1, không ghi gì."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import lib
b = lib.Box(); sid = "sess-5"; fails = []
main, subs = b.session(sid, main_msgs=4, tail_unfinished=True)
# đã ghi một phần: SubagentStop của sa1 chạy được, phần còn lại thì không
b.hook(b.payload("SubagentStop", sid, main, "sa1", "engineering", subs["sa1"]))
before = len(b.events())
r = b.run(["backfill", sid])
if r.returncode != 0: fails.append(f"backfill thoát {r.returncode}: {(r.stderr or r.stdout)[:120]}")
ev = b.events()
keys = sorted(e["src"]["agent"] for e in ev)
if keys != ["main", "sa1", "sa2"]: fails.append(f"sau backfill cần main/sa1/sa2 mỗi cái đúng một sự kiện, có {keys}")
exp = lib.usd(3) + lib.usd(2) + lib.usd(4)
if abs(sum(e["cost"] for e in ev) - exp) > 1e-3: fails.append(f"tổng {sum(e['cost'] for e in ev):.4f}, cần {exp:.4f}")
if len(ev) - before != 2: fails.append(f"backfill phải thêm đúng 2 sự kiện (main, sa2), thêm {len(ev) - before}")
b.run(["backfill", sid])
if len(b.events()) != len(ev): fails.append("chạy backfill lần hai vẫn thêm sự kiện")
r = b.run(["backfill", sid, "--final"])
m = [e for e in b.events() if e["src"]["agent"] == "main"]
if len(m) != 2 or m[-1]["src"]["msgs"] != 4: fails.append(f"--final phải thêm tin dở của phiên chính (msgs=4), có {[e['src']['msgs'] for e in m]}")
snap = b.ledger_bytes()
r = b.run(["backfill", "khong-co-phien-nay"])
if r.returncode != 1 or b.ledger_bytes() != snap: fails.append(f"phiên không tồn tại: thoát {r.returncode}, hoặc đã ghi sổ cái")
lib.finish(fails)
