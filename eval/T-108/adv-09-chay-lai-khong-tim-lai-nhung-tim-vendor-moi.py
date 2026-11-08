#!/usr/bin/env python3
"""T-108 adv-09 (adversary, Code Gate v7, 2026-11-08). Mock, KHÔNG gọi Google (Text Search giả).
Hành vi Engineering đổi ở v7: vendor đã có dòng audit (kể cả no_match/low_confidence) không được tìm lại khi chạy lại. Spec T-106 v4.1 "Áp lại" bắt chạy lại
đúng lệnh workflow trên dữ liệu đã enrich phải 0 lượt Text Search, nên bỏ qua vendor đã thử là cần. Eval chặn mặt trái: bỏ qua QUÁ TAY.
Ca (một file venue): A đã no_match, B đã low_confidence (luật cũ, candidate_place_id rỗng), C đã enriched, D MỚI (không dòng audit, chưa từng thử).
Mong đợi khi chạy lại: Text Search đúng 1 lượt và là của D; D được nhận; A, B, C giữ nguyên trạng thái audit; dòng cuối GOOGLE_USAGE text_search=1;
chạy lần ba: 0 lượt. In PASS hoặc FAIL <lý do>; thoát 0/1. Cần TOHONG_REPO."""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-106"))
import _common as c  # noqa: E402
import _adv_harness as h  # noqa: E402

GA = "12 Pasteur, Sài Gòn, Hồ Chí Minh"
A = h.vendor("adv09_A", "Nhà hàng Alpha Zeta", "1 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh")
B = h.vendor("adv09_B", "Nhà hàng Beta Zeta", "2 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh")
C_ = h.vendor("adv09_C", "Nhà hàng Gamma Zeta", "3 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh")
D = h.vendor("adv09_D", "Nhà hàng Delta Zeta", "12 Pasteur, Quận 1, Thành phố Hồ Chí Minh")
for v in (A, B, C_, D):
    v["contact"]["address_source"] = v["contact"]["address"]
C_["enrichment_log"] = [{"source": "google_maps", "timestamp": "2026-11-08T04:03:36", "matched_name": "Nhà hàng Gamma Zeta", "confidence": 1.0,
                         "place_id": "ChIJ_adv09_C", "formatted_address": "3 Lê Lợi, Bến Thành, Hồ Chí Minh", "address_match": True, "changes": {}}]
C_["contact"]["address"] = "3 Lê Lợi, Bến Thành, Hồ Chí Minh"
C_["geo_confidence"] = "exact"
root = h.make_root({"venue": [A, B, C_, D]})
vd = root / "output" / "HCMC" / "venue"
(vd / "enrichment-audit.json").write_text(json.dumps([
    {"vendor_id": "adv09_A", "status": "no_match", "reason": "no results"},
    {"vendor_id": "adv09_B", "status": "low_confidence", "matched_name": "Beta Khác", "confidence": 0.3, "place_id": None,
     "formatted_address": "99 Hai Bà Trưng, Sài Gòn, Hồ Chí Minh", "address_match": False, "reject_reason": "low_score", "candidate_place_id": ""},
    {"vendor_id": "adv09_C", "status": "enriched", "matched_name": "Nhà hàng Gamma Zeta", "confidence": 1.0, "place_id": "ChIJ_adv09_C",
     "formatted_address": "3 Lê Lợi, Bến Thành, Hồ Chí Minh"}], ensure_ascii=False), encoding="utf-8")
places = {n: [h.place("ChIJ_adv09_" + n[10], n, "%s Lê Lợi, Bến Thành, Hồ Chí Minh" % k)] for n, k in
          (("Nhà hàng Alpha Zeta", 1), ("Nhà hàng Beta Zeta", 2), ("Nhà hàng Gamma Zeta", 3))}
places["Nhà hàng Delta Zeta"] = [h.place("ChIJ_adv09_D", "Nhà hàng Delta Zeta", GA)]
rc, out, calls = h.run_enrich(root, places)
bad = []
if len(calls) != 1 or "Delta" not in calls[0]:
    bad.append("Text Search %d lượt %r, mong đúng 1 lượt cho vendor mới D" % (len(calls), [q[:30] for q in calls]))
last = [l for l in out.strip().splitlines() if l.strip()][-1:] or [""]
if not last[0].startswith("GOOGLE_USAGE text_search=1 "):
    bad.append("dòng cuối %r" % last[0][:80])
au = h.audit(root)
for i, st in (("adv09_A", "no_match"), ("adv09_B", "low_confidence"), ("adv09_C", "enriched")):
    if (au.get(i) or {}).get("status") != st:
        bad.append("%s audit %r, mong giữ %s" % (i, (au.get(i) or {}).get("status"), st))
d = next(x for x in h.vendors_in(root, "venue") if x["id"] == "adv09_D")
if not c.google_log(d) or (au.get("adv09_D") or {}).get("status") not in ("ok", "enriched"):
    bad.append("vendor mới D không được nhận (audit %r)" % (au.get("adv09_D") or {}).get("status"))
rc3, out3, calls3 = h.run_enrich(root, places)
if calls3:
    bad.append("chạy lần ba vẫn tốn %d lượt Text Search" % len(calls3))
if bad:
    c.fail("chạy lại: " + "; ".join(bad))
c.ok("chạy lại chỉ tìm vendor mới (1 lượt), không tìm lại no_match/low_confidence/enriched; lần ba 0 lượt")
