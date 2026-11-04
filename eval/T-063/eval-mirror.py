#!/usr/bin/env python3
"""Eval tầng 1 của T-063: mirror_issue.py sinh đúng 4 mốc, đóng issue khi done, không trùng khi chạy lại,
   không bao giờ ghi vào sổ cái. Chạy khô trên một sổ cái giả, không gọi GitHub."""
import json, os, subprocess, sys, tempfile, pathlib, shutil
ROOT = pathlib.Path(__file__).resolve().parents[2]
tmp = pathlib.Path(tempfile.mkdtemp())
try:
    for d in ("scripts", "templates"):
        shutil.copytree(ROOT / d, tmp / d)
    (tmp / "board").mkdir(); (tmp / "ledger").mkdir(); (tmp / "eval").mkdir(); (tmp / "handoffs").mkdir(); (tmp / "products").mkdir()
    env = dict(os.environ, TOHONG_ROOT=str(tmp))
    def task(*args):
        r = subprocess.run([sys.executable, "scripts/task.py", *args], cwd=tmp, env=env, capture_output=True, text=True)
        assert r.returncode == 0, r.stderr + r.stdout
    task("new", "--title", "x", "--to", "product", "--tier", "B", "--area", "hq/ledger", "--issue", "7", "--criteria", "c", "--by", "chief-of-staff")
    task("new", "--title", "y", "--to", "engineering", "--tier", "C", "--area", "hq/ledger", "--criteria", "c", "--eval", "true", "--by", "chief-of-staff")  # không issue
    task("start", "T-001", "--by", "product"); task("handoff", "T-001", "--by", "product", "--eval", "true")
    task("accept", "T-001", "--by", "spec-critic", "--note", "INV-1 thêm")
    state = tmp / "state"
    def mirror():
        r = subprocess.run([sys.executable, "scripts/mirror_issue.py", "--state", str(state), "--dry-run"], cwd=tmp, env=env, capture_output=True, text=True)
        assert r.returncode == 0, r.stderr; return r.stdout
    out = mirror()  # lần đầu cũng phản chiếu (chống trùng bằng marker trên issue)
    assert "①" in out and "②" in out and "T-001 → issue #7" in out, out
    assert "T-002" not in out, "việc không có issue bị phản chiếu"
    assert out.count("PATCH") >= 1 and '"state": "closed"' in out, "done bậc B sau Spec Gate phải đóng issue:\n" + out
    before = (tmp / "ledger/events.jsonl").read_text(); 
    mirror()
    assert (tmp / "ledger/events.jsonl").read_text() == before, "mirror ghi vào sổ cái"
    print("PASS 4 mốc, đóng khi done, không chạm sổ cái")
finally:
    shutil.rmtree(tmp, ignore_errors=True)
