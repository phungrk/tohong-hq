#!/usr/bin/env python3
"""T-136 ĐO (không phải eval): id matcher dùng có khớp id pool app không? Không mạng, chỉ đọc.
  python3 eval/T-136/measure_ids.py                         # bằng chứng sẵn có trong repo (không có bản bucket)
  python3 eval/T-136/measure_ids.py --matcher-file vendors.json   # bản bucket Capu tải về (gsutil cp gs://wedding-planner-vendors/vendors.json .): số thật
Kết quả đo 2026-11-12 trên repo: xem products/T-136-... mục Bằng chứng."""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
T = os.environ.get("TOHONG_REPO") or os.path.join(HQ, "..", "tohong"); B = os.environ.get("TOHONG_BACK_REPO") or os.path.join(HQ, "..", "tohong-back")
s = open(os.path.join(B, "lib/vendorPool.generated.js"), encoding="utf-8").read(); pool = {v["id"] for v in json.loads(s[s.index("= [") + 2:s.rindex("]") + 1])}
mp = json.load(open(os.path.join(T, "tools/scraper/output/id-migration-map.json"), encoding="utf-8"))
def load(p):
    d = json.load(open(p, encoding="utf-8")); return d["vendors"] if isinstance(d, dict) else d
def rep(name, ids):
    ids = list(ids); hit = sum(i in pool for i in ids); slug = sum(bool(re.match(r"marry_[a-z_]+_[a-z0-9-]+$", i)) and i in mp for i in ids)
    print(f"{name}: {len(ids)} id | thuộc pool {hit} | dạng slug cũ (có trong id-migration-map) {slug} | ngoài pool {len(ids)-hit}")
print(f"pool app: {len(pool)} id; id-migration-map: {len(mp)} id cũ -> {len(set(mp.values()))} id mới; id mới thuộc pool: {len(set(mp.values()) & pool)}; id cũ thuộc pool: {len(set(mp) & pool)}")
if len(sys.argv) > 2 and sys.argv[1] == "--matcher-file":
    rep("bucket vendors.json", (v["id"] for v in load(sys.argv[2])))
else:
    o = os.path.join(T, "tools/scraper/output")
    rep("output/vendors.bak.json (ảnh chụp 05/2026, trước đổi id)", (v["id"] for v in load(os.path.join(o, "vendors.bak.json"))))
    print("Mốc: bucket sửa lần cuối 2026-06-27; đổi id sang marry_<hash> merge 2026-07-15 (merge đầu tiên chạm migrate_vendor_ids.py, tohong PR #40) => bản bucket có nhiều khả năng toàn id slug cũ.")
