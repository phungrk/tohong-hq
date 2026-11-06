#!/usr/bin/env python3
"""Nguồn: T-081 (spec products/T-081-link-issue-trong-modal-capu.md v1, D-I1..D-I4; dự thảo eval/T-081/inv-draft-013 của Product), rút bởi spec-critic ở Spec Gate T-081 (2026-11-06).
Bất biến (hq/dashboard): trong `capu_queue` của bản --public xuất từ sổ cái thật,
  (a) mọi link tới issue có url đúng https://github.com/phungrk/tohong-hq/issues/<n>, nhãn "Issue #<n>", pr_state rỗng, với <n> bằng trường `issue`
      trên board của việc đó (số nguyên dương, không số 0 đứng đầu, sau khi bỏ nháy kép và khoảng trắng); tối đa một link issue mỗi phần tử;
      việc không có `issue` hợp lệ thì không có link issue;
  (b) việc có `issue` hợp lệ thì có link issue (chỉ kiểm khi exporter đã có tính năng này: dò bằng một sổ cái giả một việc escalated issue 7);
  (c) `tasks[]` công khai không có khoá `issue`.
Không token, không mạng. Chạy: cd /home/user/tohong-hq && python3 eval/invariants/hq/dashboard/inv-013-link-issue-dung-so-viec.py   (PASS / FAIL <lý do>)
"""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
EXP = ROOT / "scripts" / "export_dashboard.py"
URL = "https://github.com/phungrk/tohong-hq/issues/"
if not EXP.exists(): print("PASS chưa áp dụng: chưa có scripts/export_dashboard.py"); sys.exit(0)


def export(root, out):
    env = {k: v for k, v in os.environ.items() if k not in ("PR_READ_TOKEN", "TOHONG_ROOT")}
    if root is not None: env["TOHONG_ROOT"] = str(root)
    r = subprocess.run([sys.executable, str(EXP), "--public", "--out", str(out)], capture_output=True, text=True, env=env)
    if r.returncode: return None, (r.stderr.strip().splitlines() or ["thoát " + str(r.returncode)])[-1]
    return json.loads((Path(out) / "dashboard.json").read_text(encoding="utf-8")), None


def board_issue(text):
    m = re.search(r'(?m)^issue:[ \t]*(.*?)[ \t]*$', text.split("\n---", 1)[0] if text.startswith("---") else text)
    v = m.group(1).strip() if m else ""
    if len(v) >= 2 and v[0] == v[-1] == '"': v = v[1:-1].strip()
    return v if re.fullmatch(r"[1-9][0-9]*", v) else ""


with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    d, err = export(None, tmp / "real")
    if d is None: print("FAIL exporter --public không chạy: " + err); sys.exit(1)
    if "capu_queue" not in d: print("PASS chưa áp dụng: chưa có capu_queue"); sys.exit(0)
    # dò tính năng: sổ cái giả một việc escalated có issue 7
    fake = tmp / "fake"
    for sub in ("board", "org", "ledger", "inbox/capu", "handoffs"): (fake / sub).mkdir(parents=True)
    shutil.copy(ROOT / "org" / "roster.json", fake / "org" / "roster.json")
    src = (ROOT / "board" / "T-041.md").read_text(encoding="utf-8")
    src = re.sub(r"(?m)^id:.*$", "id: T-999", src, count=1)
    src = re.sub(r"(?m)^state:.*$", "state: escalated", src, count=1)
    src = re.sub(r"(?m)^issue:.*\n", "", src)
    src = re.sub(r"(?m)^(tier:.*)$", r"\1\nissue: 7", src, count=1)
    (fake / "board" / "T-999.md").write_text(src, encoding="utf-8")
    (fake / "ledger" / "events.jsonl").write_text("", encoding="utf-8")
    probe, perr = export(fake, tmp / "probe")
    active = bool(probe) and any(l.get("url") == URL + "7" for e in probe.get("capu_queue", []) for l in e.get("links", []))

board = {f.stem: board_issue(f.read_text(encoding="utf-8")) for f in (ROOT / "board").glob("T-*.md")}
bad = []
for e in d["capu_queue"]:
    iss = [l for l in e.get("links", []) if "/issues/" in l.get("url", "")]; b = board.get(e.get("task"), "")
    if len(iss) > 1: bad.append(f"{e.get('task')}: {len(iss)} link issue")
    for l in iss:
        if not b or l.get("url") != URL + b or l.get("label") != "Issue #" + b or l.get("pr_state") != "":
            bad.append(f"{e.get('task')}: link issue {l} không khớp board issue={b!r}")
    if active and b and not iss: bad.append(f"{e.get('task')}: board có issue {b} mà thiếu link issue")
if any("issue" in t for t in d.get("tasks", [])): bad.append("tasks[] công khai có khoá issue")
for x in bad: print("FAIL " + x)
print("FAIL" if bad else "PASS", f"{len(d['capu_queue'])} phần tử capu_queue; (b) {'đang kiểm' if active else 'chưa áp dụng (exporter chưa xuất link issue)'}")
sys.exit(1 if bad else 0)
