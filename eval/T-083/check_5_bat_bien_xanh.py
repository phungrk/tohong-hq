#!/usr/bin/env python3
"""T-083 tiêu chí 4: bất biến hq/dashboard INV-006..009 và hq/ledger INV-001..004 xanh. Chạy từng cái, PASS khi mọi mã thoát 0.
Chạy: cd /home/user/tohong-hq && python3 eval/T-083/check_5_bat_bien_xanh.py"""
import subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
files = [p for d, rng in (("dashboard", range(6, 10)), ("ledger", range(1, 5))) for p in sorted((ROOT / "eval/invariants/hq" / d).glob("inv-0*"))
         if p.is_file() and int(p.name[4:7]) in rng]
bad = []
if len(files) != 8: bad.append(f"tìm thấy {len(files)} bất biến, cần 8")
for p in files:
    r = subprocess.run(["python3" if p.suffix == ".py" else "bash", str(p)], cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0: bad.append(f"{p.name}: " + (r.stdout.strip().splitlines() or [""])[-1][:160])
if bad:
    for b in bad: print("FAIL " + b)
    sys.exit(1)
print("PASS")
