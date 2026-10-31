#!/usr/bin/env python3
"""Code Gate bằng máy: chạy eval của một việc + bất biến của vùng, in bảng PASS/FAIL.

Eval là gì (xem templates/spec.md):
  - lệnh shell            → chạy, PASS khi mã thoát 0
  - file .py / .sh        → chạy bằng python3 / bash, PASS khi mã thoát 0
  - file .md (checklist)  → không chạy được bằng máy: báo MANUAL, Capu/adversary tự kiểm

Tầng:
  1  eval ghi trong board/T-xxx.md (hành vi của việc)
  2  eval/invariants/<area>/*  (bất biến của vùng; area ghi trong board)
  3  eval/T-xxx/adv-*.*        (eval đối kháng do adversary thêm bằng `task.py evalplus`)

Ví dụ:
  python3 scripts/gate.py T-021                  # chạy trong repo này
  python3 scripts/gate.py T-021 --cwd ../tohong-front   # lệnh npm chạy trong repo sản phẩm
  python3 scripts/gate.py T-021 --json           # máy đọc

Mã thoát: 0 = mọi eval tự động PASS; 1 = có FAIL; 2 = lỗi cấu hình.
Kết quả lưu vào eval/T-xxx/gate-latest.json (sổ cái, agent không sửa tay).
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import task as ledger  # noqa: E402

ROOT = ledger.ROOT


def classify(entry):
    e = entry.strip()
    if e.endswith(".md"):
        return "manual"
    if e.endswith(".py"):
        return "py"
    if e.endswith(".sh"):
        return "sh"
    return "cmd"


def run_one(entry, cwd, timeout):
    kind = classify(entry)
    if kind == "manual":
        return {"eval": entry, "kind": kind, "status": "MANUAL", "ms": 0, "out": "checklist: người kiểm"}
    path = ROOT / entry
    if kind == "py":
        cmd = ["python3", "-I", str(path)]
    elif kind == "sh":
        cmd = ["bash", str(path)]
    else:
        cmd = entry
    t0 = time.time()
    try:
        r = subprocess.run(cmd, cwd=cwd, shell=(kind == "cmd"), capture_output=True, text=True, timeout=timeout)
        out = (r.stdout + r.stderr).strip()
        status = "PASS" if r.returncode == 0 else "FAIL"
    except FileNotFoundError:
        out, status = f"không có file: {entry}", "ERROR"
    except subprocess.TimeoutExpired:
        out, status = f"quá {timeout}s", "FAIL"
    return {"eval": entry, "kind": kind, "status": status, "ms": int((time.time() - t0) * 1000), "out": out[-800:]}


def collect(meta):
    tiers = []
    for e in meta["eval"]:
        tiers.append((1, e))
    area = (meta.get("area") or "").strip("/")
    if area:
        inv_dir = ROOT / "eval" / "invariants" / area
        if inv_dir.exists():
            for f in sorted(inv_dir.iterdir()):
                if f.is_file() and not f.name.startswith("."):
                    tiers.append((2, str(f.relative_to(ROOT))))
    adv_dir = ROOT / "eval" / meta["id"]
    if adv_dir.exists():
        for f in sorted(adv_dir.glob("adv-*")):
            rel = str(f.relative_to(ROOT))
            if rel not in meta["eval"]:
                tiers.append((3, rel))
    return tiers


def main(argv=None):
    ap = argparse.ArgumentParser(description="Code Gate bằng máy")
    ap.add_argument("task")
    ap.add_argument("--cwd", default=str(ROOT), help="Thư mục chạy lệnh shell (repo sản phẩm)")
    ap.add_argument("--timeout", type=int, default=600)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    try:
        meta, _ = ledger.read_task(a.task)
    except ledger.LedgerError as e:
        print(f"Lỗi: {e}", file=sys.stderr)
        return 2
    tiers = collect(meta)
    if not tiers:
        print(f"Lỗi: {a.task} không có eval nào. Việc chưa qua Spec Gate thì chưa được code.", file=sys.stderr)
        return 2
    results = []
    for tier, entry in tiers:
        r = run_one(entry, a.cwd, a.timeout)
        r["tier"] = tier
        results.append(r)
    auto = [r for r in results if r["status"] != "MANUAL"]
    fails = [r for r in auto if r["status"] != "PASS"]
    verdict = "GREEN" if not fails else "RED"
    report = {"task": a.task, "at": datetime.now().strftime("%Y-%m-%dT%H:%M"), "verdict": verdict,
              "tiers": {1: "hành vi", 2: "bất biến vùng " + (meta.get("area") or "—"), 3: "đối kháng"},
              "results": results,
              "hint": ("" if not fails else
                       "spec" if any(r["tier"] == 2 for r in fails) else "code")}
    out_dir = ROOT / "eval" / a.task
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "gate-latest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if a.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"Code Gate {a.task}: {verdict}  ({len(auto)} eval máy, {len(results) - len(auto)} checklist)")
        for r in results:
            print(f"  [{r['tier']}] {r['status']:<6} {r['eval']}  ({r['ms']} ms)")
            if r["status"] in ("FAIL", "ERROR") and r["out"]:
                print("         " + r["out"].splitlines()[-1][:160])
        if fails:
            kind = report["hint"]
            print(f"Gợi ý phân loại: --kind {kind} "
                  + ("(bất biến tầng 2 đỏ → spec mâu thuẫn bể)" if kind == "spec" else "(chỉ eval hành vi đỏ → code sai)"))
    return 0 if verdict == "GREEN" else 1


if __name__ == "__main__":
    sys.exit(main())
