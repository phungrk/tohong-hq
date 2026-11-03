#!/usr/bin/env python3
"""BẤT BIẾN ĐỀ XUẤT (vùng planner/vendor/images), chưa nằm trong bể; Spec critic rút vào eval/invariants/planner/vendor/images/ khi spec qua cổng.
Tính chất: mọi URL ảnh trong pool thật hoặc trỏ tới domain Pages (manifest.baseUrl) hoặc nằm trong danh sách failed của manifest; không host lạ; không ảnh nào ok mà còn ở host gốc.
Chạy: python3 inv-proposed-pool-chi-tro-pages.py --back /đường/dẫn/tohong-back. ĐỎ cho tới khi T-051 ship (pool hiện toàn www.marry.vn). In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t051 import *
a = parse_args(); back = a.get("back") or fail("cần --back")
pool = os.path.join(back, "lib", "vendorPool.generated.js"); man = os.path.join(back, "scripts", "vendor-images", "manifest.json")
if not os.path.isfile(man): fail("chưa có scripts/vendor-images/manifest.json")
vs, _ = read_pool(pool); m = json.load(open(man, encoding="utf-8")); base = m["baseUrl"].rstrip("/") + "/"
failed = {u for u, e in m["entries"].items() if e["status"] == "failed"}
bad = []
for vid, u in refs(vs):
    if u.startswith(base):
        f = u[len(base):]
        if not any(e.get("file") == f for e in m["entries"].values() if e["status"] == "ok"): bad.append((vid, u, "URL Pages không có trong manifest"))
    elif u not in failed:
        bad.append((vid, u, "không phải Pages và không nằm trong danh sách ảnh lỗi"))
if bad: fail(f"{len(bad)} lượt ảnh sai, vd {bad[0]}")
ok(f"{len(refs(vs))} lượt ảnh đều trỏ Pages hoặc nằm trong danh sách lỗi")
