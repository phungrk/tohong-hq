#!/usr/bin/env python3
"""Tầng 3 T-063 · input: mirror_project.column_of() chạy trên runner Actions (TZ=UTC) cho việc done bậc B
cập nhật 50 giờ trước (giờ sổ cái = Asia/Ho_Chi_Minh). Mong đợi (ADR-012 §4: 'Chờ Capu' = done bậc B trong 48h):
'Xong'. Kèm các biên: done B 1h → 'Chờ Capu'; review + reviewer rỗng → 'Code Gate'; review spec-critic → 'Spec Gate';
done C → 'Chờ Capu'; done A → 'Xong'. Không mạng (chỉ gọi hàm)."""
import os, subprocess, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
code = r'''
import sys; sys.path.insert(0, "scripts")
from datetime import timedelta
import task, mirror_project as mp
def m(state, tier="B", reviewer="adversary", owner="engineering", h=0):
    return {"state": state, "tier": tier, "reviewer": reviewer, "owner": owner, "updated": task.stamp(task.now() - timedelta(hours=h))}
cases = [(m("done", h=50), "Xong"), (m("done", h=1), "Chờ Capu"), (m("review", reviewer=""), "Code Gate"),
         (m("review", reviewer="spec-critic"), "Spec Gate"), (m("done", tier="C", h=500), "Chờ Capu"),
         (m("done", tier="A", h=1), "Xong"), (m("escalated"), "Chờ Capu"), (m("spec"), "Spec")]
bad = [f"{c} → {mp.column_of(c)!r}, mong đợi {w!r}" for c, w in cases if mp.column_of(c) != w]
print("\n".join(bad)); sys.exit(1 if bad else 0)
'''
r = subprocess.run([sys.executable, "-I", "-c", code], cwd=ROOT, env=dict(os.environ, TZ="UTC"), capture_output=True, text=True)
assert r.returncode == 0, "column_of sai trên runner UTC:\n" + r.stdout + r.stderr
print("PASS column_of đúng cột, cửa sổ 48h tính theo giờ sổ cái")
