"""Helper cho eval đối kháng T-113: đọc workflow của repo tohong (TOHONG_REPO), đánh giá biểu thức GitHub Actions tối giản
(so sánh chuỗi KHÔNG phân biệt hoa thường như GitHub; &&/|| trả toán hạng; always()/success() = true; steps.*.outcome = 'success' (trường hợp xấu nhất: bước sau chạy)).
Không gọi mạng, không gọi Google."""
import os, re, sys
sys.dont_write_bytecode = True  # không để __pycache__ trong repo sản phẩm

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", ".."))


def repo():
    r = os.environ.get("TOHONG_REPO") or os.path.join(HQ, "..", "tohong")
    return os.path.abspath(r)


def fail(msg):
    print("FAIL " + msg)
    sys.exit(1)


def ok(msg="PASS"):
    print(msg)
    sys.exit(0)


def load(name):
    import yaml
    p = os.path.join(repo(), ".github", "workflows", name)
    if not os.path.isfile(p):
        fail("thiếu " + p)
    d = yaml.safe_load(open(p, encoding="utf-8").read())
    if True in d and "on" not in d:
        d["on"] = d.pop(True)
    return d


TOK = re.compile(r"\s*(\$\{\{|\}\}|&&|\|\||==|!=|!|\(|\)|'(?:[^']|'')*'|[A-Za-z_][\w.\-]*\(\)|[A-Za-z_][\w.\-]*|\d+)")


def _tokens(s):
    s = s.strip()
    if s.startswith("${{") and s.endswith("}}"):
        s = s[3:-2]
    out, i = [], 0
    while i < len(s):
        m = TOK.match(s, i)
        if not m:
            if s[i:].strip() == "":
                break
            raise ValueError("không hiểu biểu thức: " + s[i:])
        out.append(m.group(1))
        i = m.end()
    return out


def _truthy(v):
    return v not in (None, "", False, 0)


def _eq(a, b):
    if a is None:
        a = ""
    if b is None:
        b = ""
    if isinstance(a, bool) or isinstance(b, bool):
        return a == b
    return str(a).lower() == str(b).lower()


def evaluate(expr, inputs):
    """inputs: dict tên input -> chuỗi (None = không có, như lần chạy theo lịch)."""
    toks = _tokens(expr)
    pos = [0]

    def peek():
        return toks[pos[0]] if pos[0] < len(toks) else None

    def take():
        t = toks[pos[0]]
        pos[0] += 1
        return t

    def atom():
        t = take()
        if t == "(":
            v = orx()
            take()
            return v
        if t == "!":
            return not _truthy(atom())
        if t.startswith("'"):
            return t[1:-1].replace("''", "'")
        if t.endswith("()"):
            return True  # always(), success(), failure()... trường hợp xấu nhất: bước chạy
        if t.startswith("github.event.inputs.") or t.startswith("inputs."):
            return inputs.get(t.split(".")[-1])
        if t.startswith("steps.") and t.endswith(".outcome"):
            return "success"
        if t.startswith("github.run_id"):
            return "777"
        if t.startswith("github."):
            return "x"
        if t.isdigit():
            return int(t)
        return None

    def cmp():
        a = atom()
        while peek() in ("==", "!="):
            op = take()
            b = atom()
            a = _eq(a, b) if op == "==" else not _eq(a, b)
        return a

    def andx():
        a = cmp()
        while peek() == "&&":
            take()
            b = cmp()
            a = b if _truthy(a) else a
        return a

    def orx():
        a = andx()
        while peek() == "||":
            take()
            b = andx()
            a = a if _truthy(a) else b
        return a

    return orx()


def render(text, inputs):
    """Thay mọi ${{ … }} trong chuỗi bằng giá trị biểu thức (như runner làm trước khi chạy bash)."""
    def sub(m):
        v = evaluate(m.group(0), inputs)
        return "" if v is None else str(v)
    return re.sub(r"\$\{\{.*?\}\}", sub, text)
