#!/usr/bin/env python3
"""Nguồn: T-073 (spec products/T-073-tag-minimalist-tinh-te.md v2, qua Spec Gate 2026-11-06, spec-critic; đề xuất của product:
eval/T-073/inv-proposed-pool-khop-nguon.py).
Bất biến (planner/vendor/pool): mọi tag phong cách cặp đôi thấy trên vendor đều có bằng chứng trong văn bản của chính vendor đó.
  Với mỗi vendor của pool (tohong-back/lib/vendorPool.generated.js) có trong dữ liệu scrape:
  (a) styles == tags;
  (b) tập styles == hợp các tag mà extractor hiện hành cho ra từ văn bản nguồn của MỌI bản ghi cùng id trong
      tohong/tools/scraper/output/HCMC/*/vendors.json (name, description, merchant_description, top_reviews[].text; KHÔNG đọc style_tags).
  Tag không còn bằng chứng (luật extractor đổi mà không tạo lại pool, hoặc tag cũ nằm lại) và tag thiếu đều làm bất biến đỏ.
  Ghi chú: nếu sau này dữ liệu nguồn giữ lại tín hiệu tên gói thô (style_tags không phải tag chuẩn) thì (b) phải cập nhật qua Chief of Staff.
Chạy: python3 -I <file>. Repo: TOHONG_REPO (mặc định ../tohong cạnh tohong-hq), TOHONG_BACK_REPO (mặc định ../tohong-back).
Thiếu repo hoặc dữ liệu: PASS 'chưa áp dụng'."""
import glob, json, os, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), *[".."] * 5))
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
neq = [v["id"] for v in pool if v.get("styles") != v.get("tags")]
bad = [v["id"] for v in pool if v["id"] in src and set(v.get("styles") or []) != src[v["id"]]]
msg = []
if neq: msg.append("%d vendor có styles != tags, vd %s" % (len(neq), neq[:3]))
if bad:
    ex_id = bad[0]; ev = next(v for v in pool if v["id"] == ex_id)
    msg.append("%d vendor có styles lệch văn bản nguồn, vd %s: pool %s, nguồn %s" % (len(bad), ex_id, sorted(ev.get("styles") or []), sorted(src[ex_id])))
print("PASS" if not msg else "FAIL " + "; ".join(msg))
sys.exit(1 if msg else 0)
