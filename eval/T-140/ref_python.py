#!/usr/bin/env python3
"""Chuẩn so sánh T-140: chạy matcher Python của tohong-back (matcher/matcher.py, top_k=5, nới điều kiện bật, MMR λ=0.3) trên pool đã đông cứng.
Dùng: ref_python.py <thư mục matcher/> <pool-frozen.json> <hồ sơ.json (đầu ra của profileBuilder)>. In JSON [{ids, passed, relax}] theo thứ tự hồ sơ.
Bản ghi Python dựng từ pool: categories=[category], style_tags=styles, price_range=[priceMin,priceMax]*1e6 (không giá thì không price_range), reviews=[rating,count].
Chỉ giữ vendor đủ điều kiện như tab Vendor (xác minh, không dưới 3,5 sao). Không mạng."""
import datetime, json, sys
sys.path.insert(0, sys.argv[1])
from profile import CoupleMatchProfile
from matcher import WeddingMatcher
pool = json.load(open(sys.argv[2], encoding="utf-8"))["vendors"]
recs = []
for v in pool:
    if not v.get("isVerified") or (v.get("rating", 0) > 0 and v["rating"] < 3.5):
        continue
    r = {"id": v["id"], "name": v["name"], "city": v["city"], "categories": [v["category"]], "style_tags": v.get("styles", []),
         "contact": {}, "verification_status": "verified",
         "reviews": [{"source": "pool", "rating": v["rating"], "count": v["reviewCount"], "last_updated": "2000-01-01T00:00:00"}] if v.get("reviewCount", 0) > 0 else []}
    if (v.get("priceMin") or 0) > 0 or (v.get("priceMax") or 0) > 0:
        r["price_range"] = {"min_vnd": (v.get("priceMin") or 0) * 1_000_000, "max_vnd": (v.get("priceMax") or 0) * 1_000_000, "unit": "package"}
    recs.append(r)
m = WeddingMatcher(recs)
out = []
for p in json.load(open(sys.argv[3], encoding="utf-8")):
    p = {k: p.get(k) for k in ("category", "city", "wedding_date", "budget_for_category", "guest_count", "style_preferences", "bride_region", "groom_region", "dealbreakers") if p.get(k) is not None}
    p["wedding_date"] = datetime.date.fromisoformat(p["wedding_date"])
    r = m.match(CoupleMatchProfile(**p), top_k=5)
    out.append({"ids": [x.vendor["id"] for x in r.matches], "passed": r.passed_filters, "relax": r.relaxations_applied})
print(json.dumps(out))
