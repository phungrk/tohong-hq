#!/usr/bin/env python3
"""Bất biến hq/ledger · nguồn: eval đối kháng T-063/adv-03 (Code Gate 2026-11-04).
Trường `issue` của mọi việc trong board/ là rỗng hoặc số nguyên dương (chữ số, không '#', không dấu cách, không URL).
Lý do: mirror_issue.py dựng /issues/<issue>/… và mirror_project.py gọi int(issue); một giá trị rác làm cả lần
phản chiếu dừng cho mọi việc khác (ADR-012)."""
import os, re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "scripts"))
os.environ.setdefault("TOHONG_ROOT", str(ROOT))
import task  # noqa: E402
bad = [f"{t['id']}: {t.get('issue')!r}" for t in task.all_tasks() if t.get("issue") and not re.fullmatch(r"[1-9]\d*", t["issue"])]
if bad:
    print("FAIL trường issue không phải số nguyên dương: " + "; ".join(bad[:10])); sys.exit(1)
print("PASS mọi trường issue rỗng hoặc là số nguyên dương")
