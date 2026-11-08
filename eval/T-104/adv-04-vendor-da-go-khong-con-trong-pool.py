#!/usr/bin/env python3
"""T-104 · adv-04 (tầng 3, adversary). Vendor đã gỡ vì place_id Google 404 (tohong/tools/scraper/output/**/removed_vendors.json, PR tohong #67 #69)
không còn trong pool tohong-back (lib/vendorPool.generated.js) cũng như trong mọi vendors.json đang dùng của tohong (merge.py đọc vendors.json).
Input phá: vendor bị gỡ ở category này nhưng còn bản ghi trùng id/place_id ở category hoặc file khác; pool tohong-back sinh từ dữ liệu cũ.
Mong đợi: không id nào trong removed_vendors.json xuất hiện trong pool back; không place_id nào của vendor đã gỡ còn trong output/**/vendors.json.
(vendors.bak.json, raw_vendors.json, id-migration-map.json là bản lưu/bản thô, không phải nguồn của merge.py: bỏ qua.)
Repo: TOHONG_REPO / cwd / ../tohong và TOHONG_BACK_REPO / cwd / ../tohong-back. Thiếu một trong hai hoặc chưa có removed_vendors.json:
PASS "chưa áp dụng". Mã thoát 0 = đạt."""
import glob, json, os, sys

def find(env, rel, sib):
    for c in (os.environ.get(env), os.getcwd(), os.path.join(os.getcwd(), "..", sib)):
        if c and os.path.exists(os.path.join(c, rel)): return os.path.abspath(c)
front = find("TOHONG_REPO", os.path.join("tools", "scraper", "output"), "tohong")
back = find("TOHONG_BACK_REPO", os.path.join("lib", "vendorPool.generated.js"), "tohong-back")
if not front or not back: print("PASS chưa áp dụng (thiếu repo tohong hoặc tohong-back)"); sys.exit(0)
out = os.path.join(front, "tools", "scraper", "output")
removed = {}
for p in glob.glob(os.path.join(out, "**", "removed_vendors.json"), recursive=True):
    for e in json.load(open(p, encoding="utf-8")):
        v = e.get("vendor") or {}
        pids = [x.get("place_id") for x in v.get("enrichment_log") or [] if x.get("source") == "google_maps" and x.get("place_id")]
        if v.get("id"): removed[v["id"]] = pids
if not removed: print("PASS chưa áp dụng (chưa có removed_vendors.json)"); sys.exit(0)

pool = open(os.path.join(back, "lib", "vendorPool.generated.js"), encoding="utf-8").read()
fails = ['pool back còn id %s' % i for i in removed if '"%s"' % i in pool]
for p in glob.glob(os.path.join(out, "**", "vendors.json"), recursive=True):
    t = open(p, encoding="utf-8").read(); rel = os.path.relpath(p, front)
    for i, pids in removed.items():
        if '"%s"' % i in t: fails.append("%s còn id %s" % (rel, i))
        for pid in pids:
            if pid in t: fails.append("%s còn place_id của %s" % (rel, i))
if fails: print("FAIL vendor đã gỡ còn sót: " + "; ".join(fails[:10])); sys.exit(1)
print("PASS %d vendor đã gỡ không còn trong pool back và output/**/vendors.json" % len(removed))
