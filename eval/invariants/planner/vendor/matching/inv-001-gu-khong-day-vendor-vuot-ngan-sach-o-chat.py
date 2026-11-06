#!/usr/bin/env python3
"""Nguồn: T-072 (spec products/T-072-hop-dong-style-chung.md v4, R8 + mục "Hệ quả" + Giả thuyết/chỉ số bảo vệ; ADR-026 mục 1 và 3;
qua Spec Gate 2026-11-06, spec-critic). Rút ra vì check_2 chỉ so thứ tự theo điểm sau boost: một bản cài cộng điểm gu ở bước boost
(+30 cho vendor khớp) PASS check_2 nhưng trả top 5 chat toàn vendor vượt ngân sách, đúng hành vi ADR-026 đã bác.
INV-001 · Ở đường chat Python, gu là tín hiệu cộng điểm với trọng số cố định của bước chấm điểm, không hơn:
  (i)  hai vendor giống hệt nhau, chỉ khác tag (khớp gu cặp đôi / tag lệch / không tag), nhận cùng một lượng boost
       (điểm sau boost trừ điểm chấm điểm bằng nhau), với mọi style trong pool;
  (ii) pool 6 vendor khớp gu nhưng rating 3,6, 10 đánh giá, giá 30-90tr (trần gấp 3 ngân sách 30tr) + 6 vendor không khớp
       rating 4,9, 300 đánh giá, giá 18-21tr: kết quả cuối của đường chat (top 5) không chứa vendor khớp gu nào.
Repo tohong-back: TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back. Không có thư mục matcher/ thì PASS "chưa áp dụng".
Chạy không tham số (gate.py: python3 -I). Mã thoát 0 = đạt."""
import json, os, subprocess, sys

cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "matcher", "matcher.py"))), None)
if not repo: print("PASS chưa áp dụng (không tìm thấy tohong-back/matcher)"); sys.exit(0)

CHILD = r'''
import json, sys, os, warnings
warnings.filterwarnings("ignore")
from datetime import date, timedelta, datetime
sys.path.insert(0, os.path.join(sys.argv[1], "matcher"))
from profile import CoupleMatchProfile
from stage2_scoring import compute_score
from stage3_boosts import apply_boosts
from matcher import WeddingMatcher
now = datetime.utcnow().isoformat()
def vendor(id, tags, **kw):
    v = {"id": id, "name": id, "category": "photography", "city": "HCMC",
         "price_range": {"min_vnd": 15_000_000, "max_vnd": 30_000_000, "unit": "package"},
         "style_tags": tags, "contact": {"phone": "0901234567", "address": "Q1"},
         "reviews": [{"source": "marry", "rating": 4.5, "count": 80, "last_updated": now}],
         "portfolio_urls": ["a", "b", "c"], "verification_status": "verified", "flags": []}
    v.update(kw); return v
def prof(st):
    return CoupleMatchProfile(category="photography", city="HCMC", wedding_date=date.today() + timedelta(days=180),
                              budget_for_category=30_000_000, style_preferences=list(st))
bad = []
for st in ["korean", "modern", "minimalist", "luxury", "rustic", "traditional"]:
    p = prof([st]); deltas = {}
    for name, tags in (("khop", [st]), ("lech", ["editorial"] if st != "editorial" else ["rustic"]), ("khong_tag", [])):
        sb = compute_score(vendor(name, tags), p)
        deltas[name] = round(apply_boosts(vendor(name, tags), sb, p).final_score - sb.total, 6)
    if len(set(deltas.values())) != 1: bad.append(f"boost phụ thuộc gu ({st}): {deltas}")
rv = lambda r, c: {"reviews": [{"source": "marry", "rating": r, "count": c, "last_updated": now}]}
u_price = [18, 19, 19.5, 20, 20.5, 21]; u_tags = [["editorial"], [], ["luxury"], ["rustic"], ["natural"], ["simple"]]
pool = [vendor(f"m{i}", ["korean"], price_range={"min_vnd": 30_000_000, "max_vnd": 90_000_000, "unit": "package"}, **rv(3.6, 10)) for i in range(6)] + \
       [vendor(f"u{i}", u_tags[i], price_range={"min_vnd": int(u_price[i] * 1e6), "max_vnd": int(u_price[i] * 1e6), "unit": "package"}, **rv(4.9, 300)) for i in range(6)]
top = [[m.vendor["id"], m.score] for m in WeddingMatcher(pool).match(prof(["korean"]), top_k=5, enable_relaxation=False).matches]
if len(top) != 5 or any(i.startswith("m") for i, _ in top): bad.append(f"top 5 chat có vendor khớp gu vượt ngân sách hoặc thiếu chỗ: {top}")
print(json.dumps(bad, ensure_ascii=False))
'''
p = subprocess.run([sys.executable, "-I", "-c", CHILD, repo], capture_output=True, text=True, timeout=300)
if p.returncode != 0: print("FAIL chạy lỗi: " + (p.stderr or p.stdout)[-300:]); sys.exit(1)
bad = json.loads(p.stdout.strip().splitlines()[-1])
if bad: print(f"FAIL {len(bad)} vi phạm; " + " | ".join(bad[:3])); sys.exit(1)
print("PASS boost không phụ thuộc gu (6 style) và top 5 chat không có vendor khớp gu vượt ngân sách")
