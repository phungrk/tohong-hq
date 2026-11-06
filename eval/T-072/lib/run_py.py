"""Chạy hợp đồng style qua đường Python. Dùng: python3 run_py.py <repo> <cases.json> <mode>
mode: cases | twins | rank ; in JSON ra stdout. Không sửa repo sản phẩm."""
import json, sys, os
from datetime import date, timedelta, datetime

repo, cases_path, mode = sys.argv[1:4]
C = json.load(open(cases_path, encoding="utf-8"))
sys.path.insert(0, os.path.join(repo, "matcher"))  # profile.py che stdlib `profile`: chủ ý, giống test_matcher.py
from profile import CoupleMatchProfile
from stage2_scoring import compute_score, score_and_rank


def vendor(id, tags, **kw):
    v = {"id": id, "name": id, "category": "photography", "city": "HCMC",
         "price_range": {"min_vnd": 15_000_000, "max_vnd": 30_000_000, "unit": "package"},
         "style_tags": tags, "contact": {"phone": "0901234567", "address": "Q1"},
         "reviews": [{"source": "marry", "rating": 4.5, "count": 80, "last_updated": datetime.utcnow().isoformat()}],
         "portfolio_urls": ["a", "b", "c"], "verification_status": "verified", "flags": []}
    v.update(kw)
    return v


def prof(couple):
    return CoupleMatchProfile(category="photography", city="HCMC",
                              wedding_date=date.today() + timedelta(days=180),
                              budget_for_category=30_000_000, style_preferences=list(couple))


if mode == "cases":
    print(json.dumps([{"id": c["id"], "style": compute_score(vendor("t1", c["vendor"]), prof(c["couple"])).components["style"][0]} for c in C["cases"]]))
elif mode == "twins":
    res = []
    bases = [{}, {"price_range": {"min_vnd": 5_000_000, "max_vnd": 9_000_000, "unit": "package"}},
             {"reviews": [{"source": "marry", "rating": 3.9, "count": 12, "last_updated": datetime.utcnow().isoformat()}]},
             {"contact": {"phone": "0900000000", "website": "x", "facebook": "y"}}]
    for st in C["pool_styles"]:
        for b in bases:
            p = prof([st])
            a = compute_score(vendor("a", ["editorial"], **b), p).total
            n = compute_score(vendor("b", [], **b), p).total
            m = compute_score(vendor("m", [st], **b), p).total
            res.append({"style": st, "lech": a, "khong_tag": n, "khop": m})
    print(json.dumps(res))
elif mode == "rank":
    # 25 vendor lệch/không tag chất lượng cao + 3 vendor khớp chất lượng thấp; top_n=20 phải chứa cả 3 khớp.
    vs = [vendor(f"u{i}", ["editorial"] if i % 2 else [], reviews=[{"source": "marry", "rating": 5.0, "count": 300, "last_updated": datetime.utcnow().isoformat()}]) for i in range(25)]
    vs += [vendor(f"m{i}", ["soft"], reviews=[{"source": "marry", "rating": 3.6, "count": 5, "last_updated": datetime.utcnow().isoformat()}],
                  price_range={"min_vnd": 60_000_000, "max_vnd": 90_000_000, "unit": "package"}) for i in range(3)]
    top = score_and_rank(vs, prof(["korean"]), top_n=20)
    print(json.dumps({"ids": [v["id"] for v, _ in top]}))
