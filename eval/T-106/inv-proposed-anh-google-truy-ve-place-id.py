#!/usr/bin/env python3
"""Đề xuất bất biến (planner/vendor/images) từ T-106: ảnh Google trong pool truy được về place_id.
Mọi vendor trong lib/vendorPool.generated.js (tohong-back) có ít nhất một ảnh source=google phải có bản ghi cùng id trong
tohong/tools/scraper/output/HCMC/*/vendors.json với enrichment_log[source=google_maps].place_id. Lý do: photoUri hết hạn, ảnh chỉ làm mới và gỡ (404) được qua place_id;
ảnh Google mồ côi không còn cách làm mới hay kiểm nguồn (Terms Google chỉ cho cache place_id).
Chạy: python3 -I <file>. Repo: TOHONG_REPO (mặc định ../tohong cạnh tohong-hq), TOHONG_BACK_REPO (mặc định ../tohong-back). Thiếu repo hoặc dữ liệu: PASS 'chưa áp dụng'. Mã thoát 0 = đạt."""
import glob, json, os, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
def find(env, marker, sib):
    for c in (os.environ.get(env), os.path.join(HQ, "..", sib)):
        if c and os.path.isfile(os.path.join(c, marker)): return os.path.abspath(c)
t = find("TOHONG_REPO", os.path.join("tools", "scraper", "enrich.py"), "tohong")
b = find("TOHONG_BACK_REPO", os.path.join("lib", "vendorPool.generated.js"), "tohong-back")
if not t or not b: print("PASS chưa áp dụng (thiếu repo tohong hoặc tohong-back)"); sys.exit(0)
s = open(os.path.join(b, "lib", "vendorPool.generated.js"), encoding="utf-8").read()
pool = json.loads(s[s.index("= [") + 2:s.rindex("]") + 1])
has = set()
for f in glob.glob(os.path.join(t, "tools", "scraper", "output", "HCMC", "*", "vendors.json")):
    d = json.load(open(f, encoding="utf-8"))
    for v in (d.get("vendors", []) if isinstance(d, dict) else d):
        if any(e.get("source") == "google_maps" and e.get("place_id") for e in v.get("enrichment_log") or []): has.add(v.get("id"))
orphan = [p["id"] for p in pool if any(x.get("source") == "google" for x in p.get("photos", [])) and p["id"] not in has]
if orphan: print("FAIL %d vendor có ảnh Google nhưng không có place_id trong dữ liệu nguồn, vd %s" % (len(orphan), orphan[0])); sys.exit(1)
print("PASS mọi vendor có ảnh Google đều có place_id nguồn"); sys.exit(0)
