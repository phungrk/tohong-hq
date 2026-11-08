#!/usr/bin/env python3
"""T-103 adv-01 (tầng 3). Spec T-101 mục 5: "Mã phiên không có transcript nào ở DIR/*/<session>.jsonl: thoát 1,
không ghi gì"; mục 4: không đếm trùng. Input: mã phiên chứa ký tự glob ("*", "?", "[...]"), vd gõ nhầm/cắt dán.
Không có file nào tên đúng "*.jsonl" nên phải thoát 1 và sổ cái không đổi. Lỗi cũ: glob khớp transcript của phiên
khác, ghi sự kiện với src.session="*"; backfill mã thật sau đó ghi lại cùng tiền lần nữa (đếm trùng)."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "T-101"))
from lib import Box, finish

fails = []
for bad in ("*", "only-on?", "only-on[e]"):
    b = Box()
    main, subs = b.session("only-one"); b.age(main, *subs.values())
    r = b.run(["backfill", bad, "--dry-run"])
    if r.returncode != 1 or "PENDING" in r.stdout:
        fails.append(f"dry-run '{bad}': mong thoát 1 không PENDING, được {r.returncode} {r.stdout.strip()!r}")
    before = b.ledger_bytes()
    r = b.run(["backfill", bad])
    if r.returncode != 1 or b.ledger_bytes() != before:
        fails.append(f"backfill '{bad}': mong thoát 1 không ghi, được {r.returncode}, "
                     f"{len(b.events())} sự kiện session={[e['src']['session'] for e in b.events()][:1]}")
finish(fails)
