#!/usr/bin/env python3
"""Nguồn: T-104 (spec tohong/specs/005-google-place-photos FR-001; PR phungrk/tohong #65 #67 #69, phungrk/tohong-back #40 #41, main d3dfa18);
rút vào bể khi adversary đọc lại việc Capu làm ngoài HQ (Cowork 07–08/11).
INV-012 · Pool vendor của tohong-back không chứa URL API Places của Google: không có `places.googleapis.com`, không có endpoint cũ
`maps.googleapis.com/maps/api/place/...`, không có URL googleapis nào mang `key=`, không có chuỗi khoá dạng `AIza…`.
Lý do: URL đó lộ API key ra trình duyệt và mỗi lần hiển thị là một request tính tiền; pool chỉ được giữ photoUri (lh3.googleusercontent.com).
Cách đo: tìm mọi file pool trong repo (bỏ node_modules, .git, thư mục test/tests/__tests__/fixtures): `lib/vendorPool*.js`, mọi file
.js/.mjs/.cjs có dòng bắt đầu bằng `export const GENERATED_VENDOR_POOL =`, mọi file .json có tên chứa cả "vendor" và "pool"; đọc dạng văn bản (đổi `\\/` thành `/`, không phân biệt hoa thường)
và đối chiếu bốn mẫu trên. Đạt khi không file nào khớp.
Repo tohong-back: TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back (repo có lib/vendorPool.generated.js). Không tìm thấy: PASS "chưa áp dụng".
Chạy không tham số (gate.py: python3 -I). Mã thoát 0 = đạt."""
import os, re, sys

POOL_FILE = os.path.join("lib", "vendorPool.generated.js")
cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, POOL_FILE))), None)
if not repo: print("PASS chưa áp dụng (không tìm thấy tohong-back/%s)" % POOL_FILE); sys.exit(0)

BAD = [
    ("places.googleapis.com", re.compile(r"places\.googleapis\.com", re.I)),
    ("maps.googleapis.com/maps/api/place", re.compile(r"maps\.googleapis\.com/maps/api/place", re.I)),
    ("URL googleapis có key=", re.compile(r"googleapis\.com/[^\s\"'<>]*[?&]key=", re.I)),
    ("chuỗi khoá AIza…", re.compile(r"AIza[0-9A-Za-z_\-]{35}")),
]
SKIP = {"node_modules", ".git", "test", "tests", "__tests__", "fixtures"}
DEF = re.compile(r"^export\s+const\s+GENERATED_VENDOR_POOL\s*=", re.M)

def is_pool(rel, path):
    r = rel.replace(os.sep, "/"); name = os.path.basename(r).lower()
    if r.lower().startswith("lib/vendorpool") and name.endswith((".js", ".mjs", ".cjs")): return True
    if name.endswith(".json"): return "vendor" in name and "pool" in name
    if name.endswith((".js", ".mjs", ".cjs")):
        try:
            with open(path, encoding="utf-8", errors="replace") as f: return bool(DEF.search(f.read()))
        except OSError: return False
    return False

files = []
for d, dirs, names in os.walk(repo):
    dirs[:] = [x for x in dirs if x not in SKIP]
    for n in names:
        p = os.path.join(d, n); rel = os.path.relpath(p, repo)
        if is_pool(rel, p): files.append((rel, p))
if not any(rel.replace(os.sep, "/") == "lib/vendorPool.generated.js" for rel, _ in files):
    files.append((POOL_FILE, os.path.join(repo, POOL_FILE)))

fails = []
for rel, p in sorted(set(files)):
    text = open(p, encoding="utf-8", errors="replace").read().replace("\\/", "/")
    for label, rx in BAD:
        m = rx.search(text)
        if m:
            # không in khoá: chỉ in vị trí và nhãn mẫu
            fails.append("%s: %s (vị trí %d)" % (rel, label, m.start()))
if fails:
    print("FAIL pool chứa URL API Places của Google (lộ key, tính tiền mỗi lần hiển thị):")
    for f in fails[:20]: print("  " + f)
    sys.exit(1)
print("PASS %d file pool (%s) không chứa URL API Places/khoá Google" % (len(set(files)), ", ".join(sorted({r for r, _ in files}))))
