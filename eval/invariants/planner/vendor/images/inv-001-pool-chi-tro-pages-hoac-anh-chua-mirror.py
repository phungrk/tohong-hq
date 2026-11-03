#!/usr/bin/env python3
"""Nguồn: T-051 (spec products/T-051-tu-host-anh-vendor.md v3, qua Spec Gate 2026-11-03, spec-critic; rút từ eval/T-051/inv-proposed-pool-chi-tro-pages.py).
INV-001 · Pool ảnh vendor nhất quán với manifest Pages:
  (i)   mọi URL ảnh trong lib/vendorPool.generated.js bắt đầu bằng manifest.baseUrl + "/" phải trỏ tới file của một entry `ok`;
  (ii)  URL gốc đã có entry `ok` thì không còn nằm trong pool (đã rewrite sang Pages);
  (iii) URL chưa có trong manifest (vendor mới chờ mirror) hoặc có entry `failed` được phép.
Chạy không tham số (gate.py: python3 -I). Repo tohong-back: biến TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back.
Chưa có manifest hoặc pool: PASS "chưa áp dụng". Mã thoát 0 = đạt."""
import json, os, sys

cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back")]
repo = os.path.abspath(next((c for c in cands if c and os.path.isfile(os.path.join(c, "lib", "vendorPool.generated.js"))), os.getcwd()))
pool = os.path.join(repo, "lib", "vendorPool.generated.js")
man = os.path.join(repo, "scripts", "vendor-images", "manifest.json")
if not os.path.isfile(man) or not os.path.isfile(pool):
    print("PASS chưa áp dụng (chưa có scripts/vendor-images/manifest.json hoặc lib/vendorPool.generated.js)"); sys.exit(0)
try:
    s = open(pool, encoding="utf-8").read()
    vs = json.loads(s[s.index("= ") + 2:s.rindex(";")])
    m = json.load(open(man, encoding="utf-8"))
    base = m["baseUrl"].rstrip("/") + "/"
    ents = m["entries"]
except Exception as e:
    print("FAIL không đọc được pool/manifest: " + str(e)[:120]); sys.exit(1)
ok_files = {e["file"] for e in ents.values() if e.get("status") == "ok"}
bad = []
for v in vs:
    for p in v.get("photos", []):
        u = p["url"]
        if u.startswith(base):
            if u[len(base):] not in ok_files: bad.append((v["id"], u, "Pages URL không có entry ok trong manifest"))
        elif ents.get(u, {}).get("status") == "ok":
            bad.append((v["id"], u, "ảnh đã mirror ok nhưng pool còn URL gốc"))
if bad:
    print(f"FAIL {len(bad)} lượt ảnh sai, vd {bad[0]}"); sys.exit(1)
print("PASS pool nhất quán với manifest")
