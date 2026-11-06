#!/usr/bin/env python3
"""T-075 tầng 3 (adversary). Spec T-073 Định nghĩa dùng chung: "chuỗi thô" = phần tử style_tags KHÔNG trùng nguyên văn tag chuẩn (so khớp đúng
  từng ký tự, Spec Gate: tag thô 'Luxury' không bị loại); tag chuẩn trùng nguyên văn bị bỏ qua. Hành vi 3: enrichment chạy lại cho cùng kết quả.
Input biên: 'Luxury', 'MINIMALIST', ' minimalist' (dấu cách), tên gói lẫn tag chuẩn, phần tử không phải chuỗi (None, số, dict), chuỗi rỗng;
  "tinh tế" với tab / nbsp / không dấu; văn bản rỗng toàn bộ. Enrichment: style_tags lẫn phần tử lạ (không phải chuỗi) không làm vỡ run(), chạy hai lần cùng kết quả.
  (Không đưa chuỗi thô vào ca enrichment: spec T-073 Hành vi 3 "thay thế hoàn toàn" + "chạy lại cùng kết quả" mâu thuẫn khi đầu vào có
  chuỗi thô, lần 1 dùng rồi xoá tên gói, lần 2 mất tag; adversary ghi nhận, chưa phải lỗi code.)
Chạy: python3 -I eval/T-075/adv-04-chuoi-tho-va-phan-tu-la.py. Repo: TOHONG_REPO."""
import copy, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-073"))
import _common as c
c.scraper_on_path(c.tohong())
from extractors.style_tags import StyleTagExtractor
ex = StyleTagExtractor(); bad = []
def e(**f):
    v = {"name": "", "description": "", "merchant_description": "", "top_reviews": []}; v.update(f)
    try: return ex.extract(v)
    except Exception as x: return "EXC %r" % x
for st, want in ((["Luxury"], ["luxury"]), (["MINIMALIST"], ["minimalist"]), ([" minimalist"], ["minimalist"]),
                 (["minimalist", "Gói dịch vụ chủ đề LUXURY PARTY"], ["luxury"]), ([None, 5, {"a": 1}, ""], []),
                 (["luxury", "minimalist", "korean"], []), ([], [])):
    got = e(style_tags=st)
    if got != want: bad.append("style_tags=%r -> %r, mong %r" % (st, got, want))
for d in ("tinh\ttế", "tinh tế", "TINH TE", "Tinh Tế tinh tế", "không gian tinh tế, sang trọng"):
    got = e(description=d)
    if not isinstance(got, list) or "minimalist" in got: bad.append("description=%r -> %r (không được ra minimalist)" % (d, got))
from enrichment.pipeline import EnrichmentPipeline
from enrichment.google_maps import EnrichmentResult
pipe = EnrichmentPipeline(dry_run=True); pipe.dry_run = False
pipe.gmaps.enrich = lambda v: EnrichmentResult(v["id"], status="enriched", enriched_fields={"merchant_description": "tinh tế"}, matched_name="x", confidence=0.9, place_id="p")
base = {"id": "adv04", "name": "Studio", "description": "phong cách Hàn Quốc", "categories": ["photography"], "city": "HCMC", "latitude": 10.77,
        "longitude": 106.7, "contact": {"address": "1 Lê Lợi"}, "style_tags": ["minimalist", None, "", 3, {"a": 1}], "reviews": [], "flags": []}
v = copy.deepcopy(base)
try:
    pipe.run([v]); first = list(v.get("style_tags") or []); pipe.run([v])
    if v.get("style_tags") != first: bad.append("enrichment lần hai đổi: %r -> %r" % (first, v.get("style_tags")))
    if "minimalist" in first: bad.append("enrichment giữ minimalist chỉ vì tag cũ/tinh tế: %r" % first)
    if any(not isinstance(x, str) for x in first): bad.append("enrichment để lại phần tử không phải chuỗi: %r" % first)
except Exception as x:
    bad.append("enrichment vỡ với phần tử lạ trong style_tags: %r" % x)
if bad: print("FAIL " + " | ".join(bad)); sys.exit(1)
print("PASS")
