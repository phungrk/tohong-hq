#!/usr/bin/env python3
"""T-106 tiêu chí 1: >= 60 trong 96 vendor venue của pool có place_id Google sau enrich.
Đếm: vendor có category=venue trong tohong-back/lib/vendorPool.generated.js, mà trong tohong/tools/scraper/output/HCMC/*/vendors.json
bản ghi cùng id có enrichment_log[source=google_maps] với place_id không rỗng, và id không nằm trong removed_vendors.json.
(Pool không mang place_id, nên đếm ở dữ liệu nguồn, nối theo id.) Cần: TOHONG_REPO, TOHONG_BACK_REPO. Không gọi Google."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
MIN = 60
t, b = c.tohong(), c.back()
venues = c.venue_pool(c.load_pool(b))
recs, gone = c.load_records(t), c.removed_ids(t)
have = [v["id"] for v in venues if v["id"] not in gone and c.record_google_log(recs.get(v["id"]))]
n, tot = len(have), len(venues)
if n < MIN:
    c.fail("%d/%d vendor venue có place_id Google (cần >= %d)" % (n, tot, MIN))
c.ok("%d/%d vendor venue có place_id Google (>= %d)" % (n, tot, MIN))
