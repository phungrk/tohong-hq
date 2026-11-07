"""Quy tắc `name` và `source` của spec T-092 mục A, viết lại độc lập (không đọc exporter) để eval kiểm exporter trên bể thật.
name(text, slug), source(text) nhận toàn bộ nội dung file."""
import re

_PRE = re.compile(r'^(?:#+|//+|"""|\'\'\')+')
_POST = re.compile(r'(?:"""|\'\'\')\s*$')


def clean(line):
    s = line.strip()
    s = _PRE.sub("", s).strip()
    s = _POST.sub("", s).strip()
    return s


def _colon0(s):
    d = 0
    for i, c in enumerate(s):
        if c == "(": d += 1
        elif c == ")": d = max(0, d - 1)
        elif c == ":" and d == 0: return i
    return -1


def _final(t, slug):
    t = t.strip()
    k = t.find(". ")
    if k >= 0: t = t[:k]
    t = t.strip().rstrip(":").strip()
    if len(t) > 140: t = t[:140].rstrip() + "…"
    return t or slug.replace("-", " ")


def name(text, slug):
    ls = [clean(l) for l in text.split("\n")[:12]]
    # (1) dòng đầu tiên BẮT ĐẦU bằng "Bất biến"
    for i, l in enumerate(ls):
        if not l.lower().startswith("bất biến"): continue
        k = _colon0(l)
        head, rest = (l[:k], l[k + 1:].strip()) if k >= 0 else (l, "")
        if rest and not rest.lower().startswith("nguồn") and not head.rstrip().lower().endswith("nguồn"):
            return _final(rest, slug)
        j = i + 1
        if not l.rstrip().endswith((".", ":")):   # (b) bỏ phần nối tiếp của đoạn nguồn: tới hết dòng kết thúc bằng "." hoặc ":"
            while j < len(ls) and ls[j] and not ls[j].rstrip().endswith((".", ":")): j += 1
            j += 1
        for m in ls[j:]:   # rồi dòng đầu tiên >= 50 ký tự không bắt đầu bằng "chỉ xanh"
            if len(m) >= 50 and not m.lower().startswith("chỉ xanh"): return _final(m, slug)
        break
    # (2) dòng bắt đầu bằng INV-<số> [(…)] · <mô tả>
    for l in ls:
        m = re.match(r"^INV-\d+\s*(?:\([^)]*\))?\s*·\s*(.+)$", l, re.I)
        if m: return _final(m.group(1), slug)
    # (3) slug
    return _final("", slug)


def source(text):
    t = "\n".join(text.split("\n")[:12])
    i = t.lower().find("nguồn")
    if i < 0: return ""
    m = re.search(r"T-\d+", t[i:])
    return m.group(0) if m else ""
