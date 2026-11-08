#!/usr/bin/env python3
"""Nguồn: T-102 (spec products/T-102-graphify-thu-nghiem.md v3, mục "Bất biến đề xuất"), spec-critic accept ở Spec Gate lần 3, 2026-11-08.
INV-003 (_shared) · Công cụ đang thử nghiệm không để lại dấu vết trong cấu hình dùng chung của tohong-hq:
không file nào (kể cả file chưa được git theo dõi) dưới `.claude/`, `scripts/`, `templates/`, `handbook/`, `routines/`, `.github/`
và `CLAUDE.md` có TÊN hoặc NỘI DUNG chứa một tên trong eval/invariants/_shared/experimental-tools.txt (không phân biệt hoa thường).
Lý do: thử nghiệm (vd Graphify) phải khoanh vùng trong thư mục thí nghiệm; cài vào repo sổ cái làm đổi hành vi mọi agent
(hook, skill, CLAUDE.md) mà không qua quyết định. Chỉ quét file của repo, không quét $HOME hay repo khác, nên kết quả không phụ thuộc máy chạy.
Bỏ qua thư mục .git, node_modules, __pycache__. File danh sách nằm ngoài vùng quét nên không tự làm đỏ.
Có selftest đối chứng trước khi quét. Chạy không tham số (gate.py: python3 -I). Mã thoát 0 = đạt."""
import os, sys, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
LIST = os.path.join(ROOT, "eval", "invariants", "_shared", "experimental-tools.txt")
SCOPE = (".claude", "scripts", "templates", "handbook", "routines", ".github", "CLAUDE.md")
SKIP_DIRS = {".git", "node_modules", "__pycache__"}
MAX_BYTES = 5 * 1024 * 1024


def tools(path):
    if not os.path.isfile(path):
        print(f"FAIL thiếu danh sách công cụ thử nghiệm {os.path.relpath(path, ROOT)}"); sys.exit(1)
    out = []
    for line in open(path, encoding="utf-8"):
        s = line.strip()
        if s and not s.startswith("#"): out.append(s.lower())
    return out


def files(root):
    for top in SCOPE:
        p = os.path.join(root, top)
        if os.path.islink(p) or os.path.isfile(p):
            yield p; continue
        if not os.path.isdir(p): continue
        for d, dirs, fs in os.walk(p):           # không theo symlink thư mục
            dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
            for x in dirs: yield os.path.join(d, x)      # thư mục (kể cả rỗng) và symlink thư mục: kiểm tên
            for f in fs: yield os.path.join(d, f)


def hits(root, names):
    out = []
    for p in files(root):
        rel = os.path.relpath(p, root)
        low = rel.lower()
        for n in names:
            if n in low: out.append(f"{rel}: tên chứa '{n}'")
        if os.path.islink(p):
            tgt = os.readlink(p).lower()
            for n in names:
                if n in tgt: out.append(f"{rel}: symlink trỏ tới đường dẫn chứa '{n}'")
            continue
        if os.path.isdir(p): continue
        try:
            if os.path.getsize(p) > MAX_BYTES: continue
            data = open(p, "rb").read().decode("utf-8", "ignore").lower()
        except OSError:
            continue
        for n in names:
            i = data.find(n)
            if i >= 0: out.append(f"{rel}:{data.count(chr(10), 0, i) + 1}: nội dung chứa '{n}'")
    return out


def selftest():
    with tempfile.TemporaryDirectory() as t:
        os.makedirs(os.path.join(t, ".claude", "agents"))
        open(os.path.join(t, "CLAUDE.md"), "w").write("sạch\n")
        open(os.path.join(t, ".claude", "agents", "a.md"), "w").write("sạch\n")
        assert hits(t, ["zzthu"]) == [], "selftest: cây sạch bị báo bẩn"
        open(os.path.join(t, ".claude", "settings.json"), "w").write('{"hooks": "ZZThu query"}\n')
        assert hits(t, ["zzthu"]), "selftest: nội dung bẩn không bị bắt"
        os.remove(os.path.join(t, ".claude", "settings.json"))
        os.makedirs(os.path.join(t, ".claude", "skills", "zzthu"))
        open(os.path.join(t, ".claude", "skills", "zzthu", "SKILL.md"), "w").write("x\n")
        assert hits(t, ["zzthu"]), "selftest: tên bẩn không bị bắt"
        os.remove(os.path.join(t, ".claude", "skills", "zzthu", "SKILL.md"))
        assert hits(t, ["zzthu"]), "selftest: thư mục rỗng mang tên bẩn không bị bắt"


if __name__ == "__main__":
    try:
        selftest()
    except AssertionError as e:
        print(f"FAIL {e}"); sys.exit(1)
    names = tools(LIST)
    if not names:
        print("PASS danh sách công cụ thử nghiệm rỗng, không có gì để kiểm"); sys.exit(0)
    h = hits(ROOT, names)
    if h:
        print(f"FAIL công cụ thử nghiệm để lại dấu vết trong cấu hình dùng chung ({len(h)}):")
        for x in h[:10]: print("  " + x)
        sys.exit(1)
    print(f"PASS không có dấu vết của {', '.join(names)} trong {', '.join(SCOPE)}")
    sys.exit(0)
