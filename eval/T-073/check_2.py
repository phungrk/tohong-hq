#!/usr/bin/env python3
"""T-073 tiêu chí 2: so pool trước (baseline-pool.json = tohong-back@6a9a9c7) và sau (tohong-back/lib/vendorPool.generated.js hiện tại):
chỉ tag minimalist giảm, mọi thứ khác không đổi. minimalist chỉ được mất ở vendor mà văn bản nguồn KHÔNG có 'tối giản'/'minimalist'/'minimal',
và phải còn ở vendor có.
Văn bản nguồn của một id = name + description + merchant_description + từng top_reviews[].text của MỌI bản ghi cùng id trong
tohong/tools/scraper/output/HCMC/*/vendors.json (một bản có là đủ).
Repo: TOHONG_REPO (mặc định ../tohong), TOHONG_BACK_REPO (mặc định ../tohong-back). In PASS hoặc FAIL <lý do>."""
import glob, hashlib, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
HERE = os.path.dirname(os.path.abspath(__file__))
base = json.load(open(os.path.join(HERE, "baseline-pool.json"), encoding="utf-8"))["entries"]
after = c.load_pool(os.path.join(c.back(), "lib", "vendorPool.generated.js"))
PAT = re.compile(r"t[ốo]i\s*gi[ảa]n|minimali[sz]t|\bminimal\b", re.I)
has_text = set()
nfiles = 0
for f in glob.glob(os.path.join(c.tohong(), "tools", "scraper", "output", "HCMC", "*", "vendors.json")):
    nfiles += 1
    d = json.load(open(f, encoding="utf-8")); d = d["vendors"] if isinstance(d, dict) else d
    for v in d:
        t = " ".join([v.get("name") or "", v.get("description") or "", v.get("merchant_description") or ""]
                     + [(r.get("text") or "") for r in (v.get("top_reviews") or []) if isinstance(r, dict)])
        if PAT.search(t): has_text.add(v["id"])
bad = []
if nfiles == 0: bad.append("không đọc được dữ liệu scrape HCMC")
if [v["id"] for v in after] != sorted(base, key=lambda k: base[k]["i"]): bad.append("tập hoặc thứ tự id đổi so với pool trước (%d -> %d entry)" % (len(base), len(after)))
lost = kept = 0
for v in after:
    b = base.get(v["id"])
    if not b: continue
    if v.get("styles") != v.get("tags"): bad.append("%s: styles != tags" % v["id"])
    rest = {k: x for k, x in v.items() if k not in ("styles", "tags")}
    if hashlib.sha256(json.dumps(rest, sort_keys=True, ensure_ascii=False).encode()).hexdigest() != b["rest"]: bad.append("%s: trường khác ngoài styles/tags đổi" % v["id"])
    want = b["styles"] if v["id"] in has_text else [t for t in b["styles"] if t != "minimalist"]
    if v["id"] in has_text and "minimalist" in b["styles"]: kept += 1
    if "minimalist" in b["styles"] and v["id"] not in has_text: lost += 1
    if v["styles"] != want: bad.append("%s: styles=%s, mong %s" % (v["id"], v["styles"], want))
if lost == 0: bad.append("baseline không có vendor nào mất minimalist (hỏng baseline hoặc dữ liệu nguồn)")
print(("PASS (minimalist: %d vendor mất, %d vendor giữ vì nguồn ghi tối giản/minimal)" % (lost, kept)) if not bad else "FAIL %d lỗi: %s" % (len(bad), "; ".join(bad[:6])[:800]))
sys.exit(0 if not bad else 1)
