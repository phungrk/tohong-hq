#!/usr/bin/env python3
"""Sinh baseline-pool.json (chỉ chạy MỘT lần, trước khi Engineering tạo lại pool; không chạy lại sau đó).
Nguồn: tohong-back commit 6a9a9c707f35592fc9c3845613ba8cf38655f5c9, file lib/vendorPool.generated.js (pool trước T-073).
Mỗi id -> {"i": thứ tự, "styles": [...], "rest": sha256 của JSON chuẩn hoá phần còn lại của entry}."""
import hashlib, json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
COMMIT = "6a9a9c707f35592fc9c3845613ba8cf38655f5c9"
src = subprocess.run(["git", "-C", c.back(), "show", COMMIT + ":lib/vendorPool.generated.js"], capture_output=True, text=True, check=True).stdout
pool = json.loads(src[src.index("= [") + 2 : src.rindex("]") + 1])
out = {"commit": COMMIT, "entries": {}}
for i, v in enumerate(pool):
    rest = {k: x for k, x in v.items() if k not in ("styles", "tags")}
    out["entries"][v["id"]] = {"i": i, "styles": v["styles"], "rest": hashlib.sha256(json.dumps(rest, sort_keys=True, ensure_ascii=False).encode()).hexdigest()}
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "baseline-pool.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print("ghi %d entry" % len(pool))
