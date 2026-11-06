"""T-084 adv-02 (Code Gate, adversary): thứ tự hỏi/trả lời M4 trên capu_queue.
H: blocked 'Chờ Capu' + DR, decided ĐỨNG TRƯỚC lần block -> vẫn chờ (decision|blocked theo KIND_ORDER T-076), không coi là đã trả lời.
I: blocked 'Chờ Capu' + DR, decided đứng sau -> không dòng nào; block 'Chờ Capu' mới sau đó -> vào lại (decision|blocked).
J: done B, DR, escalated rồi decided, PR handoff còn mở -> diff-b, links chỉ PR (không link DR).
K: blocked 'Chờ vendor' (không hỏi Capu) + DR + decided -> không dòng.
L: decided của việc KHÁC không làm việc này 'đã trả lời'.
"""
import sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "T-083"))
from lib import build, handoff_event, ev, export, by_task, Checker, PR_A  # noqa

c = Checker()
R = "2026-11-06T10:00"
OLD = "2026-11-01T10:00"

def run(tasks, evs, inbox):
    with tempfile.TemporaryDirectory() as tmp:
        fake = build(tmp + "/l", tasks, evs, inbox)
        d, err = export(fake, tmp + "/o")
        c.chk(err is None, f"export lỗi: {err}")
        return by_task((d or {}).get("capu_queue", []))

T = lambda st, tier="B": dict(state=st, owner="engineering", tier=tier, updated=OLD)
q = run({"T-921": T("blocked"), "T-922": T("blocked"), "T-924": T("blocked"), "T-925": T("blocked")},
        [ev(1, "T-921", "decided", "trước", frm="capu", to="capu"),
         ev(2, "T-921", "blocked", "Chờ Capu: chọn A hay B"),
         ev(3, "T-922", "blocked", "Chờ Capu: chọn A hay B"),
         ev(4, "T-922", "decided", "A", frm="capu", to="capu"),
         ev(5, "T-924", "blocked", "Chờ vendor gửi báo giá"),
         ev(6, "T-924", "decided", "A", frm="capu", to="capu"),
         ev(7, "T-925", "blocked", "Chờ Capu: chọn"),
         ev(8, "T-922", "decided", "của việc khác không tính", frm="capu", to="capu")],
        {"T-921-dr.md": "2026-11-10", "T-922-dr.md": "2026-11-10", "T-924-dr.md": "", "T-925-dr.md": "2026-11-10"})
c.chk(q.get("T-921", {}).get("kind") in ("decision", "blocked"), f"H: T-921 phải blocked, có {q.get('T-921')}")
c.chk("T-922" not in q, f"I: T-922 đã trả lời, không được chờ: {q.get('T-922')}")
c.chk("T-924" not in q, f"K: T-924 không được chờ: {q.get('T-924')}")
c.chk(q.get("T-925", {}).get("kind") in ("decision", "blocked"), f"L: T-925 phải blocked, có {q.get('T-925')}")

q = run({"T-922": T("blocked")},
        [ev(3, "T-922", "blocked", "Chờ Capu: chọn A hay B"),
         ev(4, "T-922", "decided", "A", frm="capu", to="capu"),
         ev(5, "T-922", "blocked", "Chờ Capu: hỏi lại")],
        {"T-922-dr.md": "2026-11-10"})
c.chk(q.get("T-922", {}).get("kind") in ("decision", "blocked"), f"I: hỏi lại phải vào lại blocked, có {q.get('T-922')}")

q = run({"T-923": dict(state="done", owner="engineering", tier="B", updated=R)},
        [ev(1, "T-923", "escalated", "hỏi"), ev(2, "T-923", "decided", "A", frm="capu", to="capu"),
         handoff_event(3, "T-923", PR_A)],
        {"T-923-dr.md": "2026-11-10"})
e = q.get("T-923")
c.chk(e is not None and e["kind"] == "diff-b", f"J: T-923 phải diff-b, có {e}")
if e:
    c.chk([l["url"] for l in e["links"]] == [PR_A], f"J: links chỉ PR, có {e['links']}")
    c.chk(e["decide_by"] == "", f"J: không còn decide_by khi chỉ còn PR, có {e['decide_by']!r}")
c.done()
