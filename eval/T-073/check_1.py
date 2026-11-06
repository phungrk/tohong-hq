#!/usr/bin/env python3
"""T-073 tiêu chí 1: 'không gian tinh tế' qua extractor không ra minimalist; 'phong cách tối giản' ra minimalist; 9 tag còn lại không đổi.
Chạy: python3 -I eval/T-073/check_1.py   (repo tohong: TOHONG_REPO, mặc định ../tohong). In PASS hoặc FAIL <lý do>."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
root = c.tohong(); c.scraper_on_path(root)
from extractors.style_tags import StyleTagExtractor
ex = StyleTagExtractor()
bad = []

def tags(**f):
    v = {"name": "", "description": "", "merchant_description": "", "top_reviews": []}
    v.update(f)
    return set(ex.extract(v))

def want_no_min(label, **f):
    t = tags(**f)
    if "minimalist" in t: bad.append("%s -> %s (không được có minimalist)" % (label, sorted(t)))

def want_min(label, **f):
    t = tags(**f)
    if "minimalist" not in t: bad.append("%s -> %s (phải có minimalist)" % (label, sorted(t)))

# 'tinh tế' ở mọi nơi extractor đọc, mọi kiểu viết
for txt in ["không gian tinh tế", "Không Gian Tinh Tế", "KHÔNG GIAN TINH TẾ", "tinh tê", "tinh te", "tinh  tế", "Dịch vụ tinh tế, chu đáo"]:
    want_no_min("description=%r" % txt, description=txt)
want_no_min("name", name="Studio Tinh Tế")
want_no_min("merchant_description", merchant_description="Không gian tinh tế")
want_no_min("review", top_reviews=[{"text": "Không gian rất tinh tế", "source": "marry"}])
want_no_min("style_tags thô", style_tags=["Gói tinh tế"])
if tags(description="không gian tinh tế"):
    bad.append("'không gian tinh tế' đứng một mình phải ra danh sách rỗng, nhận %s" % sorted(tags(description="không gian tinh tế")))
# tối giản / minimal vẫn ra minimalist
for txt in ["phong cách tối giản", "Phong Cách TỐI GIẢN", "toi gian", "minimalist", "Minimalist wedding", "minimal style", "tinh tế và tối giản", "tối giản mà tinh tế"]:
    want_min("description=%r" % txt, description=txt)
want_min("name", name="Decor Tối Giản")
want_min("review", top_reviews=[{"text": "phong cách tối giản", "source": "marry"}])
# 9 tag còn lại: mỗi cụm cho đúng một tag; 'cao cấp' vẫn không ra tag nào
exact = {"phong cách Hàn Quốc": {"korean"}, "sang trọng": {"luxury"}, "mộc mạc": {"rustic"}, "ánh sáng tự nhiên": {"natural"},
         "editorial": {"editorial"}, "nhẹ nhàng": {"soft"}, "truyền thống": {"traditional"}, "hiện đại": {"modern"},
         "đơn giản": {"simple"}, "cao cấp": set()}
for txt, w in exact.items():
    got = tags(description=txt)
    if got != w: bad.append("%r -> %s, mong %s (tag khác không được đổi)" % (txt, sorted(got), sorted(w)))
print("PASS" if not bad else "FAIL " + "; ".join(bad)[:900])
sys.exit(0 if not bad else 1)
