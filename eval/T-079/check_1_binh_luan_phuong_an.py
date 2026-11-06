#!/usr/bin/env python3
"""T-079 tiêu chí 1 (spec C1): việc có issue chuyển sang chờ Capu quyết (escalated) -> issue có đúng 1 bình luận chứa THÂN file Decision Request
nguyên văn (bỏ frontmatter và comment HTML; dài > 2500 ký tự thì cắt ở ranh giới dòng + dòng '… (còn tiếp) — xem đầy đủ: <link>'),
luôn có link DR trên main và hướng dẫn /ok. Fixture: DR đúng mẫu, DR thật T-074 (gạch đầu dòng, nhiều khối), DR thật T-072 (Phương án 1/2),
một DR dài > 2500. Việc không issue không bình luận; chạy lại không trùng. GitHub giả, không mạng."""
import sys, pathlib, re
def _hook(t, v, tb):
    print("FAIL " + " | ".join(str(v).splitlines()[:14])); sys.exit(1)
sys.excepthook = _hook
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE.parent / "T-063"))
from _advlib import Ledger, posted
LIMIT = 2500
CONT = "… (còn tiếp) — xem đầy đủ: "
BLOB = "https://github.com/o/r/blob/main/"
fails = []

def body_of(text):
    t = re.sub(r"\A---\n.*?\n---\n", "", text, flags=re.S)
    return re.sub(r"<!--.*?-->", "", t, flags=re.S).strip()

def cut(body):
    """phần thân giữ lại + có bị cắt không: nhiều dòng nguyên nhất mà độ dài (ký tự) <= LIMIT"""
    if len(body) <= LIMIT: return body, False
    lines, keep = body.split("\n"), []
    for l in lines:
        if len("\n".join(keep + [l])) > LIMIT: break
        keep.append(l)
    return "\n".join(keep).rstrip(), True

TEMPLATE = "---\ntype: decision-request\ntask: T-002\n---\nCần quyết: dùng A hay B?\nPhương án A: làm ngay → nhanh nhưng rủi ro\nPhương án B: để sau → chậm nhưng chắc\nKhuyến nghị: A, vì nhanh\nNếu không quyết: đứng yên\n<!-- ghi chú nội bộ ẩn -->\n"
LONG = "---\ntype: decision-request\n---\nCần quyết: câu hỏi dài?\n" + "\n".join(f"- Khối {i}: " + ("nội dung dài dòng " * 12).strip() + f" (hết khối {i})" for i in range(1, 30)) + "\n- Khuyến nghị cuối: chọn B\nNếu không quyết: đứng yên\n"
CASES = [("đúng mẫu", TEMPLATE), ("thật T-074", (HERE / "fixtures/dr-t074.md").read_text(encoding="utf-8")),
         ("thật T-072", (HERE / "fixtures/dr-t072.md").read_text(encoding="utf-8")), ("dài > 2500", LONG)]

for name, dr in CASES:
    L = Ledger()
    try:
        L.task("new", "--title", "mồi", "--to", "product", "--tier", "C", "--area", "hq/ledger", "--criteria", "c", "--by", "chief-of-staff")
        rc, out, _ = L.mirror(); assert rc == 0, out          # mồi trạng thái mirror-state (lần đầu không phản chiếu lịch sử)
        L.task("new", "--title", "có issue", "--to", "product", "--tier", "C", "--area", "hq/ledger", "--issue", "7", "--criteria", "c", "--by", "chief-of-staff")   # T-002
        L.task("new", "--title", "không issue", "--to", "product", "--tier", "C", "--area", "hq/ledger", "--criteria", "c", "--by", "chief-of-staff")           # T-003
        f = "inbox/capu/T-002-thu.md"
        (L.tmp / f).write_text(dr, encoding="utf-8")
        L.task("escalate", "T-002", "--by", "chief-of-staff", "--note", "dùng A hay B?", "--link", f)
        L.task("escalate", "T-003", "--by", "chief-of-staff", "--note", "không issue thì sao?")
        rc, out, calls = L.mirror(); assert rc == 0, out
        bs = [b for b in posted(calls, "7") if "tohong-mirror:T-002-esc-" in b]
        if len(bs) != 1:
            fails.append(f"[{name}] issue #7 phải nhận đúng 1 bình luận chờ quyết, nhận {len(bs)}"); continue
        b = bs[0]
        keep, truncated = cut(body_of(dr))
        if keep not in b: fails.append(f"[{name}] thân DR không có nguyên văn trong bình luận (phần giữ lại {len(keep)} ký tự)")
        if "<!--" in b.split("-->", 1)[-1]: fails.append(f"[{name}] còn comment HTML của DR trong bình luận")
        if "type: decision-request" in b: fails.append(f"[{name}] còn frontmatter của DR")
        if BLOB + "inbox/capu/T-002-thu.md" not in b: fails.append(f"[{name}] thiếu link DR trên main")
        if "/ok" not in b: fails.append(f"[{name}] thiếu hướng dẫn /ok")
        if truncated:
            if CONT + BLOB + "inbox/capu/T-002-thu.md" not in b: fails.append(f"[{name}] bị cắt nhưng thiếu dòng '{CONT}<link>'")
            nxt = body_of(dr).split("\n")[len(keep.split("\n"))]
            if nxt in b.replace(keep, "", 1): fails.append(f"[{name}] dòng đứng sau chỗ cắt vẫn lọt vào bình luận (cắt không ở ranh giới dòng)")
        else:
            if CONT in b: fails.append(f"[{name}] DR đủ ngắn mà vẫn có dòng 'còn tiếp'")
        if name == "thật T-074":
            for k in ("**1.", "**2.", "**3.", "**4.", "priceMin"):
                if k not in b: fails.append(f"[{name}] mất {k!r}")
            if b.count("Khuyến nghị") < 4: fails.append(f"[{name}] mất khuyến nghị: {b.count('Khuyến nghị')}/4")
        if name == "thật T-072" and ("Phương án 1" not in b or "Phương án 2" not in b): fails.append(f"[{name}] mất Phương án 1/2")
        if any(posted(calls, n) for n in ("3",)): fails.append(f"[{name}] việc không có issue sinh bình luận")
        n_before = len(posted(calls, "7"))
        rc, out, calls2 = L.mirror(); assert rc == 0, out
        if len(posted(calls2, "7")) != n_before: fails.append(f"[{name}] chạy lần hai ghi trùng bình luận")
    finally:
        L.close()
# không có file DR: vẫn có câu hỏi + /ok
L = Ledger()
try:
    L.task("new", "--title", "mồi", "--to", "product", "--tier", "C", "--area", "hq/ledger", "--criteria", "c", "--by", "chief-of-staff")
    rc, out, _ = L.mirror(); assert rc == 0, out
    L.task("new", "--title", "issue, không DR", "--to", "product", "--tier", "C", "--area", "hq/ledger", "--issue", "9", "--criteria", "c", "--by", "chief-of-staff")
    L.task("escalate", "T-002", "--by", "chief-of-staff", "--note", "câu hỏi thiếu file DR")
    rc, out, calls = L.mirror(); assert rc == 0, out
    b9 = [b for b in posted(calls, "9") if "tohong-mirror:T-002-esc-" in b]
    if len(b9) != 1 or "/ok" not in b9[0] or "câu hỏi thiếu file DR" not in b9[0]: fails.append("[không DR] phải có 1 bình luận gồm câu hỏi + hướng dẫn /ok")
finally:
    L.close()
assert not fails, "\n".join(fails)
print("PASS bình luận chờ quyết = thân DR nguyên văn (4 loại DR, cắt đúng ranh giới + 'còn tiếp'), có link DR và /ok, không trùng")
