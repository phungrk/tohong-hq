"""Quy tắc `name` v2 của spec T-094 (mở rộng T-092 mục A), viết độc lập với exporter để eval đối chiếu trên bể thật.
looks_like_code(s): True nếu một dòng (đã làm sạch) bị coi là dòng code hoặc có đường dẫn máy => không được làm tên.
name(text, slug): như eval/T-092/namerule.py nhưng mọi ứng viên phải qua looks_like_code (xem spec T-094 mục A)."""
import re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "T-092"))
import namerule as v1  # noqa: E402

KW = ("import", "from", "def", "class", "return", "if", "elif", "else", "for", "while", "with", "try", "except", "finally",
      "raise", "assert", "print", "exit", "const", "let", "var", "function", "await", "async", "set", "export", "source",
      "cd", "echo", "python", "python3", "node", "bash", "npm", "git", "grep", "curl", "fi", "done")
_KW = re.compile(r"^(?:" + "|".join(KW) + r")(?=$|[\s(\[{:;=.-])")      # từ khoá/lệnh code ở đầu dòng, viết thường đúng như trong code
_ASSIGN = re.compile(r"^[A-Za-z_][A-Za-z0-9_.\[\]'\"]*\s*(?:[-+*/|&%]|\*\*|//)?=(?!=)\s*\S")   # tên = giá trị
_CALL = re.compile(r"^[A-Za-z_][A-Za-z0-9_.]*\(.*\)\s*;?$")             # tên(...) cả dòng
_PATH = ("/home/", "/root/", "/tmp/", "handoffs/", "C:\\")
_SYMS = ("$", "{", "}", "|", "&", "!", "<", ">", "@", ";", "\\", "^", "~", "/", "%", "*")
_INFIX = ("$(", "${", " && ", " || ", " == ", " != ", " => ", "=>", "->", ">&", "2>")


def looks_like_code(s):
    t = s.strip()
    if not t: return False
    if any(p in t for p in _PATH): return True
    if t.startswith(_SYMS): return True
    if t.endswith("{"): return True
    if any(x in t for x in _INFIX): return True
    if _KW.match(t) and not t.split()[0].isupper(): return True
    if _ASSIGN.match(t) or _CALL.match(t): return True
    return False


def name(text, slug, fname=""):
    ls = [v1.clean(l) for l in text.split("\n")[:12]]
    for i, l in enumerate(ls):
        if not l.lower().startswith("bất biến"): continue
        k = v1._colon0(l)
        head, rest = (l[:k], l[k + 1:].strip()) if k >= 0 else (l, "")
        if rest and not rest.lower().startswith("nguồn") and not head.rstrip().lower().endswith("nguồn"):
            if not looks_like_code(rest): return v1._final(rest, slug)
            break                                  # 1a bị loại -> thẳng bước 2
        j = i + 1
        if not l.rstrip().endswith((".", ":")):
            while j < len(ls) and ls[j] and not ls[j].rstrip().endswith((".", ":")): j += 1
            j += 1
        for m in ls[j:]:
            if len(m) >= 50 and not m.lower().startswith("chỉ xanh") and not looks_like_code(m): return v1._final(m, slug)
        break
    for l in ls:
        m = re.match(r"^INV-\d+\s*(?:\([^)]*\))?\s*·\s*(.+)$", l, re.I)
        if m:
            if looks_like_code(m.group(1)): break
            return v1._final(m.group(1), slug)
    return v1._final("", slug) or fname          # bước 3 slug; bước 4 tên file (khi slug rỗng)
