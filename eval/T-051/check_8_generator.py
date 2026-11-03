#!/usr/bin/env python3
"""T-051 tiêu chí 8: chạy lại generator (node tools/generate-vendor-pool.js) KHÔNG đưa URL marry.vn trở lại cho ảnh đã mirror.
Dựng cây giả theo bố cục thật (tohong/tools + tohong/edge là submodule tohong-back).
Chạy: python3 eval/T-051/check_8_generator.py --back <tohong-back> --tohong <tohong>. In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import os, sys, json, shutil, subprocess
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t051 import *

a = parse_args()
back, tohong = (a.get(k) or fail(f"cần --{k}") for k in ("back", "tohong"))
w = Work()
try:
    tree = os.path.join(w.tmp, "tree")
    os.makedirs(os.path.join(tree, "tools"))
    shutil.copy(os.path.join(tohong, "tools", "generate-vendor-pool.js"), os.path.join(tree, "tools"))
    for sub in ("scripts", ".gitignore"):
        pass
    shutil.copytree(os.path.join(back, "scripts"), os.path.join(tree, "edge", "scripts"))
    if os.path.isfile(os.path.join(back, "package.json")): shutil.copy(os.path.join(back, "package.json"), os.path.join(tree, "edge", "package.json"))
    nm = os.path.join(back, "node_modules")
    if os.path.isdir(nm): os.symlink(nm, os.path.join(tree, "edge", "node_modules"))
    os.makedirs(os.path.join(tree, "edge", "lib"))
    # nguồn scraper giả (pool-vendors.json) với URL gốc trỏ server giả
    src = [{"id": v["id"], "name": v["name"], "categories": ["photography"], "description": "d", "style_tags": ["modern"],
            "city": "HCMC", "portfolio_urls": [p["url"] for p in v["photos"]][:4]} for v in w.vendors]
    srcf = os.path.join(tree, "pool-vendors.json"); json.dump(src, open(srcf, "w", encoding="utf-8"), ensure_ascii=False)
    need_summary(w.mirror(back, pool=None), "mirror")
    man_in_edge = os.path.join(tree, "edge", "scripts", "vendor-images", "manifest.json")
    os.makedirs(os.path.dirname(man_in_edge), exist_ok=True); shutil.copy(w.manifest, man_in_edge)
    out = os.path.join(tree, "edge", "lib", "vendorPool.generated.js")
    r = run(["node", os.path.join(tree, "tools", "generate-vendor-pool.js"), "--in", srcf, "--out", out], cwd=tree)
    if r.returncode != 0 or not os.path.isfile(out): fail("generator lỗi hoặc không nhận --in/--out: " + (r.stdout + r.stderr)[-250:])
    vs, _ = read_pool(out)
    man = w.man()["entries"]
    n_ok = 0
    for vid, url in refs(vs):
        pass
    got = [u for _, u in refs(vs)]
    for old in [u for _, u in refs(w.vendors)]:
        e = man[old]
        want = BASE_URL + "/" + e["file"] if e["status"] == "ok" else old
        if want not in got: fail(f"sau generator thiếu {want}")
        n_ok += e["status"] == "ok"
    if any(u.startswith(w.fm.origin) and man[u]["status"] == "ok" for u in got): fail("generator đưa URL gốc trở lại cho ảnh đã mirror")
    ok(f"generator giữ {n_ok} URL Pages sau khi sinh lại")
finally:
    w.stop()
