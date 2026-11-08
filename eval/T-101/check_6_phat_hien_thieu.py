#!/usr/bin/env python3
"""T-101 tiêu chí 6: `cost.py backfill <session> --dry-run` không ghi byte nào vào sổ cái, in đúng một dòng
`PENDING msgs=<n> usd=<x.xxxx>` và thoát 1 khi còn phần chưa ghi, thoát 0 khi đã đủ. (Để lần sau hook hỏng
thì phát hiện ngay trong một lệnh, không phải chờ một ngày.)"""
import sys, pathlib, re
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import lib
b = lib.Box(); sid = "sess-6"; fails = []
main, subs = b.session(sid)            # 3 + 2 + 4 = 9 tin xong
snap = b.ledger_bytes()
r = b.run(["backfill", sid, "--dry-run"])
lines = [l for l in r.stdout.splitlines() if l.startswith("PENDING")]
m = re.fullmatch(r"PENDING msgs=(\d+) usd=(\d+\.\d{4})", lines[0]) if len(lines) == 1 else None
if r.returncode != 1: fails.append(f"còn thiếu mà thoát {r.returncode}, cần 1")
if b.ledger_bytes() != snap: fails.append("--dry-run đã ghi vào sổ cái")
if not m: fails.append(f"cần đúng một dòng 'PENDING msgs=<n> usd=<x.xxxx>', có {r.stdout[:80]!r}")
elif int(m.group(1)) != 9 or abs(float(m.group(2)) - lib.usd(9)) > 1e-3:
    fails.append(f"PENDING {m.group(0)}, cần msgs=9 usd={lib.usd(9):.4f}")
b.run(["backfill", sid])
r = b.run(["backfill", sid, "--dry-run"])
if r.returncode != 0 or "PENDING msgs=0 usd=0.0000" not in r.stdout: fails.append(f"đã đủ mà dry-run thoát {r.returncode}: {r.stdout[:60]!r}")
lib.finish(fails)
