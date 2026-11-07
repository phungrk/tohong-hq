"""Quy tắc `name` v2 của spec T-094 (mở rộng T-092 mục A), viết độc lập với exporter để eval đối chiếu trên bể thật.
looks_like_code(s): True nếu một dòng (đã làm sạch) bị coi là dòng code hoặc có đường dẫn máy => không được làm tên.
name(text, slug): như eval/T-092/namerule.py nhưng mọi ứng viên phải qua looks_like_code (xem spec T-094 mục A)."""
import re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "T-092"))
import namerule as v1  # noqa: E402

KW = ("import from def class return if elif else for while with try except finally raise assert print exit const let var function await async "
      "set export source cd echo python python3 node bash npm git grep curl fi done exec mkdir rm cp mv cat sed awk jq printf npx readonly "
      "declare local esac yield lambda trap touch chmod eval unset shift ls").split()
# từ dễ trùng chữ thường của văn xuôi (do, test, case, ...): chỉ tính là code khi theo sau là cờ/ký hiệu shell/hết dòng/lệnh code
AMB = "test case then do pass find sort head tail true false diff command".split()
_ALL = set(KW) | set(AMB)
_KW = re.compile(r"^(" + "|".join(KW) + r")(?=$|[\s(\[{:;=.-])")
_AMB = re.compile(r"^(" + "|".join(AMB) + r")(?:$|\s*;|\s+(?=[-\"$/.\[('])|\s+(?=(?:" + "|".join(KW) + r")(?:$|[\s(\[{:;=.-])))")
_PIPE = re.compile(r" \| *(?:" + "|".join(sorted(_ALL | set("wc tr cut xargs tee uniq sh".split()))) + r")(?=$|[\s(\[{:;=.-])")
_ASSIGN = re.compile(r"^[A-Za-z_][A-Za-z0-9_.\[\]'\"]*\s*(?:[-+*/|&%]|\*\*|//)?=(?!=)\s*\S")   # tên = giá trị
_MULTI = re.compile(r"^[A-Za-z_][\w.]*(?:\s*,\s*[A-Za-z_][\w.]*)+\s*=(?!=)")                    # a, b = ...
_TYPED = re.compile(r"^[A-Za-z_]\w*\s*:\s*[A-Za-z_][\w\[\], .]*=(?!=)")                           # x: int = ...
_CALL = re.compile(r"^[A-Za-z_][A-Za-z0-9_.]*\(.*\)\s*;?$")                                          # tên(...) cả dòng
_OPEN = re.compile(r"^[A-Za-z_][A-Za-z0-9_.]*\(")                                                      # tên( ... có thể chưa đóng
_PATH = ("/home/", "/root/", "/tmp/", "handoffs/", "C:\\", "/Users/", "/var/", "/opt/")
_SYMS = ("$", "{", "}", "|", "&", "!", "<", ">", "@", ";", "\\", "^", "~", "/", "%", "*", "+")
_INFIX = ("$(", "${", " && ", " || ", " == ", " != ", " => ", " === ", " !== ", "=>", "->", ">&", "2>")


_JSON = re.compile(r'^"[\w.-]+"\s*:|^[a-z_]+:\s*[\["{]|^\S+\)\s*,?$|\)\s*;\s*\S')   # "khoá": …  |  khoá: [ …  |  …)  |  …); lệnh tiếp


def strip_trailing_comment(t):
    """Sửa đổi T-099: cắt chú thích cuối dòng. Quét từ trái sang phải; ngoài chuỗi nháy (\" hoặc '; nháy lẻ chưa đóng = coi như còn trong chuỗi, không cắt),
    chỗ đầu tiên là ' # ' hoặc ' // ' (khoảng trắng hai bên) đứng sau ít nhất một ký tự không trắng thì trả phần trước nó (đã bỏ khoảng trắng cuối). Không có thì trả t."""
    q = None
    for i, ch in enumerate(t):
        if q:
            if ch == q: q = None
        elif ch in "\"'": q = ch
        elif ch == " " and (t.startswith("# ", i + 1) or t.startswith("// ", i + 1)) and t[:i].strip():
            return t[:i].rstrip()
    return t


def looks_like_code(s):
    t = s.strip()
    if not t: return False
    if _core(t): return True
    h = strip_trailing_comment(t)
    return h != t and _core(h)


def _core(t):
    if any(p in t for p in _PATH): return True
    if t.startswith(_SYMS): return True
    if t.endswith("{"): return True
    if any(x in t for x in _INFIX): return True
    if _PIPE.search(t) and (t.isascii() or _KW.match(t) or _AMB.match(t)): return True   # pipe: dòng toàn ASCII hoặc mở đầu bằng lệnh; văn xuôi tiếng Việt trích `a | b` thì không
    if not t.split()[0].isupper() and (_KW.match(t) or _AMB.match(t)): return True
    if t.isascii() and (_JSON.search(t) or t.startswith('"') or t.count(")") > t.count("(") or t.startswith("(")): return True   # ASCII: JSON/khoá, bắt đầu nháy kép hoặc '(', đóng ngoặc thừa
    if _ASSIGN.match(t) or _MULTI.match(t) or _TYPED.match(t) or _CALL.match(t): return True
    if _OPEN.match(t) and (t.isascii() or t.count("(") > t.count(")") or t.endswith("(")): return True
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
