#!/usr/bin/env python3
"""Eval cho việc xuất dữ liệu của T-020 (mục B của spec): tier và regression_evals.

  python3 eval/T-020/export/check_export.py [--repo /đường/dẫn/tohong-hq] [--criterion B1|B2|B3|B4]

Không có --criterion thì chạy cả bốn. In từng dòng `PASS Bn` / `FAIL Bn <lý do>`,
dòng cuối `PASS` hoặc `FAIL <lý do>`; mã thoát 0/1. Chạy trên bản sao tạm
(TOHONG_ROOT), không ghi gì vào sổ cái thật.
"""
import argparse, json, os, shutil, subprocess, sys, tempfile
from pathlib import Path

FIELDS_OLD = ["id", "title", "state", "holder", "owner", "reviewer", "rounds", "version", "deadline", "budget",
              "cost", "created", "updated", "hours_since_update", "pipeline", "as_of"]


def board_file(tid, state, tier=None):
    lines = ["---", f"id: {tid}", f'title: "Việc {tid}"', f"state: {state}", "holder: product", "owner: product",
             "reviewer: reviewer", "rounds: 0", "version: 0", "deadline: 2026-11-04", "budget: $1",
             "escalation: tu-lam", "eval: []", "spec_returns: 0", 'created: "2026-10-30T08:00"',
             'updated: "2026-10-30T09:00"', 'prev_state: ""', "cost: 0.0"]
    if tier is not None:
        lines.insert(8, f"tier: {tier}")
    lines += ["---", "", f"# {tid}", ""]
    return "\n".join(lines)


def make_root(base: Path, tiers, regression):
    """tiers: {tid: tier hoặc None (thiếu dòng tier)}; regression: None (không có thư mục) hoặc list tên mục."""
    (base / "board").mkdir(parents=True)
    (base / "ledger").mkdir()
    (base / "org").mkdir()
    (base / "ledger" / "events.jsonl").write_text(
        json.dumps({"id": "E-1", "t": "2026-10-30T09:00", "task": "T-901", "event": "assigned", "from": "chief-of-staff",
                    "to": "product", "detail": "bí mật", "link": "x.md"}, ensure_ascii=False) + "\n", encoding="utf-8")
    shutil.copy(REPO / "org" / "roster.json", base / "org" / "roster.json")
    for tid, tier in tiers.items():
        (base / "board" / f"{tid}.md").write_text(board_file(tid, "doing", tier), encoding="utf-8")
    if regression is not None:
        d = base / "eval" / "regression"
        d.mkdir(parents=True)
        for name in regression:
            p = d / name
            if name.endswith("/"):
                p.mkdir()
                (p / "check.py").write_text("print('PASS')\n")
            else:
                p.write_text("x\n")


def export(base: Path, public=False):
    out = base / ("out-public" if public else "out")
    cmd = [sys.executable, str(REPO / "scripts" / "export_dashboard.py"), "--out", str(out)] + (["--public"] if public else [])
    r = subprocess.run(cmd, env={**os.environ, "TOHONG_ROOT": str(base)}, capture_output=True, text=True)
    if r.returncode != 0:
        raise AssertionError("export_dashboard.py lỗi: " + (r.stderr.strip().splitlines() or ["?"])[-1])
    return json.loads((out / "dashboard.json").read_text(encoding="utf-8")), out


def check_b1():
    """B1: tasks[].tier bằng dòng tier trong file việc; thiếu dòng thì là chuỗi rỗng; có ở dashboard.json lẫn tasks.json, bản thường lẫn công khai."""
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp) / "r"
        want = {"T-901": "A", "T-902": "B", "T-903": "C", "T-904": None}
        make_root(base, want, None)
        for public in (False, True):
            d, out = export(base, public)
            got = {t["id"]: t.get("tier", "<thiếu>") for t in d["tasks"]}
            exp = {k: (v or "") for k, v in want.items()}
            if got != exp:
                raise AssertionError(f"tier sai (public={public}): {got} != {exp}")
            rows = json.loads((out / "tasks.json").read_text(encoding="utf-8"))
            if {t["id"]: t.get("tier", "<thiếu>") for t in rows} != exp:
                raise AssertionError(f"tasks.json thiếu hoặc sai tier (public={public})")
            for t in d["tasks"]:
                if not isinstance(t["tier"], str):
                    raise AssertionError("tier phải là chuỗi")


def check_b2():
    """B2: regression_evals = số mục cấp một của eval/regression/, trừ tên bắt đầu bằng '.' và README.md; kiểu số nguyên; có ở cả hai bản."""
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp) / "r"
        make_root(base, {"T-901": "A"}, [".gitkeep", "README.md", ".hidden", "inc-001/", "inc-002.py", "inc-003/"])
        for public in (False, True):
            d, _ = export(base, public)
            v = d.get("regression_evals", "<thiếu>")
            if v != 3 or isinstance(v, bool) or not isinstance(v, int):
                raise AssertionError(f"regression_evals phải là số nguyên 3, nhận {v!r} (public={public})")
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp) / "r"
        make_root(base, {"T-901": "A"}, [".gitkeep"])
        d, _ = export(base)
        if d.get("regression_evals", "<thiếu>") != 0:
            raise AssertionError(f"thư mục chỉ có .gitkeep phải cho 0, nhận {d.get('regression_evals', '<thiếu>')!r}")


def check_b3():
    """B3: không có thư mục eval/regression/ thì regression_evals có mặt và bằng null (không phải 0, không bỏ trường)."""
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp) / "r"
        make_root(base, {"T-901": "A"}, None)
        d, _ = export(base)
        if "regression_evals" not in d or d["regression_evals"] is not None:
            raise AssertionError(f"thiếu thư mục phải cho regression_evals = null, nhận {d.get('regression_evals', '<thiếu>')!r}")


def check_b4():
    """B4: không làm hỏng cũ: mọi trường cũ của tasks vẫn còn; events/roster còn; bản công khai vẫn bỏ detail và link; không ghi vào sổ cái."""
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp) / "r"
        make_root(base, {"T-901": "A"}, ["a/"])
        before = {p: p.read_bytes() for p in base.rglob("*") if p.is_file()}
        d, _ = export(base)
        miss = [f for f in FIELDS_OLD if f not in d["tasks"][0]]
        if miss:
            raise AssertionError(f"mất trường cũ của tasks: {miss}")
        if not d["events"] or not d["roster"]:
            raise AssertionError("events hoặc roster rỗng")
        dp, _ = export(base, True)
        if any(k in e for e in dp["events"] for k in ("detail", "link")):
            raise AssertionError("bản công khai còn detail/link")
        after = {p: p.read_bytes() for p in base.rglob("*") if p.is_file() and "out" not in p.relative_to(base).parts[0]}
        if {p: b for p, b in before.items()} != after:
            raise AssertionError("script đã ghi vào sổ cái nguồn")


CHECKS = {"B1": check_b1, "B2": check_b2, "B3": check_b3, "B4": check_b4}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=str(Path(__file__).resolve().parents[3]))
    ap.add_argument("--criterion", choices=list(CHECKS))
    a = ap.parse_args()
    REPO = Path(a.repo).resolve()
    fails = []
    for name, fn in CHECKS.items():
        if a.criterion and a.criterion != name:
            continue
        try:
            fn()
            print(f"PASS {name}")
        except Exception as e:  # noqa: BLE001
            msg = str(e) or type(e).__name__
            print(f"FAIL {name} {msg}")
            fails.append(f"{name}: {msg}")
    print("PASS" if not fails else "FAIL " + " | ".join(fails))
    sys.exit(1 if fails else 0)
