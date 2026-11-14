#!/usr/bin/env python3
"""Nguồn: T-162 (spec products/T-162-so-do-luong-theo-roster.md v2, Hành vi 4), spec-critic rút ở Spec Gate 2026-11-14. Chờ merge (ADR-028):
đỏ trên scripts/export_dashboard.py hiện tại, chỉ xanh khi PR agents/engineering/T-162-export-roster merge.
INV-022 (hq/dashboard) · Roster mà export_dashboard.py xuất ra (roster.json) gồm đúng capu, chief-of-staff và các id ở dòng ``- `id` — `` của CLAUDE.md,
đọc lúc chạy (đổi CLAUDE.md thì đổi roster, không sửa script). Không có dòng bộ phận nào khớp → thoát khác 0 và không ghi đè dashboard.json đang có.
Chạy export THẬT trên sổ cái giả (TOHONG_ROOT tạm), không ghi vào repo, không mạng.
Gốc HQ: dò ngược tới scripts/gate.py. Chạy: python3 -I <file này>. Mã thoát 0 = đạt."""
import json, os, pathlib, subprocess, sys, tempfile
here = pathlib.Path(__file__).resolve().parent
hq = next((p for p in [here, *here.parents] if (p / "scripts" / "gate.py").is_file()), None)
if hq is None: print("ERROR không dò được gốc HQ (scripts/gate.py)"); sys.exit(2)
EXPORT = hq / "scripts" / "export_dashboard.py"
def role(i): return {"id": i, "name": i, "role": "", "kind": "human" if i == "capu" else "agent", "reports_to": "", "mission": "", "agent_file": ""}
def run(md, ids, sentinel=False):
    with tempfile.TemporaryDirectory() as t:
        t = pathlib.Path(t); (t / "board").mkdir(); (t / "org").mkdir(); (t / "out").mkdir()
        (t / "CLAUDE.md").write_text(md, encoding="utf-8")
        (t / "org" / "roster.json").write_text(json.dumps({"roles": [role(i) for i in ids]}), encoding="utf-8")
        if sentinel: (t / "out" / "dashboard.json").write_text("GIU-NGUYEN", encoding="utf-8")
        r = subprocess.run([sys.executable, str(EXPORT), "--out", str(t / "out")], capture_output=True, text=True, env=dict(os.environ, TOHONG_ROOT=str(t)))
        kept = (t / "out" / "dashboard.json").read_text(encoding="utf-8") if (t / "out" / "dashboard.json").exists() else None
        got = sorted(x["id"] for x in json.loads((t / "out" / "roster.json").read_text(encoding="utf-8"))) if r.returncode == 0 and (t / "out" / "roster.json").exists() else None
        return r.returncode, got, kept, (r.stderr.strip().splitlines() or [""])[-1][:150]
why = []
old = ["vendor-ops", "growth", "finance", "reviewer", "chatgpt"]
for md, listed in [("# A\n\n- `insight` — x\n- `product` — y\n- `adversary` — z\n\nĐoạn văn nhắc `chatgpt` và `growth`.\n", ["insight", "product", "adversary"]),
                   ("# B\n\n- `kiem-thu` — x\n- `engineering` — y\n", ["kiem-thu", "engineering"])]:
    ids = ["capu", "chief-of-staff", *listed, *old]
    rc, got, _, err = run(md, ids)
    want = sorted(["capu", "chief-of-staff", *listed])
    if rc != 0: why.append(f"export thoát {rc} với CLAUDE.md có {listed}: {err}")
    elif got != want: why.append(f"roster = {got}, phải là {want}")
rc, got, kept, _ = run("# C\n\n- `product`: không đúng mẫu\n- **engineering** — không đúng mẫu\n", ["capu", "chief-of-staff", "product", "engineering"], sentinel=True)
if rc == 0: why.append("CLAUDE.md không có dòng bộ phận nào khớp mà export vẫn thoát 0")
elif kept != "GIU-NGUYEN": why.append("export lỗi nhưng đã ghi đè dashboard.json đang có")
print("PASS roster xuất theo danh sách bộ phận CLAUDE.md; không khớp dòng nào thì thoát khác 0, giữ dashboard.json" if not why else "FAIL " + " | ".join(why)); sys.exit(1 if why else 0)
