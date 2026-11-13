#!/usr/bin/env python3
"""Nguồn: sự cố lặp lại 3 lần trong 4 ngày (insights/2026-11-13-feedback.md): ADR-057 (10/11, INV-024 chép từ eval/T-119/bat-bien-cho-merge/ vào bể,
dòng tính HQ đếm 3 cấp thay vì 5, crash FileNotFoundError khi không đặt TOHONG_REPO), ADR-070 (12/11, inv-032 cùng lỗi, phải sửa tay),
ADR-076 (13/11, inv-029 "tìm gốc HQ bằng cách lùi đúng 3 cấp", cùng lỗi). Cả ba chỉ lộ ra do người nhớ chạy lại bất biến "không kèm biến môi trường, từ cwd khác".
INV-004 (_shared) · Bất biến nào tự ĐẾM cấp thư mục để tìm gốc tohong-hq (ROOT/HQ/REPO = ...parents[n] | .parent.parent | dirname(...)/.. | cd "$HERE/../..")
thì phép đếm đó phải ra ĐÚNG thư mục có scripts/gate.py, tại chỗ file đang nằm. Chép một bất biến từ bat-bien-cho-merge/ sang bể (khác độ sâu)
mà không sửa dòng đếm cấp → đỏ ngay ở gate, không đợi lần chạy sau. Dò ngược tới scripts/gate.py (ADR-057/070) không bị kiểm vì không đếm cấp.
Phạm vi quét: mọi *.py và *.sh dưới eval/invariants/ (kể cả lib/), trừ _luu-tru/ (đã lưu trữ, gate không chạy). Chỉ xét dòng gán ROOT, HQ, REPO, HQ_ROOT, HQROOT
(không đoán các biến khác); dòng comment bỏ qua. Gốc nhận ra theo vị trí thật của file này (dò ngược tới scripts/gate.py), có selftest đối chứng
(đúng độ sâu → đạt; chép sang sâu hơn / nông hơn → đỏ; dò ngược → đạt) trước khi quét. Nợ đã biết liệt kê ở _shared/mien-tru-inv-004.txt (mỗi dòng một file); miễn trừ lỗi thời (file đã sửa mà còn trong danh sách) cũng đỏ để danh sách tự dọn. Không mạng, không đọc ngoài repo. Chạy không tham số (gate.py: python3 -I). Mã thoát 0 = đạt."""
import os, re, shutil, sys, tempfile

NAMES = r"(?:ROOT|HQ|REPO|HQ_ROOT|HQROOT)"
PY_ASSIGN = re.compile(r"^\s*" + NAMES + r"\s*=\s*(.*)$")
SH_ASSIGN = re.compile(r"^\s*(?:export\s+)?" + NAMES + r"=(.*)$")
SH_CD = re.compile(r'\$\(cd "(?:\$HERE|\$\{HERE\}|\$SCRIPT_DIR|\$\{SCRIPT_DIR\}|\$\(dirname "\$0"\)|\$\(dirname "\$\{BASH_SOURCE\[0\]\}"\))((?:/\.\.)+)"')


def exempt(root):
    """Nợ đã biết (đường dẫn tương đối từ gốc HQ), đọc từ _shared/mien-tru-inv-004.txt; không phải file inv-* nên gate không chạy nó."""
    p = os.path.join(root, "eval", "invariants", "_shared", "mien-tru-inv-004.txt")
    out = set()
    if os.path.isfile(p):
        for line in open(p, encoding="utf-8"):
            s = line.split("#", 1)[0].strip()
            if s:
                out.add(s)
    return out


def find_root(start):
    d = os.path.dirname(os.path.realpath(start))
    while d != "/" and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
        d = os.path.dirname(d)
    return d if os.path.isfile(os.path.join(d, "scripts", "gate.py")) else None


def ups_py(rhs):
    """Số cấp đi lên từ THƯ MỤC CHỨA file (0 = chính thư mục đó), hoặc None nếu dòng không phải kiểu đếm cấp."""
    m = re.search(r"parents\[(\d+)\]", rhs)
    if m and "__file__" in rhs:
        return int(m.group(1))
    m = re.search(r"""\*\s*\[\s*["']\.\.["']\s*\]\s*\*\s*(\d+)""", rhs)  # join(dirname(__file__), *[".."] * N)
    if m and "__file__" in rhs:
        return int(m.group(1))
    if "__file__" in rhs and re.search(r"\.parent\b", rhs):
        n = len(re.findall(r"\.parent\b", rhs)) - 1
        return n if n >= 1 else None   # một .parent = điểm xuất phát của vòng dò ngược, không phải phép đếm cấp
    if "__file__" in rhs and ('".."' in rhs or "'..'" in rhs):
        return len(re.findall(r"""["']\.\.["']""", rhs))
    n = len(re.findall(r"\bdirname\(", rhs))
    if "__file__" in rhs and n >= 2:
        return n - 1
    return None


def scan(root):
    """Trả (số dòng đã kiểm, danh sách lỗi) cho mọi file dưới <root>/eval/invariants."""
    checked, bad = 0, []
    base = os.path.join(root, "eval", "invariants")
    for d, dirs, fs in os.walk(base):
        dirs[:] = [x for x in dirs if x not in ("_luu-tru", "node_modules", "__pycache__")]
        for f in sorted(fs):
            if not (f.endswith(".py") or f.endswith(".sh")):
                continue
            p = os.path.join(d, f)
            here = os.path.dirname(os.path.realpath(p))
            try:
                lines = open(p, encoding="utf-8", errors="replace").read().splitlines()
            except OSError:
                continue
            for i, line in enumerate(lines, 1):
                if line.lstrip().startswith("#"):
                    continue
                up = None
                if f.endswith(".py"):
                    m = PY_ASSIGN.match(line)
                    if m:
                        up = ups_py(m.group(1))
                else:
                    m = SH_ASSIGN.match(line)
                    c = SH_CD.search(m.group(1)) if m else None
                    if c:
                        up = c.group(1).count("/..")
                if up is None:
                    continue
                checked += 1
                t = here
                for _ in range(up):
                    t = os.path.dirname(t)
                if not os.path.isfile(os.path.join(t, "scripts", "gate.py")):
                    rel = os.path.relpath(t, root) if t.startswith(root) else t
                    bad.append(f"{os.path.relpath(p, root)}:{i}: đếm {up} cấp lên → '{rel}' không có scripts/gate.py ({line.strip()[:110]})")
    return checked, bad


def selftest():
    tmp = tempfile.mkdtemp(prefix="inv004-")
    try:
        def put(rel, text):
            p = os.path.join(tmp, rel)
            os.makedirs(os.path.dirname(p), exist_ok=True)
            open(p, "w", encoding="utf-8").write(text)
        put("scripts/gate.py", "")
        # a/b nằm ở eval/invariants/a/b: gốc cách 4 cấp từ thư mục chứa file (parents[4] khi resolve file: b,a,invariants,eval,root)
        put("eval/invariants/a/b/inv-001-dung.py", "from pathlib import Path\nROOT = Path(__file__).resolve().parents[4]\n")
        put("eval/invariants/a/b/inv-002-dung.sh", 'HERE="$(cd "$(dirname "$0")" && pwd)"\nROOT="$(cd "$HERE/../../../.." && pwd)"\n')
        put("eval/invariants/a/b/inv-003-doi-cap-py.py", "ROOT = pathlib.Path(__file__).resolve().parent.parent.parent.parent.parent\n")
        put("eval/invariants/a/b/inv-004-do-nguoc.py", 'HQ = os.path.dirname(os.path.abspath(__file__))\nwhile HQ != "/" and not os.path.isfile(os.path.join(HQ, "scripts", "gate.py")):\n    HQ = os.path.dirname(HQ)\n')
        put("eval/invariants/a/b/inv-005-comment.py", "# ROOT = Path(__file__).resolve().parents[1]\n")
        put("eval/invariants/a/b/inv-006-khac-ten.py", "repo = Path(__file__).resolve().parents[1]\n")
        put("eval/invariants/a/b/_luu-tru/inv-007-luu-tru.py", "ROOT = Path(__file__).resolve().parents[1]\n")
        c, b = scan(tmp)
        if b or c != 3:
            return f"selftest: bản đúng độ sâu phải đạt với 3 dòng đã kiểm, được {c} dòng, lỗi {b}"
        # chép sang sâu hơn (c/d): mọi dòng đếm cấp phải đỏ
        for n in ("inv-001-dung.py", "inv-002-dung.sh", "inv-003-doi-cap-py.py"):
            os.makedirs(os.path.join(tmp, "eval/invariants/a/b/c/d"), exist_ok=True)
            shutil.copy(os.path.join(tmp, "eval/invariants/a/b", n), os.path.join(tmp, "eval/invariants/a/b/c/d", n))
        c, b = scan(tmp)
        if len(b) != 3 or any("/c/d/" not in x.replace("\\", "/") for x in b):
            return f"selftest: chép sang sâu hơn 2 cấp phải đỏ đúng 3 dòng, được {len(b)}: {b}"
        # chép sang nông hơn (eval/invariants/inv-*): đỏ
        shutil.copy(os.path.join(tmp, "eval/invariants/a/b/inv-001-dung.py"), os.path.join(tmp, "eval/invariants/inv-001-dung.py"))
        c, b = scan(tmp)
        if len(b) != 4:
            return f"selftest: chép sang nông hơn phải đỏ thêm 1 dòng (tổng 4), được {len(b)}"
        return None
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    err = selftest()
    if err:
        print("FAIL " + err)
        return 1
    root = find_root(__file__)
    if not root:
        print("FAIL không dò ngược được tới thư mục có scripts/gate.py từ " + os.path.realpath(__file__))
        return 1
    checked, bad = scan(root)
    ex = exempt(root)
    seen = {x.split(":", 1)[0] for x in bad}
    stale = sorted(ex - seen)
    if stale:
        print("FAIL miễn trừ lỗi thời (file không còn đếm sai cấp, hoặc không còn): xoá dòng khỏi eval/invariants/_shared/mien-tru-inv-004.txt: " + ", ".join(stale))
        return 1
    bad = [x for x in bad if x.split(":", 1)[0] not in ex]
    if bad:
        print(f"FAIL {len(bad)} dòng tự đếm cấp thư mục ra khác gốc tohong-hq (sửa sang dò ngược tới scripts/gate.py, ADR-057/070):")
        for x in bad:
            print("  " + x)
        return 1
    print(f"PASS selftest 3 ca; {checked} dòng đếm cấp trong eval/invariants, {len(ex)} nợ miễn trừ (mien-tru-inv-004.txt), còn lại đều ra đúng gốc tohong-hq")
    return 0


if __name__ == "__main__":
    sys.exit(main())
