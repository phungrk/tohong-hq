#!/usr/bin/env python3
"""T-106 tiêu chí 4: pool không chứa URL places.googleapis.com (không lộ khóa, hiển thị $0).
Hai chỗ: (a) toàn bộ văn bản lib/vendorPool.generated.js của tohong-back; (b) google_photos[].uri của vendor venue trong tohong/tools/scraper/output/HCMC/*/vendors.json
(nguồn sinh pool). Hôm nay xanh sẵn: đây là lưới chặn hồi quy cho đợt thêm ảnh venue, cùng ý với INV-012 (T-104). Cần: TOHONG_REPO, TOHONG_BACK_REPO."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
t, b = c.tohong(), c.back()
text = open(os.path.join(b, "lib", "vendorPool.generated.js"), encoding="utf-8").read()
if "places.googleapis.com" in text.lower():
    c.fail("lib/vendorPool.generated.js chứa places.googleapis.com")
bad = [(i, g.get("uri", "")[:60]) for i, rs in c.load_records(t).items() for r in rs for g in (r.get("google_photos") or [])
       if "places.googleapis.com" in (g.get("uri") or "").lower()]
if bad:
    c.fail("%d google_photos.uri trong vendors.json chứa places.googleapis.com, vd %s" % (len(bad), bad[0]))
c.ok("pool và vendors.json không chứa places.googleapis.com")
