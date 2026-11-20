#!/usr/bin/env python3
"""T-215 tiêu chí 5 (chặn hồi quy lân cận, đo TƯƠNG ĐỐI): T-215 không được thêm lệch MỚI giữa danh mục trường nguồn tạo pool (tools/scraper/pool-input-fields.json) và những gì các bước sinh pool thật sự đọc.
Phép đo: hai bất biến vùng planner/admin/vendor-enrich, inv-006 (danh mục khớp trường mà bước sinh pool đọc) và inv-014 (cột pool của mục danh mục đủ), chạy trên (A) commit NỀN và (B) ứng viên (cây làm việc của TOHONG_REPO).
Commit nền = commit mà cây eval ứng viên mọc ra: merge-base của HEAD với origin/main (không có thì main, không có nữa thì HEAD) trong TOHONG_REPO. FAIL chỉ khi B có lệch không có ở A (mục danh mục thiếu/thừa mới, cột pool thiếu mới).
Lệch đã có sẵn trên main (đỏ từ #108: tệp manual_overrides.json, price_range.price_source) là sự cố bể riêng, NGOÀI T-215: không làm eval này đỏ. Không ghim commit cũ.
inv-014 chạy nguyên bản (đọc các dòng '  - ...'); inv-006 chỉ in lệch đầu tiên nên đo bằng đúng phép tính của nó trên eval/lib/pool_reads.py (danh sách đầy đủ).
B giống hệt A (cây sạch, HEAD là nền) thì PASS ngay. ~2-4 phút. Chạy: python3 -I <file>."""
import glob, json, os, shutil, subprocess, sys, tempfile
sys.dont_write_bytecode = True
d = os.path.dirname(os.path.abspath(__file__))
while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    d = os.path.dirname(d)
sys.path.insert(0, os.path.join(d, "eval", "lib"))
import pool_reads

def fail(m):
    print("FAIL " + m); sys.exit(1)

def sh(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)

repo = next((c for c in (os.environ.get("TOHONG_REPO"), os.path.join(d, "..", "tohong")) if c and os.path.isfile(os.path.join(c, "tools", "scraper", "enrich.py"))), None)
if not repo:
    fail("không thấy repo tohong (đặt TOHONG_REPO)")
repo = os.path.abspath(repo)
if sh(["git", "-C", repo, "rev-parse", "--git-dir"]).returncode != 0:
    fail("TOHONG_REPO không phải repo git: không xác định được commit nền để đo tương đối")
base = None
for ref in ("origin/main", "main"):
    r = sh(["git", "-C", repo, "merge-base", "HEAD", ref])
    if r.returncode == 0 and r.stdout.strip():
        base = r.stdout.strip(); break
if not base:
    base = sh(["git", "-C", repo, "rev-parse", "HEAD"]).stdout.strip()
head = sh(["git", "-C", repo, "rev-parse", "HEAD"]).stdout.strip()
dirty = sh(["git", "-C", repo, "status", "--porcelain", "--ignore-submodules"]).stdout.strip()
if base == head and not dirty:
    print("PASS ứng viên trùng commit nền %s (không thêm lệch nào)" % base[:8]); sys.exit(0)

def related(a, b):
    anc = lambda x, y: y == x or y.startswith(x + ".") or y.startswith(x + "[].")
    return anc(a, b) or anc(b, a)

def dev006(r):
    """Danh sách lệch đầy đủ, cùng phép tính với inv-006."""
    cp = os.path.join(r, "tools", "scraper", "pool-input-fields.json")
    if not os.path.isfile(cp):
        return set()
    fields = json.load(open(cp, encoding="utf-8")).get("fields") or []
    reads = pool_reads.detect(r)
    measured = {"vendors.json": reads["style"] | reads["build"] | reads["gen"], "enrichment-audit.json": reads["audit"],
                "manual_overrides.json": reads["overrides"], "enrich-report.json": reads["report"]}
    bad = set()
    for f in fields:
        if str(f.get("key", "")).split(".")[0].split("[")[0] == "contact":
            bad.add("danh mục có mục liên hệ: %s" % f.get("key"))
    for fl, ps in measured.items():
        keys = [f["key"] for f in fields if f.get("file") == fl]
        bad |= {"bước sinh pool đọc `%s` của %s mà danh mục không có" % (p, fl) for p in sorted(ps) if not any(related(k, p) for k in keys)}
        bad |= {"danh mục có `%s` của %s mà không bước nào đọc" % (k, fl) for k in keys if not any(related(k, p) for p in ps)}
    if not reads.get("pool_base"):
        bad.add("pool nền (--base) không còn là đầu vào của --styles-only mà extra_inputs còn ghi")
    return bad

def dev014(r):
    f = sorted(glob.glob(os.path.join(d, "eval", "invariants", "planner", "admin", "vendor-enrich", "inv-014-*.py")))
    if not f:
        fail("không thấy bất biến inv-014")
    p = sh([sys.executable, "-I", f[0]], env=dict(os.environ, TOHONG_REPO=r), timeout=900)
    if p.returncode not in (0, 1):
        fail("inv-014 lỗi chạy (ERROR) trên %s: %s" % (r, (p.stdout + p.stderr)[-200:]))
    return {l[4:].strip() for l in p.stdout.splitlines() if l.startswith("  - ")}

tmp = tempfile.mkdtemp(prefix="t215-base-")
try:
    bdir = os.path.join(tmp, "base")
    os.makedirs(bdir)
    p = subprocess.run("git -C '%s' archive '%s' | tar -x -C '%s'" % (repo, base, bdir), shell=True, capture_output=True, text=True)
    if p.returncode != 0:
        fail("không dựng được commit nền %s: %s" % (base[:8], p.stderr[-200:]))
    a = dev006(bdir) | {"[014] " + x for x in dev014(bdir)}
    b = dev006(repo) | {"[014] " + x for x in dev014(repo)}
finally:
    shutil.rmtree(tmp, ignore_errors=True)
new = sorted(b - a)
if new:
    fail("%d lệch MỚI so với nền %s (nền có %d), vd: %s" % (len(new), base[:8], len(a), new[0]))
print("PASS không thêm lệch mới so với nền %s (nền %d lệch, ứng viên %d lệch, lệch có sẵn ngoài phạm vi T-215)" % (base[:8], len(a), len(b)))
