#!/usr/bin/env python3
"""T-164: dựng lại fixtures/price-inputs.json và fixtures/expected-prices.json từ pool hiện hành + vendors.json của tohong.
Chỉ ĐỌC repo (TOHONG_REPO, TOHONG_BACK_REPO, mặc định cạnh tohong-hq); chỉ ghi hai file cạnh script này. Không mạng.
price-inputs.json = bản ghi giả dạng pool-vendors.json (id, categories, price_range, last_scraped; tên bị thay bằng "V <id>") cho generator.
expected-prices.json = đầu ra ĐÚNG theo spec products/T-164 (bảng ngưỡng, P25-P75 giữa trung điểm đã làm tròn 0,1 triệu, n >= 10, as-of 2026-11-14).
Chạy: python3 -I eval/T-164/fixtures/tao-fixture.py   (fixture là ảnh chụp 2026-11-14; chạy lại chỉ để kiểm lại, không để 'sửa cho khớp code')."""
import glob, json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); HQ = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
T = os.environ.get("TOHONG_REPO") or os.path.join(HQ, "..", "tohong"); B = os.environ.get("TOHONG_BACK_REPO") or os.path.join(HQ, "..", "tohong-back")
s = open(os.path.join(B, "lib", "vendorPool.generated.js"), encoding="utf-8").read(); pool = json.loads(s[s.index("= [") + 2:s.rindex("]") + 1])
src = {}
for f in glob.glob(os.path.join(T, "tools/scraper/output/HCMC/*/vendors.json")):
    d = json.load(open(f, encoding="utf-8")); d = d["vendors"] if isinstance(d, dict) else d
    for v in d: src.setdefault(v["id"], v)
BANDS = {"attire": (0.3, 60), "ceremony": (0.5, 100), "decor": (0.5, 300), "honeymoon": (1, 200), "jewelry": (0.5, 150), "makeup": (1, 100),
         "photography": (0.5, 150), "stationery": (0.3, 50), "transport": (0.5, 60), "venue": (1, 20)}
UNIT = {c: "package" for c in BANDS}; UNIT["venue"] = "per_table"
DEFAULTS = {"photography": (15, 30), "venue": (5, 15), "decor": (10, 50), "attire": (8, 25), "makeup": (3, 8), "ceremony": (5, 15), "jewelry": (10, 40), "transport": (3, 8), "stationery": (2, 6), "honeymoon": (20, 60)}
N_MIN = 10
r1 = lambda x: math.floor(x * 10 + 0.5) / 10          # như Math.round(x*10)/10 của JS
def pct(a, p):
    a = sorted(a); k = (len(a) - 1) * p; f = math.floor(k); c = min(f + 1, len(a) - 1); return a[f] + (a[c] - a[f]) * (k - f)
inputs, valid, rej, legacy = [], {}, [], {}
for v in pool:
    r = src[v["id"]].get("price_range"); cat = v["category"]
    inputs.append({"id": v["id"], "name": "V " + v["id"], "categories": [cat], "city": "HCMC", "style_tags": [], "description": "", "price_range": r or None, "last_scraped": src[v["id"]].get("last_scraped")})
    if not r: continue
    lo, hi = BANDS[cat]; mn, mx = r["min_vnd"] / 1e6, r["max_vnd"] / 1e6
    why = "unit" if r.get("unit") != UNIT[cat] else "order" if not (mn > 0 and mx >= mn) else "band" if (mn < lo or mx > hi) else None
    if why: rej.append({"id": v["id"], "category": cat, "reason": why}); continue
    a, b = r1(mn), r1(mx); legacy[v["id"]] = {"priceMin": a, "priceMax": b, "priceSource": "legacy_marry", "priceAsOf": src[v["id"]]["last_scraped"][:7]}
    valid.setdefault(cat, []).append((a + b) / 2)
frames = {}
for cat in BANDS:
    a = valid.get(cat, []); n = len(a)
    if n >= N_MIN: frames[cat] = {"n": n, "priceMin": r1(pct(a, .25)), "priceMax": r1(pct(a, .75)), "priceSource": "estimate_category", "priceAsOf": "2026-06"}
    else: frames[cat] = {"n": n, "priceMin": DEFAULTS[cat][0], "priceMax": DEFAULTS[cat][1], "priceSource": "estimate_default", "priceAsOf": None}
exp = {}
for v in pool:
    e = legacy.get(v["id"])
    if not e: f = frames[v["category"]]; e = {k: f[k] for k in ("priceMin", "priceMax", "priceSource", "priceAsOf")}
    exp[v["id"]] = e
out = {"as_of": "2026-11-14", "n_min": N_MIN, "bands_trieu": {k: list(v) for k, v in BANDS.items()}, "frames": frames, "rejected": rej,
       "counts": {"pool": len(pool), "co_gia_nguon": sum(1 for v in pool if src[v["id"]].get("price_range")), "bi_loai": len(rej), "legacy_marry": len(legacy),
                  "estimate_category": sum(1 for e in exp.values() if e["priceSource"] == "estimate_category"), "estimate_default": sum(1 for e in exp.values() if e["priceSource"] == "estimate_default")},
       "vendors": exp}
json.dump(inputs, open(os.path.join(HERE, "price-inputs.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
json.dump(out, open(os.path.join(HERE, "expected-prices.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps(out["counts"]), json.dumps({k: (v["n"], v["priceMin"], v["priceMax"], v["priceSource"]) for k, v in frames.items()}))
