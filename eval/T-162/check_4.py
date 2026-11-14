#!/usr/bin/env python3
"""Eval T-162 tiêu chí 4: scripts/export_dashboard.py chỉ đưa vào roster các bộ phận có trong CLAUDE.md.
Quy tắc: giữ `capu`, `chief-of-staff`, và mọi id nằm trong danh sách bộ phận của CLAUDE.md (dòng dạng "- `id` — mô tả"); bỏ phần còn lại (vendor-ops, growth, finance, reviewer, chatgpt).
Chạy từ gốc tohong-hq, dùng thư mục giả qua TOHONG_ROOT, không ghi vào repo. In PASS hoặc FAIL <lý do>."""
import json, os, re, subprocess, sys, tempfile
from pathlib import Path
ROOT = Path.cwd()
if not (ROOT / "scripts" / "export_dashboard.py").is_file(): ROOT = Path(__file__).resolve().parents[2]
def role(i, kind="agent"): return {"id": i, "name": i, "role": "", "kind": kind, "reports_to": "", "mission": "", "agent_file": ""}
def run(claude_md, ids, sentinel=False):
    with tempfile.TemporaryDirectory() as t:
        t = Path(t); (t / "board").mkdir(); (t / "org").mkdir()
        (t / "CLAUDE.md").write_text(claude_md, encoding="utf-8")
        (t / "org" / "roster.json").write_text(json.dumps({"roles": [role(i, "human" if i == "capu" else "agent") for i in ids]}), encoding="utf-8")
        if sentinel: (t / "out").mkdir(); (t / "out" / "dashboard.json").write_text("SENTINEL", encoding="utf-8")
        r = subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(t / "out")], capture_output=True, text=True, env=dict(os.environ, TOHONG_ROOT=str(t)))
        kept = (t / "out" / "dashboard.json").read_text(encoding="utf-8") if sentinel and (t / "out" / "dashboard.json").exists() else None
        if r.returncode: return None, (r.stderr.strip().splitlines() or ["?"])[-1][:150], kept, r.stdout + r.stderr
        return json.loads((t / "out" / "roster.json").read_text(encoding="utf-8")), "", kept, r.stdout + r.stderr
why = []
real = (ROOT / "CLAUDE.md").read_text(encoding="utf-8")
allids = ["capu", "chief-of-staff", "insight", "product", "spec-critic", "engineering", "adversary", "vendor-ops", "growth", "finance", "reviewer", "chatgpt"]
got, err, _, _ = run(real, allids); got = got and [x["id"] for x in got]
want = ["capu", "chief-of-staff", "insight", "product", "spec-critic", "engineering", "adversary"]
if got is None: why.append("export sập với CLAUDE.md thật: " + err)
elif sorted(got) != sorted(want): why.append(f"CLAUDE.md thật: roster = {sorted(got)}, phải là {sorted(want)}")
# sinh theo CLAUDE.md, không viết cứng: CLAUDE.md giả có bộ phận `qa`, không có insight
fake = "# X\n\n- `product` — Spec Writer\n- `qa` — kiểm thử\n\nBạn giao việc cho các bộ phận trên.\n"
got2, err2, _, _ = run(fake, ["capu", "chief-of-staff", "product", "qa", "insight", "growth"])
if got2 is None: why.append("export sập với CLAUDE.md giả: " + err2)
elif sorted(x["id"] for x in got2) != ["capu", "chief-of-staff", "product", "qa"]: why.append(f"CLAUDE.md giả: roster = {sorted(x["id"] for x in got2)}, phải là capu, chief-of-staff, product, qa")
# ca (a): không dòng bộ phận nào khớp (đổi định dạng) -> export báo lỗi, thoát khác 0, dashboard.json đang có không bị ghi đè
none = "# X\n\n- `product`: Spec Writer\n- **qa** — kiểm thử\n"
g3, e3, kept, _ = run(none, ["capu", "chief-of-staff", "product", "growth"], sentinel=True)
if g3 is not None: why.append("(a) CLAUDE.md không có dòng bộ phận nào khớp mà export vẫn thoát 0 (phải thoát khác 0)")
elif kept != "SENTINEL": why.append("(a) export lỗi nhưng đã ghi đè dashboard.json đang có")
# ca (b): id có trong CLAUDE.md mà org/roster.json không có -> tạo phần tử tối thiểu (id, tên = id) và in ::warning::
g4, e4, _, outp = run("- `product` — A\n- `ghost` — B\n", ["capu", "chief-of-staff", "product"])
if g4 is None: why.append("(b) export sập khi CLAUDE.md có id vắng trong roster.json: " + e4)
else:
    gh = [x for x in g4 if x["id"] == "ghost"]
    if len(gh) != 1 or gh[0].get("name") != "ghost": why.append("(b) id `ghost` chỉ có trong CLAUDE.md phải thành đúng một phần tử roster có name = id (thấy %s)" % gh)
    if "::warning::" not in outp: why.append("(b) thiếu dòng ::warning:: khi id vắng trong org/roster.json")
print("PASS" if not why else "FAIL " + " | ".join(why)); sys.exit(1 if why else 0)
