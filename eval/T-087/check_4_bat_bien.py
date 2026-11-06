#!/usr/bin/env python3
"""T-087 tiêu chí 4: mọi bất biến hq/ledger và hq/dashboard (cùng _shared) xanh trên sổ cái thật. Chạy: python3 eval/T-087/check_4_bat_bien.py"""
import subprocess, sys
import _lib as L
fails = []
for area in ("_shared", "hq", "hq/ledger", "hq/dashboard"):
    d = L.ROOT / "eval" / "invariants" / area
    for f in sorted(d.glob("inv-*")):
        if f.suffix not in (".py", ".sh"): continue
        r = subprocess.run(["python3" if f.suffix == ".py" else "bash", str(f)], capture_output=True, text=True, cwd=str(L.ROOT))
        if r.returncode != 0 and "thiếu d3.min.js" not in r.stdout + r.stderr:  # môi trường thiếu D3: để Code Gate tầng 2 chạy
            fails.append(f"{area}/{f.name}: {(r.stdout + r.stderr).strip()[:120]}")
L.chk(not fails, "; ".join(fails))
L.done()
