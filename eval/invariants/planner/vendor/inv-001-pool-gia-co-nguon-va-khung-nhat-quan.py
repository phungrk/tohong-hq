#!/usr/bin/env python3
"""Nguồn: T-164 (spec products/T-164-gia-vendor-n4-nhan-gia.md, H1-H3 và "Bất biến đề xuất" INV-A; đề xuất của product, chờ spec-critic rút vào bể khi spec qua Spec Gate).
Rút vào bể bởi spec-critic khi T-164 v3 qua Spec Gate 2026-11-14, vùng cha planner/vendor/ để chạy cho mọi việc chạm images, matching, pool (sinh lại pool ở vùng pool cũng phải giữ nó). Xanh trên main trước T-164 nhờ PASS "chưa áp dụng" nên không cần gác theo ADR-028.
INV-A · Mọi vendor trong pool (tohong-back/lib/vendorPool.generated.js) mang nguồn giá trung thực và khung ước tính tính lại được từ chính pool:
  (a) priceSource ∈ {legacy_marry, estimate_category, estimate_default}; priceAsOf "YYYY-MM" với legacy_marry/estimate_category, vắng/null với estimate_default;
  (b) legacy_marry: 0 < priceMin <= priceMax, cả hai đầu trong ngưỡng hạng mục (spec H1) — giá rác không bao giờ quay lại pool;
  (c) khung ước tính mỗi hạng mục = P25..P75 của trung điểm các vendor legacy_marry cùng hạng mục khi có >= 10, ngược lại giá mặc định cũ (estimate_default); không tự tham chiếu (mẫu chỉ là legacy_marry).
Chưa vendor nào có priceSource (main trước T-164): PASS "chưa áp dụng". Có vendor có mà không phải tất cả: FAIL (áp dụng dở dang).
Đổi bảng ngưỡng/n tối thiểu = đổi spec và bất biến này (qua Chief of Staff, decisions/). Chạy: python3 -I <file>. Repo: TOHONG_BACK_REPO hoặc ../tohong-back."""
import json, math, os, re, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
B = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(HQ, "..", "tohong-back")) if p and os.path.isfile(os.path.join(p, "lib", "vendorPool.generated.js"))), None)
if not B: print("PASS chưa áp dụng (không thấy tohong-back)"); sys.exit(0)
BANDS = {"attire": (0.3, 60), "ceremony": (0.5, 100), "decor": (0.5, 300), "honeymoon": (1, 200), "jewelry": (0.5, 150), "makeup": (1, 100), "photography": (0.5, 150), "stationery": (0.3, 50), "transport": (0.5, 60), "venue": (2, 20)}
DEFAULTS = {"photography": (15, 30), "venue": (5, 15), "decor": (10, 50), "attire": (8, 25), "makeup": (3, 8), "ceremony": (5, 15), "jewelry": (10, 40), "transport": (3, 8), "stationery": (2, 6), "honeymoon": (20, 60)}
r1 = lambda x: math.floor(x * 10 + 0.5) / 10
def pct(a, p):
    a = sorted(a); k = (len(a) - 1) * p; f = math.floor(k); c = min(f + 1, len(a) - 1); return a[f] + (a[c] - a[f]) * (k - f)
s = open(os.path.join(B, "lib", "vendorPool.generated.js"), encoding="utf-8").read(); pool = json.loads(s[s.index("= [") + 2:s.rindex("]") + 1])
have = [v for v in pool if "priceSource" in v]
if not have: print("PASS chưa áp dụng (pool chưa có priceSource)"); sys.exit(0)
fails = []
def bad(m):
    if len(fails) < 6: fails.append(m)
for v in pool:
    src = v.get("priceSource"); asof = v.get("priceAsOf")
    if src not in ("legacy_marry", "estimate_category", "estimate_default"): bad(f"{v['id']}: priceSource {src!r}"); continue
    if src != "estimate_default" and not (isinstance(asof, str) and re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", asof)): bad(f"{v['id']}: {src} cần priceAsOf YYYY-MM, thấy {asof!r}")
    if src == "estimate_default" and asof not in (None, ""): bad(f"{v['id']}: estimate_default có priceAsOf {asof!r}")
    if src == "legacy_marry":
        lo, hi = BANDS[v["category"]]
        if not (0 < v["priceMin"] <= v["priceMax"] and v["priceMin"] >= lo - 1e-9 and v["priceMax"] <= hi + 1e-9): bad(f"{v['id']}: giá riêng {v['priceMin']}-{v['priceMax']} ngoài ngưỡng {v['category']} {lo}-{hi}")
by = {}
for v in pool: by.setdefault(v["category"], []).append(v)
for cat, vs in by.items():
    L = [v for v in vs if v.get("priceSource") == "legacy_marry"]; E = [v for v in vs if v.get("priceSource") != "legacy_marry"]
    if len(L) >= 10:
        mids = [(x["priceMin"] + x["priceMax"]) / 2 for x in L]; w = (r1(pct(mids, .25)), r1(pct(mids, .75))); asof = max(x["priceAsOf"] for x in L)
        for v in E:
            if not (v.get("priceSource") == "estimate_category" and abs(v["priceMin"] - w[0]) < 1e-9 and abs(v["priceMax"] - w[1]) < 1e-9 and v.get("priceAsOf") == asof): bad(f"{v['id']} ({cat}): khung {v.get('priceSource')} {v['priceMin']}-{v['priceMax']} {v.get('priceAsOf')}, tính lại từ pool ra {w} {asof}"); break
    else:
        for v in E:
            if not (v.get("priceSource") == "estimate_default" and (v["priceMin"], v["priceMax"]) == DEFAULTS[cat]): bad(f"{v['id']} ({cat}, {len(L)} mẫu < 10): phải estimate_default {DEFAULTS[cat]}, thấy {v.get('priceSource')} {v['priceMin']}-{v['priceMax']}"); break
if fails: print("FAIL " + fails[0] + (f" (+{len(fails) - 1} lỗi nữa)" if len(fails) > 1 else "")); sys.exit(1)
print(f"PASS ({len(pool)} vendor có nguồn giá, khung nhất quán)")
