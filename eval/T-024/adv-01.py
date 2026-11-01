#!/usr/bin/env python3
"""Eval đối kháng T-024 (adversary). Chạy export_dashboard.py trên bản sao sổ cái đã cấy biên:
  a) không có eval/invariants, không có insights/, products/   -> model rỗng, không lỗi
  b) vùng lồng nhiều gạch chéo (front/vendor/list) + file inv-* ở hai vùng  -> đếm đúng theo vùng
  c) file không phải inv-* (README.md, .inv-x) và thư mục tên inv-*        -> không đếm
  d) việc thiếu tier/area/eval/spec_returns trong frontmatter              -> "", "", 0 (kiểu int)
  e) eval ghi dạng chuỗi trần                                              -> evals == 1, không phải độ dài chuỗi
  f) mọi khóa cũ của dashboard.json/tasks.json vẫn còn (Không làm: đổi schema cũ)
Mã thoát 0 = đạt.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
fails = []


def check(cond, msg):
    if not cond:
        fails.append(msg)


def run_export(root, out):
    env = dict(os.environ, TOHONG_ROOT=str(root), TOHONG_LIVE_URL="")
    r = subprocess.run([sys.executable, str(root / "scripts" / "export_dashboard.py"), "--out", str(out), "--public"],
                       capture_output=True, text=True, env=env)
    return r


def copy_repo(dst):
    shutil.copytree(REPO, dst, ignore=shutil.ignore_patterns(".git", "node_modules", "__pycache__"))


TASK_MIN = """---
id: {id}
title: Việc thử biên
state: {state}
holder: engineering
owner: engineering
reviewer: adversary
rounds: 0
version: 1
created: "2026-10-31T10:00"
updated: "2026-10-31T10:00"
{extra}---

# {id}
"""

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)

    # a) bể trống hoàn toàn
    root = tmp / "a"
    copy_repo(root)
    for d in ("eval/invariants", "insights", "products"):
        shutil.rmtree(root / d, ignore_errors=True)
    r = run_export(root, tmp / "out-a")
    check(r.returncode == 0, f"a) export lỗi khi thiếu invariants/insights/products: {r.stderr[-300:]}")
    if r.returncode == 0:
        m = json.loads((tmp / "out-a" / "dashboard.json").read_text(encoding="utf-8"))["model"]
        check(m["invariants"] == {} and m["invariants_total"] == 0, f"a) bể trống phải 0: {m}")
        check(m["insight_reports"] == 0 and m["last_insight"] == "" and m["specs"] == 0, f"a) {m}")

    # b) c) d) e)
    root = tmp / "b"
    copy_repo(root)
    inv = root / "eval" / "invariants"
    (inv / "front" / "vendor" / "list").mkdir(parents=True, exist_ok=True)
    (inv / "front" / "vendor" / "list" / "inv-001-a.py").write_text("print(1)\n")
    (inv / "front" / "vendor" / "list" / "inv-002-b.sh").write_text("true\n")
    (inv / "hq" / "dashboard").mkdir(parents=True, exist_ok=True)
    (inv / "hq" / "dashboard" / "inv-003-c.py").write_text("print(1)\n")
    (inv / "hq" / "dashboard" / "README.md").write_text("không phải bất biến\n")
    (inv / "hq" / "dashboard" / ".inv-hidden").write_text("x\n")
    (inv / "hq" / "dashboard" / "inv-999-dir").mkdir()
    (root / "board" / "T-901.md").write_text(TASK_MIN.format(id="T-901", state="doing", extra=""), encoding="utf-8")
    (root / "board" / "T-902.md").write_text(
        TASK_MIN.format(id="T-902", state="trang-thai-la", extra="eval: eval/T-902/x.sh\ntier: \narea: \n"), encoding="utf-8")
    r = run_export(root, tmp / "out-b")
    check(r.returncode == 0, f"b) export lỗi: {r.stderr[-300:]}")
    if r.returncode == 0:
        d = json.loads((tmp / "out-b" / "dashboard.json").read_text(encoding="utf-8"))
        m = d["model"]
        check(m["invariants"].get("front/vendor/list") == 2, f"b) vùng lồng phải đếm 2: {m['invariants']}")
        check(m["invariants"].get("hq/dashboard") == 1, f"c) hq/dashboard chỉ 1 file inv-*: {m['invariants']}")
        check(m["invariants_total"] == sum(m["invariants"].values()), "b) total != tổng theo vùng")
        t = {x["id"]: x for x in d["tasks"]}
        t1, t2 = t.get("T-901", {}), t.get("T-902", {})
        check(t1.get("tier") == "" and t1.get("area") == "" and t1.get("evals") == 0, f"d) thiếu khóa: {t1}")
        check(isinstance(t1.get("spec_returns"), int) and isinstance(t1.get("evals_added"), int), f"d) kiểu: {t1}")
        check(t2.get("evals") == 1, f"e) eval chuỗi trần phải đếm 1: {t2.get('evals')}")
        check(t2.get("state") == "trang-thai-la", "e) state lạ phải giữ nguyên")

    # f) khóa cũ còn nguyên: so với bản export ở origin/main
    root = tmp / "f"
    copy_repo(root)
    old = subprocess.run(["git", "-C", str(REPO), "show", "origin/main:scripts/export_dashboard.py"],
                         capture_output=True, text=True)
    if old.returncode == 0:
        (root / "scripts" / "export_dashboard_old.py").write_text(old.stdout, encoding="utf-8")
        env = dict(os.environ, TOHONG_ROOT=str(root), TOHONG_LIVE_URL="")
        subprocess.run([sys.executable, str(root / "scripts" / "export_dashboard_old.py"), "--out", str(tmp / "old"), "--public"],
                       capture_output=True, text=True, env=env, check=True)
        r = run_export(root, tmp / "new")
        o = json.loads((tmp / "old" / "dashboard.json").read_text(encoding="utf-8"))
        n = json.loads((tmp / "new" / "dashboard.json").read_text(encoding="utf-8"))
        check(set(o) <= set(n), f"f) mất khóa gốc: {set(o) - set(n)}")
        if o["tasks"] and n["tasks"]:
            check(set(o["tasks"][0]) <= set(n["tasks"][0]), f"f) mất khóa việc: {set(o['tasks'][0]) - set(n['tasks'][0])}")
        check(o["events"] == n["events"] and o["roster"] == n["roster"], "f) events/roster đổi")

if fails:
    print("FAIL\n" + "\n".join(fails))
    sys.exit(1)
print("PASS: a–f")
