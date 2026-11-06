#!/usr/bin/env python3
"""adv-03 (T-078, adversary, Code Gate v1): biên của bước xuất capu_queue (spec T-076 D1-D5).
Ca:
 a) handoff ghi PR kèm đuôi `#issuecomment-1` / `/files`, sự kiện merged ghi URL chuẩn -> PR đã xử lý, việc không vào (iv).
 b) blocked "  chờ capu: ..." (NBSP + NFD + chữ thường) -> blocked chờ Capu (iii).
 c) PR đóng bằng --closed (detail "closed: ...") -> đã xử lý.
 d) thứ tự link PR theo số bản handoff tăng dần dạng số (v2 trước v10), không theo chữ.
 e) sự kiện merged ghi dưới mã việc khác vẫn tính là PR đã xử lý (D3: "sự kiện merged với link đúng URL đó").
 f) dòng hỏng JSON trong events.jsonl không làm sập bước xuất.
Chạy: cd /home/user/tohong-hq && python3 eval/T-078/adv-03-export-bien.py
"""
import json, sys, tempfile, unicodedata
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "T-076"))
import _export_lib as X

G = "https://github.com/phungrk/"
fails = 0


def ok(c, m):
    global fails
    print(("PASS " if c else "FAIL ") + m)
    fails += 0 if c else 1


with tempfile.TemporaryDirectory() as tmp:
    nfd = unicodedata.normalize("NFD", "  chờ capu: cần anh tạo khoá")
    tasks = {
        "T-801": dict(state="done", owner="engineering", tier="B", updated="2026-11-01T10:00"),
        "T-802": dict(state="blocked", owner="product", tier="A", updated="2026-11-05T10:00"),
        "T-803": dict(state="done", owner="engineering", tier="C", updated="2026-11-01T10:00"),
        "T-804": dict(state="done", owner="engineering", tier="B", updated="2026-11-01T10:00"),
        "T-805": dict(state="done", owner="engineering", tier="B", updated="2026-11-01T10:00"),
        "T-806": dict(state="doing", owner="engineering", tier="B", updated="2026-11-05T10:00"),
    }
    events = [
        X.handoff_event(1, "T-801", f"{G}tohong-front/pull/91#issuecomment-1"),
        X.ev(2, "T-801", "handoff", detail=f"xem {G}tohong-back/pull/92/files", frm="engineering", to="adversary"),
        X.ev(3, "T-801", "merged", detail="merged", link=f"{G}tohong-front/pull/91"),
        X.ev(4, "T-801", "merged", detail="merged", link=f"{G}tohong-back/pull/92"),
        X.ev(5, "T-802", "blocked", detail=nfd),
        X.handoff_event(6, "T-803", f"{G}tohong-front/pull/93"),
        X.ev(7, "T-803", "merged", detail="closed: bỏ", link=f"{G}tohong-front/pull/93"),
        X.ev(9, "T-805", "handoff", detail="bàn giao", frm="engineering", to="adversary"),
        X.ev(10, "T-806", "merged", detail="merged", link=f"{G}tohong-front/pull/96"),
    ]
    handoffs = {"T-804-v10.md": f"PR {G}tohong-front/pull/95\n", "T-804-v2.md": f"PR {G}tohong-back/pull/94\n",
                "T-805-v1.md": f"PR {G}tohong-front/pull/96\n"}
    root = X.build(tmp, tasks, events, inbox=(), handoffs=handoffs)
    p = root / "ledger" / "events.jsonl"
    p.write_text(p.read_text(encoding="utf-8") + "{hỏng json\n", encoding="utf-8")
    d, err = X.export(root, Path(tmp) / "out")
    ok(d is not None, f"f) dòng hỏng không làm sập bước xuất ({err})")
    if d is not None:
        q = X.by_task(d.get("capu_queue", []))
        ok("T-801" not in q, f"a) PR có đuôi #/files đã merged -> T-801 không vào: {q.get('T-801')}")
        ok(q.get("T-802", {}).get("kind") == "blocked", f"b) NBSP+NFD+thường 'chờ capu' -> blocked: {q.get('T-802')}")
        ok("T-803" not in q, f"c) PR closed -> T-803 không vào: {q.get('T-803')}")
        urls = [l["url"] for l in q.get("T-804", {}).get("links", [])]
        ok(urls == [f"{G}tohong-back/pull/94", f"{G}tohong-front/pull/95"], f"d) thứ tự v2 trước v10: {urls}")
        ok("T-805" not in q, f"e) merged ghi dưới việc khác vẫn tính: {q.get('T-805')}")
        ok(all(set(e) == {"task", "kind", "decide_by", "links"} for e in q.values()), "khuôn bốn khoá")
print("FAIL %d ý không đạt" % fails if fails else "PASS")
sys.exit(1 if fails else 0)
