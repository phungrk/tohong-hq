#!/usr/bin/env python3
"""Eval T-162 tiêu chí 4: scripts/export_dashboard.py chỉ đưa vào roster các bộ phận có trong CLAUDE.md.
Quy tắc: giữ `capu`, `chief-of-staff`, và mọi id nằm trong danh sách bộ phận của CLAUDE.md (dòng dạng "- `id` — mô tả"); bỏ phần còn lại (vendor-ops, growth, finance, reviewer, chatgpt).
Chạy từ gốc tohong-hq, dùng thư mục giả qua TOHONG_ROOT, không ghi vào repo. In PASS hoặc FAIL <lý do>."""
import json, os, re, subprocess, sys, tempfile
from pathlib import Path
ROOT = Path.cwd()
if not (ROOT / "scripts" / "export_dashboard.py").is_file(): ROOT = Path(__file__).resolve().parents[2]
def role(i, kind="agent"): return {"id": i, "name": i, "role": "", "kind": kind, "reports_to": "", "mission": "", "agent_file": ""}
def run(claude_md, ids):
    with tempfile.TemporaryDirectory() as t:
        t = Path(t); (t / "board").mkdir(); (t / "org").mkdir()
        (t / "CLAUDE.md").write_text(claude_md, encoding="utf-8")
        (t / "org" / "roster.json").write_text(json.dumps({"roles": [role(i, "human" if i == "capu" else "agent") for i in ids]}), encoding="utf-8")
        r = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(t / "out")], capture_output=True, text=True, env=dict(os.environ, TOHONG_ROOT=str(t)))
        if r.returncode: return None, (r.stderr.strip().splitlines() or ["?"])[-1][:150]
        return [x["id"] for x in json.loads((t / "out" / "roster.json").read_text(encoding="utf-8"))], ""
why = []
real = (ROOT / "CLAUDE.md").read_text(encoding="utf-8")
allids = ["capu", "chief-of-staff", "insight", "product", "spec-critic", "engineering", "adversary", "vendor-ops", "growth", "finance", "reviewer", "chatgpt"]
got, err = run(real, allids)
want = ["capu", "chief-of-staff", "insight", "product", "spec-critic", "engineering", "adversary"]
if got is None: why.append("export sập với CLAUDE.md thật: " + err)
elif sorted(got) != sorted(want): why.append(f"CLAUDE.md thật: roster = {sorted(got)}, phải là {sorted(want)}")
# sinh theo CLAUDE.md, không viết cứng: CLAUDE.md giả có bộ phận `qa`, không có insight
fake = "# X\n\n- `product` — Spec Writer\n- `qa` — kiểm thử\n\nBạn giao việc cho các bộ phận trên.\n"
got2, err2 = run(fake, ["capu", "chief-of-staff", "product", "qa", "insight", "growth"])
if got2 is None: why.append("export sập với CLAUDE.md giả: " + err2)
elif sorted(got2) != ["capu", "chief-of-staff", "product", "qa"]: why.append(f"CLAUDE.md giả: roster = {sorted(got2)}, phải là capu, chief-of-staff, product, qa")
print("PASS" if not why else "FAIL " + " | ".join(why)); sys.exit(1 if why else 0)
