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
    # Thứ tự gu (cách B, ADR-026): các vendor giống hệt nhau, chỉ khác tag. Couple chọn korean.
    # stage2: M (tag soft, khớp) phải đứng trên A (tag lệch) và B (không tag), dù chất lượng bằng nhau.
    now = datetime.utcnow().isoformat()
    s2 = score_and_rank([vendor("A", ["editorial"]), vendor("B", []), vendor("M", ["soft"])], prof(["korean"]), top_n=20)
    # đường chat đầy đủ (stage 1-3, gồm MMR). Hai ca, mỗi ca trả [id, điểm sau boost] theo thứ tự cuối của WeddingMatcher.match:
    # (a) "sinh đôi": 4 vendor khớp CÙNG tag (MMR phạt trùng tag) + 4 vendor không khớp, mọi thứ khác bằng nhau; pool 8 > top_k 6 (MMR chỉ chạy khi pool lớn hơn top_k).
    # (b) "nguoc" (ca của Spec critic, D2): 6 vendor khớp rating 3,6 giá 29tr tới 60-90tr (trần giá gấp 2-3 lần ngân sách 30tr) + 6 vendor không khớp rating 4,9 giá 17-24tr, top_k 5:
    #     vendor khớp điểm thấp hơn rõ nên phải đứng dưới vendor không khớp điểm cao hơn.
    from matcher import WeddingMatcher
    def chat(pool, k):
        res = WeddingMatcher(pool).match(prof(["korean"]), top_k=k, enable_relaxation=False)
        return [[m.vendor["id"], m.score] for m in res.matches]
    twins = [vendor(f"m{i}", ["korean"]) for i in range(4)] + [vendor("u0", ["editorial"]), vendor("u1", []), vendor("u2", ["luxury"]), vendor("u3", ["rustic"])]
    rv = lambda r, c: [{"reviews": [{"source": "marry", "rating": r, "count": 80, "last_updated": now}]}][0]
    m_max = [60, 66, 72, 78, 84, 90]; u_price = [17, 18, 19.5, 21, 22, 24]; u_tags = [["editorial"], [], ["luxury"], ["rustic"], ["natural"], ["simple"]]
    pm = lambda p: {"min_vnd": int(p * 1e6), "max_vnd": int(p * 1e6), "unit": "package"}
    nguoc = [vendor(f"m{i}", ["korean"], price_range={"min_vnd": 29_000_000, "max_vnd": int(m_max[i] * 1e6), "unit": "package"}, **rv(3.6, 80)) for i in range(6)] + \
            [vendor(f"u{i}", u_tags[i], price_range=pm(u_price[i]), **rv(4.9, 80)) for i in range(6)]
    print(json.dumps({"stage2": [v["id"] for v, _ in s2], "pipeline": chat(twins, 6), "nguoc": chat(nguoc, 5)}))
