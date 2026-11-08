#!/usr/bin/env python3
"""T-101 tiêu chí 12 (mục 10 spec): hai chốt an toàn cho lần chạy thật.
(a) `--expect-usd X.XXXX`: số tiền chờ ghi lúc chạy khác X (vd sau rebase đã có người backfill rồi) → thoát 5, không ghi; bằng X → ghi; không có cờ thì hành vi cũ;
(b) `--final` trên phiên còn đang chạy (có transcript sửa trong 300 giây gần nhất) → thoát 6, không ghi; transcript đã cũ thì cho; `--allow-running` cho qua nhưng in cảnh báo ra stderr."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import lib
fails = []; b = lib.Box(); sid = "sess-12"
main, subs = b.session(sid)
x = f"{lib.usd(9):.4f}"; wrong = f"{lib.usd(9) + 1:.4f}"
snap = b.ledger_bytes(); r = b.run(["backfill", sid, "--expect-usd", wrong])
if r.returncode != 5 or b.ledger_bytes() != snap: fails.append(f"(a) số lệch: thoát {r.returncode}, sổ cái đổi={b.ledger_bytes() != snap}; cần 5 và không ghi")
r = b.run(["backfill", sid, "--expect-usd", x])
if r.returncode != 0 or len(b.events()) != 3: fails.append(f"(a) số khớp {x}: thoát {r.returncode}, {len(b.events())} sự kiện; cần 0 và 3")
snap = b.ledger_bytes(); r = b.run(["backfill", sid, "--expect-usd", x])
if r.returncode != 5 or b.ledger_bytes() != snap: fails.append(f"(a) đã ghi rồi mà vẫn mong {x}: thoát {r.returncode}; cần 5 (đã có người ghi)")
r = b.run(["backfill", sid])
if r.returncode != 0: fails.append(f"(a) không --expect-usd, không còn gì ghi: thoát {r.returncode}, cần 0")

b = lib.Box(); sid = "sess-12b"; main, subs = b.session(sid, tail_unfinished=True)
snap = b.ledger_bytes(); r = b.run(["backfill", sid, "--final"])
if r.returncode != 6 or b.ledger_bytes() != snap or not r.stderr.strip(): fails.append(f"(b) --final trên phiên đang chạy: thoát {r.returncode}, đổi={b.ledger_bytes() != snap}; cần 6, không ghi, có lý do ở stderr")
r = b.run(["backfill", sid, "--final", "--allow-running"])
if r.returncode != 0 or not r.stderr.strip() or not any(e["src"]["agent"] == "main" and e["src"]["msgs"] == 3 for e in b.events()):
    fails.append(f"(b) --allow-running: thoát {r.returncode}, stderr trống={not r.stderr.strip()}; cần 0, có cảnh báo, tính cả tin cuối")
b = lib.Box(); sid = "sess-12c"; main, subs = b.session(sid, tail_unfinished=True); b.age(main, *subs.values())
r = b.run(["backfill", sid, "--final"])
if r.returncode != 0 or not any(e["src"]["agent"] == "main" and e["src"]["msgs"] == 3 for e in b.events()): fails.append(f"(b) transcript đã cũ: --final thoát {r.returncode}; cần 0 và tính tin cuối")
lib.finish(fails)
