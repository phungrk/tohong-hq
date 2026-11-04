#!/usr/bin/env python3
"""Tầng 3 T-063 · input: `task.py new --issue` với giá trị lạ.
Mong đợi: '#11', ' 11 ', ' #11' được chuẩn hoá thành '11'; giá trị không phải số nguyên dương ('abc', '0', '-3',
'11.0', URL) bị từ chối (exit ≠ 0) — vì mirror_issue dựng đường dẫn /issues/<issue>/… và mirror_project gọi
int(issue): một giá trị rác làm cả lần phản chiếu dừng (SystemExit/ValueError) cho MỌI việc khác.
Và: dù sổ cái lỡ chứa issue rác, việc khác vẫn phải được phản chiếu. Chạy khô với GitHub giả, không mạng."""
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); import json
from _advlib import Ledger, posted, patched
fails = []
L = Ledger()
try:
    good = {"#11": "11", " 11 ": "11", " #11": "11"}
    n = 0
    for raw, want in good.items():
        r = L.task("new", "--title", "g", "--to", "product", "--area", "hq/ledger", "--issue", raw, "--criteria", "c",
                   "--by", "chief-of-staff", ok=False)
        if r.returncode != 0:
            fails.append(f"--issue {raw!r} bị từ chối: {r.stderr.strip()[:120]}"); continue
        n += 1
        got = (L.tmp / "board" / f"T-{n:03d}.md").read_text().split("issue:", 1)[1].splitlines()[0].strip()
        got = (json.loads(got) if got.startswith('"') else got).strip()   # như task.read_task
        if got != want:
            fails.append(f"--issue {raw!r} lưu thành {got!r}, mong đợi {want!r}")
    for raw in ("abc", "0", "-3", "11.0", "https://github.com/o/r/issues/11"):
        r = L.task("new", "--title", "b", "--to", "product", "--area", "hq/ledger", "--issue", raw, "--criteria", "c",
                   "--by", "chief-of-staff", ok=False)
        if r.returncode == 0:
            n += 1
            fails.append(f"--issue {raw!r} được nhận (phải từ chối)")
finally:
    L.close()

# Sổ cái lỡ có issue rác (sửa tay / bản cũ): việc hợp lệ vẫn phải được phản chiếu.
L = Ledger()
try:
    L.task("new", "--title", "rac", "--to", "product", "--area", "hq/ledger", "--criteria", "c", "--by", "chief-of-staff")
    p = L.tmp / "board" / "T-001.md"; p.write_text(p.read_text().replace('issue: ""', 'issue: abc'))
    L.task("new", "--title", "tot", "--to", "product", "--area", "hq/ledger", "--issue", "12", "--criteria", "c", "--by", "chief-of-staff")
    rc, out, calls = L.mirror()
    if not posted(calls, "12"):
        fails.append(f"issue rác ở T-001 chặn phản chiếu T-002 (rc={rc}): {out.strip()[-160:]}")
finally:
    L.close()
assert not fails, "\n".join(fails)
print("PASS --issue chuẩn hoá/từ chối đúng, issue rác không chặn việc khác")
