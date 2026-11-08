#!/usr/bin/env python3
"""T-103 adv-05 (tầng 3). Spec T-101 mục 10 + mã thoát chung: --expect-usd X.XXXX; lỗi → 2, lệch → 5; 1 chỉ cho
"không có transcript"/"dry-run còn thiếu". Input: --expect-usd không phải số ("abc", "$882.16", "882,16").
Mong: không ghi gì, không traceback, mã thoát 2 hoặc 5 (không phải 1)."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "T-101"))
from lib import Box, finish

fails = []
b = Box()
main, subs = b.session("s-exp"); b.age(main, *subs.values())
for x in ("abc", "$882.16", "882,16"):
    before = b.ledger_bytes()
    r = b.run(["backfill", "s-exp", "--expect-usd", x])
    if b.ledger_bytes() != before or r.returncode not in (2, 5) or "Traceback" in r.stderr:
        fails.append(f"{x!r}: thoát {r.returncode}, ghi={b.ledger_bytes() != before}, traceback={'Traceback' in r.stderr}")
finish(fails)
