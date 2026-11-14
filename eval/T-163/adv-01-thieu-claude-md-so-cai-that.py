#!/usr/bin/env python3
"""Eval đối kháng T-163 (adversary). Spec T-162 Hành vi 4(a): không có dòng bộ phận nào khớp -> export in lỗi, thoát khác 0, không ghi đè dashboard.json.
Input: sổ cái chạy như workflow publish-dashboard-data (KHÔNG đặt TOHONG_ROOT, script nằm trong chính sổ cái) nhưng CLAUDE.md bị xoá/đổi tên.
Mong đợi: thoát khác 0, dashboard.json đang có còn nguyên, roster không quay về org/roster.json (vendor-ops, growth, finance).
Chạy từ gốc tohong-hq: python3 eval/T-163/adv-01-thieu-claude-md-so-cai-that.py"""
import json, os, shutil, subprocess, sys, tempfile
from pathlib import Path
ROOT = Path.cwd()
if not (ROOT / "scripts" / "export_dashboard.py").is_file(): ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory() as t:
    t = Path(t); shutil.copytree(ROOT / "scripts", t / "scripts", ignore=shutil.ignore_patterns("__pycache__"))
    (t / "board").mkdir(); (t / "org").mkdir(); (t / "ledger").mkdir(); (t / "ledger" / "events.jsonl").write_text("", encoding="utf-8")
    roles = [{"id": i, "name": i, "role": "", "kind": "human" if i == "capu" else "agent", "reports_to": "", "mission": "", "agent_file": ""}
             for i in ["capu", "chief-of-staff", "product", "engineering", "vendor-ops", "growth", "finance"]]
    (t / "org" / "roster.json").write_text(json.dumps({"roles": roles}), encoding="utf-8")
    out = t / "out"; out.mkdir(); (out / "dashboard.json").write_text("SENTINEL", encoding="utf-8")
    env = {k: v for k, v in os.environ.items() if k != "TOHONG_ROOT"}
    r = subprocess.run([sys.executable, str(t / "scripts" / "export_dashboard.py"), "--public", "--out", str(out)], capture_output=True, text=True, env=env, cwd=str(t))
    why = []
    if r.returncode == 0: why.append("CLAUDE.md vắng trên sổ cái thật mà export vẫn thoát 0 (workflow xanh giả)")
    if (out / "dashboard.json").read_text(encoding="utf-8") != "SENTINEL":
        try: ids = [x["id"] for x in json.loads((out / "dashboard.json").read_text(encoding="utf-8"))["roster"]]
        except Exception: ids = "?"
        why.append(f"dashboard.json đang có bị ghi đè, roster = {ids}")
print("PASS" if not why else "FAIL " + " | ".join(why)); sys.exit(1 if why else 0)
