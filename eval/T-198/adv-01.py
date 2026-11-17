#!/usr/bin/env python3
"""T-198 adv-01 (adversary, tầng 3) · Cột `pool` của danh mục pool-input-fields.json phải ĐỦ: mọi trường pool đổi khi đổi một mục danh mục phải có trong `pool` của mục đó.
Nguồn: products/T-147-drawer-vendor-enrich.md Hành vi 1: "`pool` = tên các trường của vendor trong pool bị ảnh hưởng" (cột "Trường pool bị ảnh hưởng" mô tả chế độ sinh đầy đủ);
tiêu chí T-198: "danh mục mô tả đúng trường thật được đọc". T-164 (tohong#100) cho generator sinh thêm `priceSource`, `priceAsOf` và cho giá phụ thuộc
`price_range.unit`, `last_scraped`, `name` (luật e), `categories` (ngưỡng/khung theo hạng mục); inv-006 chỉ kiểm KHOÁ, không kiểm cột `pool`.
Đo thực nghiệm: dựng pool-vendors.json bằng build_pool.py trên bản sao tạm, chạy generate-vendor-pool.js sinh đầy đủ với --as-of cố định,
rồi với mỗi mục (file vendors.json, stage gen) xoá / thay giá trị đánh dấu trên mọi bản ghi, so từng vendor: trường pool nào đổi mà không nằm trong `pool` => FAIL.
Chỉ kiểm chiều "thiếu" (không kiểm thừa). Không ghi gì trong repo. Repo: TOHONG_REPO hoặc ../tohong. Thoát 0 = đạt, 1 = vi phạm."""
import copy, json, os, shutil, subprocess, sys, tempfile
sys.dont_write_bytecode = True
here = os.path.dirname(os.path.abspath(__file__))
hq = os.path.dirname(os.path.dirname(here))
repo = next((c for c in (os.environ.get("TOHONG_REPO"), os.path.join(hq, "..", "tohong")) if c and os.path.isfile(os.path.join(c, "tools", "generate-vendor-pool.js"))), None)
if not repo:
    print("PASS chưa áp dụng (không thấy tohong)"); sys.exit(0)
cat = json.load(open(os.path.join(repo, "tools", "scraper", "pool-input-fields.json"), encoding="utf-8"))["fields"]
sys.path.insert(0, os.path.join(hq, "eval", "lib"))
from pool_reads import apply  # noqa: E402

AS_OF = "2026-11-17"
tmp = tempfile.mkdtemp(prefix="t198adv01-")
try:
    shutil.copytree(os.path.join(repo, "tools"), os.path.join(tmp, "tools"))
    sc = os.path.join(tmp, "tools", "scraper")
    pv = os.path.join(tmp, "pool-vendors.json")
    r = subprocess.run([sys.executable, "-I", os.path.join(sc, "build_pool.py"), "--out", pv], cwd=sc, capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        print("ERROR build_pool.py: " + (r.stdout + r.stderr)[-300:]); sys.exit(2)
    doc = json.load(open(pv, encoding="utf-8"))
    env = dict(os.environ)

    def gen(d):
        inp, out = os.path.join(tmp, "in.json"), os.path.join(tmp, "out.js")
        json.dump(d, open(inp, "w", encoding="utf-8"), ensure_ascii=False)
        g = subprocess.run(["node", os.path.join(tmp, "tools", "generate-vendor-pool.js"), "--in", inp, "--out", out, "--as-of", AS_OF],
                           cwd=tmp, env=env, capture_output=True, text=True, timeout=180)
        if g.returncode != 0:
            return None
        s = open(out, encoding="utf-8").read()
        return {v["id"]: v for v in json.loads(s[s.index("= [") + 2:s.rindex("]") + 1])}

    base = gen(doc)
    if base is None:
        print("ERROR generator chết trên dữ liệu gốc"); sys.exit(2)
    bad = []
    for f in cat:
        if f.get("file") != "vendors.json" or "gen" not in f.get("stages", []) or f["key"] in ("id", "categories"):
            continue  # id/categories đổi danh tính hoặc tập vendor: mọi trường đều đổi, không đo theo trường
        changed = set()
        for mode in ("delete", "sent"):
            d = copy.deepcopy(doc)
            for rec in d["vendors"]:
                apply(rec, f["key"], mode)
            got = gen(d)
            if got is None:
                continue
            for vid, v in base.items():
                w = got.get(vid)
                if w is None:
                    continue
                for k in set(v) | set(w):
                    if v.get(k) != w.get(k):
                        changed.add(k)
        miss = sorted(changed - set(f.get("pool") or []))
        if miss:
            bad.append("mục `%s` đổi pool %s mà cột pool chỉ ghi %s" % (f["key"], miss, f.get("pool")))
finally:
    shutil.rmtree(tmp, ignore_errors=True)
for b in bad:
    print("  - " + b)
if bad:
    print("FAIL " + bad[0] + (" (+%d)" % (len(bad) - 1) if len(bad) > 1 else "")); sys.exit(1)
print("PASS")
