#!/usr/bin/env python3
"""Nguồn: T-073 (ý định Capu issue #17; spec products/T-073-tag-minimalist-tinh-te.md v2, Hành vi 1; qua Spec Gate 2026-11-06, spec-critic).
Bất biến (planner/vendor/pool): "tinh tế" là sáo ngữ marketing, không phải bằng chứng phong cách tối giản.
  Văn bản chỉ có "tinh tế" (mọi kiểu hoa/thường, có hay không dấu, nhiều dấu cách; ở name, description, merchant_description, review)
  và không có dấu hiệu tối giản (t[ốo]i gi[ảa]n / minimalist / minimal) thì extractor KHÔNG ra minimalist;
  có dấu hiệu tối giản thì ra minimalist, kể cả khi đi kèm "tinh tế".
CHƯA ÁP DỤNG khi pool trong tohong-back vẫn là bản @6a9a9c7 (trước T-073): in "PASS chưa áp dụng".
  Muốn bỏ hay đổi điều kiện này phải qua Chief of Staff và ghi decisions/.
Chạy: python3 -I <file>. Repo: TOHONG_REPO (mặc định ../tohong), TOHONG_BACK_REPO (mặc định ../tohong-back). Thiếu repo: PASS 'chưa áp dụng'."""
import os, subprocess, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), *[".."] * 5))
BASE = "6a9a9c707f35592fc9c3845613ba8cf38655f5c9"
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
def has_min(**f):
    v = {"name": "", "description": "", "merchant_description": "", "top_reviews": []}; v.update(f)
    return "minimalist" in ex.extract(v)
bad = []
for txt in ["tinh tế", "Tinh Tế", "TINH TẾ", "tinh te", "tinh tê", "tinh  tế", "không gian tinh tế, sang trọng"]:
    for field in ("name", "description", "merchant_description"):
        if has_min(**{field: txt}): bad.append("%s=%r ra minimalist" % (field, txt))
    if has_min(top_reviews=[{"text": txt}]): bad.append("review %r ra minimalist" % txt)
for txt in ["tinh tế và tối giản", "phong cách tối giản", "minimalist", "minimal style"]:
    if not has_min(description=txt): bad.append("description=%r không ra minimalist" % txt)
print("PASS" if not bad else "FAIL " + "; ".join(bad[:6]))
sys.exit(1 if bad else 0)
