#!/usr/bin/env python3
"""Đề xuất bất biến (planner/vendor/images) từ T-106: nhận khớp Google Maps có cổng.
(i)  Bản ghi enrichment_log[source=google_maps] có trường `address_match` (tức từ T-106 trở đi) và có place_id phải thỏa
     confidence >= 0.6, hoặc confidence >= 0.4 và address_match == true.
(ii) Vendor có dòng audit mới nhất status=low_confidence (output/HCMC/<category>/enrichment-audit.json) không có place_id trong enrichment_log cùng thư mục.
Phạm vi (i) giới hạn ở bản ghi có `address_match` để không đỏ oan các bản ghi photography cũ (confidence 0.4-0.6, chưa có trường này).
Chạy: python3 -I <file>. Repo: TOHONG_REPO (mặc định ../tohong cạnh tohong-hq). Thiếu repo/dữ liệu: PASS 'chưa áp dụng'. Mã thoát 0 = đạt."""
import glob, json, os, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
t = next((os.path.abspath(c) for c in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")) if c and os.path.isfile(os.path.join(c, "tools", "scraper", "enrich.py"))), None)
if not t: print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
bad = []; n = 0
for d in glob.glob(os.path.join(t, "tools", "scraper", "output", "HCMC", "*")):
    vp = os.path.join(d, "vendors.json")
    if not os.path.isfile(vp): continue
    raw = json.load(open(vp, encoding="utf-8")); vs = raw.get("vendors", []) if isinstance(raw, dict) else raw
    by = {v.get("id"): v for v in vs}
    for v in vs:
        for e in v.get("enrichment_log") or []:
            if e.get("source") == "google_maps" and e.get("place_id") and "address_match" in e:
                n += 1; c = e.get("confidence") or 0
                if not (c >= 0.6 or (c >= 0.4 and e.get("address_match") is True)): bad.append((v.get("id"), c, e.get("address_match")))
    ap = os.path.join(d, "enrichment-audit.json")
    if os.path.isfile(ap):
        last = {}
        for a in json.load(open(ap, encoding="utf-8")): last[a.get("vendor_id")] = a
        for i, a in last.items():
            if a.get("status") == "low_confidence" and i in by and any(e.get("source") == "google_maps" and e.get("place_id") for e in by[i].get("enrichment_log") or []):
                bad.append((i, "low_confidence nhưng có place_id", None))
if bad: print("FAIL %d vi phạm cổng nhận khớp, vd %s" % (len(bad), bad[0])); sys.exit(1)
print("PASS nhận khớp có cổng (%d bản ghi có address_match)" % n); sys.exit(0)
