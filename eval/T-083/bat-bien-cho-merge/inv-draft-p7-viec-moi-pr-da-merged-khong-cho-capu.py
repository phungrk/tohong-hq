#!/usr/bin/env python3
"""Bất biến nháp hq/dashboard · nguồn: T-083 (Spec Gate v2 2026-11-06, spec-critic; spec M1-M2, INV-P7 của Product). Gác theo ADR-028:
chỉ xanh khi PR T-083 đã merge; đưa vào eval/invariants/hq/dashboard/ (đánh số tiếp) sau khi merge.
Việc B/C `done` mà mọi PR đã biết (URL PR trong handoff từ engineering, trong handoffs/<T>-v*.md, và `link` của sự kiện `merged`
của chính việc) đều đã có sự kiện `merged` (merged hoặc closed) thì không có dòng `diff-b`/`merge-c`, bất kể tuổi.
Đo trên sổ cái thật (xuất --public vào thư mục tạm) và một sổ cái giả có ca "PR ngoài handoff, cập nhật 2 giờ trước".
Chạy: python3 eval/T-083/bat-bien-cho-merge/inv-draft-p7-viec-moi-pr-da-merged-khong-cho-capu.py"""
import json, re, sys, tempfile
from pathlib import Path
ROOT = next(p for p in Path(__file__).resolve().parents if (p / "scripts" / "task.py").is_file())
sys.path.insert(0, str(ROOT / "eval" / "T-076"))
from _export_lib import build, handoff_event, ev, export, by_task  # noqa: E402
PR = re.compile(r"https://github\.com/phungrk/[\w.-]+/pull/\d+")
bad = []

def violations(root, q):
    evs = [json.loads(l) for l in (root / "ledger" / "events.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    done = {e.get("link") for e in evs if e.get("event") == "merged"}
    prs = {}
    for e in evs:
        t = e.get("task")
        if not t: continue
        if e.get("event") == "handoff" and e.get("from") == "engineering":
            prs.setdefault(t, set()).update(PR.findall((e.get("link") or "") + " " + (e.get("detail") or "")))
        if e.get("event") == "merged" and PR.fullmatch(e.get("link") or ""):
            prs.setdefault(t, set()).add(e["link"])
    for f in (root / "handoffs").glob("T-*-v*.md"):
        m = re.fullmatch(r"(T-\d+)-v\d+\.md", f.name)
        if m: prs.setdefault(m.group(1), set()).update(PR.findall(f.read_text(encoding="utf-8", errors="replace")))
    return [r["task"] for r in q if r["kind"] in ("diff-b", "merge-c") and prs.get(r["task"]) and prs[r["task"]] <= done]

with tempfile.TemporaryDirectory() as tmp:
    q, err = export(ROOT, Path(tmp) / "real")
    if q is None: bad.append("export thật lỗi: " + str(err))
    else:
        v = violations(ROOT, q["capu_queue"])
        if v: bad.append(f"sổ cái thật: việc mọi PR đã merged vẫn chờ Capu: {v}")
    D = lambda tier: dict(state="done", owner="engineering", tier=tier, updated="2026-11-06T10:00")
    fake = build(tmp, {"T-961": D("B"), "T-962": D("C")},
                 [handoff_event(1, "T-961", "handoffs/T-961-v1.md"), ev(2, "T-961", "merged", "merged", "https://github.com/phungrk/tohong-hq/pull/26"),
                  ev(3, "T-962", "merged", "closed: x", "https://github.com/phungrk/tohong-front/pull/9")])
    q, err = export(fake, Path(tmp) / "fake")
    if q is None: bad.append("export giả lỗi: " + str(err))
    else:
        b = by_task(q["capu_queue"])
        for t in ("T-961", "T-962"):
            if t in b: bad.append(f"sổ cái giả: {t} (PR ngoài handoff đã merged/closed, cập nhật 2 giờ) vẫn có dòng {b[t]['kind']}")
if bad:
    for x in bad: print("FAIL " + x)
    sys.exit(1)
print("PASS việc B/C mà mọi PR đã biết đã merged/closed không còn chờ Capu, bất kể tuổi")
