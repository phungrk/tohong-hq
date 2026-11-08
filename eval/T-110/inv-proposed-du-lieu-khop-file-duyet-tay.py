#!/usr/bin/env python3
"""BẢN NHÁP bất biến (Spec critic rút vào bể khi spec T-110 qua cổng). Nguồn: products/T-110-duyet-tay-venue.md Hành vi 2-3.
INV-? · Dữ liệu venue khớp file duyệt tay (duyệt tay thắng luật tự động, mãi mãi):
  accept_place có `resolved` -> vendor trong venue/vendors.json có enrichment_log[google_maps].place_id = resolved.place_id;
  remove -> id không có ở vendors.json nào của HCMC và có bản ghi manual=true trong removed_vendors.json (khôi phục được);
  temporarily_closed -> nếu vendor chưa có place_id thì dòng audit mới nhất có retry=true;
  reject_match -> vendor không giữ place_id bị loại.
Chưa có manual_overrides.json hoặc repo tohong: PASS 'chưa áp dụng'. Không gọi Google. Chạy không tham số (python3 -I). Mã thoát 0 = đạt."""
import glob, json, os, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
t = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")) if x and os.path.isfile(os.path.join(x, "tools", "scraper", "enrich.py"))), None)
out = t and os.path.join(t, "tools", "scraper", "output", "HCMC")
if not out or not os.path.isfile(os.path.join(out, "manual_overrides.json")):
    print("PASS chưa áp dụng (chưa có manual_overrides.json)"); sys.exit(0)


def load(p, d):
    try: return json.load(open(p, encoding="utf-8"))
    except (OSError, ValueError): return d


def vend(cat):
    x = load(os.path.join(out, cat, "vendors.json"), {})
    return x.get("vendors", []) if isinstance(x, dict) else x


def pid(v):
    for e in reversed(v.get("enrichment_log") or []):
        if e.get("source") == "google_maps" and e.get("place_id"): return e["place_id"]


cats = [os.path.basename(os.path.dirname(f)) for f in glob.glob(os.path.join(out, "*", "vendors.json"))]
allv = {c: {v.get("id"): v for v in vend(c)} for c in cats}
audit = {r.get("vendor_id"): r for r in load(os.path.join(out, "venue", "enrichment-audit.json"), [])}
removed = [(c, (x.get("vendor") or {}).get("id"), x.get("manual")) for c in cats for x in load(os.path.join(out, c, "removed_vendors.json"), [])]
bad = []
for e in load(os.path.join(out, "manual_overrides.json"), {}).get("overrides") or []:
    i, a = e.get("vendor_id"), e.get("action")
    v = allv.get("venue", {}).get(i)
    if a == "accept_place" and e.get("resolved"):
        if not v or pid(v) != e["resolved"].get("place_id"): bad.append("%s: accept_place nhưng place_id thực = %r" % (i, v and pid(v)))
    elif a == "remove":
        if any(i in m for m in allv.values()): bad.append("%s: remove nhưng còn trong vendors.json" % i)
        if not any(r[1] == i and r[2] is True for r in removed): bad.append("%s: remove nhưng không có bản ghi manual trong removed_vendors.json" % i)
    elif a == "temporarily_closed" and v and not pid(v):
        if (audit.get(i) or {}).get("retry") is not True: bad.append("%s: temporarily_closed nhưng audit thiếu retry=true" % i)
    elif a == "reject_match" and v and pid(v) == e.get("place_id"):
        bad.append("%s: reject_match nhưng vẫn giữ place_id bị loại" % i)
if bad:
    print("FAIL %d lệch file duyệt tay, vd %s" % (len(bad), bad[0])); sys.exit(1)
print("PASS dữ liệu venue khớp mọi mục duyệt tay"); sys.exit(0)
