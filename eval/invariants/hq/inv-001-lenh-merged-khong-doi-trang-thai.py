#!/usr/bin/env python3
"""Nguồn: T-076 (spec products/T-076-modal-viec-cho-capu.md v4, qua Spec Gate 2026-11-06, spec-critic; INV-P4 của Product).
Bất biến (hq, sổ cái): ghi trạng thái PR vào sổ cái không bao giờ đổi trạng thái việc, và cùng một PR không bao giờ có hai sự kiện `merged`.
  - `task.py merged <T> --pr <url> --by <ai>` không đổi state/holder/owner/tier/rounds/version của việc;
  - ghi lại cùng PR (kể cả kèm --closed) không thêm sự kiện thứ hai.
Áp dụng từ khi task.py có lệnh `merged` (T-076 vào); trước đó PASS "chưa áp dụng".
Chạy trên bản sao sổ cái tạm (TOHONG_ROOT), không đụng sổ cái thật.
Chạy: python3 eval/invariants/hq/inv-001-lenh-merged-khong-doi-trang-thai.py
"""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TASK = ROOT / "scripts" / "task.py"
FIELDS = r"(?m)^(state|holder|owner|tier|rounds|version|prev_state):\s*(.*)$"
bad = []

def chk(c, m):
    print(("PASS " if c else "FAIL ") + m)
    if not c:
        bad.append(m)

with tempfile.TemporaryDirectory() as tmp:
    fake = Path(tmp) / "ledger"
    for d in ("board", "org", "ledger", "inbox/capu", "handoffs"):
        (fake / d).mkdir(parents=True)
    shutil.copy(ROOT / "org" / "roster.json", fake / "org" / "roster.json")
    src = (ROOT / "board" / "T-041.md").read_text(encoding="utf-8")
    cases = {"T-941": ("done", '"-"', "B"), "T-942": ("done", '"-"', "C"), "T-943": ("doing", "engineering", "B"), "T-944": ("escalated", "chief-of-staff", "B")}
    for tid, (st, holder, tier) in cases.items():
        b = re.sub(r"(?m)^id:.*$", "id: " + tid, src, count=1)
        b = re.sub(r"(?m)^state:.*$", "state: " + st, b, count=1)
        b = re.sub(r"(?m)^holder:.*$", "holder: " + holder, b, count=1)
        b = re.sub(r"(?m)^tier:.*$", "tier: " + tier, b, count=1)
        (fake / "board" / (tid + ".md")).write_text(b, encoding="utf-8")
    (fake / "ledger" / "events.jsonl").write_text("", encoding="utf-8")
    env = dict(os.environ, TOHONG_ROOT=str(fake), TOHONG_NOW="2026-11-06T12:00")
    run = lambda *a: subprocess.run([sys.executable, str(TASK), *a], capture_output=True, text=True, env=env)
    fm = lambda t: dict(re.findall(FIELDS, (fake / "board" / (t + ".md")).read_text(encoding="utf-8")))
    evs = lambda: [json.loads(l) for l in (fake / "ledger" / "events.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]

    probe = run("merged", "T-941", "--pr", "https://github.com/phungrk/tohong-front/pull/901", "--by", "chief-of-staff")
    if "invalid choice" in probe.stderr and "merged" in probe.stderr:
        print("PASS chưa áp dụng: task.py chưa có lệnh merged (T-076)")
        sys.exit(0)

    before = {t: fm(t) for t in cases}
    n = 0
    for tid in cases:
        n += 1
        url = "https://github.com/phungrk/tohong-back/pull/%d" % (910 + n)
        run("merged", tid, "--pr", url, "--by", "chief-of-staff")
        run("merged", tid, "--pr", url, "--by", "chief-of-staff")
        run("merged", tid, "--pr", url, "--by", "chief-of-staff", "--closed")
    for tid in cases:
        chk(fm(tid) == before[tid], tid + " (" + cases[tid][0] + "): merged không đổi state/holder/owner/tier/rounds/version/prev_state; " + str(before[tid]) + " -> " + str(fm(tid)))
    per = {}
    for e in evs():
        if e.get("event") == "merged":
            per[e.get("link")] = per.get(e.get("link"), 0) + 1
    chk(all(v == 1 for v in per.values()), "mỗi PR tối đa một sự kiện merged sau khi ghi lặp: " + str(per))
    chk(not any(e.get("event") not in ("merged",) for e in evs()), "lệnh merged chỉ ghi sự kiện merged, không ghi sự kiện chuyển trạng thái: " + str(sorted({e.get('event') for e in evs()})))

print("FAIL %d ý không đạt" % len(bad) if bad else "PASS")
sys.exit(1 if bad else 0)
