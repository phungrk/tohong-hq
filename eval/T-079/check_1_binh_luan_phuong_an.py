#!/usr/bin/env python3
"""T-079 tiêu chí 1: việc có issue chuyển sang chờ Capu quyết (escalated) -> issue nhận bình luận tóm tắt phương án
+ link Decision Request + hướng dẫn `/ok`. Việc không có issue không sinh bình luận nào. GitHub giả, không mạng."""
import sys, pathlib, re
def _hook(t, v, tb):
    print("FAIL " + " | ".join(str(v).splitlines()[:12])); sys.exit(1)
sys.excepthook = _hook
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE.parent / "T-063"))
from _advlib import Ledger, posted
fails = []
L = Ledger()
try:
    L.task("new", "--title", "mồi", "--to", "product", "--tier", "C", "--area", "hq/ledger", "--criteria", "c", "--by", "chief-of-staff")
    rc, out, _ = L.mirror(); assert rc == 0, out          # mồi trạng thái mirror-state (lần đầu không phản chiếu lịch sử)
    L.task("new", "--title", "có issue", "--to", "product", "--tier", "C", "--area", "hq/ledger", "--issue", "7", "--criteria", "c", "--by", "chief-of-staff")   # T-002
    L.task("new", "--title", "không issue", "--to", "product", "--tier", "C", "--area", "hq/ledger", "--criteria", "c", "--by", "chief-of-staff")           # T-003
    L.task("new", "--title", "issue, không DR", "--to", "product", "--tier", "C", "--area", "hq/ledger", "--issue", "9", "--criteria", "c", "--by", "chief-of-staff")  # T-004
    dr = "inbox/capu/T-002-thu.md"
    (L.tmp / dr).write_text("---\ntype: decision-request\ntask: T-002\n---\nCần quyết: dùng A hay B?\nPhương án A: làm ngay → nhanh nhưng rủi ro\nPhương án B: để sau → chậm nhưng chắc\nKhuyến nghị: A, vì nhanh\nNếu không quyết: đứng yên\n", encoding="utf-8")
    L.task("escalate", "T-002", "--by", "chief-of-staff", "--note", "dùng A hay B?", "--link", dr)
    L.task("escalate", "T-003", "--by", "chief-of-staff", "--note", "không issue thì sao?")
    L.task("escalate", "T-004", "--by", "chief-of-staff", "--note", "câu hỏi thiếu file DR")
    rc, out, calls = L.mirror(); assert rc == 0, out
    b7 = [b for b in posted(calls, "7") if "Leo thang" in b or "Phương án" in b]
    if len(b7) != 1:
        fails.append(f"issue #7 phải nhận đúng 1 bình luận chờ quyết, nhận {len(b7)}")
    else:
        b = b7[0]
        for need, why in (("Phương án A", "tóm tắt phương án A"), ("Phương án B", "tóm tắt phương án B"), ("Khuyến nghị", "khuyến nghị"),
                          ("dùng A hay B?", "câu hỏi cần quyết"),
                          ("https://github.com/o/r/blob/main/inbox/capu/T-002-thu.md", "link Decision Request (blob trên main)"),
                          ("/ok", "hướng dẫn trả lời bằng /ok")):
            if need not in b:
                fails.append(f"bình luận #7 thiếu {why} ({need!r})")
        if len(b) > 2500:
            fails.append(f"bình luận #7 dài {len(b)} > 2500 ký tự")
        if not re.search(r"<!-- tohong-mirror:T-002-esc-\d+ -->", b):
            fails.append("bình luận #7 thiếu marker tohong-mirror:T-002-esc-<id> (chống ghi trùng)")
    if any(posted(calls, n) for n in ("3", "")):
        fails.append("việc không có issue sinh bình luận")
    b9 = [b for b in posted(calls, "9") if "Phương án" in b or "Leo thang" in b]
    if len(b9) != 1 or "/ok" not in b9[0] or "câu hỏi thiếu file DR" not in b9[0]:
        fails.append("việc có issue nhưng không có file DR: vẫn phải có 1 bình luận gồm câu hỏi + hướng dẫn /ok")
    n_before = len(posted(calls, "7"))
    rc, out, calls2 = L.mirror(); assert rc == 0, out
    if len(posted(calls2, "7")) != n_before:
        fails.append("chạy phản chiếu lần hai ghi trùng bình luận trên #7")
finally:
    L.close()
assert not fails, "\n".join(fails)
print("PASS bình luận chờ quyết có phương án, link DR, hướng dẫn /ok; không trùng; việc không issue không bình luận")
