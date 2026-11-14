#!/usr/bin/env python3
"""Nguồn: T-162 (spec products/T-162-so-do-luong-theo-roster.md v2, Hành vi 4), spec-critic rút ở Spec Gate 2026-11-14. Chờ merge (ADR-028):
đỏ trên scripts/export_dashboard.py hiện tại, chỉ xanh khi PR agents/engineering/T-162-export-roster merge.
INV-022 (hq/dashboard) · Roster mà export_dashboard.py xuất ra (roster.json) gồm đúng capu, chief-of-staff và các id ở dòng ``- `id` — `` của CLAUDE.md,
đọc lúc chạy (đổi CLAUDE.md thì đổi roster, không sửa script). Không có dòng bộ phận nào khớp → thoát khác 0 và không ghi đè dashboard.json đang có.
Cập nhật theo spec v3 (T-163-D1, 2026-11-14): dòng khớp mẫu nằm trong fenced code block (```) không tính, không ::warning:: cho nó (4d);
thiếu file CLAUDE.md: sổ cái giả qua TOHONG_ROOT (thư mục tạm, khác kho chứa script) → giữ org/roster.json, ::warning::, thoát 0;
chạy như workflow thật (không TOHONG_ROOT, script nằm trong chính sổ cái) → thoát khác 0, không ghi đè dashboard.json (4c).
Chạy export THẬT trên sổ cái giả (TOHONG_ROOT tạm, hoặc bản chép scripts/ vào thư mục tạm), không ghi vào repo, không mạng.
Gốc HQ: dò ngược tới scripts/gate.py. Chạy: python3 -I <file này>. Mã thoát 0 = đạt."""
import json, os, pathlib, shutil, subprocess, sys, tempfile
here = pathlib.Path(__file__).resolve().parent
hq = next((p for p in [here, *here.parents] if (p / "scripts" / "gate.py").is_file()), None)
if hq is None: print("ERROR không dò được gốc HQ (scripts/gate.py)"); sys.exit(2)
EXPORT = hq / "scripts" / "export_dashboard.py"
OUT = []
def role(i): return {"id": i, "name": i, "role": "", "kind": "human" if i == "capu" else "agent", "reports_to": "", "mission": "", "agent_file": ""}
def run(md, ids, sentinel=False):
    with tempfile.TemporaryDirectory() as t:
        t = pathlib.Path(t); (t / "board").mkdir(); (t / "org").mkdir(); (t / "out").mkdir()
        if md is not None: (t / "CLAUDE.md").write_text(md, encoding="utf-8")
        (t / "org" / "roster.json").write_text(json.dumps({"roles": [role(i) for i in ids]}), encoding="utf-8")
        if sentinel: (t / "out" / "dashboard.json").write_text("GIU-NGUYEN", encoding="utf-8")
        r = subprocess.run([sys.executable, str(EXPORT), "--out", str(t / "out")], capture_output=True, text=True, env=dict(os.environ, TOHONG_ROOT=str(t)))
        kept = (t / "out" / "dashboard.json").read_text(encoding="utf-8") if (t / "out" / "dashboard.json").exists() else None
        got = sorted(x["id"] for x in json.loads((t / "out" / "roster.json").read_text(encoding="utf-8"))) if r.returncode == 0 and (t / "out" / "roster.json").exists() else None
        OUT.append(r.stdout + r.stderr)
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
# 4(d): dòng khớp mẫu trong code block không phải bộ phận
fence = "# D\n\n- `product` — x\n- `engineering` — y\n\nVí dụ:\n\n```markdown\n- `bot-cu` — ví dụ cũ\n```\n"
rc, got, _, err = run(fence, ["capu", "chief-of-staff", "product", "engineering", "growth"])
if rc != 0: why.append(f"(d) export thoát {rc} khi CLAUDE.md có code block: {err}")
elif got != ["capu", "chief-of-staff", "engineering", "product"]: why.append(f"(d) dòng trong code block thành bộ phận: roster = {got}")
elif "bot-cu" in OUT[-1]: why.append("(d) có ::warning:: cho id trong code block")
# 4(c) môi trường thử: TOHONG_ROOT trỏ sổ cái giả không có CLAUDE.md -> giữ org/roster.json, ::warning::, thoát 0
ids = ["capu", "chief-of-staff", "product", "vendor-ops"]
rc, got, _, err = run(None, ids)
if rc != 0: why.append(f"(c) sổ cái giả qua TOHONG_ROOT thiếu CLAUDE.md mà export thoát {rc}: {err}")
elif got != sorted(ids): why.append(f"(c) sổ cái giả thiếu CLAUDE.md: roster = {got}, phải giữ nguyên org/roster.json {sorted(ids)}")
elif "::warning::" not in OUT[-1]: why.append("(c) sổ cái giả thiếu CLAUDE.md mà không có ::warning::")
# 4(c) như workflow thật: không TOHONG_ROOT, script trong chính sổ cái, thiếu CLAUDE.md -> thoát khác 0, giữ dashboard.json
with tempfile.TemporaryDirectory() as t:
    t = pathlib.Path(t); shutil.copytree(hq / "scripts", t / "scripts", ignore=shutil.ignore_patterns("__pycache__"))
    for d in ("board", "org", "ledger", "out"): (t / d).mkdir()
    (t / "ledger" / "events.jsonl").write_text("", encoding="utf-8")
    (t / "org" / "roster.json").write_text(json.dumps({"roles": [role(i) for i in ids]}), encoding="utf-8")
    (t / "out" / "dashboard.json").write_text("GIU-NGUYEN", encoding="utf-8")
    r = subprocess.run([sys.executable, str(t / "scripts" / "export_dashboard.py"), "--public", "--out", str(t / "out")], capture_output=True, text=True, cwd=str(t),
                       env={k: v for k, v in os.environ.items() if k != "TOHONG_ROOT"})
    if r.returncode == 0: why.append("(c) sổ cái thật (không TOHONG_ROOT) thiếu CLAUDE.md mà export thoát 0")
    elif (t / "out" / "dashboard.json").read_text(encoding="utf-8") != "GIU-NGUYEN": why.append("(c) sổ cái thật thiếu CLAUDE.md: export lỗi nhưng đã ghi đè dashboard.json")
print("PASS roster xuất theo danh sách bộ phận CLAUDE.md (bỏ dòng trong code block); không khớp dòng nào, hoặc thiếu CLAUDE.md trên sổ cái thật, thì thoát khác 0, giữ dashboard.json; sổ cái giả thiếu CLAUDE.md giữ org/roster.json kèm ::warning::" if not why else "FAIL " + " | ".join(why)); sys.exit(1 if why else 0)
