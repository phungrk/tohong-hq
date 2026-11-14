#!/usr/bin/env python3
"""T-164 tiêu chí 7: pool đã sinh có nguồn giá và khung N4 nhất quán, và bundle Worker vẫn <= 1.000.000 byte nén (inv-007).
Chỉ đọc pool của back (lib/vendorPool.generated.js), không cần repo tohong: khung N4 tính lại được TỪ CHÍNH POOL (mẫu = vendor priceSource "legacy_marry"), nên lệch giữa pool và công thức là đo được.
  (a) mọi vendor có priceSource ∈ {legacy_marry, estimate_category, estimate_default}; priceAsOf "YYYY-MM" với legacy_marry và estimate_category, null/vắng với estimate_default;
  (b) mọi legacy_marry: 0 < priceMin <= priceMax và cả hai đầu nằm trong ngưỡng hạng mục (bảng ở spec T-164 H1, triệu VND);
  (c) với mỗi hạng mục, n = số legacy_marry; n >= 10 thì MỌI vendor ước tính của hạng mục đó là estimate_category với P25..P75 (nội suy tuyến tính trên trung điểm, làm tròn 0,1) và priceAsOf = tháng lớn nhất của mẫu;
      n < 10 thì MỌI vendor ước tính là estimate_default với giá mặc định cũ của hạng mục; ước tính cùng hạng mục thì cùng một khung;
  (d) bundle: chạy inv-007 (wrangler --dry-run, offline).
Chạy: python3 -I eval/T-164/check_7_pool_va_bundle.py   · Biến: TOHONG_BACK_REPO (mặc định ../tohong-back cạnh tohong-hq). Mã thoát 0 = đạt."""
import json, math, os, re, subprocess, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
B = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(HQ, "..", "tohong-back")) if p and os.path.isfile(os.path.join(p, "lib", "vendorPool.generated.js"))), None)
if not B: print("FAIL không thấy repo tohong-back"); sys.exit(2)
BANDS = {"attire": (0.3, 60), "ceremony": (0.5, 100), "decor": (0.5, 300), "honeymoon": (1, 200), "jewelry": (0.5, 150), "makeup": (1, 100), "photography": (0.5, 150), "stationery": (0.3, 50), "transport": (0.5, 60), "venue": (2, 20)}
DEFAULTS = {"photography": (15, 30), "venue": (5, 15), "decor": (10, 50), "attire": (8, 25), "makeup": (3, 8), "ceremony": (5, 15), "jewelry": (10, 40), "transport": (3, 8), "stationery": (2, 6), "honeymoon": (20, 60)}
N_MIN = 10
r1 = lambda x: math.floor(x * 10 + 0.5) / 10
def pct(a, p):
    a = sorted(a); k = (len(a) - 1) * p; f = math.floor(k); c = min(f + 1, len(a) - 1); return a[f] + (a[c] - a[f]) * (k - f)
s = open(os.path.join(B, "lib", "vendorPool.generated.js"), encoding="utf-8").read(); pool = json.loads(s[s.index("= [") + 2:s.rindex("]") + 1])
fails = []
def bad(m):
    if len(fails) < 8: fails.append(m)
SRC = {"legacy_marry", "estimate_category", "estimate_default"}
for v in pool:
    src = v.get("priceSource"); asof = v.get("priceAsOf")
    if src not in SRC: bad(f"{v['id']}: priceSource {src!r} không hợp lệ"); continue
    if src in ("legacy_marry", "estimate_category") and not (isinstance(asof, str) and re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", asof)): bad(f"{v['id']}: {src} cần priceAsOf YYYY-MM, thấy {asof!r}")
    if src == "estimate_default" and asof not in (None, ""): bad(f"{v['id']}: estimate_default không có priceAsOf, thấy {asof!r}")
    if src == "legacy_marry":
        lo, hi = BANDS[v["category"]]
        if not (0 < v["priceMin"] <= v["priceMax"] and v["priceMin"] >= lo - 1e-9 and v["priceMax"] <= hi + 1e-9): bad(f"{v['id']}: giá riêng {v['priceMin']}-{v['priceMax']} ngoài ngưỡng {v['category']} {lo}-{hi}")
legacy, est = {}, {}
for v in pool:
    (legacy if v.get("priceSource") == "legacy_marry" else est).setdefault(v["category"], []).append(v)
for cat in BANDS:
    L = legacy.get(cat, []); n = len(L); E = est.get(cat, [])
    if n >= N_MIN:
        mids = [(x["priceMin"] + x["priceMax"]) / 2 for x in L]; want = (r1(pct(mids, .25)), r1(pct(mids, .75))); asof = max(x["priceAsOf"] for x in L)
        for v in E:
            if v.get("priceSource") != "estimate_category": bad(f"{v['id']} ({cat}, {n} mẫu >= {N_MIN}): phải là estimate_category, thấy {v.get('priceSource')}"); break
            if abs(v["priceMin"] - want[0]) > 1e-9 or abs(v["priceMax"] - want[1]) > 1e-9: bad(f"{v['id']} ({cat}): khung {v['priceMin']}-{v['priceMax']}, tính lại từ pool ra {want[0]}-{want[1]}"); break
            if v.get("priceAsOf") != asof: bad(f"{v['id']} ({cat}): priceAsOf {v.get('priceAsOf')}, mong {asof}"); break
    else:
        for v in E:
            if v.get("priceSource") != "estimate_default": bad(f"{v['id']} ({cat}, {n} mẫu < {N_MIN}): phải là estimate_default, thấy {v.get('priceSource')}"); break
            if (v["priceMin"], v["priceMax"]) != DEFAULTS[cat]: bad(f"{v['id']} ({cat}): giá mặc định phải {DEFAULTS[cat]}, thấy {v['priceMin']}-{v['priceMax']}"); break
if fails: print("FAIL " + fails[0] + (f" (+{len(fails) - 1} lỗi nữa)" if len(fails) > 1 else "")); sys.exit(1)
r = subprocess.run([sys.executable, "-I", os.path.join(HQ, "eval", "invariants", "planner", "inv-007-worker-nen-duoi-1mb.py")], capture_output=True, text=True, env=dict(os.environ, TOHONG_BACK_REPO=B), timeout=400)
last = (r.stdout.strip().splitlines() or [""])[-1]
if r.returncode != 0 or not last.startswith("PASS"): print("FAIL bundle: " + last[:200]); sys.exit(1)
print(f"PASS ({len(pool)} vendor, bundle: {last})")
