#!/usr/bin/env python3
"""T-073 tiêu chí 3: sau enrichment, style_tags của vendor = kết quả extractor trên văn bản nguồn (thay thế, không cộng thêm, không tự củng cố tag cũ).
Đo qua đầu vào/đầu ra của pipeline: đưa danh sách vendor vào EnrichmentPipeline.run(), Google Maps (ranh giới ngoài, gọi thật tốn tiền) được giả lập
bằng cách thay GoogleMapsEnricher.enrich trả kết quả cố định; so style_tags và enrichment_log của vendor SAU run(). Không gọi hàm nội bộ.
Chạy: python3 -I eval/T-073/check_3.py   (repo tohong: TOHONG_REPO, mặc định ../tohong). In PASS hoặc FAIL <lý do>."""
import copy, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
root = c.tohong(); c.scraper_on_path(root)
from enrichment.pipeline import EnrichmentPipeline
from enrichment.google_maps import EnrichmentResult
from extractors.style_tags import StyleTagExtractor
bad = []

def make_pipe(fields):
    pipe = EnrichmentPipeline(dry_run=True)
    pipe.dry_run = False
    pipe.gmaps.enrich = lambda v: EnrichmentResult(v["id"], status="enriched", enriched_fields=dict(fields), matched_name="x", confidence=0.9, place_id="p")
    return pipe

def run(vendor, fields):
    v = copy.deepcopy(vendor)
    make_pipe(fields).run([v])
    return v

def case(label, vendor, fields, want, removed=None, added=None):
    try:
        v = run(vendor, fields)
    except Exception as e:
        bad.append("%s: lỗi %s" % (label, repr(e)[:80])); return None
    if not v.get("enrichment_log"): bad.append("%s: vendor không được enrich (không có enrichment_log)" % label); return v
    if v.get("style_tags") != want: bad.append("%s: style_tags=%s, mong %s" % (label, v.get("style_tags"), want))
    ch = v["enrichment_log"][-1]["changes"]
    if removed is not None and ch.get("style_tags_removed", []) != removed: bad.append("%s: style_tags_removed=%s, mong %s" % (label, ch.get("style_tags_removed"), removed))
    if added is not None and ch.get("style_tags_added", []) != added: bad.append("%s: style_tags_added=%s, mong %s" % (label, ch.get("style_tags_added"), added))
    return v

base = {"id": "t073", "name": "Studio A", "description": "", "categories": ["photography"], "city": "HCMC", "latitude": 10.77, "longitude": 106.7,
        "contact": {"address": "1 Lê Lợi, Quận 1"}, "style_tags": [], "reviews": [], "flags": []}
# 1. tag cũ 'minimalist' gắn nhầm vì 'tinh tế' bị bỏ; luxury có bằng chứng trong text mới thì giữ
case("bỏ minimalist cũ, giữ luxury", dict(base, style_tags=["minimalist", "luxury"]), {"merchant_description": "Không gian tinh tế, sang trọng"},
     ["luxury"], removed=["minimalist"], added=[])
# 2. tag cũ không còn bằng chứng nào trong text -> mất (tính từ đầu), kể cả khi lần này không có text mới
case("không text -> rỗng", dict(base, style_tags=["minimalist", "korean"]), {}, [], removed=["minimalist", "korean"])
# 3. tối giản có bằng chứng -> giữ
case("tối giản giữ nguyên", dict(base, description="phong cách tối giản", style_tags=["minimalist"]), {}, ["minimalist"], removed=[], added=[])
# 4. tag mới từ text enrich được thêm; tag cũ vô căn cứ bị bỏ
case("thêm mới, bỏ cũ", dict(base, style_tags=["rustic"]), {"merchant_description": "Phong cách hiện đại"}, ["modern"], removed=["rustic"], added=["modern"])
# 5. chạy lần hai cho cùng kết quả (idempotent); thứ tự = thứ tự extractor trả cho văn bản nguồn
v1 = case("lần 1", dict(base, style_tags=["simple", "minimalist"], description="sang trọng, hiện đại"), {"merchant_description": "tinh tế"}, ["luxury", "modern"])
if v1 is not None:
    v2 = run(v1, {"merchant_description": "tinh tế"})
    if v2.get("style_tags") != v1.get("style_tags"): bad.append("chạy lần hai đổi kết quả: %s -> %s" % (v1.get("style_tags"), v2.get("style_tags")))
    src = {k: v1.get(k) for k in ("name", "description", "merchant_description", "top_reviews")}
    if v1.get("style_tags") != StyleTagExtractor().extract({k: (x if x is not None else ([] if k == "top_reviews" else "")) for k, x in src.items()}):
        bad.append("style_tags %s không bằng kết quả extractor trên văn bản nguồn (thứ tự hoặc nội dung)" % v1.get("style_tags"))
# 6. không đổi gì thì log không có khoá thay đổi style
v = run(dict(base, description="sang trọng", style_tags=["luxury"]), {"merchant_description": "x"})
ch = (v.get("enrichment_log") or [{"changes": {}}])[-1]["changes"]
if ch.get("style_tags_removed") or ch.get("style_tags_added"): bad.append("không đổi mà log vẫn ghi: %s" % ch)
# 7. chuỗi thô chưa làm sạch (tên gói marry) vẫn cho tín hiệu; tag chuẩn cũ không tự củng cố
case("tên gói thô -> luxury", dict(base, style_tags=["Gói dịch vụ chủ đề LUXURY PARTY"]), {"merchant_description": "x"}, ["luxury"], added=["luxury"])
print("PASS" if not bad else "FAIL " + "; ".join(bad)[:900])
sys.exit(0 if not bad else 1)
