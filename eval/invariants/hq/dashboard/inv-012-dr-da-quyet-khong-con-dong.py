#!/usr/bin/env python3
"""Bất biến nháp hq/dashboard · nguồn: T-083 (Spec Gate v2 2026-11-06, spec-critic; spec M3-M4, phần sau INV-P9 của Product). Gác theo ADR-028:
chỉ xanh khi PR T-083 đã merge; đưa vào eval/invariants/hq/dashboard/ sau khi merge. (Phần "không đọc thư mục con" đã vào bể: hq/dashboard inv-010.)
Việc đã có sự kiện `decided`/`unblocked` đứng sau sự kiện hỏi Capu cuối cùng (`escalated`, hoặc `blocked` mở bằng "Chờ Capu"),
hoặc chưa từng hỏi mà đã có `decided`, thì không có dòng `decision` hay `blocked` trong `capu_queue` và không có link Decision Request;
hỏi lại sau đó thì vào lại. Đo trên sổ cái thật (xuất --public vào thư mục tạm) và sổ cái giả.
Chạy: python3 eval/T-083/bat-bien-cho-merge/inv-draft-p9-dr-da-quyet-khong-con-dong.py"""
import json, re, sys, tempfile
from pathlib import Path
ROOT = next(p for p in Path(__file__).resolve().parents if (p / "scripts" / "task.py").is_file())
sys.path.insert(0, str(ROOT / "eval" / "T-076"))
from _export_lib import build, ev, export, by_task  # noqa: E402
ASK = re.compile(r"^\s*Chờ Capu\b", re.I)
bad = []

def answered(root):
    evs = [json.loads(l) for l in (root / "ledger" / "events.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    ask, ans = {}, {}
    for i, e in enumerate(evs):
        t, k = e.get("task"), e.get("event")
        if not t: continue
        if k == "escalated" or (k == "blocked" and ASK.search(e.get("detail") or "")): ask[t] = i
        if k in ("decided", "unblocked"): ans.setdefault(t, []).append((i, k))
    return {t for t, l in ans.items() if (any(i > ask[t] for i, _ in l) if t in ask else any(k == "decided" for _, k in l))}

def check(root, q, where):
    for r in q:
        if r["task"] in answered(root):
            if r["kind"] in ("decision", "blocked"): bad.append(f"{where}: {r['task']} đã trả lời vẫn là '{r['kind']}'")
            if any(l.get("label") == "Decision Request" for l in r["links"]) and r["kind"] != "escalated":
                bad.append(f"{where}: {r['task']} đã trả lời vẫn còn link Decision Request")

with tempfile.TemporaryDirectory() as tmp:
    q, err = export(ROOT, Path(tmp) / "real")
    if q is None: bad.append("export thật lỗi: " + str(err))
    else: check(ROOT, q["capu_queue"], "sổ cái thật")
    T = lambda st, tier="B": dict(state=st, owner="engineering", tier=tier, updated="2026-11-06T10:00")
    evs = [ev(1, "T-971", "blocked", "Chờ Capu: x", frm="product"), ev(2, "T-971", "decided", "chờ", frm="capu"),
           ev(3, "T-972", "decided", "ok", frm="capu"),
           ev(4, "T-973", "blocked", "Chờ Capu: x", frm="product"), ev(5, "T-973", "decided", "a", frm="capu"), ev(6, "T-973", "blocked", "Chờ Capu: lần 2", frm="product")]
    fake = build(tmp, {"T-971": T("blocked"), "T-972": T("done", "A"), "T-973": T("blocked")}, evs,
                 inbox={"T-971-dr.md": "2026-11-10", "T-972-dr.md": "2026-11-10", "T-973-dr.md": "2026-11-10"})
    q, err = export(fake, Path(tmp) / "fake")
    if q is None: bad.append("export giả lỗi: " + str(err))
    else:
        b = by_task(q["capu_queue"]); check(fake, q["capu_queue"], "sổ cái giả")
        for t in ("T-971", "T-972"):
            if t in b: bad.append(f"sổ cái giả: {t} đã quyết vẫn còn dòng {b[t]['kind']}")
        if "T-973" not in b: bad.append("sổ cái giả: T-973 bị hỏi lại sau quyết định phải vào lại")
if bad:
    for x in bad: print("FAIL " + x)
    sys.exit(1)
print("PASS DR đã quyết (sau lần hỏi cuối) không còn dòng decision/blocked; hỏi lại thì vào lại")
