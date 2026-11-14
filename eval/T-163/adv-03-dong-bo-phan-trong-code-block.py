#!/usr/bin/env python3
"""Eval đối kháng T-163 (adversary). Spec T-162 Hành vi 4: roster = capu, chief-of-staff + "danh sách bộ phận của CLAUDE.md (các dòng khớp ^- `id` — )".
Input: CLAUDE.md có danh sách bộ phận thật và một code block (```) ví dụ chứa dòng "- `old-bot` — ví dụ cũ".
Mong đợi (cách hiểu "danh sách bộ phận"): dòng trong code block không phải bộ phận -> roster không có old-bot, không có ::warning:: cho old-bot.
Cách hiểu theo chữ "các dòng khớp" thì old-bot vào roster. Spec chưa chốt: eval này để product chọn.
Chạy từ gốc tohong-hq: python3 eval/T-163/adv-03-dong-bo-phan-trong-code-block.py"""
import json, os, subprocess, sys, tempfile
from pathlib import Path
ROOT = Path.cwd()
if not (ROOT / "scripts" / "export_dashboard.py").is_file(): ROOT = Path(__file__).resolve().parents[2]
md = "# X\n\n- `product` — Spec Writer\n- `engineering` — code\n\nVí dụ định dạng cũ:\n\n```markdown\n- `old-bot` — ví dụ cũ, không còn dùng\n```\n"
with tempfile.TemporaryDirectory() as t:
    t = Path(t); (t / "board").mkdir(); (t / "org").mkdir(); (t / "CLAUDE.md").write_text(md, encoding="utf-8")
    roles = [{"id": i, "name": i, "role": "", "kind": "human" if i == "capu" else "agent", "reports_to": "", "mission": "", "agent_file": ""} for i in ["capu", "chief-of-staff", "product", "engineering"]]
    (t / "org" / "roster.json").write_text(json.dumps({"roles": roles}), encoding="utf-8")
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(t / "out")], capture_output=True, text=True, env=dict(os.environ, TOHONG_ROOT=str(t)))
    if r.returncode: print("FAIL export lỗi: " + (r.stderr.strip().splitlines() or ["?"])[-1][:150]); sys.exit(1)
    ids = sorted(x["id"] for x in json.loads((t / "out" / "roster.json").read_text(encoding="utf-8")))
    want = ["capu", "chief-of-staff", "engineering", "product"]
    if ids != want: print(f"FAIL dòng trong code block thành bộ phận: roster = {ids}, mong đợi {want}"); sys.exit(1)
print("PASS")
