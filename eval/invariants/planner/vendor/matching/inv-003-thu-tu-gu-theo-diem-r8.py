#!/usr/bin/env python3
"""Nguồn: T-072 (spec products/T-072-hop-dong-style-chung.md v4, R8 + "Bất biến đề xuất" 2; ADR-026 mục 3; qua Spec Gate 2026-11-06)
và eval đối kháng eval/T-080/adv-01 (adversary, Code Gate T-080, PR phungrk/tohong-back#39). CHỈ XANH SAU KHI PR #39 MERGE vào main.
INV-003 · Thứ tự gu nhất quán theo điểm (R8), không phải khoá chia nhóm:
  (i)   JS computeMatches (danh sách đầy đủ, vendor thật của pool) và Python stage 2: hai vendor chỉ khác ở chỗ khớp gu thì vendor khớp đứng trên;
  (ii)  đường chat Python (WeddingMatcher.match sau boost + MMR): nối "kết quả" rồi "ứng viên sau boost bị loại" (stage 1 -> score_and_rank
        top 20 -> apply_boosts, tự dựng), không cặp (khớp, không khớp) nào đảo theo điểm sau boost; bằng điểm thì vendor khớp đứng trên.
        Đo trên ca sinh đôi + ca ngược của T-072, fuzz 400 pool (tới 30 vendor, tag hoa/thường/khoảng trắng/thiếu khoá, λ 0/0.3/0.9),
        ca bằng điểm ở mép top_k, chuẩn hoá R1 ('  KOREAN ' + 'Soft ' là khớp).
Không có bất biến nào nói "vendor khớp luôn đứng trước mọi vendor không khớp" (ADR-026 đã bác).
Repo tohong-back: TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back. Không có repo thì PASS "chưa áp dụng". Mã thoát 0 = đạt."""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "matcher", "matcher.py"))), None)
if not repo or not os.path.isfile(os.path.join(repo, "lib", "vendorMatcher.js")): print("PASS chưa áp dụng (không tìm thấy tohong-back)"); sys.exit(0)
T072 = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", "T-072"))
cases = os.path.join(T072, "style-cases.json")

CHILD = r'''
import json, sys, os, random, warnings
warnings.filterwarnings("ignore")
from datetime import date, timedelta, datetime
repo, cases = sys.argv[1], sys.argv[2]
EXP = json.load(open(cases, encoding="utf-8"))["expansion"]
sys.path.insert(0, os.path.join(repo, "matcher"))
from profile import CoupleMatchProfile
from stage1_filters import apply_hard_filters
from stage2_scoring import score_and_rank, compute_score
from stage3_boosts import apply_boosts
from matcher import WeddingMatcher
now = datetime.utcnow().isoformat()
n = lambda s: str(s).lower().strip()
def khop(v, prefs):
    tags = {n(t) for t in (v.get("style_tags") or [])}
    return any(tags & set(EXP.get(n(p), [n(p)])) for p in prefs if n(p))
def vendor(id, tags, price=(15, 30), rating=4.5, count=80, **kw):
    v = {"id": id, "name": id, "category": "photography", "city": "HCMC",
         "price_range": {"min_vnd": int(price[0] * 1e6), "max_vnd": int(price[1] * 1e6), "unit": "package"},
         "contact": {"phone": "0901234567", "address": "Q1"},
         "reviews": [{"source": "marry", "rating": rating, "count": count, "last_updated": now}],
         "portfolio_urls": ["a", "b", "c"], "verification_status": "verified", "flags": []}
    if tags is not None: v["style_tags"] = tags
    v.update(kw); return v
def prof(st):
    return CoupleMatchProfile(category="photography", city="HCMC", wedding_date=date.today() + timedelta(days=180),
                              budget_for_category=30_000_000, style_preferences=list(st))
def check(pool, prefs, k, w, tag):
    p = prof(prefs)
    passed, _ = apply_hard_filters(pool, p, collect_rejections=False)
    ung = sorted([(v["id"], apply_boosts(v, sb, p).final_score, khop(v, prefs)) for v, sb in score_and_rank(passed, p, top_n=20)], key=lambda t: (-t[1], not t[2]))
    top = [(m.vendor["id"], m.score, khop(m.vendor, prefs)) for m in WeddingMatcher(pool).match(p, top_k=k, enable_relaxation=False, diversity_weight=w).matches]
    ids = {i for i, _, _ in top}
    seq = top + [t for t in ung if t[0] not in ids]
    for a in range(len(seq)):
        for b in range(a + 1, len(seq)):
            (ia, sa, ka), (ib, sb_, kb) = seq[a], seq[b]
            if ka == kb: continue
            if sb_ > sa or (sb_ == sa and kb and not ka):
                return f"{tag}: {ia}({sa},{'khớp' if ka else 'lệch'}) đứng trên {ib}({sb_},{'khớp' if kb else 'lệch'}) | top={[(i,s) for i,s,_ in top]}"
    return None
bad = []
# (a) fuzz
R = random.Random(20261106)
TAGS = ["korean", "Soft ", "modern", " MINIMALIST", "luxury", "rustic", "traditional", "simple", "editorial", "natural"]
PREFS = [["korean"], ["modern"], ["  Korean "], ["luxury", "rustic"], ["minimalist"], ["soft"], ["traditional"]]
for t in range(400):
    pool = []
    for i in range(R.randint(6, 30)):
        r = R.random()
        tags = None if r < 0.08 else ([] if r < 0.3 else R.sample(TAGS, R.randint(1, 2)))
        lo = R.choice([8, 12, 15, 18, 20, 25, 30, 40])
        pool.append(vendor(f"v{i}", tags, price=(lo, lo * R.choice([1, 1.5, 2, 3])),
                           rating=R.choice([3.6, 3.9, 4.2, 4.5, 4.7, 4.9]), count=R.choice([5, 10, 30, 80, 150, 300])))
    e = check(pool, R.choice(PREFS), R.randint(3, 8), R.choice([0.0, 0.3, 0.9]), f"fuzz#{t}")
    if e: bad.append(e)
    if len(bad) >= 3: break
# (b) bằng điểm: dò vendor không khớp (rating/count/giá) có điểm sau boost = vendor khớp
p = prof(["korean"])
fs = lambda v: apply_boosts(v, compute_score(v, p), p).final_score
target_v = vendor("M", ["korean"], price=(30, 60), rating=4.2, count=30); target = fs(target_v)
tie = None
for lo in [15, 18, 20, 22, 25, 28, 30]:
    for hi_m in [1, 1.2, 1.5, 2]:
        for rt in [x / 10 for x in range(36, 50)]:
            for c in [5, 10, 20, 30, 50, 80, 100, 150, 200, 300]:
                u = vendor("U", ["rustic"], price=(lo, lo * hi_m), rating=rt, count=c)
                if fs(u) == target: tie = u; break
            if tie: break
        if tie: break
    if tie: break
if tie is None: bad.append("(b) không dò được ca bằng điểm (eval cần sửa)")
else:
    filler = [vendor(f"f{i}", ["luxury"], price=(10, 20), rating=4.9, count=300) for i in range(3)]
    if fs(filler[0]) <= target: bad.append("(b) filler không cao hơn (eval cần sửa)")
    pool = filler + [dict(tie, id="U", name="U"), dict(target_v)]
    top = [m.vendor["id"] for m in WeddingMatcher(pool).match(p, top_k=4, enable_relaxation=False).matches]
    if "M" not in top: bad.append(f"(b) bằng điểm {target}: vendor khớp M bị loại, top={top}")
    for k in (4, 5):
        e = check(pool, ["korean"], k, 0.3, f"(b) bằng điểm top_k={k}")
        if e: bad.append(e)
# (c) chuẩn hoá ở đường chat
sb = compute_score(vendor("x", ["Soft "]), prof(["  KOREAN "]))
if sb.components["style"][0] != 1.0: bad.append(f"(c) '  KOREAN ' + 'Soft ' chấm style {sb.components['style'][0]} != 1.0")
print(json.dumps(bad, ensure_ascii=False))
'''
p = subprocess.run([sys.executable, "-I", "-c", CHILD, repo, cases], capture_output=True, text=True, timeout=600)
if p.returncode != 0: print("FAIL chạy lỗi (crash trên input biên): " + (p.stderr or p.stdout)[-400:]); sys.exit(1)
bad = json.loads(p.stdout.strip().splitlines()[-1])
def run(cmd):
    q = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if q.returncode != 0: print("FAIL chạy lỗi: " + (q.stderr or q.stdout)[-300:]); sys.exit(1)
    return json.loads(q.stdout)
for r in run(["node", os.path.join(T072, "lib", "run_js.mjs"), repo, cases, "twins"]):
    if "error" in r: bad.append("JS " + r["error"]); break
    o = r.get("order", [])
    if not o or not (o.index("twin_m") < o.index("twin_a") and o.index("twin_m") < o.index("twin_b")):
        bad.append(f'JS {r["cat"]}/{r["base"]}/{r["style"]}: thứ tự {o}, vendor khớp không đứng trên')
rk = run([sys.executable, "-W", "ignore", "-I", os.path.join(T072, "lib", "run_py.py"), repo, cases, "rank"])
if rk["stage2"][0] != "M": bad.append(f'PY stage 2: thứ tự {rk["stage2"]}, vendor khớp M không đứng đầu')
for name in ("pipeline", "nguoc"):
    top = rk[name]["top"]; ids = {i for i, _ in top}
    seq = top + sorted([u for u in rk[name]["ung_vien"] if u[0] not in ids], key=lambda t: (-t[1], not t[0].startswith("m")))
    for a in range(len(seq)):
        for b in range(a + 1, len(seq)):
            (x, sx), (y, sy) = seq[a], seq[b]
            if x[0] != y[0] and (sx < sy or (sx == sy and x.startswith("u"))): bad.append(f"PY chat {name}: {x}({sx}) đứng trên {y}({sy})")
if bad: print(f"FAIL {len(bad)} vi phạm; " + " | ".join(bad[:3])); sys.exit(1)
print("PASS R8: JS + Python stage 2 + chat (sinh đôi, ngược), fuzz 400 pool (tới 30 vendor, tag hoa/thường/khoảng trắng/không khoá, λ 0/0.3/0.9), bằng điểm ở mép top_k, chuẩn hoá R1")
