#!/usr/bin/env python3
"""adv-04 (T-078, adversary, Code Gate v1): biên của `task.py merged` (spec T-076 D5).
Ca: 6 tiến trình ghi cùng PR song song -> đúng 1 sự kiện merged; --pr có dấu cách đầu/cuối, xuống dòng cuối, domain viết hoa,
http://, đuôi /files, ':' thay '/' -> từ chối (thoát khác 0) và không ghi gì; --by rỗng không tạo sự kiện from rỗng.
Chạy: cd /home/user/tohong-hq && python3 eval/T-078/adv-04-lenh-merged-bien.py
"""
import json, os, re, subprocess, sys, tempfile, shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
URL = "https://github.com/phungrk/tohong-front/pull/77"
fails = 0


def ok(c, m):
    global fails
    print(("PASS " if c else "FAIL ") + m)
    fails += 0 if c else 1


with tempfile.TemporaryDirectory() as tmp:
    fake = Path(tmp) / "ledger"
    for d in ("board", "org", "ledger", "inbox/capu", "handoffs"): (fake / d).mkdir(parents=True)
    shutil.copy(ROOT / "org" / "roster.json", fake / "org" / "roster.json")
    src = (ROOT / "board" / "T-041.md").read_text(encoding="utf-8")
    body = re.sub(r"(?m)^id:.*$", "id: T-941", src, count=1); body = re.sub(r"(?m)^state:.*$", "state: done", body, count=1)
    (fake / "board" / "T-941.md").write_text(body, encoding="utf-8")
    (fake / "ledger" / "events.jsonl").write_text("", encoding="utf-8")
    env = dict(os.environ, TOHONG_ROOT=str(fake), TOHONG_NOW="2026-11-06T12:00")
    cmd = lambda *a: [sys.executable, str(ROOT / "scripts" / "task.py"), *a]
    evs = lambda: [json.loads(l) for l in (fake / "ledger" / "events.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    ps = [subprocess.Popen(cmd("merged", "T-941", "--pr", URL, "--by", "chief-of-staff"), env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True) for _ in range(6)]
    rcs = [p.wait() for p in ps]
    ok(all(r == 0 for r in rcs), f"song song: mọi tiến trình thoát 0 ({rcs})")
    ok(len([e for e in evs() if e["event"] == "merged" and e["link"] == URL]) == 1, f"song song: đúng 1 sự kiện merged, thấy {len(evs())}")
    ids = [e["id"] for e in evs()]
    ok(len(ids) == len(set(ids)), "mã sự kiện không trùng")
    n = len(evs())
    for bad, why in ((" " + URL, "dấu cách đầu"), (URL + " ", "dấu cách cuối"), (URL + "\n", "xuống dòng cuối"),
                     ("https://GitHub.com/phungrk/tohong-front/pull/78", "domain viết hoa"), ("http://github.com/phungrk/tohong-front/pull/78", "http"),
                     ("https://github.com/phungrk/tohong-front/pull/78/files", "đuôi /files"), ("https://github.com/phungrk/tohong-front/pull/", "thiếu số"),
                     ("https://github.com/phungrk/../pull/78x", "số lẫn chữ")):
        r = subprocess.run(cmd("merged", "T-941", "--pr", bad, "--by", "chief-of-staff"), env=env, capture_output=True, text=True)
        ok(r.returncode != 0 and len(evs()) == n, f"từ chối {why}: thoát {r.returncode}, sự kiện {len(evs())}")
print("FAIL %d ý không đạt" % fails if fails else "PASS")
sys.exit(1 if fails else 0)
