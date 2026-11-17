#!/usr/bin/env python3
"""T-198 adv-02 (adversary, tầng 3) · Chế độ `--prices-only` của generate-vendor-pool.js (T-164) không đọc trường vendors.json nào ngoài danh mục.
inv-006 (pool_reads) chỉ đo sinh đầy đủ và --styles-only --prune --photos-for; --prices-only là đường đọc thứ ba chưa được đo.
Đo: build_pool.py -> pool-vendors.json, sinh đầy đủ làm pool nền, rồi với mỗi đường dẫn trường (tối đa hai cấp) KHÔNG thuộc danh mục: xoá / thay giá trị đánh dấu
trên mọi bản ghi, chạy --prices-only --base <nền> --as-of cố định; đầu ra đổi => FAIL. Bản sao tạm, không ghi gì trong repo. Thoát 0 = đạt."""
import copy, json, os, shutil, subprocess, sys, tempfile
sys.dont_write_bytecode = True
here = os.path.dirname(os.path.abspath(__file__))
hq = os.path.dirname(os.path.dirname(here))
repo = next((c for c in (os.environ.get("TOHONG_REPO"), os.path.join(hq, "..", "tohong")) if c and os.path.isfile(os.path.join(c, "tools", "generate-vendor-pool.js"))), None)
if not repo:
    print("PASS chưa áp dụng (không thấy tohong)"); sys.exit(0)
keys = [f["key"] for f in json.load(open(os.path.join(repo, "tools", "scraper", "pool-input-fields.json"), encoding="utf-8"))["fields"] if f.get("file") == "vendors.json"]
sys.path.insert(0, os.path.join(hq, "eval", "lib"))
from pool_reads import apply, paths_of  # noqa: E402


def related(a, b):
    anc = lambda x, y: y == x or y.startswith(x + ".") or y.startswith(x + "[].")  # noqa: E731
    return anc(a, b) or anc(b, a)


tmp = tempfile.mkdtemp(prefix="t198adv02-")
try:
    shutil.copytree(os.path.join(repo, "tools"), os.path.join(tmp, "tools"))
    sc = os.path.join(tmp, "tools", "scraper")
    pv = os.path.join(tmp, "pv.json")
    r = subprocess.run([sys.executable, "-I", os.path.join(sc, "build_pool.py"), "--out", pv], cwd=sc, capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        print("ERROR build_pool.py"); sys.exit(2)
    doc = json.load(open(pv, encoding="utf-8"))
    G = os.path.join(tmp, "tools", "generate-vendor-pool.js")
    basejs = os.path.join(tmp, "base.js")
    subprocess.run(["node", G, "--in", pv, "--out", basejs, "--as-of", "2026-11-17"], cwd=tmp, capture_output=True, check=True)

    def prices(d):
        inp, out = os.path.join(tmp, "in.json"), os.path.join(tmp, "out.js")
        json.dump(d, open(inp, "w", encoding="utf-8"), ensure_ascii=False)
        g = subprocess.run(["node", G, "--prices-only", "--in", inp, "--base", basejs, "--out", out, "--as-of", "2026-11-17"], cwd=tmp, capture_output=True, text=True)
        return open(out, "rb").read() if g.returncode == 0 else "EXIT%d" % g.returncode

    base = prices(doc)
    allp = set().union(*(paths_of(x) for x in doc["vendors"]))
    bad, tried = [], 0
    for p in sorted(allp):
        if any(related(k, p) for k in keys):
            continue
        tried += 1
        for mode in ("delete", "sent"):
            d = copy.deepcopy(doc)
            for rec in d["vendors"]:
                apply(rec, p, mode)
            if prices(d) != base:
                bad.append(p); break
finally:
    shutil.rmtree(tmp, ignore_errors=True)
if bad:
    print("FAIL --prices-only đọc trường ngoài danh mục: %s" % bad); sys.exit(1)
print("PASS (%d đường dẫn ngoài danh mục đã đổi, đầu ra --prices-only không đổi)" % tried)
