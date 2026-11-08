#!/usr/bin/env python3
"""T-108 adv-08 (adversary, Code Gate v7, 2026-11-08). Mock, KHÔNG gọi Google (mọi HTTP bị chặn, không khoá API).
Spec T-106 v4.1 Hành vi 2, G6: "trong các vendor đã qua G1 đến G5 của cùng thành phố (MỌI category file; cùng id ở nhiều category là MỘT vendor),
nếu hai vendor có cùng place_id mà address_match địa chỉ gốc = false và hai chuỗi gốc sau A1 khác nhau thì mọi vendor trong nhóm bị từ chối";
và "kết quả cuối không đổi khi đảo thứ tự".
Ca: venue V (gốc '100 Lê Lợi, Quận 1', Google '100 Lê Lợi, Bến Thành, Hồ Chí Minh', conf 0,9: qua G1-G5) và photography X (id KHÁC, bản ghi mới có
address_source 'Khu đô thị Sala, Thủ Đức' không rút được số nhà, CÙNG place_id, conf 0,97 >= 0,95: qua G1-G5). Hai địa chỉ gốc khác nhau, chung place_id.
Chạy đúng lệnh workflow (--state HCMC --category venue) offline. Mong đợi: V bị hạ shared_place_id (low_confidence, không place_id, không ảnh Google,
một dòng review venue). Đối chứng: V một mình (không X) vẫn được nhận.
In PASS hoặc FAIL <lý do>; thoát 0/1. Cần TOHONG_REPO."""
import contextlib, io, json, os, sys
from unittest import mock
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-106"))
import _common as c  # noqa: E402
import _adv_harness as h  # noqa: E402

P = "ChIJ_adv08_shared"
GA = "100 Lê Lợi, Bến Thành, Hồ Chí Minh"


def rec(i, name, src, conf, cat):
    r = h.vendor(i, name, GA, (cat,))
    r["contact"]["address_source"] = src
    r["google_photos"] = [{"uri": "https://lh3.googleusercontent.com/adv08-" + i, "attribution": "tác giả"}]
    r["geo_confidence"] = "exact"
    r["enrichment_log"] = [{"source": "google_maps", "timestamp": "2026-11-08T04:03:36", "matched_name": "Nhà hàng Lê Lợi", "confidence": conf,
                            "place_id": P, "formatted_address": GA, "address_match": c.address_match(src, GA), "changes": {"address": GA}}]
    return r


def run(with_x):
    files = {"venue": [rec("adv08_V", "Nhà hàng Lê Lợi", "100 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh", 0.9, "venue")]}
    if with_x:
        files["photography"] = [rec("adv08_X", "Studio Lê Lợi", "Khu đô thị Sala, Thủ Đức, Thành phố Hồ Chí Minh", 0.97, "photography")]
    root = h.make_root(files)
    vd = root / "output" / "HCMC" / "venue"
    (vd / "enrichment-audit.json").write_text(json.dumps([{"vendor_id": "adv08_V", "status": "enriched", "matched_name": "Nhà hàng Lê Lợi",
                                                         "confidence": 0.9, "place_id": P, "formatted_address": GA}]), encoding="utf-8")

    def boom(*a, **k):
        raise AssertionError("eval cấm HTTP")
    env = {k: v for k, v in os.environ.items() if k != "GOOGLE_MAPS_API_KEY"}
    with mock.patch.object(h.enrich, "SCRIPT_DIR", root), mock.patch.object(h.enrich, "OUTPUT_DIR", root / "output"), \
            mock.patch("enrichment.google_maps.requests.post", side_effect=boom), mock.patch("requests.get", side_effect=boom), \
            mock.patch.object(sys, "argv", ["enrich.py", "--state", "HCMC", "--category", "venue", "--budget", "5.0"]), \
            mock.patch.dict(os.environ, env, clear=True), contextlib.redirect_stdout(io.StringIO()):
        try:
            h.enrich.main()
        except SystemExit:
            pass
    v = next(x for x in h.vendors_in(root, "venue") if x["id"] == "adv08_V")
    return v, h.audit(root).get("adv08_V") or {}, h.review_ids(root)


v0, a0, _ = run(False)
if not c.google_log(v0):
    c.fail("đối chứng hỏng: V một mình lẽ ra được nhận nhưng bị hạ (%r)" % a0.get("reject_reason"))
for i, x in (("G6", None),):
    v, a, rv = run(True)
    p = []
    if c.google_log(v): p.append("V còn place_id")
    if v.get("google_photos"): p.append("V còn google_photos")
    if a.get("status") != "low_confidence" or a.get("reject_reason") != "shared_place_id":
        p.append("audit V status=%r reject_reason=%r" % (a.get("status"), a.get("reject_reason")))
    if "adv08_V" not in rv: p.append("V không có dòng review venue")
    if p:
        c.fail("G6 không xét vendor ở category khác cùng thành phố: venue V và photography X (id khác, địa chỉ gốc khác) chung place_id %s, "
               "spec bắt hạ cả nhóm nhưng: %s" % (P, "; ".join(p)))
c.ok("G6 xét cả vendor ở category khác: V bị hạ shared_place_id khi photography X chung place_id với địa chỉ gốc khác; V một mình vẫn được nhận")
