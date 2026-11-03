#!/usr/bin/env python3
"""BẤT BIẾN ĐỀ XUẤT (vùng planner/vendor/images), chưa nằm trong bể; Spec critic rút vào eval/invariants/planner/vendor/images/ khi spec qua cổng.
Chạy không tham số dưới `python3 -I` (như gate.py), cwd = repo tohong-back; đổi repo bằng biến môi trường TOHONG_BACK_REPO. Tự đứng một mình (không import thư viện eval).
Tính chất (spec T-051 mục 13, 19, 21):
  (i)   mọi URL ảnh trong pool bắt đầu bằng manifest.baseUrl + "/" phải có file đó trong một entry `ok` của manifest;
  (ii)  URL gốc đã có entry `ok` thì không còn nằm trong pool (đã rewrite);
  (iii) URL chưa có trong manifest, hoặc có entry `failed`, được phép (vendor mới sinh lại chờ `mirror` lần sau).
Chưa có manifest hoặc chưa có pool: PASS "chưa áp dụng". In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import json, os, sys

repo = os.path.abspath(os.environ.get("TOHONG_BACK_REPO") or os.getcwd())
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
