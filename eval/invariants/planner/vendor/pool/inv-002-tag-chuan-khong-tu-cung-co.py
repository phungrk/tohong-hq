#!/usr/bin/env python3
"""Nguồn: T-073 (spec products/T-073-tag-minimalist-tinh-te.md v2, Định nghĩa dùng chung + Hành vi 1, 3; qua Spec Gate 2026-11-06, spec-critic).
Bất biến (planner/vendor/pool): tag phong cách không tự củng cố. Kết quả gắn tag của một vendor chỉ phụ thuộc văn bản của vendor;
  tag chuẩn đã gắn từ trước (korean, luxury, rustic, natural, editorial, soft, traditional, modern, minimalist, simple) nằm trong
  style_tags không bao giờ góp phần ra tag. Đo trên extractor của repo tohong:
  (a) với mỗi bản ghi trong tools/scraper/output/HCMC/*/vendors.json: extract(văn bản) == extract(văn bản + style_tags = cả 10 tag chuẩn)
      == extract(văn bản + style_tags = extract(văn bản));
  (b) vendor không có văn bản, style_tags=["minimalist"] -> rỗng; style_tags=cả 10 tag chuẩn -> rỗng.
  (Chuỗi thô không trùng tag chuẩn, vd tên gói "Gói dịch vụ chủ đề LUXURY PARTY", vẫn là tín hiệu: bất biến này không đụng tới.)
CHƯA ÁP DỤNG khi pool trong tohong-back vẫn là bản @6a9a9c7 (trước T-073): in "PASS chưa áp dụng".
  Muốn bỏ hay đổi điều kiện này phải qua Chief of Staff và ghi decisions/.
Chạy: python3 -I <file>. Repo: TOHONG_REPO (mặc định ../tohong), TOHONG_BACK_REPO (mặc định ../tohong-back). Thiếu repo: PASS 'chưa áp dụng'."""
import glob, json, os, subprocess, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), *[".."] * 5))
BASE = "6a9a9c707f35592fc9c3845613ba8cf38655f5c9"
CANON = ["korean", "luxury", "rustic", "natural", "editorial", "soft", "traditional", "modern", "minimalist", "simple"]
def find(env, marker, sib):
    for c in (os.environ.get(env), os.path.join(HQ, "..", sib)):
        if c and os.path.isfile(os.path.join(c, marker)): return os.path.abspath(c)
t = find("TOHONG_REPO", "tools/scraper/extractors/style_tags.py", "tohong")
b = find("TOHONG_BACK_REPO", "lib/vendorPool.generated.js", "tohong-back")
if not t or not b:
    print("PASS chưa áp dụng (không tìm thấy repo tohong/tohong-back)"); sys.exit(0)
def git(*a):
    r = subprocess.run(["git", "-C", b] + list(a), capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None
old = git("rev-parse", BASE + ":lib/vendorPool.generated.js")
if old and old == git("hash-object", "lib/vendorPool.generated.js"):
    print("PASS chưa áp dụng (pool vẫn là bản @6a9a9c7, T-073 chưa ship)"); sys.exit(0)
sys.path.insert(0, os.path.join(t, "tools", "scraper"))
from extractors.style_tags import StyleTagExtractor
ex = StyleTagExtractor()
bad = []
def e(**f):
    v = {"name": "", "description": "", "merchant_description": "", "top_reviews": []}; v.update(f)
    return sorted(ex.extract(v))
for st in (["minimalist"], list(CANON)):
    if e(style_tags=st): bad.append("không văn bản, style_tags=%s -> %s (phải rỗng)" % (st, e(style_tags=st)))
n = 0
for f in glob.glob(os.path.join(t, "tools/scraper/output/HCMC/*/vendors.json")):
    d = json.load(open(f, encoding="utf-8")); d = d["vendors"] if isinstance(d, dict) else d
    for v in d:
        n += 1
        txt = {"name": v.get("name") or "", "description": v.get("description") or "",
               "merchant_description": v.get("merchant_description") or "", "top_reviews": v.get("top_reviews") or []}
        e0 = e(**txt)
        e1 = e(style_tags=list(CANON), **txt)
        e2 = e(style_tags=list(e0), **txt)
        if e1 != e0 or e2 != e0: bad.append("%s: văn bản -> %s, thêm tag chuẩn cũ -> %s / %s" % (v.get("id"), e0, e1, e2))
if n == 0:
    print("PASS chưa áp dụng (không có dữ liệu scrape)"); sys.exit(0)
print("PASS" if not bad else "FAIL %d lỗi: %s" % (len(bad), "; ".join(bad[:3])))
sys.exit(1 if bad else 0)
