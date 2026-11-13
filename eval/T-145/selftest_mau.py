#!/usr/bin/env python3
"""Tự kiểm bộ eval T-145 (không phải eval của tiêu chí): chạy check_1 trên các workflow mẫu trong eval/T-145/mau/.
xanh-*.yml phải PASS (kể cả cách gọi `git -C <dir>` và `git -c user.*=… commit`), do-*.yml phải FAIL. In PASS hoặc FAIL <lý do>."""
import os, pathlib, subprocess, sys
here = pathlib.Path(__file__).resolve().parent
bad = []
for f in sorted((here / "mau").glob("*.yml")):
    r = subprocess.run([sys.executable, "-I", str(here / "check_1_workflow.py")], env={**os.environ, "T145_WORKFLOW": str(f)}, capture_output=True, text=True)
    want = 0 if f.name.startswith("xanh-") else 1
    if r.returncode != want: bad.append(f"{f.name}: mong thoát {want}, thấy {r.returncode} ({r.stdout[:120].strip()})")
print("PASS" if not bad else "FAIL " + " | ".join(bad)); sys.exit(1 if bad else 0)
