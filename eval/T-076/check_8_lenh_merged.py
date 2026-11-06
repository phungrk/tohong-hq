#!/usr/bin/env python3
"""T-076 tiêu chí 8: `task.py merged T-xxx --pr <url> --by <ai> [--closed] [--note ..]` ghi sự kiện sổ cái `merged` (nguồn trạng thái PR không cần token), không đổi trạng thái việc.
Chạy: cd /home/user/tohong-hq && python3 eval/T-076/check_8_lenh_merged.py
"""
import json, os, re, subprocess, sys, tempfile, shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
URL = "https://github.com/phungrk/tohong-front/pull/59"
bad = []
def chk(c, m):
    if not c: bad.append(m)
with tempfile.TemporaryDirectory() as tmp:
    fake = Path(tmp) / "ledger"
    for d in ("board", "org", "ledger", "inbox/capu", "handoffs"): (fake / d).mkdir(parents=True)
    shutil.copy(ROOT / "org" / "roster.json", fake / "org" / "roster.json")
    src = (ROOT / "board" / "T-041.md").read_text(encoding="utf-8")
    body = re.sub(r"(?m)^id:.*$", "id: T-931", src, count=1); body = re.sub(r"(?m)^state:.*$", "state: done", body, count=1); body = re.sub(r"(?m)^holder:.*$", "holder: \"-\"", body, count=1)
    (fake / "board" / "T-931.md").write_text(body, encoding="utf-8")
    (fake / "ledger" / "events.jsonl").write_text("", encoding="utf-8")
    env = dict(os.environ, TOHONG_ROOT=str(fake), TOHONG_NOW="2026-11-06T12:00")
    run = lambda *a: subprocess.run([sys.executable, str(ROOT / "scripts" / "task.py"), *a], capture_output=True, text=True, env=env)
    evs = lambda: [json.loads(l) for l in (fake / "ledger" / "events.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    fm = lambda: {k: v for k, v in re.findall(r"(?m)^(state|holder|owner|tier|rounds|version):\s*(.*)$", (fake / "board" / "T-931.md").read_text(encoding="utf-8"))}
    before = fm()
    r = run("merged", "T-931", "--pr", URL, "--by", "chief-of-staff", "--note", "Capu merge 2026-11-06")
    chk(r.returncode == 0, "merged hợp lệ phải thoát 0: " + (r.stderr.strip().splitlines() or [""])[-1])
    e = [x for x in evs() if x["event"] == "merged"]
    chk(len(e) == 1 and e[0]["task"] == "T-931" and e[0]["link"] == URL and re.match(r"merged\b", e[0]["detail"]) and e[0]["from"] == "chief-of-staff", "sự kiện merged: task, link=URL, detail bắt đầu 'merged', from=by; thấy " + str(e))
    chk(fm() == before, "merged không đổi state/holder/owner/tier/rounds/version: " + str(before) + " -> " + str(fm()))
    r = run("merged", "T-931", "--pr", URL, "--by", "chief-of-staff")
    chk(r.returncode == 0 and len([x for x in evs() if x["event"] == "merged"]) == 1, "ghi lại cùng PR: thoát 0 và không thêm sự kiện thứ hai (idempotent)")
    url2 = "https://github.com/phungrk/tohong-back/pull/60"
    r = run("merged", "T-931", "--pr", url2, "--by", "chief-of-staff", "--closed", "--note", "đóng không merge")
    e = [x for x in evs() if x["link"] == url2]
    chk(r.returncode == 0 and len(e) == 1 and e[0]["event"] == "merged" and re.match(r"closed\b", e[0]["detail"]), "--closed: sự kiện merged có detail bắt đầu 'closed'; thấy " + str(e))
    n = len(evs())
    for args, why in (((["merged", "T-931", "--pr", "https://example.com/pull/1", "--by", "chief-of-staff"]), "URL không phải PR của github.com/phungrk"),
                      ((["merged", "T-931", "--pr", "https://github.com/phungrk/tohong-back/pull/abc", "--by", "chief-of-staff"]), "số PR không phải số"),
                      ((["merged", "T-999", "--pr", URL, "--by", "chief-of-staff"]), "việc không tồn tại"),
                      ((["merged", "T-931", "--by", "chief-of-staff"]), "thiếu --pr")):
        r = run(*args)
        chk(r.returncode != 0, f"phải từ chối: {why}")
    chk(len(evs()) == n, "ca bị từ chối không được ghi sự kiện nào")
    # exporter đọc sự kiện này: PR đã merged thì không vào hàng đợi
    out = Path(tmp) / "out"
    (fake / "ledger" / "events.jsonl").write_text(json.dumps({"id": "E-0001", "t": "2026-11-05T10:00", "task": "T-931", "title": "x", "event": "handoff", "from": "engineering", "to": "adversary", "round": 0, "severity": "", "detail": "", "link": URL, "cost": 0.0, "state": "review", "holder": "adversary"}) + "\n", encoding="utf-8")
    sed = re.sub(r"(?m)^tier:.*$", 'tier: "B"', (fake / "board" / "T-931.md").read_text(encoding="utf-8")); sed = re.sub(r"(?m)^owner:.*$", "owner: engineering", sed)
    (fake / "board" / "T-931.md").write_text(sed, encoding="utf-8")
    ex = lambda: json.loads(subprocess.run([sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--public", "--out", str(out)], capture_output=True, text=True, env=env).returncode == 0 and (out / "dashboard.json").read_text(encoding="utf-8") or "{}")
    chk([e["task"] for e in ex().get("capu_queue", [])] == ["T-931"], "trước khi ghi merged: T-931 (B, done, PR chưa merged) có trong capu_queue")
    run("merged", "T-931", "--pr", URL, "--by", "chief-of-staff")
    chk([e["task"] for e in ex().get("capu_queue", [])] == [], "sau `task.py merged`: T-931 biến mất khỏi capu_queue")
if bad:
    for b in bad: print("FAIL " + b)
    sys.exit(1)
print("PASS")
