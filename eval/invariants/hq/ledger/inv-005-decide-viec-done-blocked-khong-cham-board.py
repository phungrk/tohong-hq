#!/usr/bin/env python3
"""Bất biến hq/ledger · nguồn: T-083 (Spec Gate v2 2026-11-06, spec-critic; spec products/T-083-capu-queue-viec-da-xu-ly.md M3, INV-P8 của Product).
`task.py decide` trên việc `done` hoặc `blocked` không bao giờ chạm file board, và chỉ ghi quyết định của Capu:
  (a) mọi tổ hợp (có/không --note, có/không --link, có/không --close): board/<T>.md giống hệt từng byte trước và sau lệnh
      (state/holder/owner/tier/rounds/version/prev_state, updated, lịch sử đều giữ nguyên);
  (b) lệnh chỉ có thể ghi sự kiện `decided`, mỗi lần tối đa một; sự kiện đó có from = capu, detail = đúng note đã truyền;
  (c) thiếu --note hoặc có --close: thoát khác 0, không ghi sự kiện nào;
  (d) sổ cái thật: mọi sự kiện `decided` có from = capu và detail không rỗng.
Trước T-083 (decide từ chối done/blocked) bất biến vẫn đúng: từ chối thì không chạm board, không ghi gì.
Chạy trên sổ cái tạm (TOHONG_ROOT); (d) chỉ đọc sổ cái thật.
Chạy: python3 eval/invariants/hq/ledger/inv-005-decide-viec-done-blocked-khong-cham-board.py"""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
ROOT = next(p for p in Path(__file__).resolve().parents if (p / "scripts" / "task.py").is_file())
TASK = ROOT / "scripts" / "task.py"
bad = []
def chk(c, m):
    if not c: bad.append(m)
def evs(p):
    f = p / "ledger" / "events.jsonl"
    return [json.loads(l) for l in f.read_text(encoding="utf-8").splitlines() if l.strip()] if f.exists() else []

with tempfile.TemporaryDirectory() as tmp:
    fake = Path(tmp) / "s"
    for d in ("board", "org", "ledger", "inbox/capu", "handoffs"):
        (fake / d).mkdir(parents=True)
    shutil.copy(ROOT / "org" / "roster.json", fake / "org" / "roster.json")
    src = (ROOT / "board" / "T-041.md").read_text(encoding="utf-8")
    cases = {"T-951": ("done", '"-"', "B", "2026-11-01T10:00"), "T-952": ("done", '"-"', "C", "2026-11-06T09:00"),
             "T-953": ("blocked", "engineering", "B", "2026-11-03T10:00")}
    for tid, (st, holder, tier, upd) in cases.items():
        b = re.sub(r"(?m)^id:.*$", "id: " + tid, src, count=1)
        for k, v in (("state", st), ("holder", holder), ("tier", '"%s"' % tier), ("updated", '"%s"' % upd), ("owner", "engineering")):
            b = re.sub(r"(?m)^%s:.*$" % k, "%s: %s" % (k, v), b, count=1)
        (fake / "board" / (tid + ".md")).write_text(b, encoding="utf-8")
        (fake / "inbox" / "capu" / (tid + "-dr.md")).write_text("---\ntype: decision-request\ndecide-by: 2026-11-10\n---\nx\n", encoding="utf-8")
    (fake / "ledger" / "events.jsonl").write_text(json.dumps({"id": "E-0001", "t": "2026-11-03T10:00", "task": "T-953", "title": "x",
        "event": "blocked", "from": "product", "to": "product", "round": 0, "severity": "", "detail": "Chờ Capu: x", "link": "", "cost": 0.0,
        "state": "blocked", "holder": "engineering"}, ensure_ascii=False) + "\n", encoding="utf-8")
    env = dict(os.environ, TOHONG_ROOT=str(fake), TOHONG_NOW="2026-11-06T12:00")
    link = "https://github.com/phungrk/tohong-hq/issues/5#issuecomment-1"
    combos = [([], False), (["--note", "Chọn A"], True), (["--note", "Chọn B", "--link", link], True),
              (["--note", "x", "--close"], False), (["--link", link], False), (["--note", "y", "--link", link, "--close"], False)]
    for tid in cases:
        for extra, may_write in combos:
            raw, n = (fake / "board" / (tid + ".md")).read_bytes(), len(evs(fake))
            r = subprocess.run([sys.executable, str(TASK), "decide", tid, *extra], capture_output=True, text=True, env=env)
            new = evs(fake)[n:]
            chk((fake / "board" / (tid + ".md")).read_bytes() == raw, f"{tid} decide {extra}: board đổi")
            if not may_write:
                chk(r.returncode != 0 and not new, f"{tid} decide {extra}: phải từ chối và không ghi (thoát {r.returncode}, {len(new)} sự kiện)")
                continue
            note = extra[extra.index("--note") + 1]
            chk(len(new) <= 1 and all(e.get("event") == "decided" for e in new), f"{tid} decide {extra}: chỉ được ghi tối đa một decided, thấy {[e.get('event') for e in new]}")
            chk(all(e.get("from") == "capu" and e.get("detail") == note and e.get("task") == tid for e in new), f"{tid} decide {extra}: decided phải from capu, detail đúng note")
            chk((r.returncode == 0) == bool(new), f"{tid} decide {extra}: thoát 0 khi và chỉ khi có ghi")
real = [e for e in evs(ROOT) if e.get("event") == "decided"]
chk(all(e.get("from") == "capu" and (e.get("detail") or "").strip() for e in real),
    "sổ cái thật có decided không phải from capu hoặc detail rỗng: " + str([e.get("id") for e in real if e.get("from") != "capu" or not (e.get("detail") or "").strip()]))
if bad:
    for b in bad[:12]: print("FAIL " + b)
    sys.exit(1)
print("PASS decide trên việc done/blocked không chạm board; chỉ ghi decided của capu với đúng note; thiếu note/--close thì không ghi")
