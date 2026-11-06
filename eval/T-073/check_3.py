#!/usr/bin/env python3
"""T-073 tiêu chí 3: enrichment tính lại style_tags từ đầu (thay thế, không cộng thêm) và không tự củng cố tag cũ.
Chạy: python3 -I eval/T-073/check_3.py   (repo tohong: TOHONG_REPO, mặc định ../tohong). In PASS hoặc FAIL <lý do>."""
import copy, os, sys
from types import SimpleNamespace
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
root = c.tohong(); c.scraper_on_path(root)
from enrichment.pipeline import EnrichmentPipeline
from extractors.style_tags import StyleTagExtractor, KEYWORD_MAP
pipe = EnrichmentPipeline(dry_run=True)
bad = []

def run(vendor, fields):
    v = copy.deepcopy(vendor)
    res = SimpleNamespace(enriched_fields=fields, matched_name="x", confidence=0.9, place_id="p")
    pipe._apply_enrichment(v, res, source="google_maps")
    return v

def case(label, vendor, fields, want, removed=None, added=None):
    try:
        v = run(vendor, fields)
    except Exception as e:
        bad.append("%s: lỗi %s" % (label, repr(e)[:80])); return
    if v.get("style_tags") != want: bad.append("%s: style_tags=%s, mong %s" % (label, v.get("style_tags"), want))
    ch = v["enrichment_log"][-1]["changes"]
    if removed is not None and ch.get("style_tags_removed", []) != removed: bad.append("%s: style_tags_removed=%s, mong %s" % (label, ch.get("style_tags_removed"), removed))
    if added is not None and ch.get("style_tags_added", []) != added: bad.append("%s: style_tags_added=%s, mong %s" % (label, ch.get("style_tags_added"), added))
    return v

base = {"id": "t073", "name": "Studio A", "description": "", "categories": ["photography"], "contact": {}, "style_tags": []}
# 1. tag cũ 'minimalist' gắn nhầm vì 'tinh tế' bị bỏ; luxury có bằng chứng trong text mới thì giữ
case("bỏ minimalist cũ, giữ luxury", dict(base, style_tags=["minimalist", "luxury"]), {"merchant_description": "Không gian tinh tế, sang trọng"},
     ["luxury"], removed=["minimalist"], added=[])
# 2. tag cũ không còn bằng chứng nào trong text -> mất (tính từ đầu), kể cả khi lần này không có text mới
case("không text -> rỗng", dict(base, style_tags=["minimalist", "korean"]), {}, [], removed=["minimalist", "korean"])
# 3. tối giản có bằng chứng -> giữ
case("tối giản giữ nguyên", dict(base, description="phong cách tối giản", style_tags=["minimalist"]), {}, ["minimalist"], removed=[], added=[])
# 4. tag mới từ text enrich được thêm; tag cũ vô căn cứ bị bỏ
case("thêm mới, bỏ cũ", dict(base, style_tags=["rustic"]), {"merchant_description": "Phong cách hiện đại"}, ["modern"], removed=["rustic"], added=["modern"])
# 5. chạy lần hai cho cùng kết quả (idempotent), thứ tự theo extractor
v1 = case("lần 1", dict(base, style_tags=["simple", "minimalist"], description="sang trọng, hiện đại"), {"merchant_description": "tinh tế"}, ["luxury", "modern"])
if v1 is not None:
    v2 = run(v1, {"merchant_description": "tinh tế"})
    if v2.get("style_tags") != v1.get("style_tags"): bad.append("chạy lần hai đổi kết quả: %s -> %s" % (v1.get("style_tags"), v2.get("style_tags")))
    order = list(KEYWORD_MAP)
    if v1.get("style_tags") != sorted(v1.get("style_tags", []), key=order.index): bad.append("thứ tự không theo extractor")
# 6. không đổi gì thì log không có khoá thay đổi style
v = run(dict(base, description="sang trọng", style_tags=["luxury"]), {"merchant_description": "x"})
ch = v["enrichment_log"][-1]["changes"]
if ch.get("style_tags_removed") or ch.get("style_tags_added"): bad.append("không đổi mà log vẫn ghi: %s" % ch)
print("PASS" if not bad else "FAIL " + "; ".join(bad)[:900])
sys.exit(0 if not bad else 1)
