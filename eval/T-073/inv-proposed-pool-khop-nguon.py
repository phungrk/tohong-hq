#!/usr/bin/env python3
"""ĐỀ XUẤT bất biến (planner/vendor/pool) · nguồn: T-073 (spec products/T-073-tag-minimalist-tinh-te.md).
Mọi tag trong styles/tags của pool đều có bằng chứng trong văn bản nguồn: với mỗi vendor, styles == hợp các tag mà extractor hiện hành
cho ra từ từng bản ghi cùng id (name, description, merchant_description, top_reviews[].text; KHÔNG đọc style_tags cũ).
Tag không còn bằng chứng (vd extractor đổi luật) không được nằm lại trong pool. Chạy: python3 -I <file>. Repo: TOHONG_REPO, TOHONG_BACK_REPO.
Thiếu repo hoặc dữ liệu: PASS 'chưa áp dụng' (đây là bất biến, không phải eval của việc)."""
import glob, json, os, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
def find(env, marker, sib):
    for c in (os.environ.get(env), os.path.join(HQ, "..", sib)):
        if c and os.path.isfile(os.path.join(c, marker)): return os.path.abspath(c)
t = find("TOHONG_REPO", "tools/scraper/extractors/style_tags.py", "tohong")
b = find("TOHONG_BACK_REPO", "lib/vendorPool.generated.js", "tohong-back")
if not t or not b:
    print("PASS chưa áp dụng (không tìm thấy repo tohong/tohong-back)"); sys.exit(0)
sys.path.insert(0, os.path.join(t, "tools", "scraper"))
from extractors.style_tags import StyleTagExtractor
ex = StyleTagExtractor()
src = {}
for f in glob.glob(os.path.join(t, "tools/scraper/output/HCMC/*/vendors.json")):
    d = json.load(open(f, encoding="utf-8")); d = d["vendors"] if isinstance(d, dict) else d
    for v in d:
        tags = ex.extract({"name": v.get("name") or "", "description": v.get("description") or "",
                           "merchant_description": v.get("merchant_description") or "", "top_reviews": v.get("top_reviews") or []})
        src.setdefault(v["id"], set()).update(tags)
if not src:
    print("PASS chưa áp dụng (không có dữ liệu scrape)"); sys.exit(0)
s = open(os.path.join(b, "lib", "vendorPool.generated.js"), encoding="utf-8").read()
pool = json.loads(s[s.index("= [") + 2 : s.rindex("]") + 1])
bad = [v["id"] for v in pool if v["id"] in src and set(v["styles"]) != src[v["id"]]]
print("PASS" if not bad else "FAIL %d vendor có styles lệch văn bản nguồn, vd %s" % (len(bad), bad[:3]))
sys.exit(1 if bad else 0)
