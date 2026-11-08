#!/usr/bin/env python3
"""T-106 tiêu chí 2: >= 50 vendor venue trong pool tohong-back có >= 1 ảnh Google.
'Ảnh Google' = photos[] có source == "google" và url dạng https://lh<N>.googleusercontent.com/... . Một ảnh source=google mà url không phải lh*.googleusercontent.com
làm đỏ ngay (không tính). Cần: TOHONG_BACK_REPO. Không gọi Google."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
MIN = 50
venues = c.venue_pool(c.load_pool(c.back()))
bad = [(v["id"], p["url"][:60]) for v in venues for p in c.google_photos_of(v) if not c.LH3.match(p.get("url", ""))]
if bad:
    c.fail("%d ảnh source=google có url không phải lh*.googleusercontent.com, vd %s" % (len(bad), bad[0]))
n = sum(1 for v in venues if c.google_photos_of(v))
if n < MIN:
    c.fail("%d/%d vendor venue có >= 1 ảnh Google (cần >= %d)" % (n, len(venues), MIN))
c.ok("%d/%d vendor venue có >= 1 ảnh Google (>= %d)" % (n, len(venues), MIN))
